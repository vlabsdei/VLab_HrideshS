const S = {
    // Sliders / user inputs
    Ta: 25,          // Ambient temperature °C
    P: 300,          // GPU power draw in Watts
    R: 0.10,         // Base thermal resistance °C/W
    fanMode: 'auto', // 'auto' or 'manual'
    fanPct: 50,      // Fan duty-cycle 0-100%

    // Scenario toggles
    paste: false,    // true = thermal paste is degraded
    hvac: false,     // true = HVAC failure forces Ta = 40 °C
    calc: false,     // true = show formula panel

    // Exploded-view state
    exploded: false,
    explodeProg: 0,  // 0 = assembled, 1 = exploded

    // Temperature model
    targetTj: 45,    // Instantaneous Tj
    currentTj: 45,   // Displayed temperature (lerped)
    effP: 300,       // Effective power
    baseR: 0.10,     // R with paste degradation
    effR: 0.10,      // R after fan cooling
    throttle: false, // true when Tj > 85 °C

    // Fan animation
    fanAngle: 0,
    fanCurrentRPM: 0,
    fanTargetRPM: 0,

    // GPU float / camera
    floatT: 0,
    cameraZoom: 1.0,
    cameraZoomTarget: 1.0,

    // Heat particles
    particles: [],
    hvacTint: 0,

    // Misc
    hintGone: false,
    MAX_TF: 82,      // Peak TFLOPS

    // Thermal propagation (layer heat lag)
    pasteHeat: 0,
    heatsinkHeat: 0,
    diePulseT: 0,

    // Paste degradation animation
    pasteProgress: 0,
};

// Init heatsink fins
const hsFinsRow = document.getElementById('hsFinsRow');
for (let i = 0; i < 36; i++) { const f = document.createElement('div'); f.className = 'hs-fin'; hsFinsRow.appendChild(f); }

// Init die cells
const dieCells = document.getElementById('dieCells');
for (let i = 0; i < 18; i++) { const c = document.createElement('div'); c.className = 'die-cell'; dieCells.appendChild(c); }

// Color helpers
function tempColor(tj) {
    if (tj < 50) return '#2563EB';
    if (tj < 65) return '#16A34A';
    if (tj < 78) return '#D97706';
    if (tj < 90) return '#EA580C';
    return '#DC2626';
}
function tempColorHex(tj) {
    const stops = [
        [40, '#2563EB'], [60, '#16A34A'], [78, '#D97706'], [90, '#EA580C'], [100, '#DC2626']
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        if (tj <= stops[i + 1][0]) {
            const t = (tj - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
            return lerpColor(stops[i][1], stops[i + 1][1], t);
        }
    }
    return '#DC2626';
}
function lerpColor(a, b, t) {
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    return '#' + [ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// Fan canvas renderer
function drawFan(ctx, cx, cy, r, angle, blurAmt, tempPct) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    const blurPasses = Math.max(1, Math.floor(blurAmt * 12));
    const alphaStep = 1 / blurPasses;

    for (let pass = 0; pass < blurPasses; pass++) {
        const a = angle - pass * 0.28 * blurAmt;
        ctx.globalAlpha = alphaStep * (1 - pass * 0.06);
        drawFanBlades(ctx, cx, cy, r, a, tempPct);
    }
    ctx.globalAlpha = 1;

    const hubR = r * 0.2;
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubR);
    hg.addColorStop(0, '#5A5A5A'); hg.addColorStop(1, '#1C1C1C');
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();

    ctx.beginPath(); ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,200,0.25)'; ctx.fill();
}

function drawFanBlades(ctx, cx, cy, r, angle, tempPct) {
    const blades = 7;
    const temp01 = Math.max(0, Math.min(1, tempPct));
    for (let i = 0; i < blades; i++) {
        const ba = angle + i * (Math.PI * 2 / blades);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ba);

        const g = ctx.createLinearGradient(0, 0, r * 0.62, -r * 0.48);
        const alpha = 0.72;
        g.addColorStop(0, `rgba(${100 + Math.round(temp01 * 80)},${150 - Math.round(temp01 * 60)},${220 - Math.round(temp01 * 80)},${alpha})`);
        g.addColorStop(0.5, `rgba(${80 + Math.round(temp01 * 70)},${120 - Math.round(temp01 * 50)},${200 - Math.round(temp01 * 80)},${alpha * 0.8})`);
        g.addColorStop(1, `rgba(${60 + Math.round(temp01 * 60)},${90 - Math.round(temp01 * 30)},${170 - Math.round(temp01 * 70)},${alpha * 0.5})`);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r * 0.1, -r * 0.05, r * 0.55, -r * 0.06, r * 0.62, -r * 0.48);
        ctx.bezierCurveTo(r * 0.58, -r * 0.52, r * 0.12, -r * 0.13, 0, 0);
        ctx.fillStyle = g; ctx.fill();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r * 0.1, -r * 0.05, r * 0.55, -r * 0.06, r * 0.62, -r * 0.48);
        ctx.strokeStyle = `rgba(180,210,255,0.25)`; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.restore();
    }
}

// Airflow Streamlines
const afCtx = document.getElementById('airflowCanvas').getContext('2d');
let streamlines = [];
function initStreamlines() {
    streamlines = [];
    for (let i = 0; i < 14; i++) {
        streamlines.push({
            x: Math.random() * 420,
            y: 4 + Math.random() * 48,
            speed: 0,
            alpha: 0,
            wo: Math.random() * Math.PI * 2
        });
    }
}
initStreamlines();

function drawAirflow(rpm, dt) {
    const ac = afCtx;
    ac.clearRect(0, 0, 420, 56);
    const speed = rpm / 3500;
    if (speed < 0.02) return;
    streamlines.forEach(sl => {
        sl.speed = speed * (1.2 + Math.random() * 0.5);
        sl.x += sl.speed * 55 * dt;
        sl.alpha = Math.min(speed * 0.8, sl.alpha + dt * 1.8);
        if (sl.x > 435) { sl.x = Math.random() * -30; sl.y = 4 + Math.random() * 48; sl.alpha = 0; }
        ac.save();
        ac.globalAlpha = sl.alpha;
        ac.beginPath();
        const wavAmp = 1.5 + speed * 4;
        ac.moveTo(sl.x, sl.y);
        for (let dx = 0; dx <= 26; dx += 2) {
            ac.lineTo(sl.x + dx, sl.y + Math.sin((sl.x + dx) * 0.11 + sl.wo + sl.speed * 2) * wavAmp);
        }
        ac.strokeStyle = `rgba(96,165,250,${0.45 + speed * 0.35})`;
        ac.lineWidth = 0.9 + speed * 0.6;
        ac.stroke();
        ac.restore();
    });
}

// Heat Particle Canvas & Responsive Scale
const hc = document.getElementById('heatCanvas');
const hctx = hc.getContext('2d');
function resizeCanvas() {
    const vp = document.getElementById('vp');
    hc.width = vp.clientWidth; hc.height = vp.clientHeight;
}
function computeGpuScale() {
    const vp = document.getElementById('vp');
    const s = Math.min((vp.clientWidth - 80) / 540, (vp.clientHeight - 100) / 560);
    document.documentElement.style.setProperty('--gs', Math.max(0.25, Math.min(1.8, s)).toFixed(3));
}
window.addEventListener('resize', () => { resizeCanvas(); computeGpuScale(); });
resizeCanvas(); computeGpuScale();

function spawnHeatParticle() {
    if (S.explodeProg < 0.4) return;
    const vp = document.getElementById('vp');
    const vr = vp.getBoundingClientRect();
    const die = document.getElementById('elDie');
    const dr = die.getBoundingClientRect();
    const cx = (dr.left + dr.right) / 2 - vr.left;
    const cy = dr.top - vr.top;
    const intensity = Math.max(0, (S.currentTj - 45) / 70);
    if (intensity < 0.02 || Math.random() > 0.28) return;
    S.particles.push({
        x: cx + (Math.random() - 0.5) * 120,
        y: cy,
        vy: -(0.5 + Math.random() * 1.4) * intensity,
        vx: (Math.random() - 0.5) * 0.6,
        life: 1,
        decay: 0.013 + Math.random() * 0.01,
        r: 1.5 + Math.random() * 2.5,
        color: tempColorHex(S.currentTj),
    });
}
function drawHeatParticles() {
    hctx.clearRect(0, 0, hc.width, hc.height);
    S.particles = S.particles.filter(p => p.life > 0);
    S.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;
        hctx.save(); hctx.globalAlpha = p.life * 0.55;
        hctx.beginPath(); hctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        hctx.fillStyle = p.color; hctx.fill();
        hctx.restore();
    });
}

// Thermal Compute Model: Tj = Ta + P * Rθ
function computeTarget() {
    const Ta = S.hvac ? 40 : S.Ta;
    const R = S.R + (S.paste ? 0.15 : 0);
    if (S.fanMode === 'auto') S.fanPct = Math.max(20, Math.min(100, (S.currentTj - 28) * 2.2));
    const effR = R * (1 - (S.fanPct / 100) * 0.38);
    let Tj = Ta + S.P * effR;
    let throttle = false, effP = S.P;
    if (Tj > 85) { throttle = true; effP = S.P * (85 / Tj) * 0.92; Tj = Ta + effP * effR; }
    S.targetTj = Tj; S.throttle = throttle; S.effP = effP; S.effR = effR;
    S.baseR = R;
    S.currentTj += (S.targetTj - S.currentTj) * 0.15;
}

function updateDisplay() {
    const Tj = S.currentTj;
    const Ta = S.hvac ? 40 : S.Ta;
    const fanRPM = Math.round(S.fanPct * 35);
    const perf = S.throttle ? Math.round((S.effP / S.P) * 100) : 100;
    const tflops = (S.MAX_TF * perf / 100).toFixed(1);

    updateDash('Tj', Tj.toFixed(1), Tj > 95 ? 'crit' : Tj > 85 ? 'hot' : Tj > 70 ? 'warn' : '');
    updateDash('Ta', Ta.toFixed(0), (S.hvac || S.Ta >= 38) ? 'warn' : '');
    updateDash('P', S.effP.toFixed(0), S.throttle ? 'warn' : '');
    updateDash('R', S.baseR.toFixed(2), S.paste ? 'warn' : '');
    updateDash('Fan', fanRPM, '');
    updateDash('Perf', perf, perf < 80 ? 'warn' : 'good');
    updateDash('TF', tflops, perf < 80 ? 'warn' : '');

    const pill = document.getElementById('statusPill'), stxt = document.getElementById('statusTxt');
    if (Tj > 95) { pill.className = 'hd-pill pill-crit'; stxt.textContent = 'Critical'; }
    else if (Tj > 85) { pill.className = 'hd-pill pill-hot'; stxt.textContent = 'Throttling'; }
    else if (Tj > 75) { pill.className = 'hd-pill pill-warn'; stxt.textContent = 'Elevated'; }
    else { pill.className = 'hd-pill pill-ok'; stxt.textContent = 'Nominal'; }

    document.getElementById('vTa').textContent = (S.hvac ? 40 : S.Ta) + ' °C';
    document.getElementById('vP').textContent = S.P + ' W';
    document.getElementById('vR').textContent = S.baseR.toFixed(2) + ' °C/W';
    document.getElementById('vFan').textContent = Math.round(S.fanPct) + '%';
    if (S.hvac) document.getElementById('slTa').value = 40;

    S.hvacTint += (S.hvac ? 0.07 : -0.07); S.hvacTint = Math.max(0, Math.min(1, S.hvacTint));
    document.getElementById('hvacOverlay').style.background = `rgba(220,38,38,${S.hvacTint * 0.06})`;

    const ht01 = Math.max(0, (Tj - 40) / 65);

    S.diePulseT += 0.018;
    const pulse = S.currentTj > 90 ? (Math.sin(S.diePulseT * 7) * 0.5 + 0.5) : 0;
    const dieCol = tempColorHex(Tj);
    const pkg = document.getElementById('diePackage');
    const glowSize = 12 + ht01 * 30 + pulse * 20;
    const glowAlpha = Math.round(55 + pulse * 80).toString(16).padStart(2, '0');
    pkg.style.boxShadow = `0 0 ${glowSize}px ${dieCol}${glowAlpha},0 2px 8px rgba(0,0,0,.18)`;
    document.getElementById('dieSubstrate').style.background =
        `linear-gradient(135deg,${mixDark(dieCol, 0.1 + ht01 * 0.45)},${mixDark(dieCol, 0.05 + ht01 * 0.35)})`;
    document.getElementById('dieTempLbl').textContent = Tj.toFixed(1) + '°C';
    document.getElementById('dieTempLbl').style.color = dieCol;

    document.querySelectorAll('.die-cell').forEach((c, i) => {
        const row = Math.floor(i / 6), col = i % 6;
        const dx = col - 2.5, dy = row - 1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const heat = Math.max(0, 1 - dist / 3.2);
        const cr = Math.round(ht01 * 150 * heat), ca = 0.12 + heat * 0.25 * ht01;
        c.style.background = `rgba(${255 - cr},${80 - cr / 2},${20},${ca + 0.06})`;
    });

    S.pasteHeat += (ht01 * 0.82 - S.pasteHeat) * 0.13;
    S.heatsinkHeat += (S.pasteHeat * 0.70 - S.heatsinkHeat) * 0.10;

    const pH = S.pasteHeat;
    if (!S.paste) document.getElementById('pasteTrack').style.background =
        `linear-gradient(90deg,#E8E8D0,rgba(${200 + Math.round(pH * 55)},${200 - Math.round(pH * 40)},${160 - Math.round(pH * 55)},1),#E8E8D0)`;

    const fins = document.querySelectorAll('.hs-fin');
    const nFins = fins.length;
    fins.forEach((f, i) => {
        const centerDist = Math.abs(i / (nFins - 1) - 0.5) * 2;
        const finHeat = S.heatsinkHeat * (1 - centerDist * 0.58);
        if (finHeat > 0.03) {
            const rr = Math.round(168 + finHeat * 75), gg = Math.round(180 - finHeat * 65), bb = Math.round(195 - finHeat * 95);
            const alt = i % 2;
            f.style.background = `linear-gradient(180deg,rgb(${rr + alt * 5},${gg + alt * 3},${bb + alt * 3}) 0%,rgb(${rr + 14},${gg + 6},${bb - 10}) 45%,rgb(${rr + alt * 5},${gg + alt * 3},${bb + alt * 3}) 100%)`;
        } else { f.style.background = ''; }
    });

    if (S.calc) updateCalcBox();
}

function mixDark(hex, t) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return '#' + [Math.round(r * t), Math.round(g * t), Math.round(b * t)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function updateDash(key, val, cls) {
    document.getElementById('dv' + key).textContent = val;
    document.getElementById('dc' + key).className = 'dc' + (cls ? ' ' + cls : '');
}

// Paste Visual Simulation
const PASTE_HEIGHTS = [0.9, 0.3, 1, 0.5, 0.8, 0.15, 0.95, 0.6, 0.25, 1, 0.7, 0.35, 0.85, 0.5, 0.2, 0.75];
let _pasteDivs = [];

function buildPasteVisual() {
    const pt = document.getElementById('pasteTrack');
    pt.innerHTML = '';
    _pasteDivs = [];
    const segs = PASTE_HEIGHTS.length;
    const sw = 100 / segs;
    PASTE_HEIGHTS.forEach((h, i) => {
        const d = document.createElement('div');
        d.style.cssText = `position:absolute;left:${i * sw + 0.1}%;bottom:0;width:${sw - 0.5}%;height:0%;border-radius:1px 1px 0 0;transition:height 0.08s,background 0.3s`;
        pt.appendChild(d);
        _pasteDivs.push({ el: d, targetH: h });
    });
}

function updatePasteVisual(progress) {
    const pt = document.getElementById('pasteTrack');
    if (progress < 0.01) {
        pt.style.background = '';
        pt.style.backgroundImage = 'linear-gradient(90deg,#E8E8D0,#F0F0E0,#E8E8D0)';
        _pasteDivs.forEach(p => { p.el.style.height = '0%'; p.el.style.background = 'transparent'; });
        return;
    }
    pt.style.backgroundImage = '';
    pt.style.background = '#EAE4CC';
    _pasteDivs.forEach(({ el, targetH }) => {
        const h = Math.min(targetH, progress * (1 + targetH * 0.4));
        const col = targetH < 0.4 ? '#C8A060' : '#D8C890';
        el.style.height = (h * 100) + '%';
        el.style.background = col;
        el.style.outline = targetH < 0.4 ? '1px solid rgba(220,100,0,.3)' : 'none';
    });
}

// Exploded view positions (ass = assembled, exp = exploded)
const LAYER_POS = {
    elShroud: { ass: 190, exp: 20 },
    elHeatsink: { ass: 252, exp: 215 },
    elPaste: { ass: 274, exp: 285 },
    elDie: { ass: 240, exp: 310 },
    elPCB: { ass: 247, exp: 410 },
};
Object.keys(LAYER_POS).forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.transition = 'none'; el.style.top = LAYER_POS[id].ass + 'px'; }
});
const OPEN_DELAY = { elShroud: 0, elHeatsink: 90, elPaste: 170, elDie: 230, elPCB: 0 };
const CLOSE_DELAY = { elShroud: 260, elHeatsink: 160, elPaste: 70, elDie: 0, elPCB: 0 };

let _explodeTimers = [];

// Explode / Assembled Transition Logic
function animateExplode(target) {
    _explodeTimers.forEach(t => clearTimeout(t));
    _explodeTimers = [];
    const es = document.getElementById('explodedScene');
    const asc = document.getElementById('assembledScene');

    if (target === 1) {
        S.cameraZoomTarget = 1.06;
        es.style.display = 'block';
        es.style.opacity = '0';
        es.style.transition = 'opacity 0.3s';
        document.getElementById('elShroud').style.zIndex = '10';

        Object.keys(LAYER_POS).forEach(id => {
            const el = document.getElementById(id);
            el.style.transition = 'none';
            el.style.top = LAYER_POS[id].ass + 'px';
        });
        es.getBoundingClientRect();

        asc.style.transition = 'opacity 0.35s';
        asc.style.opacity = '0';
        asc.style.pointerEvents = 'none';
        es.style.opacity = '1';
        S.explodeProg = 0.05;

        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elPCB');
            el.style.transition = 'top 0.9s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elPCB.exp + 'px';
        }, 50));

        _explodeTimers.push(setTimeout(() => {
            ['elDie', 'elPaste'].forEach((id, i) => {
                setTimeout(() => {
                    const el = document.getElementById(id);
                    el.style.transition = 'top 0.7s cubic-bezier(.34,1.56,.64,1)';
                    el.style.top = LAYER_POS[id].exp + 'px';
                }, i * 150);
            });
        }, 400));

        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elHeatsink');
            el.style.transition = 'top 0.9s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elHeatsink.exp + 'px';
        }, 1000));

        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elShroud');
            el.style.transition = 'top 0.9s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elShroud.exp + 'px';
        }, 1500));

        _explodeTimers.push(setTimeout(() => {
            document.querySelectorAll('.exp-layer').forEach(l => l.classList.add('show-lbl'));
            document.getElementById('dieTempLbl').style.opacity = '1';
            S.explodeProg = 1;
        }, 2200));

    } else {
        document.querySelectorAll('.exp-layer').forEach(l => l.classList.remove('show-lbl'));
        document.getElementById('dieTempLbl').style.opacity = '0';
        S.cameraZoomTarget = 1.0;

        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elShroud');
            el.style.transition = 'top 0.85s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elShroud.ass + 'px';
        }, 0));

        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elHeatsink');
            el.style.transition = 'top 0.85s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elHeatsink.ass + 'px';
        }, 400));

        _explodeTimers.push(setTimeout(() => {
            ['elPaste', 'elDie'].forEach((id, i) => {
                setTimeout(() => {
                    const el = document.getElementById(id);
                    el.style.transition = 'top 0.7s cubic-bezier(.34,1.56,.64,1)';
                    el.style.top = LAYER_POS[id].ass + 'px';
                }, i * 100);
            });
        }, 800));

        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elPCB');
            el.style.transition = 'top 0.85s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elPCB.ass + 'px';
        }, 1200));

        _explodeTimers.push(setTimeout(() => {
            asc.style.transition = 'opacity 0.45s';
            asc.style.opacity = '1';
            asc.style.pointerEvents = '';
        }, 2050));

        _explodeTimers.push(setTimeout(() => {
            es.style.transition = 'opacity 0.3s';
            es.style.opacity = '0';
            S.explodeProg = 0;
            setTimeout(() => { es.style.display = 'none'; }, 320);
        }, 2100));
    }
}
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// Formula calculation box update
function updateCalcBox() {
    const Tj = S.currentTj, Ta = S.hvac ? 40 : S.Ta;
    const col = tempColorHex(Tj);
    document.getElementById('cbFormula').innerHTML =
        `T<sub>j</sub> = T<sub>a</sub> + (P &times; R&theta;)<br>` +
        `&nbsp;&nbsp;&nbsp;= ${Ta} + (${S.effP.toFixed(0)} &times; ${S.baseR.toFixed(2)})<br>` +
        `&nbsp;&nbsp;&nbsp;= <strong style="color:${col}">${Tj.toFixed(1)} &deg;C</strong>` +
        (S.throttle ? `<br><span style="color:#DC2626;font-size:11px;font-weight:400">&nbsp;&nbsp;&nbsp;⚠ Thermal throttle active</span>` : '');
}

// Main simulation loop
let lastTs = 0, lastCompute = 0;
function mainLoop(ts) {
    const dt = Math.min((ts - lastTs) / 1000, 0.05); lastTs = ts;

    if (ts - lastCompute > 200) { computeTarget(); updateDisplay(); lastCompute = ts; }

    S.floatT += dt * 0.65;
    S.cameraZoom += (S.cameraZoomTarget - S.cameraZoom) * 0.12;
    const fp = 1 - Math.min(1, S.explodeProg * 8);
    const float = Math.sin(S.floatT) * 6 * fp;
    const floatRot = Math.sin(S.floatT * 0.78) * 1.5 * fp;
    const gs = document.documentElement.style.getPropertyValue('--gs') || '1';
    const totalScale = (parseFloat(gs) * S.cameraZoom).toFixed(3);

    const transformString = `translate(-50%,calc(-50% + ${float.toFixed(2)}px)) rotate(${floatRot.toFixed(2)}deg) scale(${totalScale})`;

    document.getElementById('assembledScene').style.transform = transformString;
    document.getElementById('explodedScene').style.transform = transformString;

    S.fanTargetRPM = S.fanPct * 35;
    S.fanCurrentRPM += (S.fanTargetRPM - S.fanCurrentRPM) * 0.06;
    S.fanAngle += (S.fanCurrentRPM / 3500) * 0.30 + 0.001;
    const blur01 = Math.min(1, (S.fanCurrentRPM / 3500 - 0.15) / 0.75);
    const tempPct = Math.max(0, (S.currentTj - 40) / 65);

    [['fc1', 37], ['fc2', 37], ['fc3', 37]].forEach(([id, r]) => {
        const c = document.getElementById(id); if (!c) return;
        drawFan(c.getContext('2d'), r, r, r, S.fanAngle, Math.max(0, blur01), tempPct);
    });
    [['efc1', 37], ['efc2', 37], ['efc3', 37]].forEach(([id, r]) => {
        const c = document.getElementById(id); if (!c) return;
        drawFan(c.getContext('2d'), r, r, r, S.fanAngle, Math.max(0, blur01), tempPct);
    });

    drawAirflow(S.fanCurrentRPM, dt);
    spawnHeatParticle();
    drawHeatParticles();

    requestAnimationFrame(mainLoop);
}

// UI Control Handlers
function syncSlider(el) {
    const pct = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
}
['slTa', 'slP', 'slR', 'slFan'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { syncSlider(el); onSlider(id); });
    syncSlider(el);
});

function onSlider(id) {
    if (id === 'slTa' && !S.hvac) S.Ta = +document.getElementById('slTa').value;
    if (id === 'slP') S.P = +document.getElementById('slP').value;
    if (id === 'slR') S.R = document.getElementById('slR').value / 100;
    if (id === 'slFan' && S.fanMode === 'manual') S.fanPct = +document.getElementById('slFan').value;
    computeTarget(); updateDisplay();
}

function setFanMode(m) {
    S.fanMode = m;
    document.getElementById('fanAutoBtn').className = 'tog-btn' + (m === 'auto' ? ' on' : '');
    document.getElementById('fanManBtn').className = 'tog-btn' + (m === 'manual' ? ' on' : '');
    document.getElementById('fanSlRow').style.display = m === 'manual' ? 'flex' : 'none';
    computeTarget(); updateDisplay();
}

function togglePaste() {
    S.paste = !S.paste;
    document.getElementById('btnPaste').className = 'sc-btn' + (S.paste ? ' on-paste' : '');
    buildPasteVisual();
    computeTarget(); updateDisplay();
}

// toggleHvac: HVAC failure forces ambient to 40 °C
function toggleHvac() {
    S.hvac = !S.hvac;
    document.getElementById('btnHvac').className = 'sc-btn' + (S.hvac ? ' on-hvac' : '');
    if (S.hvac) { document.getElementById('slTa').value = 40; syncSlider(document.getElementById('slTa')); }
    computeTarget(); updateDisplay();
}

function resetAll() {
    S.Ta = 25; S.P = 300; S.R = 0.10; S.fanMode = 'auto'; S.fanPct = 50; S.paste = false; S.hvac = false;
    ['slTa', 'slP', 'slR'].forEach(id => {
        const el = document.getElementById(id);
        el.value = { slTa: 25, slP: 300, slR: 10 }[id]; syncSlider(el);
    });
    document.getElementById('btnPaste').className = 'sc-btn';
    document.getElementById('btnHvac').className = 'sc-btn';
    setFanMode('auto'); buildPasteVisual();
    computeTarget(); updateDisplay();
}

function toggleCalc() {
    S.calc = !S.calc;
    const btn = document.getElementById('calcBtn');
    btn.className = 'calc-btn' + (S.calc ? ' on' : '');
    btn.textContent = S.calc ? '✕ Hide Calculation' : '∑ Show Calculation';
    const box = document.getElementById('calcBox');
    if (S.calc) { box.classList.add('show'); updateCalcBox(); }
    else box.classList.remove('show');
}

function handleClick(e) {
    if (e.target.closest('#calcBox')) return;
    if (e.target.closest('input')) return;
    S.exploded = !S.exploded;
    animateExplode(S.exploded ? 1 : 0);
    if (!S.hintGone) {
        S.hintGone = true;
        const h = document.getElementById('clickHint');
        h.classList.add('gone');
        setTimeout(() => { h.style.display = 'none'; }, 700);
    }
}
window.addEventListener('resize', () => { resizeCanvas(); });

// Initialize simulation
buildPasteVisual();
computeTarget();
updateDisplay();
requestAnimationFrame(mainLoop);
