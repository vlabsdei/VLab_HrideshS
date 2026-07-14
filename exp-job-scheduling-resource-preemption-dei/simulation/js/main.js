
// ══════════════════════════════════
//  COLORS (canvas can't read CSS vars)
// ══════════════════════════════════
const COL = {
  bg3:'#F1F5F9', bg4:'#E2E8F0', border:'#D6DCE5', border2:'#CBD5E1',
  t1:'#1E293B', t2:'#475569', t3:'#94A3B8',
  blue:'#2563EB', blueD:'#1E40AF', blueL:'#DBEAFE',
  purple:'#7C3AED', purpleL:'#EDE9FE',
  red:'#DC2626', redL:'#FEE2E2',
  green:'#16A34A', greenL:'#DCFCE7',
  orange:'#EA580C', yellow:'#D97706',
  white:'#FFFFFF'
};
const TYPE_COLOR = { short: COL.blue, long: COL.purple, emergency: COL.red };
const TYPE_LABEL = { short: 'INTERACTIVE', long: 'TRAINING', emergency: 'EMERGENCY' };

// ══════════════════════════════════
//  STATE
// ══════════════════════════════════
const TIME_SCALE = 2;          // simulated seconds per real second
const TOKENS_PER_SEC = 6;      // compute-token conversion for waste accounting
const CHECKPOINT_OVERHEAD = 1.5; // sim-seconds of overhead paid on a checkpointed resume
const AGING_RATE = 0.12;       // fair-share priority gained per sim-second waited

let S = {
  algorithm: 'fifo',      // 'fifo' | 'sjf' | 'fair'
  preemption: 'kill',     // 'kill' | 'checkpoint'
  nodeCount: 6,
  mixShortPct: 50,        // % of arriving jobs that are short/interactive
  arrivalRate: 18         // jobs per simulated minute
};

let simClock = 0;
let paused = true;
let hasStarted = false;
let pendingEmergency = false;
let emergencyTimeoutId = null;
let jobIdSeq = 1;
let nodes = [];            // array of job|null, length = S.nodeCount
let nodeFlash = [];        // real-ms timestamp until which node border flashes (eviction)
let queue = [];            // waiting jobs
let completed = [];        // recent completed jobs {wait}
let recoveryEvents = {};   // jobId -> {evictedAt}
let recoveryTimes = [];    // recent recovery durations
let wastedTokens = 0;
let utilEMA = null;
let lastEvictedNode = -1;

function initNodes(n){
  nodes = new Array(n).fill(null);
  nodeFlash = new Array(n).fill(0);
}
initNodes(S.nodeCount);

function makeJob(type, durationOverride){
  let duration, priority;
  if(type === 'short'){ duration = durationOverride ?? rand(4,9); priority = 5; }
  else if(type === 'long'){ duration = durationOverride ?? rand(25,45); priority = 2; }
  else { duration = durationOverride ?? rand(5,8); priority = 999; }
  return { id: jobIdSeq++, type, duration, remaining: duration, arrival: simClock, priority, queueTime: 0, lastQueuedAt: simClock };
}
function rand(a,b){ return a + Math.random()*(b-a); }

// ══════════════════════════════════
//  SIMULATION STEP
// ══════════════════════════════════
function spawnArrival(dt){
  const prob = (S.arrivalRate/60) * dt;
  if(Math.random() < prob){
    const type = Math.random()*100 < S.mixShortPct ? 'short' : 'long';
    queue.push(makeJob(type));
  }
}

function advanceRunning(dt){
  for(let i=0;i<nodes.length;i++){
    const job = nodes[i];
    if(!job) continue;
    job.remaining -= dt;
    if(job.remaining <= 0){
      completed.push({ wait: job.queueTime });
      if(completed.length > 40) completed.shift();
      nodes[i] = null;
    }
  }
}

function effectivePriority(job){
  if(S.algorithm === 'fair') return job.priority + AGING_RATE * (simClock - job.arrival);
  return job.priority;
}

function pickNextIndex(){
  if(!queue.length) return -1;
  let bestIdx = 0;
  if(S.algorithm === 'fifo'){
    for(let i=1;i<queue.length;i++) if(queue[i].arrival < queue[bestIdx].arrival) bestIdx = i;
  } else if(S.algorithm === 'sjf'){
    for(let i=1;i<queue.length;i++) if(queue[i].remaining < queue[bestIdx].remaining) bestIdx = i;
  } else { // fair
    for(let i=1;i<queue.length;i++){
      if(effectivePriority(queue[i]) > effectivePriority(queue[bestIdx])) bestIdx = i;
    }
  }
  return bestIdx;
}

function scheduleQueue(){
  let guard = 0;
  while(queue.length && guard++ < 64){
    const idleIdx = nodes.findIndex(n => n === null);
    if(idleIdx === -1) break;
    const jobIdx = pickNextIndex();
    if(jobIdx === -1) break;
    const job = queue.splice(jobIdx,1)[0];
    job.queueTime += (simClock - job.lastQueuedAt);
    if(S.algorithm === 'fifo'){
      job.scheduleReason = "FIFO: Earliest Arrival";
    } else if(S.algorithm === 'sjf'){
      job.scheduleReason = "SJF: Shortest Runtime";
    } else if(S.algorithm === 'fair'){
      job.scheduleReason = "Fair-Share: Highest Priority";
    }
    nodes[idleIdx] = job;
    if(recoveryEvents[job.id]){
      const rec = simClock - recoveryEvents[job.id].evictedAt;
      recoveryTimes.push(rec);
      if(recoveryTimes.length > 20) recoveryTimes.shift();
      delete recoveryEvents[job.id];
    }
  }
}

function evictVictim(newJobPriority){
  let victimIdx = -1;
  for(let i=0;i<nodes.length;i++){
    if(!nodes[i]) continue;
    if(victimIdx === -1) { victimIdx = i; continue; }
    const a = nodes[i], b = nodes[victimIdx];
    if(a.priority < b.priority || (a.priority === b.priority && a.remaining > b.remaining)) victimIdx = i;
  }
  if(victimIdx === -1) return -1;
  if(newJobPriority !== undefined && nodes[victimIdx].priority >= newJobPriority) return -1;
  const job = nodes[victimIdx];
  if(S.preemption === 'kill'){
    const progressDone = job.duration - job.remaining;
    wastedTokens += Math.round(progressDone * TOKENS_PER_SEC);
    job.remaining = job.duration; // restart from scratch
  } else {
    wastedTokens += Math.round(CHECKPOINT_OVERHEAD * TOKENS_PER_SEC);
    job.remaining += CHECKPOINT_OVERHEAD; // resume overhead only
    job.priority += 3; // checkpointed job resumes quickly once re-queued
  }
  recoveryEvents[job.id] = { evictedAt: simClock };
  job.lastQueuedAt = simClock;
  queue.push(job);
  nodes[victimIdx] = null;
  nodeFlash[victimIdx] = performance.now() + 900;
  lastEvictedNode = victimIdx;
  return victimIdx;
}

function injectEmergency(){
  const job = makeJob('emergency');
  let idx = nodes.findIndex(n => n === null);
  if(idx === -1) idx = evictVictim(job.priority);
  if(idx === -1) { queue.unshift(job); return; }
  nodes[idx] = job;
  flashPill();
}

function flashPill(){
  const pill = document.getElementById('statusPill');
  pill.style.transform = 'scale(1.08)';
  setTimeout(()=> pill.style.transform = 'scale(1)', 200);
}

function updateSim(dt){
  spawnArrival(dt);
  advanceRunning(dt);
  scheduleQueue();
  const busy = nodes.filter(Boolean).length;
  const inst = (busy / S.nodeCount) * 100;
  utilEMA = utilEMA === null ? inst : (utilEMA*0.94 + inst*0.06);
}

// ══════════════════════════════════
//  CONFIG SETTERS
// ══════════════════════════════════
function setAlgorithm(alg){
  S.algorithm = alg;
  document.querySelectorAll('[data-alg]').forEach(b => b.classList.toggle('active', b.dataset.alg === alg));
  updateCalcPanel();
}
function setPreemption(p){
  S.preemption = p;
  document.querySelectorAll('[data-pre]').forEach(b => b.classList.toggle('active', b.dataset.pre === p));
  updateCalcPanel();
}
function setNodeCount(n){
  n = Math.max(2, Math.min(8, n));
  if(n < nodes.length){
    for(let i=n;i<nodes.length;i++){
      if(nodes[i]){
        const job = nodes[i];
        wastedTokens += Math.round((job.duration - job.remaining) * TOKENS_PER_SEC);
        job.remaining = job.duration;
        job.lastQueuedAt = simClock;
        queue.push(job);
      }
    }
    nodes.length = n; nodeFlash.length = n;
  } else if(n > nodes.length){
    while(nodes.length < n){ nodes.push(null); nodeFlash.push(0); }
  }
  S.nodeCount = n;
  document.getElementById('vNodes').textContent = n;
  document.getElementById('slNodes').value = n;
}
function onNodesInput(v){ setNodeCount(+v); }
function onMixInput(v){
  S.mixShortPct = +v;
  document.getElementById('vMix').textContent = `${v}:${100-v}`;
}
function onArrivalInput(v){
  S.arrivalRate = +v;
  document.getElementById('vArrival').textContent = `${v}/min`;
}

function startSim(){
  hasStarted = true;
  paused = false;
  
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  if (btnStart) btnStart.style.display = 'none';
  if (btnPause) {
    btnPause.style.display = 'inline-block';
    btnPause.textContent = 'Pause';
    btnPause.classList.remove('on');
  }
  if (btnReset) btnReset.style.display = 'inline-block';
  
  if (pendingEmergency) {
    pendingEmergency = false;
    emergencyTimeoutId = setTimeout(injectEmergency, 1400);
  }
}

function resetCluster(){
  simClock = 0;
  initNodes(S.nodeCount);
  queue = []; completed = []; recoveryEvents = {}; recoveryTimes = [];
  wastedTokens = 0; utilEMA = null; lastEvictedNode = -1;

  hasStarted = false;
  paused = true;
  
  pendingEmergency = false;
  if (emergencyTimeoutId) {
    clearTimeout(emergencyTimeoutId);
    emergencyTimeoutId = null;
  }
  
  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  if (btnStart) btnStart.style.display = 'inline-block';
  if (btnPause) btnPause.style.display = 'none';
  if (btnReset) btnReset.style.display = 'none';
}

// ── Quick scenario presets ──
function presetFifoConvoy(){
  resetCluster();
  setAlgorithm('fifo'); setPreemption('kill'); setNodeCount(1);
  onMixInput(50);
  queue.push(makeJob('long', 55));
  for(let i=0;i<8;i++){ const j = makeJob('short', rand(4,7)); j.arrival = simClock + 0.01 + i*0.001; queue.push(j); }
}
function presetFairShare(){
  resetCluster();
  setAlgorithm('fair'); setPreemption('checkpoint'); setNodeCount(6);
  onMixInput(50); document.getElementById('slMix').value = 50;
}
function presetSJF(){
  resetCluster();
  setAlgorithm('sjf'); setPreemption('checkpoint'); setNodeCount(6);
  onMixInput(50); document.getElementById('slMix').value = 50;
}
function presetKillStress(){
  resetCluster();
  setAlgorithm('fifo'); setPreemption('kill'); setNodeCount(3);
  onMixInput(20); document.getElementById('slMix').value = 20;
  document.getElementById('slArrival').value = 28; onArrivalInput(28);
}
function presetCheckpointDemo(){
  resetCluster();
  setAlgorithm('fair'); setPreemption('checkpoint'); setNodeCount(4);
  onMixInput(40); document.getElementById('slMix').value = 40;
  pendingEmergency = true;
}

function togglePause(){
  paused = !paused;
  const btn = document.getElementById('btnPause');
  btn.textContent = paused ? 'Resume' : 'Pause';
  btn.classList.toggle('on', paused);
}

// ══════════════════════════════════
//  CANVAS
// ══════════════════════════════════
const canvas = document.getElementById('c');
const ctx2 = canvas.getContext('2d');

function resize(){
  const vp = document.getElementById('vp');
  canvas.width = vp.clientWidth;
  canvas.height = vp.clientHeight;
}
window.addEventListener('resize', resize);
resize();

function pathRoundRect(cx, x, y, w, h, r){
  cx.beginPath();
  cx.moveTo(x + r, y);
  cx.lineTo(x + w - r, y);    cx.arcTo(x + w, y,     x + w, y + r,     r);
  cx.lineTo(x + w, y + h - r);cx.arcTo(x + w, y + h, x + w - r, y + h, r);
  cx.lineTo(x + r, y + h);    cx.arcTo(x,     y + h, x,     y + h - r, r);
  cx.lineTo(x, y + r);        cx.arcTo(x,     y,     x + r, y,         r);
  cx.closePath();
}

function drawNode(x, y, w, h, i){
  const job = nodes[i];
  const flashing = performance.now() < nodeFlash[i];
  ctx2.fillStyle = job ? '#FFFFFF' : COL.bg3;
  pathRoundRect(ctx2, x, y, w, h, 9);
  ctx2.fill();
  ctx2.lineWidth = flashing ? 2.5 : 1.4;
  ctx2.strokeStyle = flashing ? COL.red : (job ? TYPE_COLOR[job.type] : COL.border);
  pathRoundRect(ctx2, x, y, w, h, 9);
  ctx2.stroke();

  ctx2.textAlign = 'left'; ctx2.textBaseline = 'top';
  ctx2.font = '600 10px ui-monospace,monospace';
  ctx2.fillStyle = COL.t3;
  ctx2.fillText('GPU ' + i, x + 8, y + 7);

  if(job){
    ctx2.textAlign = 'center';
    ctx2.font = '700 10px system-ui,-apple-system,sans-serif';
    ctx2.fillStyle = TYPE_COLOR[job.type];
    ctx2.fillText(TYPE_LABEL[job.type], x + w/2, y + h*0.30);

    // progress bar
    const barX = x + 10, barY = y + h - 12, barW = w - 20, barH = 6;
    const frac = Math.max(0, Math.min(1, 1 - job.remaining / job.duration));
    ctx2.fillStyle = COL.bg4;
    pathRoundRect(ctx2, barX, barY, barW, barH, 3); ctx2.fill();
    ctx2.fillStyle = TYPE_COLOR[job.type];
    pathRoundRect(ctx2, barX, barY, Math.max(3, barW*frac), barH, 3); ctx2.fill();

    ctx2.font = '500 9px ui-monospace,monospace';
    ctx2.fillStyle = COL.t2;
    ctx2.fillText(job.remaining.toFixed(1) + 's left · #' + job.id, x + w/2, y + h*0.30 + 14);

    if(job.scheduleReason){
      ctx2.font = 'italic 500 9px system-ui,-apple-system,sans-serif';
      ctx2.fillStyle = COL.blueD;
      ctx2.fillText(job.scheduleReason, x + w/2, y + h*0.30 + 26);
    }
  } else {
    ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
    ctx2.font = '600 10px system-ui,-apple-system,sans-serif';
    ctx2.fillStyle = COL.t3;
    ctx2.fillText('IDLE', x + w/2, y + h/2 + 4);
  }

  if(flashing){
    ctx2.fillStyle = 'rgba(220,38,38,.10)';
    pathRoundRect(ctx2, x, y, w, h, 9); ctx2.fill();
    ctx2.textAlign = 'right'; ctx2.textBaseline = 'top';
    ctx2.font = '700 9px system-ui,-apple-system,sans-serif';
    ctx2.fillStyle = COL.red;
    ctx2.fillText('EVICTED', x + w - 8, y + 7);
  }
}

function orderedQueueRanks(){
  // returns queue jobs sorted by current scheduling rank (next-up first)
  const arr = queue.slice();
  if(S.algorithm === 'fifo') arr.sort((a,b) => a.arrival - b.arrival);
  else if(S.algorithm === 'sjf') arr.sort((a,b) => a.remaining - b.remaining);
  else arr.sort((a,b) => effectivePriority(b) - effectivePriority(a));
  return arr;
}

function draw(){
  const W = canvas.width, H = canvas.height;
  ctx2.clearRect(0,0,W,H);

  const n = S.nodeCount;
  const cols = n <= 2 ? n : (n <= 4 ? 2 : (n <= 6 ? 3 : 4));
  const rows = Math.ceil(n / cols);

  const topPad = 8, sidePad = 14, gap = 9;
  const nodesAreaH = H * 0.66;

  ctx2.textAlign = 'left'; ctx2.textBaseline = 'top';
  ctx2.font = '700 10px system-ui,-apple-system,sans-serif';
  ctx2.fillStyle = COL.t3;
  ctx2.fillText('CLUSTER — ' + n + ' GPU NODE' + (n>1?'S':''), sidePad, topPad);

  const gridTop = topPad + 18;
  const boxW = (W - sidePad*2 - gap*(cols-1)) / cols;
  const boxH = Math.min((nodesAreaH - gridTop - gap*(rows-1)) / rows, 92);

  for(let i=0;i<n;i++){
    const col = i % cols, row = Math.floor(i / cols);
    const x = sidePad + col*(boxW+gap);
    const y = gridTop + row*(boxH+gap);
    drawNode(x, y, boxW, boxH, i);
  }

}

// ══════════════════════════════════
//  DASHBOARD / STATUS
// ══════════════════════════════════
function fmt1(x){ return (x===null || x===undefined || isNaN(x)) ? '—' : x.toFixed(1); }

function avgWait(){
  if(!completed.length) return null;
  return completed.reduce((s,c)=>s+c.wait,0) / completed.length;
}
function avgRecovery(){
  if(!recoveryTimes.length) return null;
  return recoveryTimes.reduce((a,b)=>a+b,0) / recoveryTimes.length;
}

function updateDashboard(){
  const busy = nodes.filter(Boolean).length;
  const qLen = queue.length;
  const wait = avgWait();
  const rec = avgRecovery();

  document.getElementById('vWait').textContent = fmt1(wait);
  document.getElementById('vUtil').textContent = fmt1(utilEMA === null ? 0 : utilEMA);
  document.getElementById('vWaste').textContent = wastedTokens.toLocaleString();
  document.getElementById('vRecovery').textContent = fmt1(rec);

  let status, cls, pillCls;
  if(qLen === 0){ status='Balanced'; cls='good'; pillCls='pill-ok'; }
  else if(qLen <= 3){ status='Queue Building'; cls='warn'; pillCls='pill-warn'; }
  else if(qLen <= 7){ status='Congested'; cls='hot'; pillCls='pill-hot'; }
  else { status='Overloaded'; cls='crit'; pillCls='pill-crit'; }

  document.getElementById('vStatus').textContent = status;
  document.getElementById('vStatusSub').textContent = `${qLen} queued · ${busy}/${S.nodeCount} busy`;

  const dcStatus = document.getElementById('dcStatus');
  dcStatus.className = 'dc ' + cls;
  const dcUtil = document.getElementById('dcUtil');
  const u = utilEMA === null ? 0 : utilEMA;
  dcUtil.className = 'dc ' + (u >= 90 ? 'hot' : u >= 60 ? 'good' : 'warn');
  const dcWait = document.getElementById('dcWait');
  dcWait.className = 'dc ' + (wait===null ? '' : (wait > 15 ? 'crit' : wait > 6 ? 'warn' : 'good'));

  const pill = document.getElementById('statusPill');
  pill.className = 'hd-pill ' + pillCls;
  document.getElementById('statusTxt').textContent = status;

  updateQueueDOM();
  updateCalcPanel();
}

const activeCards = new Map();

function updateQueueDOM() {
  const queueTitle = document.getElementById('queueTitle');
  const queueLane = document.getElementById('queueLane');
  const scrollContent = document.getElementById('queueScrollContent');
  if (!queueTitle || !queueLane || !scrollContent) return;

  const ranked = orderedQueueRanks();
  queueTitle.textContent = 'WAITING QUEUE — ' + ranked.length + ' job' + (ranked.length !== 1 ? 's' : '');

  const cardWidth = 120;
  const cardGap = 10;
  const totalWidth = 10 + ranked.length * (cardWidth + cardGap) + 10;
  scrollContent.style.width = `${totalWidth}px`;

  const currentJobIds = new Set();

  ranked.forEach((job, idx) => {
    currentJobIds.add(job.id);
    const leftPos = 10 + idx * (cardWidth + cardGap);

    let card = activeCards.get(job.id);
    if (!card) {
      card = document.createElement('div');
      card.className = `queue-card ${job.type} entering`;
      card.dataset.jobId = job.id;

      let prioHTML = `<span>Pri: ${effectivePriority(job).toFixed(1)}</span>`;
      if (S.algorithm === 'fair') {
        prioHTML = `<span style="color: var(--green); font-weight: 700;">Pri: ${effectivePriority(job).toFixed(1)} ↑</span>`;
      }

      card.innerHTML = `
        <div class="card-header">
          <span>#${job.id}</span>
          <span>${TYPE_LABEL[job.type]}</span>
        </div>
        <div class="card-body">
          <span class="remaining-time">${job.remaining.toFixed(1)}s</span> left
        </div>
        <div class="card-footer">
          ${prioHTML}
          <span>Pos: ${idx + 1}</span>
        </div>
      `;
      card.style.left = `${leftPos}px`;
      scrollContent.appendChild(card);
      activeCards.set(job.id, card);

      requestAnimationFrame(() => {
        card.classList.remove('entering');
        card.classList.add('active');
      });
    } else {
      card.querySelector('.remaining-time').textContent = `${job.remaining.toFixed(1)}s`;

      let prioHTML = `<span>Pri: ${effectivePriority(job).toFixed(1)}</span>`;
      if (S.algorithm === 'fair') {
        prioHTML = `<span style="color: var(--green); font-weight: 700;">Pri: ${effectivePriority(job).toFixed(1)} ↑</span>`;
      }

      card.querySelector('.card-footer').innerHTML = `
        ${prioHTML}
        <span>Pos: ${idx + 1}</span>
      `;
      card.style.left = `${leftPos}px`;
      if (card.classList.contains('entering')) {
        card.classList.remove('entering');
        card.classList.add('active');
      }
    }
  });

  for (const [jobId, card] of activeCards.entries()) {
    if (!currentJobIds.has(jobId)) {
      card.classList.remove('active');
      card.classList.add('exiting');
      activeCards.delete(jobId);
      setTimeout(() => {
        card.remove();
      }, 300);
    }
  }
}

// ══════════════════════════════════
//  EQUATIONS PANEL
// ══════════════════════════════════
let calcOpen = false;
function toggleCalc(){
  calcOpen = !calcOpen;
  const btn = document.getElementById('btnCalc');
  const sect = document.getElementById('calcSect');
  btn.className = 'hd-btn' + (calcOpen ? ' on' : '');
  btn.textContent = calcOpen ? 'Close Equations' : 'Equations';
  sect.style.display = calcOpen ? 'flex' : 'none';
  if(calcOpen) updateCalcPanel();
}
function updateCalcPanel(){
  if(!calcOpen) return;
  const wait = avgWait();
  const n = completed.length;
  const sumWait = completed.reduce((s,c)=>s+c.wait,0);
  const u = utilEMA === null ? 0 : utilEMA;
  document.getElementById('calcInner').innerHTML =
    `<b>W<sub>avg</sub> = &Sigma;(Time in Queue) / Total Completed Jobs</b><br>` +
    `&nbsp;&nbsp;= ${sumWait.toFixed(1)}s / ${n}<br>` +
    `&nbsp;&nbsp;= <span class="hl">${wait===null?'—':wait.toFixed(2)+'s'}</span><br><br>` +

    `<b>Utilization = (&Sigma;(Nodes &times; Runtime) / (Capacity &times; Time)) &times; 100%</b><br>` +
    `&nbsp;&nbsp;&asymp; <span class="hl">${u.toFixed(1)}%</span> (EMA of busy/${S.nodeCount} nodes)<br><br>` +

    `<b>Wasted Tokens</b> (Kill/Restart discards all progress; Checkpointing discards only overhead)<br>` +
    `&nbsp;&nbsp;cumulative = <span class="${wastedTokens>0?'hl-r':'hl-g'}">${wastedTokens.toLocaleString()} tokens</span>`;
}

// ══════════════════════════════════
//  OBSERVATIONS TABLE
// ══════════════════════════════════
let observations = [];
const ALG_LABEL = { fifo:'FIFO', sjf:'SJF', fair:'Fair-Share' };
const PRE_LABEL = { kill:'Kill/Restart', checkpoint:'Checkpoint' };

function recordObs(){
  const wait = avgWait(), rec = avgRecovery();
  const qLen = queue.length;
  const status = qLen===0?'Balanced':qLen<=3?'Building':qLen<=7?'Congested':'Overloaded';
  const n = observations.length + 1;
  observations.push({
    n, alg: ALG_LABEL[S.algorithm], pre: PRE_LABEL[S.preemption],
    mix: `${S.mixShortPct}:${100-S.mixShortPct}`,
    wait, util: utilEMA, waste: wastedTokens, rec, status
  });

  const tbody = document.getElementById('obsBody');
  if(n === 1) tbody.innerHTML = '';
  const row = tbody.insertRow();
  row.innerHTML =
    `<td>${n}</td><td>${ALG_LABEL[S.algorithm]}</td><td>${PRE_LABEL[S.preemption]}</td>` +
    `<td>${S.mixShortPct}:${100-S.mixShortPct}</td><td>${fmt1(wait)}</td><td>${(utilEMA === null ? 0 : utilEMA).toFixed(1)}</td>` +
    `<td>${wastedTokens}</td><td>${fmt1(rec)}</td><td>${status}</td>`;

  const btn = document.getElementById('recBtn');
  btn.classList.add('flash');
  setTimeout(()=>btn.classList.remove('flash'), 500);

  const wrap = tbody.closest('.tbl-wrap');
  if(wrap) wrap.scrollTop = wrap.scrollHeight;
}

function clearObs(){
  observations = [];
  document.getElementById('obsBody').innerHTML =
    '<tr><td colspan="9" class="tbl-empty">No readings yet — adjust parameters and record</td></tr>';
}

function exportCSV(){
  if(!observations.length) return;
  const h = '#,Algorithm,Preemption,Mix,AvgWait(s),Utilization(%),WastedTokens,Recovery(s),Status';
  const rows = observations.map(o =>
    [o.n, o.alg, o.pre, o.mix, o.wait===null?'':o.wait.toFixed(2), (o.util===null?0:o.util).toFixed(1), o.waste, o.rec===null?'':o.rec.toFixed(2), o.status].join(',')
  );
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
  a.download = 'job_scheduling_observations.csv';
  a.click();
}

// ══════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════
let lastTime = null;
function tick(now){
  if(lastTime === null) lastTime = now;
  let dtReal = (now - lastTime) / 1000;
  lastTime = now;
  dtReal = Math.min(dtReal, 0.05);

  if(hasStarted && !paused){
    const dtSim = dtReal * TIME_SCALE;
    simClock += dtSim;
    updateSim(dtSim);
  }
  draw();
  updateDashboard();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
