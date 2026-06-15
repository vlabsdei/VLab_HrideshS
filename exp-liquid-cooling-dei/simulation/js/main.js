
// ══════════════════════════════════
// STATE
// ══════════════════════════════════
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const graphCanvas = document.getElementById('graphCanvas');
const gctx = graphCanvas.getContext('2d');
let W = 0, H = 0;
let flow = 1.5, heat = 500, Tin = 25;
let paused = false, showLabels = false, showCalc = false;
let observations = [], frame = 0, pumpAngle = 0;
let lastTime = performance.now();

// ══════════════════════════════════
// PHYSICS
// ══════════════════════════════════
const Cp = 4186, rho = 998;
function massFlow(f) { return (f / 60000) * rho; }
function calcTout(f, q, tin) { return tin + q / (massFlow(f) * Cp); }
function calcRth(f) { return 0.006 + 0.075 / (f + 0.25); } // K/W — hyperbolic, diminishing returns
function calcTgpu(f, q, tin) { return tin + q * calcRth(f); }
function calcCoolant(f, q) { return f * (0.5 + (q / 1000) * 0.5); }

// ══════════════════════════════════
// RESIZE
// ══════════════════════════════════
function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  W = canvas.width; H = canvas.height;
  if (graphCanvas) {
    graphCanvas.width = graphCanvas.clientWidth * devicePixelRatio;
    graphCanvas.height = graphCanvas.clientHeight * devicePixelRatio;
  }
}
window.addEventListener('resize', resize);

// ══════════════════════════════════
// LAYOUT — compact, centered
// ══════════════════════════════════
function getLayout() {
  const dpr = devicePixelRatio;
  // Canvas center is anchor. Positions as fraction of W,H
  return {
    gpu: { x: W * 0.28, y: H * 0.50 },
    pump: { x: W * 0.14, y: H * 0.74 },
    hx: { x: W * 0.68, y: H * 0.22 },
    dpr
  };
}

function buildPath(gpu, pump, hx) {
  const dpr = devicePixelRatio;
  return [
    // 1. Inlet (off-screen left) to Pump
    { x: 0, y: pump.y },
    { x: pump.x, y: pump.y },
    // 2. Pump to Cold Plate inlet (goes up left of GPU, enters cold plate left)
    { x: pump.x, y: gpu.y - 43 * dpr },
    { x: gpu.x - 55 * dpr, y: gpu.y - 43 * dpr },
    // 3. Through Cold Plate (left to right)
    { x: gpu.x + 55 * dpr, y: gpu.y - 43 * dpr },
    // 4. Cold Plate outlet to Heat Exchanger inlet (goes right, down to bottom, and up to HX)
    { x: gpu.x + 75 * dpr, y: gpu.y - 43 * dpr },
    { x: gpu.x + 75 * dpr, y: pump.y + H * 0.04 },
    { x: W * 0.50, y: pump.y + H * 0.04 },
    { x: W * 0.78, y: pump.y - H * 0.05 },
    { x: W * 0.78, y: hx.y + H * 0.08 },
    { x: hx.x + W * 0.08, y: hx.y + H * 0.04 },
    // 5. Through Heat Exchanger (right to left)
    { x: hx.x, y: hx.y },
    { x: hx.x - W * 0.08, y: hx.y - H * 0.03 },
    // 6. Heat Exchanger outlet to Drain/Outlet (off-screen left)
    { x: 0, y: hx.y - H * 0.03 }
  ];
}

function interp(pts, t) {
  t = ((t % 1) + 1) % 1;
  const n = pts.length - 1, p = t * n, i = Math.floor(p), f = p - i;
  const a = pts[Math.min(i, n - 1)], b = pts[Math.min(i + 1, n)];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

// Heat fraction along path — physically tied to flow+heat
function heatFrac(t, f, q) {
  const dT = calcTout(f, q, 0), dTmax = calcTout(0.5, 1000, 0);
  const relHeat = Math.min(1, dT / dTmax);
  let fr = 0;
  if (t < 0.23) {
    fr = 0;
  } else if (t < 0.31) {
    fr = (t - 0.23) / (0.31 - 0.23);
  } else if (t < 0.77) {
    fr = 1.0;
  } else if (t < 0.92) {
    fr = 1.0 - (t - 0.77) / (0.92 - 0.77);
  } else {
    fr = 0;
  }
  return fr * relHeat;
}

// ══════════════════════════════════
// PARTICLES
// ══════════════════════════════════
const PARTS = Array.from({ length: 110 }, (_, i) => ({ t: i / 110, trail: [] }));
const PLUMES = Array.from({ length: 35 }, () => newPlume());
function newPlume() { return { ox: (Math.random() - .5), vx: (Math.random() - .5) * .3, vy: -(0.3 + Math.random() * .7), life: Math.random(), mxL: .8 + Math.random() * .4, sz: 3 + Math.random() * 5 }; }
const SPARKS = Array.from({ length: 18 }, () => newSpark());
function newSpark() { return { ox: (Math.random() - .5), oy: (Math.random() - .5), vx: (Math.random() - .5) * .5, vy: -(0.2 + Math.random() * .8), life: Math.random(), sz: 1 + Math.random() * 3 }; }

// ══════════════════════════════════
// COLOR HELPERS
// ══════════════════════════════════
function lerp3(a, b, t) { return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
const COLD = [14, 165, 233], WARM = [249, 115, 22], HOT = [239, 68, 68];
function coolColor(hf) { return hf < .5 ? lerp3(COLD, WARM, hf * 2) : lerp3(WARM, HOT, (hf - .5) * 2); }

function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ══════════════════════════════════
// DRAW: PIPE
// ══════════════════════════════════
function drawPipe(pts) {
  const dpr = devicePixelRatio;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const s = (c, lw) => {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle = c; ctx.lineWidth = lw * dpr; ctx.stroke();
  };
  s('#b0bec5', 20); s('#dce7ef', 16); s('rgba(186,230,253,.65)', 11); s('rgba(255,255,255,.3)', 4);
}

// ══════════════════════════════════
// DRAW: GPU — glow by actual T_gpu
// ══════════════════════════════════
function drawGPU(cx, cy, dpr) {
  const Tg = calcTgpu(flow, heat, Tin);
  const t = Math.max(0, Math.min(1, (Tg - 40) / 55));
  const w = 100 * dpr, h = 72 * dpr, x = cx - w / 2, y = cy - h / 2;
  // Glow
  const glowR = (50 + t * 75) * dpr;
  const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  gl.addColorStop(0, `rgba(239,68,68,${.04 + t * .28})`);
  gl.addColorStop(.4, `rgba(249,115,22,${(.04 + t * .28) * .5})`);
  gl.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill();
  // PCB
  rrect(x - 5 * dpr, y - 5 * dpr, w + 10 * dpr, h + 10 * dpr, 6 * dpr); ctx.fillStyle = '#1e3a2f'; ctx.fill();
  // Die
  rrect(x, y, w, h, 4 * dpr); ctx.fillStyle = '#1e293b'; ctx.fill();
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = dpr;
  for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 6, y); ctx.lineTo(x + w * i / 6, y + h); ctx.stroke(); }
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x, y + h * i / 4); ctx.lineTo(x + w, y + h * i / 4); ctx.stroke(); }
  // Heat overlay
  rrect(x, y, w, h, 4 * dpr);
  const hg = ctx.createLinearGradient(x, y + h, x, y);
  hg.addColorStop(0, `rgba(239,68,68,${.04 + t * .3})`); hg.addColorStop(1, 'rgba(239,68,68,0)');
  ctx.fillStyle = hg; ctx.fill();
  // Label + temp readout on die
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = `bold ${7 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.fillText('AI GPU', cx, cy - 6 * dpr);
  const tc = t < .4 ? '#4ade80' : t < .7 ? '#fbbf24' : '#f87171';
  ctx.fillStyle = tc; ctx.font = `bold ${9 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.fillText(Tg.toFixed(0) + '°C', cx, cy + 7 * dpr);
  
  
 
}

// ══════════════════════════════════
// DRAW: COLD PLATE
// ══════════════════════════════════
function drawCP(cx, cy, dpr) {
  const w = 110 * dpr, h = 14 * dpr, x = cx - w / 2, y = cy - 36 * dpr - h;
  const fn = (flow - 0.5) / 2.5;
  const t = 1 - fn;
  const r = Math.round(14 + t * 235), g2 = Math.round(165 + t * (-50)), b = Math.round(233 + t * (-211));
  rrect(x, y, w, h, 3 * dpr); ctx.fillStyle = `rgb(${r},${g2},${b})`; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = dpr;
  for (let i = 1; i < 10; i++) { ctx.beginPath(); ctx.moveTo(x + w * i / 10, y + 2 * dpr); ctx.lineTo(x + w * i / 10, y + h - 2 * dpr); ctx.stroke(); }
  rrect(x + 2 * dpr, y + 2 * dpr, w - 4 * dpr, 3 * dpr, 2 * dpr); ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fill();
}

// ══════════════════════════════════
// DRAW: PUMP
// ══════════════════════════════════
function drawPump(cx, cy, dpr) {
  const R = 26 * dpr;
  ctx.beginPath(); ctx.arc(cx, cy, R + 5 * dpr, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(cx, cy - R * .3, 0, cx, cy, R + 5 * dpr);
  hg.addColorStop(0, '#94a3b8'); hg.addColorStop(1, '#475569'); ctx.fillStyle = hg; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = '#1e293b'; ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(pumpAngle);
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate((i / 6) * Math.PI * 2);
    const bg = ctx.createLinearGradient(0, -2 * dpr, R * .85, -2 * dpr);
    bg.addColorStop(0, '#64748b'); bg.addColorStop(1, '#94a3b8'); ctx.fillStyle = bg;
    rrect(3 * dpr, -2.5 * dpr, R * .85 - 3 * dpr, 5 * dpr, 2 * dpr); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, 8 * dpr, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 3.5 * dpr, 0, Math.PI * 2); ctx.fillStyle = '#475569'; ctx.fill();
}

// ══════════════════════════════════
// DRAW: HX — gradient from actual Tout
// ══════════════════════════════════
function drawHX(cx, cy, dpr, ts) {
  const w = 148 * dpr, h = 62 * dpr, x = cx - w / 2, y = cy - h / 2;
  rrect(x + 3 * dpr, y + 3 * dpr, w, h, 5 * dpr); ctx.fillStyle = 'rgba(0,0,0,.07)'; ctx.fill();
  rrect(x, y, w, h, 5 * dpr);
  const Tout = calcTout(flow, heat, Tin);
  const tH = Math.max(0, Math.min(1, (Tout - Tin) / 50));
  const hr = Math.round(14 + tH * 225), hg = Math.round(165 + tH * (-97)), hb = Math.round(233 + tH * (-211));
  const gr = ctx.createLinearGradient(x, y, x + w, y);
  gr.addColorStop(0, '#e0f2fe');
  gr.addColorStop(1, `rgb(${hr},${hg},${hb})`);
  ctx.fillStyle = gr; ctx.fill();
  for (let i = 0; i < 11; i++) {
    const fx = x + 9 * dpr + i * ((w - 18 * dpr) / 11);
    const a = Math.sin(ts * 2 + i * .5) * .5 + .5;
    ctx.strokeStyle = `rgba(100,116,139,${.45 + a * .3})`; ctx.lineWidth = 2.5 * dpr; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fx, y + 7 * dpr); ctx.lineTo(fx, y + h - 7 * dpr); ctx.stroke();
  }
  rrect(x, y, w, h, 5 * dpr); ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1.5 * dpr; ctx.stroke();
  ctx.fillStyle = 'rgba(15,23,42,.65)'; ctx.font = `${6.5 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillText('COLD OUT', x + 4 * dpr, y + h - 4 * dpr);
  ctx.textAlign = 'right'; ctx.fillText('HOT IN', x + w - 4 * dpr, y + h - 4 * dpr);
}

// ══════════════════════════════════
// DRAW: PLUMES + SPARKS
// ══════════════════════════════════
function drawPlumes(hxCx, hxCy, dpr, dt) {
  const Tout = calcTout(flow, heat, Tin);
  const t = Math.max(0, Math.min(1, (Tout - Tin) / 50));
  const top = hxCy - 31 * dpr;
  for (const p of PLUMES) {
    p.life += dt * (0.3 + t * 0.7);
    if (p.life >= p.mxL) { Object.assign(p, newPlume()); p.life = 0; }
    const lf = p.life / p.mxL;
    const px = hxCx + p.ox * 148 * dpr * .45 + p.vx * p.life * 75 * dpr;
    const py = top + p.vy * p.life * 75 * dpr - 8 * dpr;
    const alpha = (1 - lf) * .45 * t;
    if (alpha < .01) continue;
    ctx.beginPath(); ctx.arc(px, py, p.sz * dpr * (.5 + lf * .5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(249,115,22,${alpha})`; ctx.fill();
  }
}
function drawSparks(gpuCx, gpuCy, dpr, dt) {
  const Tg = calcTgpu(flow, heat, Tin);
  const t = Math.max(0, Math.min(1, (Tg - 40) / 55));
  for (const s of SPARKS) {
    s.life += dt * (0.15 + t * .9);
    if (s.life > 1) { Object.assign(s, newSpark()); s.life = 0; }
    const px = gpuCx + s.ox * 46 * dpr + s.vx * s.life * 28 * dpr;
    const py = gpuCy - 28 * dpr + s.vy * s.life * 55 * dpr;
    const alpha = (1 - s.life) * t * .8;
    if (alpha < .01) continue;
    ctx.beginPath(); ctx.arc(px, py, s.sz * dpr * (1 - s.life * .5), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(251,191,36,${alpha})`; ctx.fill();
  }
}

// ══════════════════════════════════
// DRAW: PARTICLES
// ══════════════════════════════════
function drawParticles(pts, dpr) {
  const speed = 0.0008 * flow;
  for (const p of PARTS) {
    p.t = (p.t + speed) % 1;
    const pos = interp(pts, p.t);
    const hf = heatFrac(p.t, flow, heat);
    const col = coolColor(Math.min(1, hf));
    if (!p.trail) p.trail = [];
    if (p.trail.length > 0) {
      const last = p.trail[p.trail.length - 1];
      const dx = pos.x - last.x, dy = pos.y - last.y;
      if (dx * dx + dy * dy > 10000 * dpr * dpr) p.trail = [];
    }
    p.trail.push({ x: pos.x, y: pos.y });
    if (p.trail.length > 6) p.trail.shift();
    for (let i = 1; i < p.trail.length; i++) {
      const a = i / p.trail.length;
      ctx.beginPath(); ctx.arc(p.trail[i].x, p.trail[i].y, (2.2 + hf) * dpr * a, 0, Math.PI * 2);
      ctx.fillStyle = col.replace('rgb', 'rgba').replace(')', `,${a * .65})`); ctx.fill();
    }
    ctx.beginPath(); ctx.arc(pos.x, pos.y, (2.8 + hf * 1.8) * dpr, 0, Math.PI * 2);
    ctx.fillStyle = col; ctx.fill();
  }
}

// ══════════════════════════════════
// DRAW: LABELS OVERLAY
// ══════════════════════════════════
function drawLabels(layout, pts) {
  if (!showLabels) return;
  const dpr = devicePixelRatio;
  const { gpu, pump, hx } = layout;
  ctx.font = `${9.5 * dpr}px 'IBM Plex Sans',sans-serif`; ctx.textBaseline = 'middle';
  const labels = [
    { x: gpu.x, y: gpu.y + 62 * dpr, text: 'GPU Heat Source', col: '#ef4444' },
    { x: gpu.x, y: gpu.y - 54 * dpr, text: 'Cold Plate', col: '#0ea5e9' },
    { x: pump.x, y: pump.y - 50 * dpr, text: 'Pump', col: '#475569' },
    { x: hx.x, y: hx.y + 52 * dpr, text: 'Heat Exchanger', col: '#64748b' },
  ];
  for (const l of labels) {
    const tw = ctx.measureText(l.text).width;
    rrect(l.x - tw / 2 - 5 * dpr, l.y - 8 * dpr, tw + 10 * dpr, 16 * dpr, 8 * dpr);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = l.col; ctx.fillText(l.text, l.x, l.y);
  }
}

// ══════════════════════════════════
// DRAW: MINI GRAPH (Rth curve)
// embedded right in canvas, top-right corner
// ══════════════════════════════════
function drawGraph() {
  const dpr = devicePixelRatio;
  const gw = graphCanvas.width;
  const gh = graphCanvas.height;
  if (gw === 0 || gh === 0) return;

  gctx.clearRect(0, 0, gw, gh);

  const pad = { l: 32 * dpr, r: 12 * dpr, t: 16 * dpr, b: 24 * dpr };
  const pw = gw - pad.l - pad.r;
  const ph = gh - pad.t - pad.b;

  // Grid lines
  gctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
  gctx.lineWidth = dpr;
  for (let i = 1; i < 4; i++) {
    gctx.beginPath();
    gctx.moveTo(pad.l, pad.t + ph * i / 3);
    gctx.lineTo(pad.l + pw, pad.t + ph * i / 3);
    gctx.stroke();
  }

  // R range
  const rVals = [];
  for (let f = 0.5; f <= 3.01; f += 0.1) rVals.push(calcRth(f) * 1000);
  const rMin = Math.min(...rVals) * 0.9;
  const rMax = Math.max(...rVals) * 1.05;
  const gxF = f => pad.l + (f - 0.5) / 2.5 * pw;
  const gyR = r => pad.t + ph - (r - rMin) / (rMax - rMin) * ph;

  // DR zone (Diminishing returns region for flow >= 1.5)
  gctx.fillStyle = 'rgba(251, 191, 36, 0.08)';
  gctx.fillRect(gxF(1.5), pad.t, gxF(3) - gxF(1.5), ph);

  // Curve
  gctx.beginPath();
  let first = true;
  for (let f = 0.5; f <= 3.01; f += 0.04) {
    const r = calcRth(f) * 1000;
    const x2 = gxF(f);
    const y2 = gyR(r);
    if (first) {
      gctx.moveTo(x2, y2);
      first = false;
    } else {
      gctx.lineTo(x2, y2);
    }
  }
  gctx.strokeStyle = '#2563EB';
  gctx.lineWidth = 2.5 * dpr;
  gctx.stroke();

  // Current operating point marker
  const cR = calcRth(flow) * 1000;
  gctx.beginPath();
  gctx.arc(gxF(flow), gyR(cR), 5 * dpr, 0, Math.PI * 2);
  gctx.fillStyle = '#DC2626';
  gctx.fill();

  gctx.beginPath();
  gctx.arc(gxF(flow), gyR(cR), 3 * dpr, 0, Math.PI * 2);
  gctx.fillStyle = 'white';
  gctx.fill();

  // Axes
  gctx.strokeStyle = 'rgba(148, 163, 184, 0.8)';
  gctx.lineWidth = 1.2 * dpr;
  gctx.beginPath();
  gctx.moveTo(pad.l, pad.t);
  gctx.lineTo(pad.l, pad.t + ph);
  gctx.lineTo(pad.l + pw, pad.t + ph);
  gctx.stroke();

  // Y Axis labels
  gctx.fillStyle = '#64748B';
  gctx.font = `${8 * dpr}px 'IBM Plex Mono', monospace`;
  gctx.textAlign = 'right';
  gctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const v = rMin + (rMax - rMin) * i / 3;
    gctx.fillText(v.toFixed(0), pad.l - 4 * dpr, gyR(v));
  }

  // X Axis labels
  gctx.textAlign = 'center';
  gctx.textBaseline = 'top';
  ['0.5', '1.0', '1.5', '2.0', '2.5', '3.0'].forEach(v => {
    gctx.fillText(v, gxF(parseFloat(v)), pad.t + ph + 4 * dpr);
  });

  // Axis Titles
  gctx.fillStyle = '#475569';
  gctx.font = `bold ${8 * dpr}px 'IBM Plex Sans', sans-serif`;
  gctx.textAlign = 'left';
  gctx.textBaseline = 'bottom';
  gctx.fillText('Thermal Resistance Rth (mK/W)', pad.l, pad.t - 4 * dpr);

  gctx.textAlign = 'right';
  gctx.textBaseline = 'top';
  gctx.fillText('Flow Rate (LPM)', pad.l + pw, pad.t + ph + 12 * dpr);
}

// ══════════════════════════════════
// MAIN LOOP
// ══════════════════════════════════
function draw(ts) {
  requestAnimationFrame(draw);
  if (paused) return;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts; frame++;

  flow = parseFloat(document.getElementById('slFlow').value);
  Tin = parseFloat(document.getElementById('slTin').value);
  heat = parseFloat(document.getElementById('slHeat').value);

  pumpAngle += dt * flow * 4;
  if (W === 0) return;
  const dpr = devicePixelRatio;
  const layout = getLayout();
  const { gpu, pump, hx } = layout;
  const pts = buildPath(gpu, pump, hx);

  // Clear
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, W, H);
  // Dot grid via CSS ::before — canvas is transparent
  // But we paint dots manually for the canvas layer
  ctx.fillStyle = 'rgba(203,213,225,.2)';
  const gs = 24 * dpr;
  for (let gx_ = gs / 2; gx_ < W; gx_ += gs) for (let gy_ = gs / 2; gy_ < H; gy_ += gs) { ctx.beginPath(); ctx.arc(gx_, gy_, dpr, 0, Math.PI * 2); ctx.fill(); }

  drawPipe(pts);
  drawHX(hx.x, hx.y, dpr, ts / 1000);
  drawPlumes(hx.x, hx.y, dpr, dt);
  drawGPU(gpu.x, gpu.y, dpr);
  drawSparks(gpu.x, gpu.y, dpr, dt);
  drawCP(gpu.x, gpu.y, dpr);
  drawPump(pump.x, pump.y, dpr);
  drawParticles(pts, dpr);
  drawGraph();
  drawLabels(layout, pts);

  if (frame % 8 === 0) { updateSliderUI(); updateDashboard(); updateCalcPanel(); }
}

// ══════════════════════════════════
// SLIDER UI — sync gradients + values
// ══════════════════════════════════
function syncSlider(el) {
  const pct = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
}
['slFlow', 'slTin', 'slHeat'].forEach(id => {
  const el = document.getElementById(id);
  el.addEventListener('input', () => { syncSlider(el); });
  syncSlider(el);
});

function updateSliderUI() {
  flow = parseFloat(document.getElementById('slFlow').value);
  Tin = parseFloat(document.getElementById('slTin').value);
  heat = parseFloat(document.getElementById('slHeat').value);
  document.getElementById('vFlow').textContent = flow.toFixed(1) + ' LPM';
  document.getElementById('vTin').textContent = Tin.toFixed(0) + ' °C';
  document.getElementById('vHeat').textContent = heat.toFixed(0) + ' W';
}

// ══════════════════════════════════
// DASHBOARD UPDATE
// ══════════════════════════════════
function classify(v, thresholds) {
  // thresholds: [warn,hot,crit] ascending
  if (v >= thresholds[2]) return 'crit';
  if (v >= thresholds[1]) return 'hot';
  if (v >= thresholds[0]) return 'warn';
  return '';
}
function setDC(id, val, cls) {
  const el = document.getElementById(id);
  el.className = 'dc' + (cls ? ' ' + cls : '');
  el.querySelector('.dash-v').textContent = val;
}
function updateDashboard() {
  const Tout = calcTout(flow, heat, Tin);
  const Rth = calcRth(flow);
  const Tgpu = calcTgpu(flow, heat, Tin);
  const coolant = calcCoolant(flow, heat);

  const tgCls = classify(Tgpu, [60, 80, 95]);
  setDC('dcTgpu', Tgpu.toFixed(0), tgCls || 'good');
  // GPU bar
  const tgN = Math.max(0, Math.min(1, (Tgpu - 40) / 55));
  const barCol = tgN < .4 ? '#16A34A' : tgN < .7 ? '#D97706' : '#DC2626';
  document.getElementById('gpuBar').style.width = (tgN * 100) + '%';
  document.getElementById('gpuBar').style.background = barCol;

  setDC('dcTout', Tout.toFixed(1), '');
  setDC('dcRth', (Rth * 1000).toFixed(1), '');
  const wCls = coolant > 3 ? 'hot' : coolant > 2 ? 'warn' : '';
  setDC('dcWater', coolant.toFixed(2), wCls);

  // Status pill
  const pill = document.getElementById('statusPill');
  const txt = document.getElementById('statusTxt');
  if (Tgpu >= 95) { pill.className = 'hd-pill pill-crit'; txt.textContent = 'Critical'; }
  else if (Tgpu >= 80) { pill.className = 'hd-pill pill-hot'; txt.textContent = 'Overheating'; }
  else if (Tgpu >= 60) { pill.className = 'hd-pill pill-warn'; txt.textContent = 'Warm'; }
  else { pill.className = 'hd-pill pill-ok'; txt.textContent = 'Nominal'; }

  // Slider value color
  const vHeat = document.getElementById('vHeat');
  vHeat.className = 'sl-val' + (heat > 800 ? ' hot' : heat > 600 ? ' warm' : '');
}

// ══════════════════════════════════
// EQUATION PANEL
// ══════════════════════════════════
let calcOpen = false;
function toggleCalc() {
  calcOpen = !calcOpen;
  const btn = document.getElementById('calcBtn');
  const panel = document.getElementById('calcPanel');
  btn.className = 'calc-btn' + (calcOpen ? ' on' : '');
  btn.textContent = calcOpen ? '✕ Hide Equations' : '∑ Show Equations';
  panel.className = 'calc-panel' + (calcOpen ? ' open' : '');
  if (calcOpen) updateCalcPanel();
}
function updateCalcPanel() {
  if (!calcOpen) return;
  const f = flow, q = heat, tin = Tin;
  const mdot = massFlow(f);
  const Tout = calcTout(f, q, tin);
  const Rth = calcRth(f);
  const Tgpu = calcTgpu(f, q, tin);
  const dT = (Tout - tin).toFixed(2);
  const qCheck = (mdot * Cp * parseFloat(dT)).toFixed(0);
  document.getElementById('calcInner').innerHTML =
    `Q = ṁ·Cp·ΔT<br>` +
    `&nbsp;&nbsp;= ${mdot.toFixed(5)}×${Cp}×${dT}<br>` +
    `&nbsp;&nbsp;= <span class="hl">${qCheck} W</span> &nbsp;(given: ${q} W)<br>` +
    `R<sub>th</sub> = ${(Rth * 1000).toFixed(2)} mK/W<br>` +
    `T<sub>gpu</sub> = T<sub>in</sub> + Q×R<sub>th</sub><br>` +
    `&nbsp;&nbsp;= ${tin} + ${q}×${Rth.toFixed(4)}<br>` +
    `&nbsp;&nbsp;= <span class="hl">${Tgpu.toFixed(1)} °C</span>`;
}

// ══════════════════════════════════
// PRESET
// ══════════════════════════════════
function setPreset(f, tin, q) {
  document.getElementById('slFlow').value = f;
  document.getElementById('slTin').value = tin;
  document.getElementById('slHeat').value = q;
  ['slFlow', 'slTin', 'slHeat'].forEach(id => syncSlider(document.getElementById(id)));
  flow = f; Tin = tin; heat = q;
  updateSliderUI(); updateDashboard(); updateCalcPanel();
}

// ══════════════════════════════════
// RECORD + EXPORT
// ══════════════════════════════════
function recordObs() {
  const Tout = calcTout(flow, heat, Tin);
  const Rth = calcRth(flow);
  const Tgpu = calcTgpu(flow, heat, Tin);
  const coolant = calcCoolant(flow, heat);
  const n = observations.length + 1;
  observations.push({ n, flow, Tin, heat, Tout, Tgpu, Rth, coolant });

  const tbody = document.getElementById('obsBody');
  if (n === 1) tbody.innerHTML = '';
  const row = tbody.insertRow();
  row.innerHTML = `<td>${n}</td><td>${flow.toFixed(1)}</td><td>${Tin}</td><td>${heat}</td>` +
    `<td>${Tout.toFixed(1)}</td><td>${Tgpu.toFixed(1)}</td>` +
    `<td>${(Rth * 1000).toFixed(2)}</td><td>${coolant.toFixed(2)}</td>`;

  const btn = document.getElementById('recBtn');
  btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 500);
}
function clearObs() {
  observations = [];
  document.getElementById('obsBody').innerHTML = '<tr><td colspan="8" class="tbl-empty">No readings yet</td></tr>';
}
function exportCSV() {
  if (!observations.length) return;
  const h = '#,Flow(LPM),Tin(C),Q(W),Tout(C),Tgpu(C),Rth(mK/W),Coolant(L/min)';
  const rows = observations.map(o => [o.n, o.flow, o.Tin, o.heat, o.Tout.toFixed(1), o.Tgpu.toFixed(1), (o.Rth * 1000).toFixed(2), o.coolant.toFixed(2)].join(','));
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
  a.download = 'cooling_observations.csv'; a.click();
}

// ══════════════════════════════════
// LABELS / TIPS
// ══════════════════════════════════
document.getElementById('btnLabels').addEventListener('click', function () {
  showLabels = !showLabels;
  this.className = 'hd-btn' + (showLabels ? ' on' : '');
  if (!showLabels) {
    ['tipGPU', 'tipCP', 'tipPump', 'tipHX', 'tipFlow'].forEach(id => document.getElementById(id).classList.add('hidden'));
  } else updateTips();
});
function updateTips() {
  if (!W || !showLabels) return;
  const { gpu, pump, hx } = getLayout();
  const sx = canvas.clientWidth / canvas.width;
  const sy = canvas.clientHeight / canvas.height;
  const mx = (gpu.x + hx.x) / 2;
  const my = (gpu.y + hx.y) / 2;
  [
    { id: 'tipGPU', x: gpu.x * sx, y: gpu.y * sy + 36, transform: 'translate(-50%, 15px)' },
    { id: 'tipCP', x: gpu.x * sx, y: gpu.y * sy - 50, transform: 'translate(-50%, -110%)' },
    { id: 'tipPump', x: pump.x * sx, y: pump.y * sy + 26, transform: 'translate(-50%, 15px)' },
    { id: 'tipHX', x: hx.x * sx, y: hx.y * sy + 31, transform: 'translate(-50%, 15px)' },
    { id: 'tipFlow', x: mx * sx, y: my * sy, transform: 'translate(-50%, -50%)' },
  ].forEach(t => {
    const el = document.getElementById(t.id);
    el.style.left = t.x + 'px';
    el.style.top = t.y + 'px';
    el.style.transform = t.transform;
    el.classList.remove('hidden');
  });
}
setInterval(() => { if (showLabels) updateTips(); }, 300);

// ══════════════════════════════════
// PAUSE
// ══════════════════════════════════
document.getElementById('btnPause').addEventListener('click', function () {
  paused = !paused;
  document.getElementById('pauseIco').innerHTML = paused
    ? '<polygon points="5,3 19,12 5,21"/>'
    : '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
  document.getElementById('pauseTxt').textContent = paused ? 'Resume' : 'Pause';
  this.className = 'hd-btn' + (paused ? ' on' : '');
  if (!paused) lastTime = performance.now();
});

// ══════════════════════════════════
// INIT
// ══════════════════════════════════
resize();
updateSliderUI();
updateDashboard();
requestAnimationFrame(draw);

