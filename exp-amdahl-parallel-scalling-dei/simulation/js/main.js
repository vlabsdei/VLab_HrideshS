
// ══════════════════════════════════════
//  CONSTANTS & CONFIG
// ══════════════════════════════════════
const PF_STEPS = [0.80, 0.90, 0.95, 0.99, 0.999, 0.9999];
const N_STEPS  = [1, 4, 16, 64, 256, 1024, 4096];
const CO_STEPS = [0, 0.0005, 0.001, 0.002, 0.005, 0.01];
const CO_LABELS= ['0', '0.0005', '0.0010', '0.0020', '0.0050', '0.0100'];

const GPU_COST_USD = 30000;
const DOMAIN_MIN = 1, DOMAIN_MAX = 4096;

let S = { pfIdx:2, nIdx:2, coIdx:2, classic:false };

function getPf(){ return PF_STEPS[S.pfIdx]; }
function getN(){ return N_STEPS[S.nIdx]; }
function getCo(){ return S.classic ? 0 : CO_STEPS[S.coIdx]; }

function calcSpeedup(Pf, N, Co){
  const denom = (1 - Pf) + (Pf / N) + Co * Math.log(N);
  return 1 / denom;
}
function calcAsymptote(Pf){ return 1 / (1 - Pf); }
function calcOptimalN(Pf, Co){
  if (Co <= 0) return null;
  return Pf / Co;
}
function calcEfficiency(Sp, N){ return (Sp / N) * 100; }
function calcWastedNodes(N, Nopt){
  if (Nopt === null) return 0;
  return Math.max(0, N - Nopt);
}
function calcWastedCost(wastedNodes){ return wastedNodes * GPU_COST_USD; }

// ══════════════════════════════════════
//  SLIDER FILL HELPER
// ══════════════════════════════════════
function fillSlider(el, pct){
  el.style.background = `linear-gradient(90deg,var(--blue) ${pct}%,var(--border2) ${pct}%)`;
}

// ══════════════════════════════════════
//  UI EVENT WIRING
// ══════════════════════════════════════
function toggleClassic(){
  S.classic = !S.classic;
  const btn = document.getElementById('classicBtn');
  const lbl = document.getElementById('classicLabel');
  const row = document.getElementById('coRow');
  btn.classList.toggle('active', S.classic);
  lbl.textContent = "Classic Amdahl's Law — " + (S.classic ? 'On (Co=0)' : 'Off');
  row.classList.toggle('disabled', S.classic);
  updateInfoCard();
  update();
}

function updateInfoCard(){
  const card = document.getElementById('infoCard');
  const title = document.getElementById('infoTitle');
  const list = document.getElementById('infoList');
  const isClassic = getCo() <= 0;
  if (isClassic){
    card.className = 'info-card';
    title.textContent = "Classic Amdahl's Law";
    list.innerHTML =
      '<li>Speedup rises monotonically with N</li>' +
      '<li>Bounded by asymptote 1/(1-P<sub>f</sub>)</li>' +
      '<li>No communication penalty modeled</li>' +
      '<li>Diminishing — but never negative — returns</li>';
  } else {
    card.className = 'info-card ext';
    title.textContent = 'Extended Model (with C_o)';
    list.innerHTML =
      '<li>Overhead term C<sub>o</sub>&times;ln(N) grows with cluster size</li>' +
      '<li>Speedup peaks at N* = P<sub>f</sub> / C<sub>o</sub></li>' +
      '<li>Beyond N*, adding nodes <b>reduces</b> speedup</li>' +
      '<li>Nodes past N* are wasted capital expenditure</li>';
  }
}

document.getElementById('slPf').addEventListener('input', function(){
  S.pfIdx = +this.value;
  document.getElementById('vPf').textContent = PF_STEPS[S.pfIdx].toString();
  fillSlider(this, (S.pfIdx/5)*100);
  update();
});
document.getElementById('slN').addEventListener('input', function(){
  S.nIdx = +this.value;
  document.getElementById('vN').textContent = N_STEPS[S.nIdx].toLocaleString();
  fillSlider(this, (S.nIdx/6)*100);
  update();
});
document.getElementById('slCo').addEventListener('input', function(){
  S.coIdx = +this.value;
  document.getElementById('vCo').textContent = CO_LABELS[S.coIdx];
  fillSlider(this, (S.coIdx/5)*100);
  update();
});

// setPreset(pfIdx, nIdx, coIdx, classic)
function setPreset(pfIdx, nIdx, coIdx, classic){
  S.pfIdx = pfIdx; S.nIdx = nIdx; S.coIdx = coIdx; S.classic = classic;

  const slPf = document.getElementById('slPf');
  slPf.value = pfIdx; fillSlider(slPf, (pfIdx/5)*100);
  document.getElementById('vPf').textContent = PF_STEPS[pfIdx].toString();

  const slN = document.getElementById('slN');
  slN.value = nIdx; fillSlider(slN, (nIdx/6)*100);
  document.getElementById('vN').textContent = N_STEPS[nIdx].toLocaleString();

  const slCo = document.getElementById('slCo');
  slCo.value = coIdx; fillSlider(slCo, (coIdx/5)*100);
  document.getElementById('vCo').textContent = CO_LABELS[coIdx];

  const btn = document.getElementById('classicBtn');
  const lbl = document.getElementById('classicLabel');
  const row = document.getElementById('coRow');
  btn.classList.toggle('active', classic);
  lbl.textContent = "Classic Amdahl's Law — " + (classic ? 'On (Co=0)' : 'Off');
  row.classList.toggle('disabled', classic);

  updateInfoCard();
  update();
}

function resetAll(){
  setPreset(2, 2, 2, false);
}

// ══════════════════════════════════════
//  MAIN UPDATE (dashboard + status)
// ══════════════════════════════════════
function update(){
  const Pf = getPf(), N = getN(), Co = getCo();
  const Sp = calcSpeedup(Pf, N, Co);
  const eff = calcEfficiency(Sp, N);
  const Nopt = calcOptimalN(Pf, Co);
  const wastedNodes = calcWastedNodes(N, Nopt);
  const wastedCost = calcWastedCost(wastedNodes);

  document.getElementById('vSpeed').textContent = Sp.toFixed(2);
  document.getElementById('vEff').textContent   = eff.toFixed(1);
  document.getElementById('vOpt').textContent   = Nopt === null ? '∞' : Math.round(Nopt).toLocaleString();
  document.getElementById('vWaste').textContent = '$' + wastedCost.toLocaleString();

  // Speedup / efficiency card color
  const dcSpeed = document.getElementById('dcSpeed');
  dcSpeed.className = 'dc' + (eff>=70?' good':eff>=40?' warn':' hot');
  const dcEff = document.getElementById('dcEff');
  dcEff.className = 'dc' + (eff>=70?' good':eff>=40?' warn':' hot');

  // Optimal N card
  const dcOpt = document.getElementById('dcOpt');
  if (Nopt===null) dcOpt.className = 'dc good';
  else if (N<=Nopt) dcOpt.className = 'dc good';
  else if (N<=Nopt*1.5) dcOpt.className = 'dc warn';
  else dcOpt.className = 'dc crit';

  // Waste card
  const dcWaste = document.getElementById('dcWaste');
  if (wastedCost<=0) dcWaste.className='dc good';
  else if (wastedCost<300000) dcWaste.className='dc warn';
  else if (wastedCost<2000000) dcWaste.className='dc hot';
  else dcWaste.className='dc crit';

  // Rating + status pill
  const dcRating = document.getElementById('dcRating');
  const vRating = document.getElementById('vRating');
  const vRatingSub = document.getElementById('vRatingSub');
  const pill = document.getElementById('statusPill');
  const pillTxt = document.getElementById('statusTxt');
  let rating, sub, cls;
  if (Nopt!==null && N > Nopt*1.5){
    rating='OVER-PROVISIONED'; sub='past peak, declining'; cls='crit';
  } else if (Nopt!==null && N > Nopt){
    rating='PAST PEAK'; sub='speedup declining'; cls='hot';
  } else if (eff < 40){
    rating='LOW EFFICIENCY'; sub='serial-bound'; cls='warn';
  } else if (eff < 70){
    rating='MODERATE'; sub='scaling reasonably'; cls='warn';
  } else {
    rating='EFFICIENT'; sub='near-linear scaling'; cls='good';
  }
  vRating.textContent = rating;
  vRatingSub.textContent = sub;
  dcRating.className = 'dc ' + cls;
  pill.className = 'hd-pill pill-' + (cls==='good'?'ok':cls==='warn'?'warn':cls==='hot'?'hot':'crit');
  pillTxt.textContent = Co<=0 ? 'Classic Amdahl' : (rating.charAt(0)+rating.slice(1).toLowerCase());

  updateLegend();
  updateCalcPanel();
}

// ══════════════════════════════════════
//  LEGEND
// ══════════════════════════════════════
function updateLegend(){
  const Co = getCo();
  document.getElementById('legendContent').innerHTML =
    `<div class="legend-row">
      <span style="display:inline-block;width:14px;height:3px;background:#2563EB;margin-top:7px;flex-shrink:0"></span>
      <div><b>Speedup Curve</b>: S<sub>max</sub> plotted against node count N (log scale).</div>
    </div>
    <div class="legend-row">
      <span style="display:inline-block;width:14px;height:0;border-top:2px dashed #94A3B8;margin-top:7px;flex-shrink:0"></span>
      <div><b>Asymptote</b>: Theoretical ceiling 1/(1-P<sub>f</sub>) at infinite N.</div>
    </div>
    <div class="legend-row">
      <span class="legend-swatch" style="background:#2563EB;border-radius:50%"></span>
      <div><b>Current Cluster Point</b>: Your selected N plotted live on the curve.</div>
    </div>
    <div class="legend-row">
      <span style="font-size:12px;font-weight:bold;color:#DC2626;margin-top:1px;flex-shrink:0">N*</span>
      <div><b>Diminishing-Returns Peak</b>: N* = P<sub>f</sub>/C<sub>o</sub> — where speedup stops rising.</div>
    </div>
    <div class="legend-row">
      <span class="legend-swatch" style="background:repeating-linear-gradient(45deg,#FCA5A5,#FCA5A5 3px,#FEE2E2 3px,#FEE2E2 6px)"></span>
      <div><b>Wasted Spend Zone</b>: Region past N* where extra GPUs reduce throughput.</div>
    </div>
    <div class="legend-row">
      <span style="display:inline-block;width:14px;height:14px;border-radius:2px;background:#2563EB;flex-shrink:0"></span>
      <div><b>Node Utilization Grid</b>: Blue = contributing GPU, grey-striped = idle/wasted GPU.</div>
    </div>`;
}

// ══════════════════════════════════════
//  CANVAS ENGINE — SCALING CURVE CHART
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

function xForN(N, x0, x1){
  const lo = Math.log10(DOMAIN_MIN), hi = Math.log10(DOMAIN_MAX);
  const t = (Math.log10(Math.max(DOMAIN_MIN,Math.min(DOMAIN_MAX,N))) - lo) / (hi - lo);
  return x0 + t*(x1-x0);
}
function yForS(Sv, yMax, y0, y1){
  const t = Math.max(0, Math.min(1, Sv / yMax));
  return y1 - t*(y1-y0);
}

function drawChart(W,H){
  const isNarrow = W < 520;
  const Pf = getPf(), N = getN(), Co = getCo();
  const asym = calcAsymptote(Pf);
  const Nopt = calcOptimalN(Pf, Co);
  const Sp = calcSpeedup(Pf, N, Co);

  const padL = isNarrow?42:56, padR = isNarrow?12:20, padT = isNarrow?22:28, padB = isNarrow?70:86;
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB;

  // sample curve
  const steps = 140;
  const pts = [];
  let curveMax = 0;
  for (let i=0;i<=steps;i++){
    const logN = Math.log10(DOMAIN_MIN) + (i/steps)*(Math.log10(DOMAIN_MAX)-Math.log10(DOMAIN_MIN));
    const Nv = Math.pow(10, logN);
    const Sv = calcSpeedup(Pf, Nv, Co);
    pts.push({N:Nv, S:Sv});
    if (Sv > curveMax) curveMax = Sv;
  }
  let yMax = Math.max(curveMax, Sp) * 1.18;

  // background plot area
  cx.fillStyle = 'rgba(255,255,255,.55)';
  rr(x0,y0,x1-x0,y1-y0,6); cx.fill();
  cx.strokeStyle = 'rgba(148,163,184,.4)'; cx.lineWidth=1;
  rr(x0,y0,x1-x0,y1-y0,6); cx.stroke();

  // y gridlines / ticks
  cx.textAlign='right'; cx.font=`500 ${isNarrow?8:9}px system-ui,sans-serif`;
  [0, 0.5, 1].forEach(f=>{
    const yy = y1 - f*(y1-y0);
    cx.strokeStyle='rgba(148,163,184,.22)'; cx.lineWidth=1;
    cx.beginPath(); cx.moveTo(x0,yy); cx.lineTo(x1,yy); cx.stroke();
    cx.fillStyle='#94A3B8';
    cx.fillText((f*yMax).toFixed(0)+'×', x0-6, yy+3);
  });

  // x gridlines / ticks
  const tickNs = isNarrow ? [1,16,256,4096] : N_STEPS;
  cx.textAlign='center';
  tickNs.forEach(tv=>{
    const xx = xForN(tv,x0,x1);
    cx.strokeStyle='rgba(148,163,184,.18)'; cx.lineWidth=1;
    cx.beginPath(); cx.moveTo(xx,y0); cx.lineTo(xx,y1); cx.stroke();
    cx.fillStyle='#94A3B8';
    cx.fillText(tv.toLocaleString(), xx, y1+14);
  });
  cx.fillStyle='#64748B'; cx.font=`600 ${isNarrow?8:9}px system-ui,sans-serif`;
  cx.fillText('NODE COUNT (N, log scale)', (x0+x1)/2, y1+ (isNarrow?26:30));

  // wasted zone shading
  if (Nopt !== null && Nopt < DOMAIN_MAX){
    const xw0 = xForN(Nopt,x0,x1), xw1 = x1;
    cx.save();
    cx.beginPath(); cx.rect(xw0,y0,xw1-xw0,y1-y0); cx.clip();
    cx.fillStyle = 'rgba(220,38,38,.07)';
    cx.fillRect(xw0,y0,xw1-xw0,y1-y0);
    cx.strokeStyle = 'rgba(220,38,38,.35)'; cx.lineWidth=1;
    for (let sx=xw0-40; sx<xw1+40; sx+=10){
      cx.beginPath(); cx.moveTo(sx,y1); cx.lineTo(sx+40,y0); cx.stroke();
    }
    cx.restore();
    cx.strokeStyle='rgba(220,38,38,.5)'; cx.lineWidth=1.5; cx.setLineDash([4,3]);
    cx.beginPath(); cx.moveTo(xw0,y0); cx.lineTo(xw0,y1); cx.stroke();
    cx.setLineDash([]);
    if (!isNarrow){
      cx.fillStyle='#DC2626'; cx.font='700 8px system-ui,sans-serif'; cx.textAlign='left';
      cx.fillText('WASTED SPEND ZONE', Math.min(xw0+6,x1-110), y0+11);
    } else {
      const lgX = x0 + 6;
      const lgY = y0 + 6;
      cx.fillStyle = 'rgba(255,255,255,0.85)';
      rr(lgX, lgY, 68, 16, 4); cx.fill();
      cx.strokeStyle = 'rgba(148,163,184,.3)';
      cx.lineWidth = 1;
      rr(lgX, lgY, 68, 16, 4); cx.stroke();

      cx.fillStyle = 'rgba(220,38,38,.2)';
      cx.fillRect(lgX+5, lgY+5, 8, 6);
      cx.strokeStyle = 'rgba(220,38,38,.5)';
      cx.strokeRect(lgX+5, lgY+5, 8, 6);
      
      cx.fillStyle = '#1E293B'; cx.font = '600 7.5px system-ui,sans-serif'; cx.textAlign = 'left';
      cx.fillText('Wasted Zone', lgX+18, lgY+10.5);
    }
  }

  // asymptote line (only if visible in range)
  if (asym <= yMax){
    const ay = yForS(asym,yMax,y0,y1);
    cx.strokeStyle='rgba(100,116,139,.55)'; cx.lineWidth=1.3; cx.setLineDash([5,4]);
    cx.beginPath(); cx.moveTo(x0,ay); cx.lineTo(x1,ay); cx.stroke();
    cx.setLineDash([]);
    cx.fillStyle='#64748B'; cx.font=`600 ${isNarrow?8:8.5}px ui-monospace,monospace`; cx.textAlign='right';
    cx.fillText('max '+asym.toFixed(0)+'×', x1-4, ay-4);
  }

  // curve
  cx.beginPath();
  pts.forEach((p,i)=>{
    const xx=xForN(p.N,x0,x1), yy=yForS(p.S,yMax,y0,y1);
    if (i===0) cx.moveTo(xx,yy); else cx.lineTo(xx,yy);
  });
  cx.strokeStyle='#2563EB'; cx.lineWidth=isNarrow?2:2.6;
  cx.shadowColor='rgba(37,99,235,.35)'; cx.shadowBlur=6;
  cx.stroke();
  cx.shadowBlur=0;

  // peak marker
  if (Nopt !== null && Nopt >= DOMAIN_MIN && Nopt <= DOMAIN_MAX){
    const px = xForN(Nopt,x0,x1);
    const py = yForS(calcSpeedup(Pf,Nopt,Co),yMax,y0,y1);
    cx.beginPath(); cx.arc(px,py,4,0,Math.PI*2);
    cx.fillStyle='#DC2626'; cx.fill();
    cx.fillStyle='#DC2626'; cx.font=`700 ${isNarrow?9:10}px system-ui,sans-serif`; cx.textAlign='center';
    cx.fillText('N*='+Math.round(Nopt).toLocaleString(), px, py-10);
  }

  // current point
  const cxp = xForN(N,x0,x1), cyp = yForS(Sp,yMax,y0,y1);
  const pulse = 3+2*Math.sin(animT*4);
  cx.beginPath(); cx.arc(cxp,cyp,7+pulse,0,Math.PI*2);
  cx.fillStyle='rgba(37,99,235,.18)'; cx.fill();
  cx.beginPath(); cx.arc(cxp,cyp,6,0,Math.PI*2);
  cx.fillStyle='#2563EB'; cx.fill();
  cx.strokeStyle='#fff'; cx.lineWidth=2; cx.stroke();

  cx.fillStyle='#fff'; cx.strokeStyle='#2563EB'; cx.lineWidth=1;
  const lbl = 'N='+N.toLocaleString()+'  S='+Sp.toFixed(2)+'×';
  cx.font=`700 ${isNarrow?9:10.5}px ui-monospace,monospace`;
  const tw = cx.measureText(lbl).width;
  let lx = cxp - tw/2, ly = cyp - 26;
  if (ly < y0+8) ly = cyp + 20;
  if (lx < x0) lx = x0;
  if (lx+tw > x1) lx = x1-tw;
  rr(lx-6, ly-11, tw+12, 16, 4); cx.fill(); cx.stroke();
  cx.fillStyle='#1E293B'; cx.textAlign='left';
  cx.fillText(lbl, lx, ly+1);

  return {Nopt, wastedFrac: (Nopt!==null && N>Nopt) ? Math.min(1,(N-Nopt)/N) : 0, plotBottom:y1, W, H, isNarrow};
}

function drawNodeGrid(info){
  const {wastedFrac, plotBottom, W, H, isNarrow} = info;
  const cols = isNarrow?16:22, rows = 2;
  const total = cols*rows;
  const active = Math.round(total*(1-wastedFrac));
  const cellW = Math.min(16, (W-40)/cols);
  const cellH = 10;
  const gap = 3;
  const gridW = cols*(cellW+gap)-gap;
  const startX = (W-gridW)/2;
  const startY = plotBottom + (isNarrow?44:50);

  cx.font=`600 ${isNarrow?8:8.5}px system-ui,sans-serif`;
  cx.fillStyle='#64748B'; cx.textAlign='left';
  cx.fillText('CLUSTER UTILIZATION (representative)', startX, startY-6);

  let idx=0;
  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      const xx = startX + c*(cellW+gap);
      const yy = startY + r*(cellH+gap);
      const isActive = idx < active;
      if (isActive){
        cx.fillStyle = '#2563EB';
        rr(xx,yy,cellW,cellH,2); cx.fill();
      } else {
        cx.fillStyle = '#F1F5F9';
        rr(xx,yy,cellW,cellH,2); cx.fill();
        cx.strokeStyle='#FCA5A5'; cx.lineWidth=1;
        rr(xx,yy,cellW,cellH,2); cx.stroke();
      }
      idx++;
    }
  }
}

function draw(){
  animT += 0.016;
  const W = canvas.width / (window.devicePixelRatio||1);
  const H = canvas.height / (window.devicePixelRatio||1);
  cx.clearRect(0,0,W,H);
  const info = drawChart(W,H);
  drawNodeGrid(info);
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
  const Pf = getPf(), N = getN(), Co = getCo();
  const serial = 1-Pf, par = Pf/N, comm = Co*Math.log(N);
  const denom = serial+par+comm;
  const Sp = 1/denom;
  const eff = calcEfficiency(Sp,N);
  const Nopt = calcOptimalN(Pf,Co);
  const wastedNodes = calcWastedNodes(N,Nopt);
  const wastedCost = calcWastedCost(wastedNodes);

  document.getElementById('calcInner').innerHTML =
    `<b>S<sub>max</sub> = 1 / ((1-P<sub>f</sub>) + P<sub>f</sub>/N + C<sub>o</sub>&times;ln(N))</b><br>` +
    `&nbsp;&nbsp;= 1 / (${serial.toFixed(4)} + ${par.toFixed(4)} + ${comm.toFixed(4)})<br>` +
    `&nbsp;&nbsp;= 1 / ${denom.toFixed(4)} = <span class="hl">${Sp.toFixed(3)}×</span><br><br>` +

    `<b>Efficiency = S<sub>max</sub> / N &times; 100%</b><br>` +
    `&nbsp;&nbsp;= ${Sp.toFixed(2)} / ${N} = <span class="${eff<50?'hl-r':'hl-g'}">${eff.toFixed(1)}%</span><br><br>` +

    `<b>N* = P<sub>f</sub> / C<sub>o</sub></b> (point of diminishing returns)<br>` +
    (Nopt===null
      ? `&nbsp;&nbsp;<span class="hl-g">undefined — C<sub>o</sub>=0, monotonic increase</span><br><br>`
      : `&nbsp;&nbsp;= ${Pf} / ${Co} = <span class="${N>Nopt?'hl-r':'hl'}">${Nopt.toFixed(1)} nodes</span><br><br>`) +

    `<b>Wasted Nodes = max(0, N - N*)</b><br>` +
    `&nbsp;&nbsp;= ${wastedNodes.toFixed(1)} nodes &times; $${GPU_COST_USD.toLocaleString()}<br>` +
    `&nbsp;&nbsp;= <span class="${wastedCost>0?'hl-r':'hl-g'}">$${wastedCost.toLocaleString()}</span>`;
}

// ══════════════════════════════════════
//  OBSERVATIONS TABLE
// ══════════════════════════════════════
let observations = [];

function recordObs(){
  const Pf = getPf(), N = getN(), Co = getCo();
  const Sp = calcSpeedup(Pf,N,Co);
  const eff = calcEfficiency(Sp,N);
  const Nopt = calcOptimalN(Pf,Co);
  const wastedNodes = calcWastedNodes(N,Nopt);
  const wastedCost = calcWastedCost(wastedNodes);
  const n = observations.length+1;
  observations.push({n,Pf,N,Co,Sp,eff,Nopt,wastedCost});

  const tbody = document.getElementById('obsBody');
  if (n===1) tbody.innerHTML='';
  const row = tbody.insertRow();
  const effCls = eff<40?'color:var(--red);font-weight:700':eff<70?'color:var(--orange);font-weight:700':'color:var(--green);font-weight:700';
  row.innerHTML =
    `<td>${n}</td>` +
    `<td>${Pf}</td>` +
    `<td>${N.toLocaleString()}</td>` +
    `<td>${Co}</td>` +
    `<td>${Sp.toFixed(2)}×</td>` +
    `<td style="${effCls}">${eff.toFixed(1)}</td>` +
    `<td>${Nopt===null?'∞':Math.round(Nopt).toLocaleString()}</td>` +
    `<td>$${wastedCost.toLocaleString()}</td>`;

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
  const h = '#,Pf,N,Co,Speedup,Efficiency(%),OptimalN,WastedCost(USD)';
  const rows = observations.map(o =>
    [o.n,o.Pf,o.N,o.Co,o.Sp.toFixed(4),o.eff.toFixed(2),
     o.Nopt===null?'Infinity':o.Nopt.toFixed(2), o.wastedCost.toFixed(2)].join(','));
  const a = document.createElement('a');
  a.href = 'data:text/csv,' + encodeURIComponent([h,...rows].join('\n'));
  a.download = 'amdahls_law_observations.csv';
  a.click();
}

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
fillSlider(document.getElementById('slPf'), (S.pfIdx/5)*100);
fillSlider(document.getElementById('slN'), (S.nIdx/6)*100);
fillSlider(document.getElementById('slCo'), (S.coIdx/5)*100);
updateInfoCard();
update();
requestAnimationFrame(draw);
//Your JavaScript goes in here
