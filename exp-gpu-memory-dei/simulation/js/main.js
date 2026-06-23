
// ══════════════════════════════════
//  CONSTANTS & STATE
// ══════════════════════════════════
const PARAM_STEPS  = [1, 7, 13, 30, 70, 100];
const PARAM_LABELS = ['1B','7B','13B','30B','70B','100B'];
const CTX_STEPS    = [512, 2048, 8192, 16384, 32768];
const CTX_LABELS   = ['512','2K','8K','16K','32K'];
const BATCH_STEPS  = [1, 4, 8, 16, 64, 128];
const BATCH_LABELS = ['1','4','8','16','64','128'];

// Realistic architecture dimensions per model size
const ARCH = {
  1:  {d: 2048, nl: 22},
  7:  {d: 4096, nl: 32},
  13: {d: 5120, nl: 40},
  30: {d: 6656, nl: 60},
  70: {d: 8192, nl: 80},
  100:{d: 8192, nl: 96}
};

// Simulation state
let S = {
  paramIdx: 1,  // → 7B
  qb:       16, // FP16
  ctxIdx:   1,  // → 2048
  batchIdx: 0,  // → 1
  vram:     80, // GB
  gpuCount: 1
};

function getN()     { return PARAM_STEPS[S.paramIdx]; }
function getCtx()   { return CTX_STEPS[S.ctxIdx]; }
function getBatch() { return BATCH_STEPS[S.batchIdx]; }

// ── Memory equations ──
// M_weights = N × (Qb/8) × 1.2   [GB]
function calcWeights(N, qb) {
  return (N * 1e9 * (qb / 8) * 1.2) / 1e9;
}
// M_cache = 2 × B × L × D_model × N_layers × (Qb/8)   [GB]
function calcKVCache(N, qb, L, B) {
  const a = ARCH[N] || ARCH[7];
  return (2 * B * L * a.d * a.nl * (qb / 8)) / 1e9;
}

// ── Rough throughput heuristic ──
function estimateTPS(N, qb, L, B) {
  const base     = 500 / N;
  const qMul     = {32:0.5, 16:1.0, 8:1.8, 4:3.2}[qb] || 1;
  const ctxPen   = Math.max(0.2, 1 - L / 65536);
  const bBoost   = Math.sqrt(B);
  return Math.max(1, Math.round(base * qMul * ctxPen * bBoost * 10));
}

function fmtCtx(L) { return L >= 1000 ? (L / 1024).toFixed(0) + 'K' : String(L); }

// ══════════════════════════════════
//  CANVAS
// ══════════════════════════════════
const canvas = document.getElementById('c');
const ctx2   = canvas.getContext('2d');
let animT    = 0;
let oomShake = 0;

function resize() {
  const vp = document.getElementById('vp');
  canvas.width  = vp.clientWidth;
  canvas.height = vp.clientHeight;
}
window.addEventListener('resize', resize);
resize();

// ── Path helpers ──
function pathRoundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + w - r, y);    cx.arcTo(x + w, y,     x + w, y + r,     r);
  cx.lineTo(x + w, y + h - r);cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x + r, y + h);    cx.arcTo(x,     y + h, x,     y + h - r, r);
  cx.lineTo(x, y + r);        cx.arcTo(x,     y,     x + r, y,         r);
  cx.closePath();
}
function pathRoundLeft(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.lineTo(x + w, y); cx.lineTo(x + w, y + h); cx.lineTo(x + r, y + h);
  cx.arcTo(x, y + h, x, y + h - r, r); cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r);
  cx.closePath();
}
function pathRoundRight(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x, y); cx.lineTo(x + w - r, y);
  cx.arcTo(x + w, y, x + w, y + r, r);
  cx.lineTo(x + w, y + h - r);
  cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x, y + h); cx.closePath();
}

function draw() {
  requestAnimationFrame(draw);
  animT += 0.018;

  const W = canvas.width, H = canvas.height;
  ctx2.clearRect(0, 0, W, H);

  const N    = getN();
  const qb   = S.qb;
  const L    = getCtx();
  const B    = getBatch();
  const vram = S.vram;
  const mW   = calcWeights(N, qb);
  const mK   = calcKVCache(N, qb, L, B);
  const mT   = mW + mK;
  const oom  = mT > vram;

  // ── GPU chip position & size ──
  const chipCX = W / 2;
  const chipCY = H * 0.42;
  const chipW  = Math.min(W * 0.56, 340);
  const chipH  = Math.min(H * 0.38, 190);

  // Shake effect on OOM
  let ox = 0, oy = 0;
  if (oom && oomShake > 0) {
    ox = (Math.random() - 0.5) * 7 * oomShake;
    oy = (Math.random() - 0.5) * 4 * oomShake;
    oomShake = Math.max(0, oomShake - 0.04);
  }

  const bx = chipCX - chipW / 2 + ox;
  const by = chipCY - chipH / 2 + oy;

  // ── GPU body ──
  const stackSize = S.gpuCount > 1 ? Math.min(Math.ceil(Math.log2(S.gpuCount)) + 1, 6) : 1;
  for (let i = stackSize - 1; i >= 0; i--) {
    const cx = bx + i * 8;
    const cy = by - i * 8;
    
    if (i === stackSize - 1) {
      ctx2.shadowColor = 'rgba(0,0,0,0.14)';
      ctx2.shadowBlur  = 30;
    } else {
      ctx2.shadowBlur  = 0;
    }

    ctx2.fillStyle   = oom ? '#FEF2F2' : '#1E293B';
    pathRoundRect(ctx2, cx, cy, chipW, chipH, 14);
    ctx2.fill();

    ctx2.strokeStyle = oom ? '#DC2626' : '#334155';
    ctx2.lineWidth   = oom ? 2 : 1.5;
    pathRoundRect(ctx2, cx, cy, chipW, chipH, 14);
    ctx2.stroke();
  }
  ctx2.shadowBlur = 0;

  // Inner bezel
  ctx2.strokeStyle = oom ? 'rgba(220,38,38,.25)' : 'rgba(148,163,184,.16)';
  ctx2.lineWidth   = 1;
  pathRoundRect(ctx2, bx + 8, by + 8, chipW - 16, chipH - 16, 10);
  ctx2.stroke();
  
  if (S.gpuCount > 1) {
    ctx2.font = '600 11px system-ui,-apple-system,sans-serif';
    ctx2.fillStyle = oom ? 'rgba(220,38,38,0.85)' : 'rgba(148,163,184,0.85)';
    ctx2.textAlign = 'left';
    ctx2.fillText(`${S.gpuCount}x GPU Cluster`, bx + 22, by + 24);
  }

  // ── VRAM bar region ──
  const barPad = 22;
  const barX = bx + barPad;
  const barY = by + 36;
  const barW = chipW - barPad * 2;
  const barH = chipH - 70;

  // Background track
  ctx2.fillStyle = 'rgba(255,255,255,0.07)';
  pathRoundRect(ctx2, barX, barY, barW, barH, 6);
  ctx2.fill();

  // Ratios (clamped to available space)
  const wRatio = Math.min(mW / vram, 1);
  const kRatio = Math.min(mK / vram, 1 - wRatio);
  const tRatio = Math.min(mT / vram, 1);

  // Weights fill (blue)
  if (wRatio > 0.001) {
    const gW = ctx2.createLinearGradient(barX, 0, barX + barW * wRatio, 0);
    gW.addColorStop(0, '#1D4ED8');
    gW.addColorStop(1, '#3B82F6');
    ctx2.fillStyle = gW;
    if (kRatio < 0.001) {
      pathRoundRect(ctx2, barX, barY, barW * wRatio, barH, 6);
    } else {
      pathRoundLeft(ctx2, barX, barY, barW * wRatio, barH, 6);
    }
    ctx2.fill();
  }

  // KV Cache fill (purple)
  if (kRatio > 0.001) {
    const kx = barX + barW * wRatio;
    const kw = barW * kRatio;
    const gK = ctx2.createLinearGradient(kx, 0, kx + kw, 0);
    gK.addColorStop(0, '#6D28D9');
    gK.addColorStop(1, '#A78BFA');
    ctx2.fillStyle = gK;
    pathRoundRight(ctx2, kx, barY, kw, barH, 6);
    ctx2.fill();
  }

  // OOM overflow flash overlay
  if (oom) {
    const flash = 0.4 + 0.4 * Math.sin(animT * 6);
    ctx2.fillStyle = `rgba(220,38,38,${flash * 0.35})`;
    pathRoundRect(ctx2, barX, barY, barW, barH, 6);
    ctx2.fill();
    ctx2.strokeStyle = `rgba(220,38,38,${0.55 + 0.45 * Math.sin(animT * 6)})`;
    ctx2.lineWidth = 2;
    pathRoundRect(ctx2, barX - 1, barY - 1, barW + 2, barH + 2, 7);
    ctx2.stroke();
  }


  // Bar label: "GPU MEMORY"
  ctx2.font      = '600 11px system-ui,-apple-system,sans-serif';
  ctx2.fillStyle = oom ? 'rgba(220,38,38,0.85)' : 'rgba(148,163,184,0.65)';
  ctx2.textAlign = 'center';
  ctx2.fillText('GPU MEMORY', chipCX + ox, barY - 10 + oy);

  // Centre readout inside bar
  const fontSize = Math.max(10, Math.min(13, chipW * 0.038));
  ctx2.font      = `600 ${fontSize}px ui-monospace,monospace`;
  ctx2.fillStyle = oom ? 'rgba(255,200,200,0.95)' : 'rgba(255,255,255,0.88)';
  ctx2.textAlign = 'center';
  const readout  = oom
    ? `OOM  ${mT.toFixed(1)} / ${vram} GB`
    : `${mT.toFixed(1)} / ${vram} GB`;
  ctx2.fillText(readout, chipCX + ox, barY + barH / 2 + oy + fontSize * 0.35);

  // Sub-labels below bar
  const lblY = barY + barH + 16 + oy;
  ctx2.font  = '500 10px system-ui,-apple-system,sans-serif';
  if (!oom) {
    ctx2.fillStyle = 'rgba(148,163,184,0.8)';
    ctx2.textAlign = 'left';
    ctx2.fillText('Weights: ' + mW.toFixed(1) + ' GB', barX, lblY);
    ctx2.textAlign = 'right';
    ctx2.fillText('KV Cache: ' + mK.toFixed(1) + ' GB', barX + barW, lblY);
  } else {
    ctx2.fillStyle = 'rgba(220,38,38,0.75)';
    ctx2.textAlign = 'center';
    ctx2.fillText('Overflow: +' + (mT - vram).toFixed(1) + ' GB beyond capacity', chipCX + ox, lblY);
  }

  // Config tag below chip
  const tagY = by + chipH + 22;
  ctx2.font      = '500 11px system-ui,-apple-system,sans-serif';
  ctx2.fillStyle = oom ? '#DC2626' : '#64748B';
  ctx2.textAlign = 'center';
  ctx2.fillText(N + 'B params · ' + qb + '-bit · ctx ' + fmtCtx(L) + ' · batch ' + B, chipCX, tagY);

  // Throughput / failure line
  const tpsY = tagY + 20;
  if (!oom) {
    const tps = estimateTPS(N, qb, L, B);
    const isWaste = (mT / vram) < 0.2;
    ctx2.font      = '600 13px ui-monospace,monospace';
    ctx2.fillStyle = isWaste ? '#2563EB' : '#22C55E';
    ctx2.textAlign = 'center';
    ctx2.fillText('~' + tps + ' tok/s' + (isWaste ? ' (UNDERUTILIZED)' : ''), chipCX, tpsY);
    ctx2.font      = '400 10px system-ui,-apple-system,sans-serif';
    ctx2.fillStyle = isWaste ? '#3B82F6' : '#94A3B8';
    ctx2.fillText(isWaste ? 'Resource waste detected' : 'estimated throughput', chipCX, tpsY + 16);
  } else {
    ctx2.font      = '700 13px ui-monospace,monospace';
    ctx2.fillStyle = '#DC2626';
    ctx2.textAlign = 'center';
    ctx2.fillText('DEPLOYMENT FAILED', chipCX, tpsY);
  }
}

// ══════════════════════════════════
//  UI UPDATE (sidebar + dashboard)
// ══════════════════════════════════
function update() {
  const N    = getN();
  const qb   = S.qb;
  const L    = getCtx();
  const B    = getBatch();
  const vram = S.vram;
  const mW   = calcWeights(N, qb);
  const mK   = calcKVCache(N, qb, L, B);
  const mT   = mW + mK;
  const oom  = mT > vram;
  const pct  = (mT / vram) * 100;

  // ── Sidebar VRAM bar ──
  const wPct = Math.min(mW / vram, 1) * 100;
  const kPct = Math.min(mK / vram, 1 - wPct / 100) * 100;
  document.getElementById('segW').style.width = wPct + '%';
  document.getElementById('segK').style.width = kPct + '%';
  document.getElementById('segK').style.left  = wPct + '%';

  document.getElementById('vramUsed').textContent = mT.toFixed(2) + ' GB used';
  const freeEl = document.getElementById('vramFree');
  if (oom) {
    freeEl.textContent = 'OOM  +' + (mT - vram).toFixed(1) + ' GB';
    freeEl.style.color = 'var(--red)';
    freeEl.style.fontWeight = '600';
  } else {
    freeEl.textContent  = (vram - mT).toFixed(1) + ' GB free';
    freeEl.style.color  = 'var(--t3)';
    freeEl.style.fontWeight = '400';
  }

  // ── Dashboard cards ──
  const vramPerGpu = vram / S.gpuCount;
  const freePerGpu = (vram - mT) / S.gpuCount;
  const wPerGpu    = mW / S.gpuCount;
  const kPerGpu    = mK / S.gpuCount;

  // Weights leaving too little room?
  const wCls = (vramPerGpu - wPerGpu) <= 4 ? 'crit' : (vramPerGpu - wPerGpu) <= 10 ? 'hot' : '';
  setDC('dcWeights', 'vW',    mW.toFixed(2), wCls);
  
  // KV Cache nearing available space?
  const availForKv = vramPerGpu - wPerGpu;
  const kCls = kPerGpu >= availForKv - 2 ? 'crit' : kPerGpu >= availForKv - 6 ? 'hot' : kPerGpu >= availForKv - 12 ? 'warn' : '';
  setDC('dcKV',      'vKV',   mK.toFixed(2), kCls);

  // Total deployment status based on free GB per GPU
  const tCls = oom ? 'crit' : pct < 20 ? 'waste' : freePerGpu <= 2 ? 'crit' : freePerGpu <= 6 ? 'hot' : freePerGpu <= 12 ? 'warn' : 'good';
  setDC('dcTotal',   'vTotal', mT.toFixed(2), tCls);
  setDC('dcUtil',    'vUtil',  pct.toFixed(1), tCls);

  const statusCard = document.getElementById('dcStatus');
  const vStatusEl  = document.getElementById('vStatus');
  const vSubEl     = document.getElementById('vStatusSub');
  if (oom) {
    statusCard.className   = 'dc crit';
    vStatusEl.textContent  = 'OOM';
    vSubEl.textContent     = 'Deploy Failed';
  } else if (pct < 20) {
    statusCard.className   = 'dc waste';
    vStatusEl.textContent  = 'Underused';
    vSubEl.textContent     = 'Wasting Compute';
  } else {
    statusCard.className   = 'dc good';
    vStatusEl.textContent  = 'OK';
    vSubEl.textContent     = 'Running';
  }

  // ── Header pill ──
  const pill = document.getElementById('statusPill');
  const ptxt = document.getElementById('statusTxt');
  if (oom)        { pill.className = 'hd-pill pill-oom';  ptxt.textContent = 'CUDA OOM'; }
  else if (pct<20){ pill.className = 'hd-pill pill-waste';ptxt.textContent = 'Underutilized'; }
  else if (freePerGpu<=6){ pill.className = 'hd-pill pill-warn'; ptxt.textContent = 'High Usage'; }
  else            { pill.className = 'hd-pill pill-ok';   ptxt.textContent = 'Deployed'; }

  // ── OOM overlay ──
  const overlay = document.getElementById('oomOverlay');
  if (oom) {
    overlay.classList.add('visible');
    document.getElementById('oomDetail').textContent =
      `Required : ${mT.toFixed(2)} GB\n` +
      `Available: ${vram} GB\n` +
      `Overflow : +${(mT - vram).toFixed(2)} GB\n\n` +
      `Weights  : ${mW.toFixed(2)} GB\n` +
      `KV Cache : ${mK.toFixed(2)} GB`;
    oomShake = 1;
  } else {
    overlay.classList.remove('visible');
  }

  // ── Batch value chip colour ──
  const vBatchEl = document.getElementById('vBatch');
  if      (B >= 64) vBatchEl.className = 'sl-val crit';
  else if (B >= 16) vBatchEl.className = 'sl-val hot';
  else if (B >= 8)  vBatchEl.className = 'sl-val warn';
  else              vBatchEl.className = 'sl-val';

  updateCalcPanel();
}

function setDC(cardId, valId, val, cls) {
  document.getElementById(cardId).className = 'dc' + (cls ? ' ' + cls : '');
  document.getElementById(valId).textContent = val;
}

// ══════════════════════════════════
//  SLIDER CONTROLS
// ══════════════════════════════════
function fillSlider(el, pct) {
  el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
}

document.getElementById('slParams').addEventListener('input', function() {
  S.paramIdx = +this.value;
  document.getElementById('vParams').textContent = PARAM_LABELS[S.paramIdx];
  fillSlider(this, (S.paramIdx / 5) * 100);
  update();
});

document.getElementById('slCtx').addEventListener('input', function() {
  S.ctxIdx = +this.value;
  const L  = CTX_STEPS[S.ctxIdx];
  const el = document.getElementById('vCtx');
  el.textContent = fmtCtx(L);
  el.className   = 'sl-val' + (L >= 32768 ? ' crit' : L >= 16384 ? ' hot' : L >= 8192 ? ' warn' : '');
  fillSlider(this, (S.ctxIdx / 4) * 100);
  update();
});

document.getElementById('slBatch').addEventListener('input', function() {
  S.batchIdx = +this.value;
  document.getElementById('vBatch').textContent = BATCH_LABELS[S.batchIdx];
  fillSlider(this, (S.batchIdx / 5) * 100);
  update();
});

document.getElementById('gpuSelect').addEventListener('change', function() {
  S.vram = +this.value;
  const opt = this.options[this.selectedIndex];
  S.gpuCount = +(opt.dataset.count || 1);
  document.getElementById('vramCapLabel').textContent = opt.dataset.label || this.value + ' GB';
  update();
});

// ── Quantization buttons ──
function setQuant(qb) {
  S.qb = qb;
  document.querySelectorAll('.q-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.qb === qb);
  });
  update();
}

// ── Preset scenarios ──
// Args: paramIdx, qb, ctxIdx, batchIdx, vramVal
function setPreset(paramIdx, qb, ctxIdx, batchIdx, vramVal) {
  S.paramIdx  = paramIdx;
  S.qb        = qb;
  S.ctxIdx    = ctxIdx;
  S.batchIdx  = batchIdx;
  if (vramVal) {
    S.vram = vramVal;
    const select = document.getElementById('gpuSelect');
    select.value = vramVal;
    const opt = select.options[select.selectedIndex];
    S.gpuCount = opt ? +(opt.dataset.count || 1) : 1;
    document.getElementById('vramCapLabel').textContent = opt ? (opt.dataset.label || vramVal + ' GB') : vramVal + ' GB';
  }

  const slP = document.getElementById('slParams');
  slP.value  = paramIdx;
  fillSlider(slP, (paramIdx / 5) * 100);
  document.getElementById('vParams').textContent = PARAM_LABELS[paramIdx];

  const slC = document.getElementById('slCtx');
  slC.value  = ctxIdx;
  fillSlider(slC, (ctxIdx / 4) * 100);
  const L = CTX_STEPS[ctxIdx];
  const ctxEl = document.getElementById('vCtx');
  ctxEl.textContent = fmtCtx(L);
  ctxEl.className   = 'sl-val' + (L >= 32768 ? ' crit' : L >= 16384 ? ' hot' : L >= 8192 ? ' warn' : '');

  const slB = document.getElementById('slBatch');
  slB.value  = batchIdx;
  fillSlider(slB, (batchIdx / 5) * 100);
  document.getElementById('vBatch').textContent = BATCH_LABELS[batchIdx];

  document.querySelectorAll('.q-btn').forEach(btn => {
    btn.classList.toggle('active', +btn.dataset.qb === qb);
  });

  update();
}

function dismissOOM() {
  document.getElementById('oomOverlay').classList.remove('visible');
}

// ══════════════════════════════════
//  EQUATIONS PANEL
// ══════════════════════════════════
let calcOpen = false;
function toggleCalc() {
  calcOpen = !calcOpen;
  const btn  = document.getElementById('btnCalc');
  const sect = document.getElementById('calcSect');
  btn.className   = 'hd-btn' + (calcOpen ? ' on' : '');
  btn.textContent = calcOpen ? 'Close Equations' : 'Equations';
  sect.style.display = calcOpen ? 'flex' : 'none';
  if (calcOpen) updateCalcPanel();
}

function updateCalcPanel() {
  if (!calcOpen) return;
  const N    = getN();
  const qb   = S.qb;
  const L    = getCtx();
  const B    = getBatch();
  const a    = ARCH[N] || ARCH[7];
  const mW   = calcWeights(N, qb);
  const mK   = calcKVCache(N, qb, L, B);
  const mT   = mW + mK;
  const oom  = mT > S.vram;
  const hlT  = oom ? 'hl-r' : 'hl';

  document.getElementById('calcInner').innerHTML =
    `<b>M<sub>weights</sub> = N &times; (Q<sub>b</sub>/8) &times; 1.2</b><br>` +
    `&nbsp;&nbsp;= ${N}&times;10<sup>9</sup> &times; (${qb}/8) &times; 1.2<br>` +
    `&nbsp;&nbsp;= <span class="hl">${mW.toFixed(3)} GB</span><br><br>` +

    `<b>M<sub>cache</sub> = 2 &times; B &times; L &times; D<sub>model</sub> &times; N<sub>layers</sub> &times; (Q<sub>b</sub>/8)</b><br>` +
    `&nbsp;&nbsp;= 2 &times; ${B} &times; ${L.toLocaleString()} &times; ${a.d} &times; ${a.nl} &times; (${qb}/8)<br>` +
    `&nbsp;&nbsp;= <span class="hl">${mK.toFixed(3)} GB</span><br><br>` +

    `<b>M<sub>total</sub> = M<sub>weights</sub> + M<sub>cache</sub></b><br>` +
    `&nbsp;&nbsp;= ${mW.toFixed(3)} + ${mK.toFixed(3)}<br>` +
    `&nbsp;&nbsp;= <span class="${hlT}">${mT.toFixed(3)} GB</span>` +
    (oom
      ? ` &nbsp;<span class="hl-r">&#9888; exceeds ${S.vram} GB</span>`
      : ` &nbsp;&#10003; fits in ${S.vram} GB`);
}

// ══════════════════════════════════
//  OBSERVATIONS TABLE
// ══════════════════════════════════
let observations = [];

function recordObs() {
  const N   = getN();
  const qb  = S.qb;
  const L   = getCtx();
  const B   = getBatch();
  const mW  = calcWeights(N, qb);
  const mK  = calcKVCache(N, qb, L, B);
  const mT  = mW + mK;
  const oom = mT > S.vram;
  const n   = observations.length + 1;
  observations.push({n, N, qb, L, B, mW, mK, mT, oom});

  const tbody = document.getElementById('obsBody');
  if (n === 1) tbody.innerHTML = '';
  const row = tbody.insertRow();
  const statusColor = oom ? 'color:var(--red);font-weight:700' : 'color:var(--green);font-weight:700';
  row.innerHTML =
    `<td>${n}</td>` +
    `<td>${N}B</td>` +
    `<td>${qb}b</td>` +
    `<td>${fmtCtx(L)}</td>` +
    `<td>${B}</td>` +
    `<td>${mW.toFixed(2)}</td>` +
    `<td>${mK.toFixed(2)}</td>` +
    `<td>${mT.toFixed(2)}</td>` +
    `<td style="${statusColor}">${oom ? 'OOM' : 'OK'}</td>`;

  const btn = document.getElementById('recBtn');
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), 500);

  // Auto-scroll table
  const wrap = tbody.closest('.tbl-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function clearObs() {
  observations = [];
  document.getElementById('obsBody').innerHTML =
    '<tr><td colspan="9" class="tbl-empty">No readings yet — adjust parameters and record</td></tr>';
}

function exportCSV() {
  if (!observations.length) return;
  const h    = '#,Params(B),Qb(bit),Context,Batch,Weights(GB),KVCache(GB),Total(GB),Status';
  const rows = observations.map(o =>
    [o.n, o.N, o.qb, o.L, o.B,
     o.mW.toFixed(3), o.mK.toFixed(3), o.mT.toFixed(3),
     o.oom ? 'OOM' : 'OK'].join(',')
  );
  const a   = document.createElement('a');
  a.href    = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
  a.download = 'llm_memory_observations.csv';
  a.click();
}

// ══════════════════════════════════
//  INIT
// ══════════════════════════════════
fillSlider(document.getElementById('slParams'), (S.paramIdx / 5) * 100);
fillSlider(document.getElementById('slCtx'),    (S.ctxIdx   / 4) * 100);
fillSlider(document.getElementById('slBatch'),  (S.batchIdx / 5) * 100);
update();
requestAnimationFrame(draw);
