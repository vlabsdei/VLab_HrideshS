
// ══════════════════════════════════════
//  CONSTANTS & CONFIG
// ══════════════════════════════════════
const N_STEPS    = [4, 8, 16, 32, 64];
const GRAD_STEPS = [50, 200, 500, 1000, 2000];      // MB
const SPEED_STEPS= [100, 200, 400, 800];             // Gbps

const T_KERNEL_MS     = 0.4;   // per-node TCP/IP kernel-copy + context-switch overhead (ms)
const T_COMPUTE_MS    = 50;    // assumed fixed per-step compute time (ms)
const STRAGGLER_MS    = 40;    // extra sync delay injected by a straggler node (ms)

let S = { protocol:'tcp', nIdx:1, gradIdx:2, speedIdx:2, straggler:false };

let currentPhase = 'scatter-reduce';
let currentStep = 1;
let stepProgress = 0;
let simStatus = 'moving'; // 'moving' or 'paused'
let pauseDuration = 0.8; // seconds
let pauseTimeElapsed = 0; // seconds
let chunkContributions = [];
let isSimPlaying = true;

function togglePlay() {
  isSimPlaying = true;
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  if (btnPlay) btnPlay.classList.add('active');
  if (btnPause) btnPause.classList.remove('active');
}

function togglePause() {
  isSimPlaying = false;
  const btnPlay = document.getElementById('btnPlay');
  const btnPause = document.getElementById('btnPause');
  if (btnPlay) btnPlay.classList.remove('active');
  if (btnPause) btnPause.classList.add('active');
}

function resetProgress() {
  resetSimulationState();
  togglePlay();
  update();
}

function resetSimulationState() {
  currentPhase = 'scatter-reduce';
  currentStep = 1;
  stepProgress = 0;
  simStatus = 'moving';
  pauseTimeElapsed = 0;

  const N = getN();
  chunkContributions = [];
  for (let i = 0; i < N; i++) {
    const nodeChunks = [];
    for (let c = 0; c < N; c++) {
      nodeChunks.push(1);
    }
    chunkContributions.push(nodeChunks);
  }
}

function getN()        { return N_STEPS[S.nIdx]; }
function getGradMB()   { return GRAD_STEPS[S.gradIdx]; }
function getSpeedGbps(){ return SPEED_STEPS[S.speedIdx]; }

// Ring all-reduce theoretical sync latency (ms)
function calcTheoretical(N, gradMB, speedGbps){
  const bits = gradMB * 8e6;         // MB -> bits (decimal MB)
  const bps  = speedGbps * 1e9;
  return (2*(N-1)/N) * (bits/bps) * 1000;
}
function calcKernelOverhead(N, protocol){
  return protocol === 'tcp' ? N * T_KERNEL_MS : 0;
}
function calcStragglerExtra(active){
  return active ? STRAGGLER_MS : 0;
}
function calcTsyncActual(){
  const N = getN();
  return calcTheoretical(N, getGradMB(), getSpeedGbps())
       + calcKernelOverhead(N, S.protocol)
       + calcStragglerExtra(S.straggler);
}
function calcEfficiency(Tsync){
  return (T_COMPUTE_MS / (T_COMPUTE_MS + Tsync)) * 100;
}
function calcSpeedup(){
  const N = getN(), grad = getGradMB(), speed = getSpeedGbps();
  const theo = calcTheoretical(N, grad, speed);
  const strag = calcStragglerExtra(S.straggler);
  const tcpTotal  = theo + calcKernelOverhead(N,'tcp') + strag;
  const rdmaTotal = theo + calcKernelOverhead(N,'rdma') + strag;
  return tcpTotal / rdmaTotal;
}

// ══════════════════════════════════════
//  SLIDER FILL HELPER
// ══════════════════════════════════════
function fillSlider(el, pct){
  el.style.background = `linear-gradient(90deg,var(--blue) ${pct}%,var(--border2) ${pct}%)`;
}

// ══════════════════════════════════════
//  UI EVENT WIRING
// ══════════════════════════════════════
function setProto(p){
  S.protocol = p;
  document.getElementById('protoTCP').classList.toggle('active', p==='tcp');
  document.getElementById('protoRDMA').classList.toggle('active', p==='rdma');
  updateInfoCard(p);
  update();
}

function updateInfoCard(p){
  const card = document.getElementById('infoCard');
  const title = document.getElementById('infoTitle');
  const list = document.getElementById('infoList');
  if (p === 'tcp'){
    card.className = 'info-card tcp';
    title.textContent = 'TCP/IP Stack';
    list.innerHTML =
      '<li>Data copied user-space → kernel → NIC</li>' +
      '<li>Per-node kernel overhead: N × T<sub>kernel</sub></li>' +
      '<li>CPU involved in every transfer</li>' +
      '<li>Overhead grows linearly with cluster size</li>';
  } else {
    card.className = 'info-card rdma';
    title.textContent = 'RDMA (Hardware-Offloaded)';
    list.innerHTML =
      '<li>Direct GPU VRAM → NIC transfer</li>' +
      '<li>Zero kernel memory copies</li>' +
      '<li>Zero CPU involvement</li>' +
      '<li>Near-theoretical sync performance at scale</li>';
  }
}

// ══════════════════════════════════════
//  STRAGGLER TOGGLE
// ══════════════════════════════════════
function toggleStraggler(){
  S.straggler = !S.straggler;
  const btn = document.getElementById('stragBtn');
  const lbl = document.getElementById('stragLabel');
  btn.classList.toggle('active', S.straggler);
  lbl.textContent = 'Straggler Node — ' + (S.straggler ? 'Active' : 'Inactive');
  update();
}

document.getElementById('slN').addEventListener('input', function(){
  S.nIdx = +this.value;
  document.getElementById('vN').textContent = N_STEPS[S.nIdx];
  fillSlider(this, (S.nIdx/4)*100);
  resetSimulationState();
  update();
});
document.getElementById('slGrad').addEventListener('input', function(){
  S.gradIdx = +this.value;
  document.getElementById('vGrad').textContent = GRAD_STEPS[S.gradIdx] + ' MB';
  fillSlider(this, (S.gradIdx/4)*100);
  resetSimulationState();
  update();
});
document.getElementById('slSpeed').addEventListener('input', function(){
  S.speedIdx = +this.value;
  document.getElementById('vSpeed').textContent = SPEED_STEPS[S.speedIdx] + ' Gbps';
  fillSlider(this, (S.speedIdx/3)*100);
  resetSimulationState();
  update();
});

// setPreset(protocol, nIdx, gradIdx, speedIdx, straggler)
function setPreset(protocol, nIdx, gradIdx, speedIdx, straggler){
  S.protocol = protocol; S.nIdx = nIdx; S.gradIdx = gradIdx; S.speedIdx = speedIdx; S.straggler = straggler;

  document.getElementById('protoTCP').classList.toggle('active', protocol==='tcp');
  document.getElementById('protoRDMA').classList.toggle('active', protocol==='rdma');
  updateInfoCard(protocol);

  const slN = document.getElementById('slN');
  slN.value = nIdx; fillSlider(slN, (nIdx/4)*100);
  document.getElementById('vN').textContent = N_STEPS[nIdx];

  const slG = document.getElementById('slGrad');
  slG.value = gradIdx; fillSlider(slG, (gradIdx/4)*100);
  document.getElementById('vGrad').textContent = GRAD_STEPS[gradIdx] + ' MB';

  const slS = document.getElementById('slSpeed');
  slS.value = speedIdx; fillSlider(slS, (speedIdx/3)*100);
  document.getElementById('vSpeed').textContent = SPEED_STEPS[speedIdx] + ' Gbps';

  const btn = document.getElementById('stragBtn');
  const lbl = document.getElementById('stragLabel');
  btn.classList.toggle('active', straggler);
  lbl.textContent = 'Straggler Node — ' + (straggler ? 'Active' : 'Inactive');

  resetSimulationState();
  update();
}

function resetAll(){
  setPreset('tcp', 1, 2, 2, false);
  togglePlay();
}

// ══════════════════════════════════════
//  MAIN UPDATE (dashboard + status)
// ══════════════════════════════════════
function update(){
  const N = getN();
  const Tsync = calcTsyncActual();
  const kernelOH = calcKernelOverhead(N, S.protocol);
  const eff = calcEfficiency(Tsync);
  const speedup = calcSpeedup();

  document.getElementById('vKernel').textContent = kernelOH.toFixed(2);
  document.getElementById('vTsync').textContent  = Tsync.toFixed(2);
  document.getElementById('vEff').textContent    = eff.toFixed(1);
  document.getElementById('vSpeedup').textContent= speedup.toFixed(2);

  // Kernel card color
  const dcKernel = document.getElementById('dcKernel');
  dcKernel.className = 'dc' + (kernelOH === 0 ? ' good' : kernelOH > 15 ? ' crit' : kernelOH > 5 ? ' hot' : ' warn');

  // Sync latency card color
  const dcTsync = document.getElementById('dcTsync');
  dcTsync.className = 'dc' + (Tsync > 60 ? ' crit' : Tsync > 25 ? ' hot' : Tsync > 10 ? ' warn' : ' good');

  // Efficiency card color
  const dcEff = document.getElementById('dcEff');
  dcEff.className = 'dc' + (eff < 55 ? ' crit' : eff < 70 ? ' hot' : eff < 85 ? ' warn' : ' good');

  // Speedup card color
  const dcSpeedup = document.getElementById('dcSpeedup');
  dcSpeedup.className = 'dc' + (speedup > 2 ? ' good' : speedup > 1.3 ? ' warn' : ' good');

  // Rating + status pill
  const dcRating = document.getElementById('dcRating');
  const vRating = document.getElementById('vRating');
  const vRatingSub = document.getElementById('vRatingSub');
  const pill = document.getElementById('statusPill');
  const pillTxt = document.getElementById('statusTxt');
  let rating, sub, cls;
  if (S.straggler){
    rating='STALLED'; sub='straggler blocking'; cls='crit';
  } else if (Tsync > 60){
    rating='CRITICAL'; sub='high overhead'; cls='crit';
  } else if (Tsync > 25){
    rating='DEGRADED'; sub='rising latency'; cls='hot';
  } else if (Tsync > 10){
    rating='MODERATE'; sub='acceptable'; cls='warn';
  } else {
    rating='OPTIMAL'; sub='near-theoretical'; cls='good';
  }
  vRating.textContent = rating;
  vRatingSub.textContent = sub;
  dcRating.className = 'dc ' + cls;
  pill.className = 'hd-pill pill-' + (cls==='good'?'ok':cls==='warn'?'warn':cls==='hot'?'hot':'crit');
  pillTxt.textContent = S.straggler ? 'Straggler Stall' : (S.protocol==='tcp' ? 'TCP/IP Sync' : 'RDMA Sync');

  updateLegend();
  updateCalcPanel();
}

// ══════════════════════════════════════
//  LEGEND
// ══════════════════════════════════════
function updateLegend(){
  const isTcp = S.protocol === 'tcp';
  document.getElementById('legendContent').innerHTML =
    `<div class="legend-row">
      <span class="legend-swatch" style="background:${isTcp?'#EA580C':'#0891B2'}"></span>
      <div><b>GPU Node</b>: One cluster member holding a shard of the local gradient tensor.</div>
    </div>
    <div class="legend-row">
      <span class="legend-swatch" style="background:#FCA5A5;border:1px solid #DC2626"></span>
      <div><b>Straggler Node</b>: A hardware-slowed node that blocks the entire ring until it catches up.</div>
    </div>
    <div class="legend-row">
      <span style="display:inline-block;width:14px;height:3px;background:${isTcp?'#EA580C':'#0891B2'};margin-top:7px;flex-shrink:0"></span>
      <div><b>Ring Link</b>: Active path segment currently carrying a gradient chunk.</div>
    </div>
    <div class="legend-row">
      <span style="font-size:10px;color:#94A3B8;margin-top:1px;flex-shrink:0">▢</span>
      <div><b>Kernel Buffer</b>: Shown only in TCP/IP mode — the extra user↔kernel↔NIC memory-copy hop.</div>
    </div>`;
}

// ══════════════════════════════════════
//  CANVAS ENGINE — RING ALL-REDUCE
// ══════════════════════════════════════
const canvas = document.getElementById('c');
const cx = canvas.getContext('2d');
let animT = 0;

function resize(){
  const vp = document.getElementById('vp');
  canvas.width  = vp.clientWidth  * (window.devicePixelRatio || 1);
  canvas.height = vp.clientHeight * (window.devicePixelRatio || 1);
  canvas.style.width  = vp.clientWidth + 'px';
  canvas.style.height = vp.clientHeight + 'px';
  cx.setTransform(1,0,0,1,0,0);
  cx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
}
window.addEventListener('resize', resize);
resize();

function rr(x,y,w,h,r){
  cx.beginPath();
  cx.moveTo(x+r,y);
  cx.lineTo(x+w-r,y); cx.arcTo(x+w,y,x+w,y+r,r);
  cx.lineTo(x+w,y+h-r); cx.arcTo(x+w,y+h,x+w-r,y+h,r);
  cx.lineTo(x+r,y+h); cx.arcTo(x,y+h,x,y+h-r,r);
  cx.lineTo(x,y+r); cx.arcTo(x,y,x+r,y,r);
  cx.closePath();
}
function easeInOut(t){ return t<.5 ? 2*t*t : -1+(4-2*t)*t; }

function drawNode(x,y,r,color,active,isStraggler,pulse,labelText){
  if (isStraggler){
    cx.beginPath();
    cx.arc(x,y,r+5+pulse*3,0,Math.PI*2);
    cx.fillStyle = 'rgba(220,38,38,' + (0.15+pulse*0.15) + ')';
    cx.fill();
  } else if (active) {
    cx.beginPath();
    cx.arc(x,y,r+4,0,Math.PI*2);
    cx.fillStyle = color + '33';
    cx.fill();
  }
  cx.shadowColor = isStraggler ? 'rgba(220,38,38,.4)' : (active ? color+'55' : 'rgba(0,0,0,.08)');
  cx.shadowBlur = isStraggler||active ? 10 : 4;
  cx.beginPath();
  cx.arc(x,y,r,0,Math.PI*2);
  cx.fillStyle = isStraggler ? '#DC2626' : '#1E293B';
  cx.fill();
  cx.shadowBlur = 0;
  cx.strokeStyle = isStraggler ? '#DC2626' : color;
  cx.lineWidth = 2;
  cx.beginPath();
  cx.arc(x,y,r,0,Math.PI*2);
  cx.stroke();
  cx.fillStyle = 'rgba(255,255,255,.9)';
  cx.font = `600 ${Math.max(8,r*0.55)}px system-ui,sans-serif`;
  cx.textAlign = 'center';
  cx.fillText(labelText || (isStraggler ? '⚠' : 'G'), x, y + r*0.35);
}

function drawKernelBox(x,y,color){
  const w=34,h=14;
  cx.fillStyle = '#FFFFFF';
  cx.shadowColor = 'rgba(0,0,0,.04)';
  cx.shadowBlur = 3;
  cx.strokeStyle = color;
  cx.lineWidth = 1.5;
  rr(x-w/2,y-h/2,w,h,4);
  cx.fill(); cx.stroke();
  cx.shadowBlur = 0;
  cx.fillStyle = '#475569';
  cx.font = '700 7px system-ui,sans-serif';
  cx.textAlign = 'center';
  cx.fillText('KERNEL', x, y+2.5);
}

function drawPacket(x,y,color,size){
  const g = cx.createRadialGradient(x,y,0,x,y,size*4);
  g.addColorStop(0,color+'aa'); g.addColorStop(1,'transparent');
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(x,y,size*4,0,Math.PI*2); cx.fill();
  cx.beginPath(); cx.arc(x,y,size,0,Math.PI*2); cx.fillStyle = color; cx.fill();
  cx.beginPath(); cx.arc(x,y,size*0.4,0,Math.PI*2); cx.fillStyle='rgba(255,255,255,.85)'; cx.fill();
}

function drawRing(W,H){
  const N = getN();
  const isTcp = S.protocol === 'tcp';
  const color = isTcp ? '#EA580C' : '#0891B2';
  const isNarrow = W < 500;
  const cxp = W/2, cyp = H/2 + (isNarrow?4:0);
  const R = Math.min(W,H) * (isNarrow?0.30:0.33);
  const nodeR = N>32 ? (isNarrow?5:7) : N>16 ? (isNarrow?7:9) : (isNarrow?9:12);

  const stragIdx = Math.floor(N * 0.35);

  const pos = [];
  const kpos = [];  // kernel-box positions (one per node)
  for (let i=0;i<N;i++){
    const ang = -Math.PI/2 + i*(2*Math.PI/N);
    pos.push({x: cxp + R*Math.cos(ang), y: cyp + R*Math.sin(ang)});
    kpos.push({x: cxp + (R+nodeR+16)*Math.cos(ang), y: cyp + (R+nodeR+16)*Math.sin(ang)});
  }

  // Calculate pause duration
  const dur = S.straggler ? 3.0 : 0.8;

  // background ghost ring (always on node-to-node path for spatial context)
  cx.beginPath();
  for (let i=0;i<=N;i++){
    const p = pos[i % N];
    if (i===0) cx.moveTo(p.x,p.y); else cx.lineTo(p.x,p.y);
  }
  cx.strokeStyle = 'rgba(148,163,184,.25)';
  cx.lineWidth = 1;
  cx.setLineDash([3,4]);
  cx.stroke();
  cx.setLineDash([]);

  // active link segments — kernel-to-kernel in TCP, node-to-node in RDMA
  for (let i = 0; i < N; i++) {
    const a = isTcp ? kpos[i]       : pos[i];
    const b = isTcp ? kpos[(i+1)%N] : pos[(i+1)%N];
    cx.beginPath();
    cx.moveTo(a.x, a.y);
    cx.lineTo(b.x, b.y);
    cx.strokeStyle = color;
    cx.lineWidth = isNarrow ? 2 : 2.5;
    cx.shadowColor = color + '66';
    cx.shadowBlur = 8;
    cx.stroke();
    cx.shadowBlur = 0;
  }

  // nodes
  for (let i=0;i<N;i++){
    const isStrag = S.straggler && i===stragIdx;
    const active = true;
    const pulse = 0.5+0.5*Math.sin(animT*4+i);

    // Local sub-phase for node i
    let nodeSubPhase = 'receive';
    let nodeSubProgress = 0;
    if (simStatus === 'paused') {
      const t_local = isStrag ? (pauseTimeElapsed / dur) * 0.8 : Math.min(0.8, pauseTimeElapsed);
      const t_sub = t_local / 0.8;
      if (t_sub < 0.3) {
        nodeSubPhase = 'receive';
        nodeSubProgress = t_sub / 0.3;
      } else if (t_sub < 0.7) {
        nodeSubPhase = 'combine';
        nodeSubProgress = (t_sub - 0.3) / 0.4;
      } else {
        nodeSubPhase = 'forward';
        nodeSubProgress = Math.min(1.0, (t_sub - 0.7) / 0.3);
      }
    }

    let labelText = isStrag ? '⚠' : 'G';
    if (simStatus === 'paused' && !isStrag) {
      if (nodeSubPhase === 'receive') {
        labelText = '↓';
      } else if (nodeSubPhase === 'combine') {
        labelText = '+';
      } else if (nodeSubPhase === 'forward') {
        labelText = '↑';
      }
    }

    drawNode(pos[i].x,pos[i].y,nodeR,color,active,isStrag,pulse,labelText);

    // Combine phase expanding pulse wave
    if (simStatus === 'paused' && nodeSubPhase === 'combine' && !isStrag) {
      cx.beginPath();
      cx.arc(pos[i].x, pos[i].y, nodeR + 3 + nodeSubProgress * 6, 0, Math.PI * 2);
      cx.strokeStyle = 'rgba(245, 158, 11, ' + (1 - nodeSubProgress) + ')';
      cx.lineWidth = 1.5;
      cx.stroke();
    }

    // TCP kernel box just outside the node — use precomputed kpos for consistency
    if (isTcp){
      drawKernelBox(kpos[i].x, kpos[i].y, color);
    }

    // Gradient Chunk Grid below the node
    if (chunkContributions && chunkContributions[i]) {
      const cols = N === 4 ? 4 : 8;
      const rows = Math.ceil(N / cols);
      const cellSize = N === 4 ? 8 : N === 8 ? 6 : N === 16 ? 4.5 : N === 32 ? 3 : 2;
      const cellGap = N >= 32 ? 0.7 : 1;
      const gridW = cols * cellSize + (cols - 1) * cellGap;
      const gridH = rows * cellSize + (rows - 1) * cellGap;
      const startX = pos[i].x - gridW / 2;
      const startY = pos[i].y + nodeR + 6;

      const targetChunkIdx = (currentPhase === 'scatter-reduce')
        ? (i - currentStep + N) % N
        : (i + 1 - currentStep + N) % N;

      for (let c = 0; c < N; c++) {
        const col = c % cols;
        const row = Math.floor(c / cols);
        const cx_val = startX + col * (cellSize + cellGap);
        const cy_val = startY + row * (cellSize + cellGap);
        
        const contrib = chunkContributions[i][c];
        let fill = '#CBD5E1'; // neutral grey
        if (contrib === N) {
          fill = '#10B981'; // fully reduced (green)
        } else if (contrib > 1) {
          fill = '#F59E0B'; // partially reduced (orange)
        }
        
        cx.fillStyle = fill;
        cx.fillRect(cx_val, cy_val, cellSize, cellSize);

        // Highlight combining cell
        if (simStatus === 'paused' && nodeSubPhase === 'combine' && c === targetChunkIdx && !isStrag) {
          cx.strokeStyle = '#FFFFFF';
          cx.lineWidth = 1;
          cx.strokeRect(cx_val - 0.5, cy_val - 0.5, cellSize + 1, cellSize + 1);
        }
      }
    }
  }

  // packets along all active segments
  for (let i = 0; i < N; i++) {
    const a = pos[i];
    const b = pos[(i + 1) % N];
    
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const ux = dx / dist;
    const uy = dy / dist;

    // Kernel-box positions for this link's sender (a) and receiver (b)
    const kx_a = kpos[i].x,         ky_a = kpos[i].y;
    const kx_b = kpos[(i+1)%N].x,   ky_b = kpos[(i+1)%N].y;

    let px, py;
    let opacity = 1;
    let showPacketItem = true;
    let labelChunkIdx = (currentPhase === 'scatter-reduce')
      ? (i - (currentStep - 1) + N) % N
      : (i + 2 - currentStep + N) % N;

    if (simStatus === 'moving') {
      if (isTcp) {
        // TCP: moving phase = pure wire transfer, kernel_a → kernel_b (node↔kernel legs are in paused sub-phases)
        const t = easeInOut(stepProgress);
        px = kx_a + (kx_b - kx_a) * t;
        py = ky_a + (ky_b - ky_a) * t;
      } else {
        px = a.x + ux * nodeR + (dist - 2 * nodeR) * easeInOut(stepProgress) * ux;
        py = a.y + uy * nodeR + (dist - 2 * nodeR) * easeInOut(stepProgress) * uy;
      }
    } else if (simStatus === 'paused') {
      // Determine per-link straggler slowdown
      const isStragLink = S.straggler && (i === stragIdx || (i + 1) % N === stragIdx);
      const t_local = isStragLink ? (pauseTimeElapsed / dur) * 0.8 : Math.min(0.8, pauseTimeElapsed);
      const t_sub = t_local / 0.8;

      let subPhase = 'receive';
      let subProgress = 0;
      if (t_sub < 0.3) {
        subPhase = 'receive';
        subProgress = easeInOut(t_sub / 0.3);
      } else if (t_sub < 0.7) {
        subPhase = 'combine';
        subProgress = easeInOut((t_sub - 0.3) / 0.4);
      } else {
        subPhase = 'forward';
        subProgress = easeInOut(Math.min(1.0, (t_sub - 0.7) / 0.3));
      }

      if (subPhase === 'receive') {
        if (isTcp) {
          // kernel_b → node_b  (incoming kernel copy, independent easing)
          px = kx_b + (b.x - kx_b) * subProgress;
          py = ky_b + (b.y - ky_b) * subProgress;
        } else {
          px = b.x - (1 - subProgress) * ux * nodeR;
          py = b.y - (1 - subProgress) * uy * nodeR;
        }
      } else if (subPhase === 'combine') {
        px = b.x;
        py = b.y;
        opacity = 1 - subProgress;
      } else if (subPhase === 'forward') {
        if (isTcp) {
          // node_b → kernel_b  (outgoing kernel copy — seals the loop seamlessly into next moving step)
          px = b.x + (kx_b - b.x) * subProgress;
          py = b.y + (ky_b - b.y) * subProgress;
        } else {
          const nextTarget = pos[(i + 2) % N];
          const ndx = nextTarget.x - b.x;
          const ndy = nextTarget.y - b.y;
          const ndist = Math.sqrt(ndx*ndx + ndy*ndy);
          const nux = ndx / ndist;
          const nuy = ndy / ndist;
          px = b.x + subProgress * nux * nodeR;
          py = b.y + subProgress * nuy * nodeR;
        }

        const nextStep = (currentStep === N - 1) ? 1 : currentStep + 1;
        const nextPhase = (currentStep === N - 1) ? (currentPhase === 'scatter-reduce' ? 'all-gather' : 'scatter-reduce') : currentPhase;
        labelChunkIdx = (nextPhase === 'scatter-reduce')
          ? ((i + 1) - (nextStep - 1) + N) % N
          : ((i + 1) + 2 - nextStep + N) % N;
      }
    }

    if (showPacketItem) {
      cx.save();
      cx.globalAlpha = opacity;
      drawPacket(px, py, color, isNarrow ? 5 : 7);

      // Draw chunk label next to packet for N <= 8
      if (N <= 8) {
        const chunkLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const chunkLabel = labelChunkIdx < chunkLetters.length ? chunkLetters[labelChunkIdx] : 'C' + labelChunkIdx;
        
        cx.fillStyle = color;
        cx.font = '700 9px system-ui, sans-serif';
        cx.textAlign = 'center';
        cx.fillText(chunkLabel, px, py - 8);
      }
      cx.restore();
    }
  }

  // Center readout badge
  const Tsync = calcTsyncActual();
  const badgeW = isNarrow?96:118, badgeH = isNarrow?44:52;
  cx.fillStyle = 'rgba(255,255,255,.96)';
  cx.shadowColor='rgba(0,0,0,.1)'; cx.shadowBlur=10;
  rr(cxp-badgeW/2, cyp-badgeH/2, badgeW, badgeH, 10);
  cx.fill(); cx.shadowBlur=0;
  cx.strokeStyle = color+'88'; cx.lineWidth=1;
  rr(cxp-badgeW/2, cyp-badgeH/2, badgeW, badgeH, 10);
  cx.stroke();
  cx.fillStyle = color;
  cx.font = `700 ${isNarrow?15:18}px ui-monospace,monospace`;
  cx.textAlign='center';
  cx.fillText(Tsync.toFixed(2)+' ms', cxp, cyp-2);
  cx.fillStyle = '#94A3B8';
  cx.font = `500 ${isNarrow?8:9}px system-ui,sans-serif`;
  cx.fillText(isTcp?'TCP/IP · N='+N:'RDMA · N='+N, cxp, cyp+14);
  if (S.straggler){
    cx.fillStyle = '#DC2626';
    cx.font = `700 ${isNarrow?8:9}px system-ui,sans-serif`;
    cx.fillText('⚠ STRAGGLER BLOCKING', cxp, cyp+26);
  }

  // Labels
  cx.fillStyle = 'rgba(148,163,184,.7)';
  cx.font = `500 9px system-ui,sans-serif`;
  cx.textAlign='left';
  cx.fillText('RING ALL-REDUCE', 8, 16);
}

function draw(){
  const N = getN();
  const stragIdx = Math.floor(N * 0.35);

  pauseDuration = S.straggler ? 3.0 : 0.8;
  
  if (isSimPlaying) {
    animT += 0.016;

    if (simStatus === 'moving') {
      let stepSpeed = 0.8;
      stepProgress += 0.016 * stepSpeed;
      if (stepProgress >= 1) {
        stepProgress = 1;
        simStatus = 'paused';
        pauseTimeElapsed = 0;

        // Update chunk contributions at arrival
        if (chunkContributions && chunkContributions.length > 0) {
          const nextContributions = JSON.parse(JSON.stringify(chunkContributions));
          if (currentPhase === 'scatter-reduce') {
            for (let i = 0; i < N; i++) {
              const r = (i + 1) % N;
              const c = (i - (currentStep - 1) + N) % N;
              nextContributions[r][c] = Math.min(N, chunkContributions[r][c] + chunkContributions[i][c]);
            }
          } else {
            // All-Gather
            for (let i = 0; i < N; i++) {
              const r = (i + 1) % N;
              const c = (i + 2 - currentStep + N) % N;
              nextContributions[r][c] = N;
            }
          }
          chunkContributions = nextContributions;
        }
      }
    } else if (simStatus === 'paused') {
      pauseTimeElapsed += 0.016;
      if (pauseTimeElapsed >= pauseDuration) {
        simStatus = 'moving';
        stepProgress = 0;
        currentStep++;
        if (currentStep > N - 1) {
          currentStep = 1;
          if (currentPhase === 'scatter-reduce') {
            currentPhase = 'all-gather';
          } else {
            currentPhase = 'scatter-reduce';
            // Reset chunk contributions for the new round
            chunkContributions = [];
            for (let i = 0; i < N; i++) {
              const nodeChunks = [];
              for (let c = 0; c < N; c++) {
                nodeChunks.push(1);
              }
              chunkContributions.push(nodeChunks);
            }
          }
        }
      }
    }
  }

  // Update HTML Overlay
  const overlayPhase = document.getElementById('overlayPhase');
  const overlayStep = document.getElementById('overlayStep');
  if (overlayPhase && overlayStep) {
    if (currentPhase === 'scatter-reduce') {
      overlayPhase.textContent = 'Phase 1: Scatter-Reduce';
      overlayPhase.style.color = 'var(--blue)';
    } else {
      overlayPhase.textContent = 'Phase 2: All-Gather';
      overlayPhase.style.color = 'var(--green)';
    }
    const remaining = (N - 1) - currentStep;
    overlayStep.textContent = `Step ${currentStep} of ${N-1} (${remaining} remaining)`;
  }

  const W = canvas.width / (window.devicePixelRatio||1);
  const H = canvas.height / (window.devicePixelRatio||1);
  cx.clearRect(0,0,W,H);
  drawRing(W,H);
  requestAnimationFrame(draw);
}

// ══════════════════════════════════════
//  EQUATIONS PANEL
// ══════════════════════════════════════
let calcOpen = false;
function toggleCalc(){
  calcOpen = !calcOpen;
  const btn = document.getElementById('btnCalc');
  const sect = document.getElementById('calcSect');
  btn.className = 'hd-btn' + (calcOpen?' on':'');
  btn.textContent = calcOpen ? '✕ Equations' : '∑ Equations';
  sect.style.display = calcOpen ? 'flex' : 'none';
  if (calcOpen) updateCalcPanel();
}

function updateCalcPanel(){
  if (!calcOpen) return;
  const N = getN(), grad = getGradMB(), speed = getSpeedGbps();
  const theo = calcTheoretical(N,grad,speed);
  const kOH  = calcKernelOverhead(N, S.protocol);
  const strag = calcStragglerExtra(S.straggler);
  const Tsync = theo + kOH + strag;
  const eff = calcEfficiency(Tsync);

  document.getElementById('calcInner').innerHTML =
    `<b>T<sub>sync_theoretical</sub> = (2(N-1)/N) &times; (S<sub>g</sub>/B<sub>inj</sub>)</b><br>` +
    `&nbsp;&nbsp;= (2&times;${N-1}/${N}) &times; (${grad}MB/${speed}Gbps)<br>` +
    `&nbsp;&nbsp;= <span class="hl">${theo.toFixed(3)} ms</span><br><br>` +

    `<b>Kernel Overhead = N &times; T<sub>kernel</sub></b> ${S.protocol==='rdma'?'(bypassed by RDMA)':''}<br>` +
    `&nbsp;&nbsp;= ${N} &times; ${T_KERNEL_MS} ms = <span class="${kOH>0?'hl-o':'hl-g'}">${kOH.toFixed(3)} ms</span><br><br>` +

    (S.straggler ? `<b>Straggler Penalty</b><br>&nbsp;&nbsp;= <span class="hl-r">+${strag.toFixed(1)} ms</span><br><br>` : '') +

    `<b>T<sub>sync</sub> = T<sub>theoretical</sub> + Kernel OH${S.straggler?' + Straggler':''}</b><br>` +
    `&nbsp;&nbsp;= <span class="${Tsync>25?'hl-r':'hl'}">${Tsync.toFixed(3)} ms</span><br><br>` +

    `<b>Efficiency = T<sub>compute</sub> / (T<sub>compute</sub> + T<sub>sync</sub>)</b><br>` +
    `&nbsp;&nbsp;= ${T_COMPUTE_MS} / (${T_COMPUTE_MS} + ${Tsync.toFixed(2)})<br>` +
    `&nbsp;&nbsp;= <span class="${eff<70?'hl-r':'hl-g'}">${eff.toFixed(1)}%</span>` +
    ` <span style="color:var(--t3);font-size:10px">(assumes T<sub>compute</sub>=${T_COMPUTE_MS}ms/step)</span>`;
}

// ══════════════════════════════════════
//  OBSERVATIONS TABLE
// ══════════════════════════════════════
let observations = [];

function recordObs(){
  const N = getN(), grad = getGradMB(), speed = getSpeedGbps();
  const kOH = calcKernelOverhead(N, S.protocol);
  const Tsync = calcTsyncActual();
  const eff = calcEfficiency(Tsync);
  const n = observations.length + 1;
  observations.push({n, protocol:S.protocol, N, grad, speed, kOH, Tsync, eff, straggler:S.straggler});

  const tbody = document.getElementById('obsBody');
  if (n===1) tbody.innerHTML = '';
  const row = tbody.insertRow();
  const latCls = Tsync>60 ? 'color:var(--red);font-weight:700'
               : Tsync>25 ? 'color:var(--orange);font-weight:700'
               : Tsync>10 ? 'color:var(--yellow);font-weight:700'
               : 'color:var(--green);font-weight:700';
  row.innerHTML =
    `<td>${n}</td>` +
    `<td>${S.protocol==='tcp'?'TCP/IP':'RDMA'}${S.straggler?' ⚠':''}</td>` +
    `<td>${N}</td>` +
    `<td>${grad}MB</td>` +
    `<td>${speed}G</td>` +
    `<td>${kOH.toFixed(2)}</td>` +
    `<td style="${latCls}">${Tsync.toFixed(2)}</td>` +
    `<td>${eff.toFixed(1)}</td>`;

  const btn = document.getElementById('recBtn');
  btn.classList.add('flash');
  setTimeout(()=>btn.classList.remove('flash'),500);
  tbody.closest('.tbl-wrap').scrollTop = 9999;
}

function clearObs(){
  observations = [];
  document.getElementById('obsBody').innerHTML =
    '<tr><td colspan="8" class="tbl-empty">No readings yet — adjust parameters and record</td></tr>';
}

function exportCSV(){
  if (!observations.length) return;
  const h = '#,Protocol,N,Gradient(MB),Speed(Gbps),KernelOH(ms),Tsync(ms),Efficiency(%),Straggler';
  const rows = observations.map(o =>
    [o.n, o.protocol==='tcp'?'TCP/IP':'RDMA', o.N, o.grad, o.speed,
     o.kOH.toFixed(3), o.Tsync.toFixed(3), o.eff.toFixed(2), o.straggler?'Yes':'No'].join(','));
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
  a.download = 'rdma_allreduce_observations.csv';
  a.click();
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
fillSlider(document.getElementById('slN'), (S.nIdx/4)*100);
fillSlider(document.getElementById('slGrad'), (S.gradIdx/4)*100);
fillSlider(document.getElementById('slSpeed'), (S.speedIdx/3)*100);
updateInfoCard('tcp');
resetSimulationState();
update();
requestAnimationFrame(draw);
