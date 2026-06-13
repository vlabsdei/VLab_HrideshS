
// ══════════════════════════════════════
//  CONSTANTS & STATE
// ══════════════════════════════════════
const BREAKER_MAX = 32;   // A — breaker trips above this
const MIN_CURRENT = 25;  // A — underpowered below this
const RAD = Math.PI / 180;

const S = {
  I1: 25, I2: 25, I3: 25,
  A1: 0, A2: 120, A3: 240,
  harmonic: false,
  tripped: [false, false, false],
  // animated
  waveT: 0,
  particles: [],
  lastTs: 0
};

// ══════════════════════════════════════
//  PHYSICS & CONTROLS
// ══════════════════════════════════════
function getEffectiveCurrents() {
  return [
    S.tripped[0] ? 0 : S.I1,
    S.tripped[1] ? 0 : S.I2,
    S.tripped[2] ? 0 : S.I3
  ];
}

function checkTripping() {
  if (S.I1 > BREAKER_MAX) S.tripped[0] = true;
  if (S.I2 > BREAKER_MAX) S.tripped[1] = true;
  if (S.I3 > BREAKER_MAX) S.tripped[2] = true;
}

function resetBreaker(idx) {
  const key = ['I1', 'I2', 'I3'][idx];
  const slId = ['slI1', 'slI2', 'slI3'][idx];
  const valId = ['vI1', 'vI2', 'vI3'][idx];

  S[key] = BREAKER_MAX;
  const el = document.getElementById(slId);
  if (el) {
    el.value = BREAKER_MAX;
    syncSlider(el);
  }
  const dispEl = document.getElementById(valId);
  if (dispEl) {
    dispEl.textContent = BREAKER_MAX.toFixed(1) + ' A';
  }

  S.tripped[idx] = false;
  updateDashboard();
  updateCalcPanel();
}

function calcNeutral(I1, I2, I3, A1, A2, A3) {
  const re = I1 * Math.cos(A1 * RAD) + I2 * Math.cos(A2 * RAD) + I3 * Math.cos(A3 * RAD);
  const im = I1 * Math.sin(A1 * RAD) + I2 * Math.sin(A2 * RAD) + I3 * Math.sin(A3 * RAD);
  return Math.sqrt(re * re + im * im);
}

function getStatus() {
  if (S.tripped[0] || S.tripped[1] || S.tripped[2]) return 'trip';
  const eff = getEffectiveCurrents();
  if (eff[0] < MIN_CURRENT || eff[1] < MIN_CURRENT || eff[2] < MIN_CURRENT) return 'under';
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  if (In > 8) return 'crit';
  if (In > 1.5) return 'warn';
  return 'ok';
}

function imbalanceIndex() {
  const eff = getEffectiveCurrents();
  const A1 = S.A1, A2 = S.A2, A3 = S.A3;
  const rad = Math.PI / 180;

  const IA = { re: eff[0] * Math.cos(A1 * rad), im: eff[0] * Math.sin(A1 * rad) };
  const IB = { re: eff[1] * Math.cos(A2 * rad), im: eff[1] * Math.sin(A2 * rad) };
  const IC = { re: eff[2] * Math.cos(A3 * rad), im: eff[2] * Math.sin(A3 * rad) };

  const a = { re: -0.5, im: 0.8660254 };
  const a2 = { re: -0.5, im: -0.8660254 };

  const mult = (c1, c2) => ({
    re: c1.re * c2.re - c1.im * c2.im,
    im: c1.re * c2.im + c1.im * c2.re
  });

  const a2_IB = mult(a2, IB);
  const a_IC = mult(a, IC);
  const Ipos = {
    re: (IA.re + a2_IB.re + a_IC.re) / 3,
    im: (IA.im + a2_IB.im + a_IC.im) / 3
  };

  const a_IB = mult(a, IB);
  const a2_IC = mult(a2, IC);
  const Ineg = {
    re: (IA.re + a_IB.re + a2_IC.re) / 3,
    im: (IA.im + a_IB.im + a2_IC.im) / 3
  };

  const mag = (c) => Math.sqrt(c.re * c.re + c.im * c.im);
  const magPos = mag(Ipos);
  const magNeg = mag(Ineg);

  return magPos > 0 ? (magNeg / magPos) * 100 : 0;
}

// ══════════════════════════════════════
//  CANVAS SETUP
// ══════════════════════════════════════
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;

function resize() {
  const vp = document.getElementById('viewport');
  canvas.width = vp.clientWidth * devicePixelRatio;
  canvas.height = vp.clientHeight * devicePixelRatio;
  W = canvas.width; H = canvas.height;
}
window.addEventListener('resize', () => { resize(); });

// ══════════════════════════════════════
//  DRAW HELPERS
// ══════════════════════════════════════
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

// ══════════════════════════════════════
//  DRAW: PDU BOX
// ══════════════════════════════════════
function drawPDU(cx, cy, dpr) {
  const w = 200 * dpr, h = 100 * dpr, x = cx - w / 2, y = cy - h / 2;
  const status = getStatus();

  // Shadow
  rrect(x + 3 * dpr, y + 4 * dpr, w, h, 8 * dpr);
  ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fill();

  // Body
  rrect(x, y, w, h, 8 * dpr);
  const bg = ctx.createLinearGradient(x, y, x, y + h);
  bg.addColorStop(0, '#2D3748'); bg.addColorStop(1, '#1A202C');
  ctx.fillStyle = bg; ctx.fill();

  // Top edge highlight
  rrect(x, y, w, 3 * dpr, 2 * dpr);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();

  // Status LED strip
  const ledColors = { 'ok': '#22C55E', 'warn': '#F59E0B', 'trip': '#EF4444', 'under': '#A78BFA' };
  const ledColor = ledColors[status] || '#22C55E';
  const ledAlpha = 0.5 + 0.5 * Math.abs(Math.sin(S.waveT * 2));
  rrect(x + 12 * dpr, y + 12 * dpr, w - 24 * dpr, 6 * dpr, 3 * dpr);
  ctx.fillStyle = `rgba(30,32,36,.6)`; ctx.fill();
  rrect(x + 12 * dpr, y + 12 * dpr, w - 24 * dpr, 6 * dpr, 3 * dpr);
  ctx.fillStyle = status === 'ok' ? ledColor : `rgba(${hexToRgb(ledColor)},${ledAlpha})`;
  ctx.fill();

  // Outlet rows (3 × 4 grid)
  const outletCols = 4, outletRows = 3;
  const oW = 14 * dpr, oH = 9 * dpr;
  const oGapX = (w - 40 * dpr) / (outletCols - 1), oGapY = (h - 52 * dpr) / (outletRows - 1);
  const oStartX = x + 20 * dpr, oStartY = y + 28 * dpr;
  const phaseColors = ['#3B82F6', '#22C55E', '#F59E0B'];

  const eff = getEffectiveCurrents();
  for (let row = 0; row < outletRows; row++) {
    for (let col = 0; col < outletCols; col++) {
      const ox = oStartX + col * oGapX - oW / 2;
      const oy = oStartY + row * oGapY - oH / 2;
      const phIdx = row;
      const tripped = S.tripped[phIdx];
      const under = eff[phIdx] < MIN_CURRENT && !tripped;

      rrect(ox, oy, oW, oH, 2 * dpr);
      ctx.fillStyle = tripped ? 'rgba(239,68,68,.1)' : under ? 'rgba(167,139,250,.2)' : 'rgba(255,255,255,.07)';
      ctx.fill();
      rrect(ox, oy, oW, oH, 2 * dpr);
      ctx.strokeStyle = tripped ? 'rgba(148,163,184,.3)' : under ? 'rgba(167,139,250,.6)' : `rgba(${hexToRgb(phaseColors[phIdx])},.35)`;
      ctx.lineWidth = dpr; ctx.stroke();

      // LED indicator (gray when tripped)
      ctx.beginPath();
      ctx.arc(ox + oW / 2, oy + oH / 2, 1.6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = tripped ? '#475569' : under ? '#A78BFA' : phaseColors[phIdx];
      ctx.fill();
    }
  }

  // Label
  ctx.fillStyle = 'rgba(255,255,255,.25)';
  ctx.font = `${8 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText('3 PHASE-PDU', x + w - 10 * dpr, y + h - 7 * dpr);

  // Phase lane labels on side
  const laneColors = ['#60A5FA', '#4ADE80', '#FBBF24'];
  const laneLabels = ['L1', 'L2', 'L3'];
  for (let r = 0; r < 3; r++) {
    ctx.fillStyle = laneColors[r];
    ctx.font = `bold ${7.5 * dpr}px 'IBM Plex Mono',monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(laneLabels[r], x + 4 * dpr, oStartY + r * oGapY);
  }
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

// ══════════════════════════════════════
//  DRAW: WIRE HARNESS (from panel to PDU)
// ══════════════════════════════════════
function drawWires(panelX, panelY, pduX, pduY, dpr) {
  const phColors = ['#3B82F6', '#22C55E', '#F59E0B', '#A78BFA'];
  const eff = getEffectiveCurrents();
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  const allI = [...eff, In];
  const offsets = [-18, -6, 6, 18];

  for (let i = 0; i < 4; i++) {
    const I = allI[i];
    const tripped = i < 3 && S.tripped[i];
    const thick = tripped ? 1.5 * dpr : Math.max(2, (I / 32) * 5.5) * dpr;
    const alpha = tripped ? 0.25 : 0.7 + Math.min(.3, I / 100);
    const color = tripped ? '#94A3B8' : phColors[i];

    ctx.beginPath();
    ctx.moveTo(panelX, panelY + offsets[i] * dpr);
    ctx.bezierCurveTo(
      panelX + 60 * dpr, panelY + offsets[i] * dpr,
      pduX - 60 * dpr, pduY + offsets[i] * dpr,
      pduX, pduY + offsets[i] * dpr
    );
    ctx.strokeStyle = tripped ? `rgba(148,163,184,${alpha})` : `rgba(${hexToRgb(color)},${alpha})`;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// ══════════════════════════════════════
//  DRAW: ELECTRICAL PANEL (left side)
// ══════════════════════════════════════
function drawPanel(cx, cy, dpr) {
  const w = 80 * dpr, h = 140 * dpr, x = cx - w / 2, y = cy - h / 2;
  rrect(x + 2 * dpr, y + 3 * dpr, w, h, 5 * dpr); ctx.fillStyle = 'rgba(0,0,0,.1)'; ctx.fill();
  rrect(x, y, w, h, 5 * dpr);
  const g = ctx.createLinearGradient(x, y, x, y + h);
  g.addColorStop(0, '#374151'); g.addColorStop(1, '#1F2937'); ctx.fillStyle = g; ctx.fill();
  rrect(x, y, w, 3 * dpr, 2 * dpr); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();

  // Breaker slots
  const bH = 12 * dpr, bW = 26 * dpr, bGap = 5 * dpr;
  const bStart = y + 14 * dpr;
  const phColors = ['#3B82F6', '#22C55E', '#F59E0B'];
  const phNames = ['L1', 'L2', 'L3'];
  const eff = getEffectiveCurrents();

  for (let i = 0; i < 3; i++) {
    const by = bStart + i * (bH + bGap);
    const tripped = S.tripped[i];
    const under = eff[i] < MIN_CURRENT && !tripped;
    rrect(x + w / 2 - bW / 2, by, bW, bH, 3 * dpr);
    ctx.fillStyle = tripped ? 'rgba(239,68,68,.4)' : under ? 'rgba(167,139,250,.3)' : 'rgba(255,255,255,.08)'; ctx.fill();
    rrect(x + w / 2 - bW / 2, by, bW, bH, 3 * dpr);
    ctx.strokeStyle = tripped ? 'rgba(239,68,68,.8)' : `rgba(${hexToRgb(phColors[i])},.5)`;
    ctx.lineWidth = dpr; ctx.stroke();

    // Breaker indicator (thrown to the side/open position when tripped)
    const bdx = tripped ? 0.25 : 0.55;
    const boxX = tripped ? (x + w / 2 - bW / 2 + 3 * dpr) : (x + w / 2 - bW / 2 + bW * (1 - bdx) - 3 * dpr);
    rrect(boxX, by + 3 * dpr, bW * bdx - 4 * dpr, bH - 6 * dpr, 2 * dpr);
    ctx.fillStyle = tripped ? '#EF4444' : under ? '#A78BFA' : phColors[i];
    ctx.globalAlpha = tripped ? 0.7 + 0.3 * Math.abs(Math.sin(S.waveT * 3)) : 1;
    ctx.fill(); ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = tripped ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.55)';
    ctx.font = `bold ${6.5 * dpr}px 'IBM Plex Mono',monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tripped ? 'TRIP' : phNames[i], x + w / 2, by + bH / 2);
  }

  // Neutral breaker (smaller, purple)
  const nby = bStart + 3 * (bH + bGap) + 4 * dpr;
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  rrect(x + w / 2 - bW * 0.4, nby, bW * 0.8, bH * .85, 3 * dpr);
  ctx.fillStyle = `rgba(${hexToRgb('#A78BFA')},.3)`; ctx.fill();
  rrect(x + w / 2 - bW * 0.4, nby, bW * 0.8, bH * .85, 3 * dpr);
  ctx.strokeStyle = `rgba(${hexToRgb('#A78BFA')},.5)`; ctx.lineWidth = dpr; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = `bold ${6 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', x + w / 2, nby + bH * .43);

  // Main label
  ctx.fillStyle = 'rgba(255,255,255,.2)';
  ctx.font = `${7 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('MAIN PANEL', x + w / 2, y + h - 5 * dpr);
}

// ══════════════════════════════════════
//  DRAW: CURRENT PARTICLES on wires
// ══════════════════════════════════════
function spawnParticles() {
  if (S.particles.length > 120) return;
  const phColors = ['#3B82F6', '#22C55E', '#F59E0B', '#A78BFA'];
  const eff = getEffectiveCurrents();
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  const phI = [...eff, In];
  const offsets = [-18, -6, 6, 18];
  for (let i = 0; i < 4; i++) {
    if (i < 3 && S.tripped[i]) continue;
    if (i === 3 && In < 0.1) continue;
    const rate = Math.max(0.01, phI[i] / 200);
    if (Math.random() < rate) {
      S.particles.push({
        phase: i, t: 0, color: phColors[i], speed: 0.004 + phI[i] / 8000
      });
    }
  }
}

function drawParticles(panelX, panelY, pduX, pduY, dpr) {
  const offsets = [-18, -6, 6, 18];
  spawnParticles();
  S.particles = S.particles.filter(p => {
    if (p.phase < 3 && S.tripped[p.phase]) return false;
    p.t += p.speed;
    if (p.t > 1) return false;
    const ofs = offsets[p.phase];
    const t = p.t;
    // Cubic bezier eval
    const cp1x = panelX + 60 * dpr, cp1y = panelY + ofs * dpr;
    const cp2x = pduX - 60 * dpr, cp2y = pduY + ofs * dpr;
    const bx = bezier(panelX, cp1x, cp2x, pduX, t);
    const by = bezier(panelY + ofs * dpr, cp1y, cp2y, pduY + ofs * dpr, t);
    ctx.beginPath(); ctx.arc(bx, by, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = p.color; ctx.fill();
    return true;
  });
}
function bezier(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
}

// ══════════════════════════════════════
//  DRAW: PHASOR DIAGRAM
// ══════════════════════════════════════
function drawPhasor(cx, cy, dpr) {
  const R = Math.min(W, H) * 0.13;
  // Background circle
  ctx.beginPath(); ctx.arc(cx, cy, R + 8 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  ctx.strokeStyle = 'rgba(203,213,225,.7)'; ctx.lineWidth = dpr; ctx.stroke();

  // Grid rings
  ctx.strokeStyle = 'rgba(203,213,225,.35)'; ctx.lineWidth = dpr;
  for (let r = 0.33; r <= 1; r += 0.33) {
    ctx.beginPath(); ctx.arc(cx, cy, R * r, 0, Math.PI * 2); ctx.stroke();
  }
  // Axes
  ctx.strokeStyle = 'rgba(203,213,225,.5)';
  for (let a = 0; a < 360; a += 60) {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(a * RAD), cy - R * Math.sin(a * RAD)); ctx.stroke();
  }

  const eff = getEffectiveCurrents();
  const phases = [
    { I: eff[0], A: S.A1, col: '#2563EB', lbl: 'L1', tripped: S.tripped[0] },
    { I: eff[1], A: S.A2, col: '#16A34A', lbl: 'L2', tripped: S.tripped[1] },
    { I: eff[2], A: S.A3, col: '#D97706', lbl: 'L3', tripped: S.tripped[2] },
  ];
  const Imax = Math.max(S.I1, S.I2, S.I3, BREAKER_MAX);

  // Draw phasors
  for (const ph of phases) {
    if (ph.tripped) continue;
    const len = (ph.I / Imax) * R;
    const ax = RAD * ph.A, ex = cx + len * Math.cos(ax), ey = cy - len * Math.sin(ax);
    // Shadow
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex + dpr, ey + dpr);
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 3 * dpr; ctx.lineCap = 'round'; ctx.stroke();
    // Main arrow
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
    ctx.strokeStyle = ph.col; ctx.lineWidth = 2.5 * dpr; ctx.stroke();
    // Arrowhead
    const angle = Math.atan2(ey - cy, ex - cx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 10 * dpr * Math.cos(angle - 0.4), ey - 10 * dpr * Math.sin(angle - 0.4));
    ctx.lineTo(ex - 10 * dpr * Math.cos(angle + 0.4), ey - 10 * dpr * Math.sin(angle + 0.4));
    ctx.closePath(); ctx.fillStyle = ph.col; ctx.fill();
    // Label
    ctx.fillStyle = ph.col; ctx.font = `bold ${9 * dpr}px 'IBM Plex Sans',sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(ph.lbl, ex + 14 * dpr * Math.cos(angle), ey + 14 * dpr * Math.sin(angle));
  }

  // Neutral resultant
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  if (In > 0.5) {
    const re = eff[0] * Math.cos(S.A1 * RAD) + eff[1] * Math.cos(S.A2 * RAD) + eff[2] * Math.cos(S.A3 * RAD);
    const im = eff[0] * Math.sin(S.A1 * RAD) + eff[1] * Math.sin(S.A2 * RAD) + eff[2] * Math.sin(S.A3 * RAD);
    const len = (In / Imax) * R;
    const angle = Math.atan2(im, re);
    const ex2 = cx + len * Math.cos(angle), ey2 = cy - len * Math.sin(angle);
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex2, ey2);
    ctx.strokeStyle = '#7C3AED'; ctx.lineWidth = 2 * dpr; ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(ex2, ey2, 4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#7C3AED'; ctx.fill();
    ctx.fillStyle = '#7C3AED'; ctx.font = `bold ${8.5 * dpr}px 'IBM Plex Sans',sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Iₙ', cx + (ex2 - cx) * 1.2, cy - (ey2 - cy) * 1.2 - 2 * dpr);
  }

  // Center dot
  ctx.beginPath(); ctx.arc(cx, cy, 4 * dpr, 0, Math.PI * 2);
  ctx.fillStyle = '#1E293B'; ctx.fill();

  // Title
  ctx.fillStyle = '#94A3B8'; ctx.font = `${8 * dpr}px 'IBM Plex Sans',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Phasor Diagram', cx, cy - R - 10 * dpr);
}

// ══════════════════════════════════════
//  DRAW: WAVEFORM (right side)
// ══════════════════════════════════════
function drawWaveform(x, y, w, h, dpr) {
  // Box bg
  rrect(x, y, w, h, 6 * dpr); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fill();
  rrect(x, y, w, h, 6 * dpr); ctx.strokeStyle = 'rgba(203,213,225,.7)'; ctx.lineWidth = dpr; ctx.stroke();

  // Zero line
  const midY = y + h / 2;
  ctx.beginPath(); ctx.moveTo(x + 8 * dpr, midY); ctx.lineTo(x + w - 8 * dpr, midY);
  ctx.strokeStyle = 'rgba(148,163,184,.35)'; ctx.lineWidth = dpr; ctx.stroke();

  const eff = getEffectiveCurrents();
  const phases = [
    { I: eff[0], A: S.A1, col: '#2563EB', lbl: 'L1' },
    { I: eff[1], A: S.A2, col: '#16A34A', lbl: 'L2' },
    { I: eff[2], A: S.A3, col: '#D97706', lbl: 'L3' },
  ];
  const Imax = Math.max(S.I1, S.I2, S.I3);
  const amp = (h / 2 - 14 * dpr);
  const cyc = w - 20 * dpr;

  for (const ph of phases) {
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const px2 = x + 10 * dpr + (i / 200) * cyc;
      const angle = ((i / 200) * 2 * Math.PI) + S.waveT + (ph.A * RAD);
      const py2 = midY - (ph.I / Imax) * amp * Math.sin(angle);
      if (i === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
    }
    ctx.strokeStyle = ph.col; ctx.lineWidth = 2 * dpr; ctx.stroke();
  }

  // Title
  ctx.fillStyle = '#94A3B8'; ctx.font = `${8 * dpr}px 'IBM Plex Sans',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText('', x + w / 2, y + 4 * dpr);

  // Breaker limit line
  const overany = S.I1 > BREAKER_MAX || S.I2 > BREAKER_MAX || S.I3 > BREAKER_MAX;
  if (overany) {
    const limitY = midY - (BREAKER_MAX / Imax) * amp;
    ctx.beginPath(); ctx.moveTo(x + 10 * dpr, limitY); ctx.lineTo(x + w - 10 * dpr, limitY);
    ctx.strokeStyle = 'rgba(239,68,68,.6)'; ctx.lineWidth = dpr; ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(239,68,68,.7)'; ctx.font = `${7 * dpr}px 'IBM Plex Sans',sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText('32A trip', x + w - 10 * dpr, limitY - 1 * dpr);
  }

  // Legend
  const lx = x + 12 * dpr, ly = y + h - 18 * dpr;
  phases.forEach((ph, i) => {
    ctx.fillStyle = ph.col; ctx.beginPath(); ctx.arc(lx + i * 38 * dpr, ly, 3 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#64748B'; ctx.font = `${7.5 * dpr}px 'IBM Plex Mono',monospace`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(ph.lbl, lx + i * 38 * dpr + 6 * dpr, ly);
  });
}

// ══════════════════════════════════════
//  DRAW: NEUTRAL CURRENT METER
// ══════════════════════════════════════
function drawNeutralMeter(cx, cy, dpr) {
  const R = Math.min(W, H) * 0.07;
  const eff = getEffectiveCurrents();
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  const pct = Math.min(1, In / 20);

  // Background arc
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25, false);
  ctx.strokeStyle = '#E2E8F0'; ctx.lineWidth = 6 * dpr; ctx.lineCap = 'round'; ctx.stroke();

  // Colored arc
  const col = In < 2 ? '#16A34A' : In < 6 ? '#D97706' : In < 10 ? '#EA580C' : '#DC2626';
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 0.75 + pct * Math.PI * 1.5, false);
  ctx.strokeStyle = col; ctx.lineWidth = 6 * dpr; ctx.lineCap = 'round'; ctx.stroke();

  // Needle
  const needleAngle = Math.PI * 0.75 + pct * Math.PI * 1.5;
  const nx = cx + R * 0.78 * Math.cos(needleAngle), ny = cy + R * 0.78 * Math.sin(needleAngle);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
  ctx.strokeStyle = col; ctx.lineWidth = 2 * dpr; ctx.stroke();

  // Value
  ctx.fillStyle = '#1E293B'; ctx.font = `bold ${10 * dpr}px 'IBM Plex Mono',monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(In.toFixed(1), cx, cy + 2 * dpr);
  ctx.fillStyle = '#94A3B8'; ctx.font = `${7 * dpr}px 'IBM Plex Sans',sans-serif`;
  ctx.fillText('Iₙ (A)', cx, cy + 12 * dpr);

  // Title
  ctx.fillStyle = '#94A3B8'; ctx.font = `${8 * dpr}px 'IBM Plex Sans',sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Neutral Return', cx, cy - R - 8 * dpr);
}

// ══════════════════════════════════════
//  MAIN DRAW LOOP
// ══════════════════════════════════════
let frameN = 0;
function draw(ts) {
  requestAnimationFrame(draw);
  const dt = Math.min((ts - S.lastTs) / 1000, .05); S.lastTs = ts;
  S.waveT += dt * 1.8;
  frameN++;
  if (W === 0) return;

  const dpr = devicePixelRatio;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#F8FAFC'; ctx.fillRect(0, 0, W, H);

  // Layout math
  const cx = W / 2, cy = H / 2;
  const panelX = W * 0.14, panelY = cy;
  const pduX = W * 0.50, pduY = cy;
  const phasorX = W * 0.78, phasorY = H * 0.4;
  const waveX = W * 0.58, waveY = H * 0.62;
  const waveW = W * 0.38, waveH = H * 0.30;
  const meterX = W * 0.78, meterY = H * 0.72;

  drawWires(panelX, panelY, pduX, pduY, dpr);
  drawParticles(panelX, panelY, pduX, pduY, dpr);
  drawPanel(panelX, panelY, dpr);
  drawPDU(pduX, pduY, dpr);
  drawPhasor(phasorX, phasorY, dpr);
  drawWaveform(waveX, waveY, waveW, waveH, dpr);
  drawNeutralMeter(meterX, meterY, dpr);

  // Wire labels
  const wLabel = (txt, x, y, col) => {
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.font = `bold ${8 * dpr}px 'IBM Plex Mono',monospace`;
    const tw = ctx.measureText(txt).width;
    rrect(x - tw / 2 - 4 * dpr, y - 7 * dpr, tw + 8 * dpr, 13 * dpr, 4 * dpr);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
  };
  const midX = (panelX + pduX) / 2;
  wLabel('L1', midX, panelY - 22 * dpr, '#2563EB');
  wLabel('L2', midX, panelY - 8 * dpr, '#16A34A');
  wLabel('L3', midX, panelY + 6 * dpr, '#D97706');
  wLabel('N', midX, panelY + 20 * dpr, '#7C3AED');

  // Breaker trip overlay
  const st = getStatus();
  document.getElementById('tripOverlay').className = 'trip-overlay' + (st === 'trip' ? ' active' : '');

  if (frameN % 8 === 0) { updateDashboard(); updateCalcPanel(); }
}

// ══════════════════════════════════════
//  DASHBOARD UPDATE
// ══════════════════════════════════════
function dcClass(v, thresholds, reverse) {
  const [w, c] = thresholds;
  if (reverse) { if (v <= c) return 'good'; if (v <= w) return ''; return 'warn'; }
  if (v >= c) return 'crit'; if (v >= w) return 'warn'; return 'good';
}
function setDC(id, val, cls) {
  const el = document.getElementById(id);
  el.className = 'dc' + (cls ? ' ' + cls : '');
  el.querySelector('.dash-v').textContent = val;
}
function setBar(id, pct, col) {
  const el = document.getElementById(id);
  el.style.width = Math.max(0, Math.min(100, pct)) + '%';
  el.style.background = col;
}

function updateDashboard() {
  checkTripping();
  const eff = getEffectiveCurrents();
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  const imb = imbalanceIndex();
  const st = getStatus();

  // Neutral current
  const inCls = In < 2 ? 'good' : In < 6 ? '' : In < 10 ? 'warn' : 'crit';
  setDC('dcIn', In.toFixed(1), inCls);
  setBar('barIn', (In / 20) * 100, In < 2 ? '#16A34A' : In < 6 ? '#94A3B8' : In < 10 ? '#D97706' : '#DC2626');

  // Phase dashboard cards
  const ph = [
    { id: 'dcI1', v: eff[0], setpoint: S.I1, tripped: S.tripped[0], bar: 'barI1' },
    { id: 'dcI2', v: eff[1], setpoint: S.I2, tripped: S.tripped[1], bar: 'barI2' },
    { id: 'dcI3', v: eff[2], setpoint: S.I3, tripped: S.tripped[2], bar: 'barI3' }
  ];
  ph.forEach(p => {
    const under = p.v < MIN_CURRENT && !p.tripped;
    const cls = p.tripped ? 'crit' : under ? 'under' : '';
    setDC(p.id, p.v.toFixed(1), cls);
    setBar(p.bar, (p.v / BREAKER_MAX) * 100, p.tripped ? '#DC2626' : under ? '#7C3AED' : '#2563EB');
  });

  const imbCls = imb < 5 ? 'good' : imb < 15 ? '' : imb < 30 ? 'warn' : 'crit';
  setDC('dcImb', imb.toFixed(1), imbCls);
  setBar('barImb', imb, imb < 5 ? '#16A34A' : imb < 15 ? '#94A3B8' : imb < 30 ? '#D97706' : '#DC2626');

  // Status pill
  const pill = document.getElementById('statusPill');
  const pillTxt = document.getElementById('statusTxt');
  const pillMap = {
    ok: { cls: 'pill-ok', txt: 'Optimal' },
    warn: { cls: 'pill-warn', txt: 'Unbalanced' },
    crit: { cls: 'pill-crit', txt: 'High Neutral Current' },
    trip: { cls: 'pill-trip', txt: 'Breaker Tripped' },
    under: { cls: 'pill-under', txt: 'Underpowered' }
  };
  const pm = pillMap[st] || pillMap.ok;
  pill.className = `hd-pill ${pm.cls}`; pillTxt.textContent = pm.txt;

  // Phase blocks in left panel
  const phaseBlocks = [
    { block: 'blockL1', val: 'vI1', btn: 'btnResetL1', I: S.I1, eff: eff[0], tripped: S.tripped[0] },
    { block: 'blockL2', val: 'vI2', btn: 'btnResetL2', I: S.I2, eff: eff[1], tripped: S.tripped[1] },
    { block: 'blockL3', val: 'vI3', btn: 'btnResetL3', I: S.I3, eff: eff[2], tripped: S.tripped[2] },
  ];
  phaseBlocks.forEach(pb => {
    const under = pb.eff < MIN_CURRENT && !pb.tripped;
    document.getElementById(pb.block).className = 'phase-block' + (pb.tripped ? ' ph-trip' : under ? ' ph-under' : '');
    const vEl = document.getElementById(pb.val);
    vEl.textContent = pb.I.toFixed(1) + ' A';
    vEl.className = 'sl-val' + (pb.tripped ? ' trip' : under ? ' under' : '');

    // Show/hide manual breaker reset button
    const btn = document.getElementById(pb.btn);
    if (pb.tripped) {
      btn.style.display = 'block';
    } else {
      btn.style.display = 'none';
    }
  });
}

// ══════════════════════════════════════
//  CALC PANEL
// ══════════════════════════════════════
let calcOpen = false;
function toggleCalc() {
  calcOpen = !calcOpen;
  const btn = document.getElementById('btnCalc');
  const sect = document.getElementById('calcSect');
  btn.className = 'hd-btn' + (calcOpen ? ' on' : '');
  btn.textContent = calcOpen ? '✕ Equations' : '∑ Equations';
  sect.style.display = calcOpen ? 'flex' : 'none';
  if (calcOpen) updateCalcPanel();
}
function updateCalcPanel() {
  if (!calcOpen) return;
  const eff = getEffectiveCurrents();
  const { A1, A2, A3 } = S;
  const re = (eff[0] * Math.cos(A1 * RAD) + eff[1] * Math.cos(A2 * RAD) + eff[2] * Math.cos(A3 * RAD)).toFixed(3);
  const im = (eff[0] * Math.sin(A1 * RAD) + eff[1] * Math.sin(A2 * RAD) + eff[2] * Math.sin(A3 * RAD)).toFixed(3);
  const In = calcNeutral(eff[0], eff[1], eff[2], A1, A2, A3);
  const imb = imbalanceIndex();
  document.getElementById('calcInner').innerHTML =
    `<b>Neutral Current (Iₙ):</b><br>` +
    `Σ Re = I₁·cos(θ₁) + I₂·cos(θ₂) + I₃·cos(θ₃)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ${eff[0]}·cos(${A1}°)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ${eff[1]}·cos(${A2}°)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ${eff[2]}·cos(${A3}°)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= <span class="hl">${re}</span><br>` +
    `Σ Im = I₁·sin(θ₁) + I₂·sin(θ₂) + I₃·sin(θ₃)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= ${eff[0]}·sin(${A1}°)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ${eff[1]}·sin(${A2}°)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;+ ${eff[2]}·sin(${A3}°)<br>` +
    `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;= <span class="hl">${im}</span><br>` +
    `Iₙ = √(Σ Re² + Σ Im²)<br>` +
    `&nbsp;&nbsp;&nbsp;= √(${re}² + ${im}²)<br>` +
    `&nbsp;&nbsp;&nbsp;= <span class="${In > 8 ? 'hl-r' : 'hl'}">${In.toFixed(2)} A</span><br>` +
    `<b>Imbalance (IEEE):</b> ${imb.toFixed(1)}%`;
}

// ══════════════════════════════════════
//  SLIDER SYNC
// ══════════════════════════════════════
function syncSlider(el) {
  const pct = (el.value - el.min) / (el.max - el.min) * 100;
  el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
}
const sliderMap = [
  { id: 'slI1', state: 'I1', disp: 'vI1', fmt: v => v.toFixed(1) + ' A' },
  { id: 'slI2', state: 'I2', disp: 'vI2', fmt: v => v.toFixed(1) + ' A' },
  { id: 'slI3', state: 'I3', disp: 'vI3', fmt: v => v.toFixed(1) + ' A' },
  { id: 'slA1', state: 'A1', disp: 'vA1', fmt: v => v.toFixed(0) + '°' },
  { id: 'slA2', state: 'A2', disp: 'vA2', fmt: v => v.toFixed(0) + '°' },
  { id: 'slA3', state: 'A3', disp: 'vA3', fmt: v => v.toFixed(0) + '°' },
];
sliderMap.forEach(m => {
  const el = document.getElementById(m.id);
  el.addEventListener('input', () => {
    S[m.state] = parseFloat(el.value);
    document.getElementById(m.disp).textContent = m.fmt(parseFloat(el.value));
    syncSlider(el);
    updateDashboard(); updateCalcPanel();
  });
  syncSlider(el);
});

// ══════════════════════════════════════
//  HARMONIC TOGGLE
// ══════════════════════════════════════
let harmonicTimers = [];
function toggleHarmonic() {
  S.harmonic = !S.harmonic;
  const btn = document.getElementById('btnHarm');
  btn.className = 'sc-btn' + (S.harmonic ? ' on-harm' : '');

  harmonicTimers.forEach(clearTimeout); harmonicTimers = [];

  if (S.harmonic) {
    // Shift angles with ±15° distortion
    const shifts = [15, -12, 13];
    const slIds = ['slA1', 'slA2', 'slA3'];
    const stKeys = ['A1', 'A2', 'A3'];
    const dispIds = ['vA1', 'vA2', 'vA3'];
    const nominals = [0, 120, 240];
    shifts.forEach((sh, i) => {
      const newVal = nominals[i] + sh;
      document.getElementById(slIds[i]).value = newVal;
      S[stKeys[i]] = newVal;
      document.getElementById(dispIds[i]).textContent = newVal + '°';
      syncSlider(document.getElementById(slIds[i]));
    });
  } else {
    // Restore nominal angles
    const nomAngles = [0, 120, 240];
    ['slA1', 'slA2', 'slA3'].forEach((id, i) => {
      document.getElementById(id).value = nomAngles[i];
      S[['A1', 'A2', 'A3'][i]] = nomAngles[i];
      document.getElementById(['vA1', 'vA2', 'vA3'][i]).textContent = nomAngles[i] + '°';
      syncSlider(document.getElementById(id));
    });
  }
  updateDashboard(); updateCalcPanel();
}

// ══════════════════════════════════════
//  RESET
// ══════════════════════════════════════
function resetAll() {
  S.harmonic = false;
  S.tripped = [false, false, false];
  document.getElementById('btnHarm').className = 'sc-btn';
  const defaults = { slI1: 25, slI2: 25, slI3: 25, slA1: 0, slA2: 120, slA3: 240 };
  const stMap = { slI1: 'I1', slI2: 'I2', slI3: 'I3', slA1: 'A1', slA2: 'A2', slA3: 'A3' };
  const dispMap = { slI1: 'vI1', slI2: 'vI2', slI3: 'vI3', slA1: 'vA1', slA2: 'vA2', slA3: 'vA3' };
  const fmts = { slI1: v => v + ' A', slI2: v => v + ' A', slI3: v => v + ' A', slA1: v => v + '°', slA2: v => v + '°', slA3: v => v + '°' };
  Object.keys(defaults).forEach(id => {
    const el = document.getElementById(id);
    el.value = defaults[id];
    S[stMap[id]] = defaults[id];
    document.getElementById(dispMap[id]).textContent = fmts[id](defaults[id]);
    syncSlider(el);
  });
  updateDashboard(); updateCalcPanel();
}

// ══════════════════════════════════════
//  OBSERVATIONS
// ══════════════════════════════════════
let observations = [];
function recordObs() {
  const eff = getEffectiveCurrents();
  const In = calcNeutral(eff[0], eff[1], eff[2], S.A1, S.A2, S.A3);
  const st = getStatus();
  const statusLbl = { ok: 'Optimal', warn: 'Unbalanced', crit: 'High Neutral Current', trip: 'TRIPPED', under: 'Underpowered' };
  const n = observations.length + 1;
  observations.push({ n, I1: eff[0], I2: eff[1], I3: eff[2], A1: S.A1, A2: S.A2, A3: S.A3, In, status: st });

  const tbody = document.getElementById('obsBody');
  if (n === 1) tbody.innerHTML = '';
  const row = tbody.insertRow();
  row.innerHTML =
    `<td>${n}</td><td>${eff[0].toFixed(1)}</td><td>${eff[1].toFixed(1)}</td><td>${eff[2].toFixed(1)}</td>` +
    `<td>${S.A1}°</td><td>${S.A2}°</td><td>${S.A3}°</td>` +
    `<td>${In.toFixed(2)}</td><td>${statusLbl[st] || st}</td>`;

  const btn = document.getElementById('recBtn');
  btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 500);
}
function clearObs() {
  observations = [];
  document.getElementById('obsBody').innerHTML = '<tr><td colspan="9" class="tbl-empty">No readings yet</td></tr>';
}
function exportCSV() {
  if (!observations.length) return;
  const h = '#,I1(A),I2(A),I3(A),A1(deg),A2(deg),A3(deg),In(A),Status';
  const rows = observations.map(o => [o.n, o.I1.toFixed(1), o.I2.toFixed(1), o.I3.toFixed(1), o.A1, o.A2, o.A3, o.In.toFixed(2), o.status].join(','));
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
  a.download = 'pdu_observations.csv'; a.click();
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
resize();
updateDashboard();
requestAnimationFrame(draw);
