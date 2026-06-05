

// ══════════════════════════════════════
//  GLOBAL STATE  (single source of truth for the whole simulation)
//  All values live here. To change a default, edit the number next to
//  the key. To add a new feature, add a key here first.
// ══════════════════════════════════════
const S = {
    // ── Sliders / user inputs ──────────────────────────────────────
    Ta: 25,          // Ambient temperature °C  (slider range 15-40)
    P: 300,          // GPU power draw in Watts  (slider range 100-700)
    R: 0.10,         // Base thermal resistance °C/W  (slider range 0.05-0.50)
    fanMode: 'auto', // 'auto' = fan speed computed from Tj; 'manual' = user slider
    fanPct: 50,      // Fan duty-cycle 0-100%.  In auto mode this is overwritten each frame.

    // ── Scenario toggles ───────────────────────────────────────────
    paste: false,    // true = thermal paste is degraded (+0.15 °C/W resistance)
    hvac: false,     // true = HVAC failure forces Ta = 40 °C
    calc: false,     // true = show the formula overlay panel

    // ── Exploded-view state ────────────────────────────────────────
    exploded: false, // Whether we are currently in exploded mode
    explodeProg: 0,  // 0 = fully assembled, 1 = fully exploded.
    // Used by heat particles and fan speed suppression.

    // ── Temperature model ──────────────────────────────────────────
    targetTj: 45,    // Instantaneous Tj from the formula (no inertia).
    // Change the formula in computeTarget() to affect this.
    currentTj: 45,   // Displayed temperature — lerps toward targetTj each frame.
    // Increase the lerp factor (0.025) for faster response.
    effP: 300,       // Effective power after thermal throttling
    baseR: 0.10,     // R including paste degradation penalty
    effR: 0.10,      // R after fan-cooling reduction
    throttle: false, // true when Tj > 85 °C — triggers performance cut

    // ── Fan animation ──────────────────────────────────────────────
    fanAngle: 0,         // Current blade rotation angle in radians
    fanCurrentRPM: 0,    // Actual RPM after momentum smoothing.
    // Raise the lerp factor (0.06) to make fans respond faster.
    fanTargetRPM: 0,     // RPM the fan is trying to reach this frame

    // ── GPU float / camera ─────────────────────────────────────────
    floatT: 0,           // Time accumulator for the sine-based floating animation.
    // Change dt multiplier (0.65) to speed up / slow down drift.
    cameraZoom: 1.0,     // Current scale applied on top of --gs.  Lerps each frame.
    cameraZoomTarget: 1.0, // Target scale. Set to 1.06 on explode, 1.0 on close.

    // ── Heat particles ─────────────────────────────────────────────
    particles: [],   // Array of active heat particle objects
    hvacTint: 0,     // 0-1 redness of the HVAC failure overlay

    // ── Misc ───────────────────────────────────────────────────────
    hintGone: false, // Whether the "click to explore" hint has been dismissed
    MAX_TF: 82,      // Peak TFLOPS at 100% performance (change for a different GPU)

    // ── Thermal propagation (layer heat lag) ──────────────────────
    pasteHeat: 0,    // Heat that has reached the paste layer (lags behind die).
    // Drives paste colour. Increase lerp factor (0.022) to speed up.
    heatsinkHeat: 0, // Heat that has reached the heatsink (lags behind paste).
    // Drives the centre-hot fin gradient.
    diePulseT: 0,    // Time accumulator for the high-temp die glow pulse

    // ── Paste degradation animation ────────────────────────────────
    pasteProgress: 0, // 0 = pristine, 1 = fully cracked.
    // Animated to 1 when paste is toggled on.
};

// ══════════════════════════════════════
//  INIT HEATSINK FINS
//  Dynamically creates 36 <div class="hs-fin"> elements inside #hsFinsRow.
//  Change 36 to add more or fewer fins — affects density and heat gradient detail.
//  Each fin's colour is updated every display frame in updateDisplay().
// ══════════════════════════════════════
const hsFinsRow = document.getElementById('hsFinsRow');
for (let i = 0; i < 36; i++) { const f = document.createElement('div'); f.className = 'hs-fin'; hsFinsRow.appendChild(f); }

// ══════════════════════════════════════
//  INIT DIE CELLS
//  Creates an 6×3 grid of cells inside #dieCells (used in the exploded die view).
//  Cells are coloured based on distance from the die centre in updateDisplay().
//  Increase 18 (and adjust the grid CSS) for finer resolution.
// ══════════════════════════════════════
const dieCells = document.getElementById('dieCells');
for (let i = 0; i < 18; i++) { const c = document.createElement('div'); c.className = 'die-cell'; dieCells.appendChild(c); }

// ══════════════════════════════════════
//  COLOR HELPERS
//  tempColor()    → returns a CSS colour string for a given Tj (step-based, used for
//                   UI badges, borders, etc.).
//  tempColorHex() → smooth interpolated hex colour across temperature stops.
//                   Used for die glow, particles, dashboard cells.
//  To change the colour thresholds edit the stops arrays below.
//  lerpColor()    → pure utility: linearly interpolates between two hex colours.
// ══════════════════════════════════════
function tempColor(tj) {
    // Step thresholds: change numbers to shift when each colour kicks in
    if (tj < 50) return '#2563EB'; // cool — blue
    if (tj < 65) return '#16A34A'; // warm  — green
    if (tj < 78) return '#D97706'; // hot   — amber
    if (tj < 90) return '#EA580C'; // very hot — orange
    return '#DC2626';              // critical — red
}
function tempColorHex(tj) {
    // Smooth gradient stops [°C, hexColour].  Add or move stops for finer control.
    const stops = [
        [40, '#2563EB'], [60, '#16A34A'], [78, '#D97706'], [90, '#EA580C'], [100, '#DC2626']
    ];
    for (let i = 0; i < stops.length - 1; i++) {
        if (tj <= stops[i + 1][0]) {
            // How far between this stop and the next (0-1)
            const t = (tj - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
            return lerpColor(stops[i][1], stops[i + 1][1], t);
        }
    }
    return '#DC2626'; // above max stop
}
function lerpColor(a, b, t) {
    // Splits both hex colours into R/G/B, interpolates each channel, rejoins.
    const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
    return '#' + [ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
}

// ══════════════════════════════════════
//  FAN CANVAS RENDERER
//  Draws a top-down view of a single fan onto a <canvas> element.
//  drawFan()       — entry point; handles motion blur then draws hub + bolt.
//  drawFanBlades() — draws the 7 curved airfoil blades.
//
//  To change fan appearance:
//    blurAmt  — raise to increase motion-blur streak length
//    blades   — change 7 to use a different blade count
//    bezier control points — tweak the curve shape of each blade
//    blade gradient stops — change colours / tints based on tempPct
// ══════════════════════════════════════
function drawFan(ctx, cx, cy, r, angle, blurAmt, tempPct) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Motion blur: draw the same blades multiple times at slightly earlier angles,
    // each pass fainter.  More passes = smoother blur but more CPU cost.
    // Change blurAmt * 12 to control max pass count.
    const blurPasses = Math.max(1, Math.floor(blurAmt * 12));
    const alphaStep = 1 / blurPasses;

    for (let pass = 0; pass < blurPasses; pass++) {
        // Each pass is rotated 0.28*blurAmt radians behind the current frame
        const a = angle - pass * 0.28 * blurAmt;
        ctx.globalAlpha = alphaStep * (1 - pass * 0.06);
        drawFanBlades(ctx, cx, cy, r, a, tempPct);
    }
    ctx.globalAlpha = 1;

    // Central hub — radial gradient from grey to near-black
    const hubR = r * 0.2; // Change 0.2 to resize the hub relative to the fan
    const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, hubR);
    hg.addColorStop(0, '#5A5A5A'); hg.addColorStop(1, '#1C1C1C');
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.stroke();
    // Tiny center bolt highlight
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,200,0.25)'; ctx.fill();
}

function drawFanBlades(ctx, cx, cy, r, angle, tempPct) {
    const blades = 7; // Number of blades — change this to add/remove blades
    const temp01 = Math.max(0, Math.min(1, tempPct)); // 0=cool 1=hot (drives colour shift)
    for (let i = 0; i < blades; i++) {
        const ba = angle + i * (Math.PI * 2 / blades); // evenly space blades around 360°
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ba);

        // Blade colour: interpolates from cool blue → warm orange as tempPct rises
        const g = ctx.createLinearGradient(0, 0, r * 0.62, -r * 0.48);
        const alpha = 0.72;
        g.addColorStop(0, `rgba(${100 + Math.round(temp01 * 80)},${150 - Math.round(temp01 * 60)},${220 - Math.round(temp01 * 80)},${alpha})`);
        g.addColorStop(0.5, `rgba(${80 + Math.round(temp01 * 70)},${120 - Math.round(temp01 * 50)},${200 - Math.round(temp01 * 80)},${alpha * 0.8})`);
        g.addColorStop(1, `rgba(${60 + Math.round(temp01 * 60)},${90 - Math.round(temp01 * 30)},${170 - Math.round(temp01 * 70)},${alpha * 0.5})`);

        // Blade shape: cubic bezier forming a curved airfoil
        // Adjust the control points to change blade sweep / curvature
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r * 0.1, -r * 0.05, r * 0.55, -r * 0.06, r * 0.62, -r * 0.48);
        ctx.bezierCurveTo(r * 0.58, -r * 0.52, r * 0.12, -r * 0.13, 0, 0);
        ctx.fillStyle = g; ctx.fill();

        // Subtle highlight stroke along the leading edge
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(r * 0.1, -r * 0.05, r * 0.55, -r * 0.06, r * 0.62, -r * 0.48);
        ctx.strokeStyle = `rgba(180,210,255,0.25)`; ctx.lineWidth = 0.7; ctx.stroke();
        ctx.restore();
    }
}

// ══════════════════════════════════════
//  AIRFLOW STREAMLINES
//  Draws animated wavy lines over the heatsink canvas to visualise
//  airflow velocity.  More lines / faster motion = higher fan RPM.
//
//  To tune visuals:
//    14          — number of lines; raise for denser flow
//    55 * dt     — horizontal advance speed; raise to move lines faster
//    wavAmp      — vertical wobble amplitude; raise for more turbulent look
//    0.11 * x    — wave frequency; raise for tighter sine ripples
//    rgba(96,165,250,...) — line colour; change for different airflow tint
// ══════════════════════════════════════
const afCtx = document.getElementById('airflowCanvas').getContext('2d');
let streamlines = [];
function initStreamlines() {
    streamlines = [];
    for (let i = 0; i < 14; i++) {
        streamlines.push({
            x: Math.random() * 420,       // starting X position (random across fin width)
            y: 4 + Math.random() * 48,    // starting Y position (within fin height)
            speed: 0,                     // current horizontal speed this frame
            alpha: 0,                     // current opacity (fades in from 0)
            wo: Math.random() * Math.PI * 2 // per-line wave phase offset for variety
        });
    }
}
initStreamlines();

function drawAirflow(rpm, dt) {
    const ac = afCtx;
    ac.clearRect(0, 0, 420, 56);
    const speed = rpm / 3500; // Normalise RPM to 0-1.  Change 3500 to match max fan RPM.
    if (speed < 0.02) return;  // Don't draw at very low RPM — avoids phantom flicker
    streamlines.forEach(sl => {
        // Advance position proportional to fan speed
        sl.speed = speed * (1.2 + Math.random() * 0.5);
        sl.x += sl.speed * 55 * dt;
        // Fade opacity up to a cap that scales with speed (faster = more visible)
        sl.alpha = Math.min(speed * 0.8, sl.alpha + dt * 1.8);
        // Wrap: when a line exits the right, re-enter from the left at a random height
        if (sl.x > 435) { sl.x = Math.random() * -30; sl.y = 4 + Math.random() * 48; sl.alpha = 0; }
        ac.save();
        ac.globalAlpha = sl.alpha;
        ac.beginPath();
        const wavAmp = 1.5 + speed * 4; // Amplitude: more turbulence at higher RPM
        ac.moveTo(sl.x, sl.y);
        // Draw 13-point sine approximation for the wavy line
        for (let dx = 0; dx <= 26; dx += 2) {
            ac.lineTo(sl.x + dx, sl.y + Math.sin((sl.x + dx) * 0.11 + sl.wo + sl.speed * 2) * wavAmp);
        }
        // Line colour opacity also scales with speed
        ac.strokeStyle = `rgba(96,165,250,${0.45 + speed * 0.35})`;
        ac.lineWidth = 0.9 + speed * 0.6; // Thicker lines at higher RPM
        ac.stroke();
        ac.restore();
    });
}

// ══════════════════════════════════════
//  HEAT PARTICLE CANVAS  &  RESPONSIVE SCALE
//  heatCanvas is a full-viewport overlay where rising heat particles are drawn.
//  computeGpuScale() calculates --gs (a CSS variable) so the GPU scenes
//  scale to fit any screen size without changing the underlying px values.
//
//  To tune particles:
//    0.28           — spawn probability per frame; raise for more particles
//    intensity      — derived from (Tj-45)/70; raise 45 to start earlier, 70 for slower ramp
//    vy range       — rise speed; increase upper bound for faster particles
//    r range        — radius; change 1.5/2.5 for smaller/larger dots
//    decay range    — lifespan; lower = shorter trails
//  To tune scale:
//    540 / 520      — reference scene width/height the scale is based on
//    0.3 / 2.0      — min/max --gs; prevent GPU being too tiny or too huge
// ══════════════════════════════════════
const hc = document.getElementById('heatCanvas');
const hctx = hc.getContext('2d');
function resizeCanvas() {
    // Keep the canvas resolution in sync with the viewport (called on every resize)
    const vp = document.getElementById('vp');
    hc.width = vp.clientWidth; hc.height = vp.clientHeight;
}
function computeGpuScale() {
    // Fit the GPU scene to the available viewport area.
    // In exploded mode the scene is 540×520 px; in assembled it's ~420×180.
    // We size for the exploded scene so the GPU never clips.
    const vp = document.getElementById('vp');
    // Use generous padding (80px) so all layers (especially PCB at bottom) remain visible
    const s = Math.min((vp.clientWidth - 80) / 540, (vp.clientHeight - 100) / 560);
    document.documentElement.style.setProperty('--gs', Math.max(0.25, Math.min(1.8, s)).toFixed(3));
}
window.addEventListener('resize', () => { resizeCanvas(); computeGpuScale(); });
resizeCanvas(); computeGpuScale();

function spawnHeatParticle() {
    // Only spawn when the GPU is exploded (particles float above the visible die)
    if (S.explodeProg < 0.4) return;
    // Anchor particles to the centre-top of the die element in viewport coords
    const vp = document.getElementById('vp');
    const vr = vp.getBoundingClientRect();
    const die = document.getElementById('elDie');
    const dr = die.getBoundingClientRect();
    const cx = (dr.left + dr.right) / 2 - vr.left;
    const cy = dr.top - vr.top;
    // intensity 0-1 based on how hot the die is (0 at 45°C, 1 at 115°C)
    const intensity = Math.max(0, (S.currentTj - 45) / 70);
    if (intensity < 0.02 || Math.random() > 0.28) return; // throttle spawn rate
    S.particles.push({
        x: cx + (Math.random() - 0.5) * 120, // scatter horizontally across die width
        y: cy,
        vy: -(0.5 + Math.random() * 1.4) * intensity, // rise speed scales with heat
        vx: (Math.random() - 0.5) * 0.6,              // slight horizontal drift
        life: 1,                                       // fades from 1 to 0
        decay: 0.013 + Math.random() * 0.01,           // lifespan variance
        r: 1.5 + Math.random() * 2.5,                  // radius variance
        color: tempColorHex(S.currentTj),              // colour matches die temp
    });
}
function drawHeatParticles() {
    hctx.clearRect(0, 0, hc.width, hc.height);
    S.particles = S.particles.filter(p => p.life > 0); // remove dead particles
    S.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= p.decay;  // advance position, age particle
        hctx.save(); hctx.globalAlpha = p.life * 0.55; // fade out as life drops
        hctx.beginPath(); hctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        hctx.fillStyle = p.color; hctx.fill();
        hctx.restore();
    });
}

// ══════════════════════════════════════
//  THERMAL COMPUTE  (called every 200 ms)
//  Implements: Tj = Ta + P × Rθ_eff
//  where Rθ_eff = base_R × (1 - fan_reduction)
//
//  Key tuning knobs:
//    0.15   — extra resistance added by degraded paste (in °C/W)
//    0.38   — max fan cooling reduction (38% at 100% fan speed)
//    2.2    — auto-fan ramp rate: lower = less aggressive fan curve
//    85 °C  — thermal throttle onset; change to match a different GPU TDP limit
//    0.92   — efficiency factor when throttling (GPU can only use 92% of headroom)
//    0.025  — thermal inertia lerp factor; raise toward 1.0 for instant response
// ══════════════════════════════════════
function computeTarget() {
    const Ta = S.hvac ? 40 : S.Ta; // HVAC failure overrides ambient to 40 °C
    const R = S.R + (S.paste ? 0.15 : 0); // degraded paste adds 0.15 °C/W
    // Auto fan: ramp from 20% at 28 °C to 100% at ~73 °C
    if (S.fanMode === 'auto') S.fanPct = Math.max(20, Math.min(100, (S.currentTj - 28) * 2.2));
    // Effective thermal resistance reduced by fan cooling
    const effR = R * (1 - (S.fanPct / 100) * 0.38);
    let Tj = Ta + S.P * effR; // Newton's cooling law: Tj = Ta + P×Rθ
    let throttle = false, effP = S.P;
    // Thermal throttle: if Tj would exceed 85 °C, reduce power until it fits
    if (Tj > 85) { throttle = true; effP = S.P * (85 / Tj) * 0.92; Tj = Ta + effP * effR; }
    S.targetTj = Tj; S.throttle = throttle; S.effP = effP; S.effR = effR;
    S.baseR = R;
    // Thermal inertia: currentTj creeps toward target each tick.  0.025 ≈ 1.5 s lag.
    S.currentTj += (S.targetTj - S.currentTj) * 0.025;
}

function updateDisplay() {
    const Tj = S.currentTj;
    const Ta = S.hvac ? 40 : S.Ta;
    const fanRPM = Math.round(S.fanPct * 35);
    const cooling = Math.round(Math.max(0, Math.min(100, (1 - (Tj - Ta) / (S.P * 0.45)) * 100)));
    const perf = S.throttle ? Math.round((S.effP / S.P) * 100) : 100;
    const tflops = (S.MAX_TF * perf / 100).toFixed(1);

    updateDash('Tj', Tj.toFixed(1), Tj > 95 ? 'crit' : Tj > 85 ? 'hot' : Tj > 70 ? 'warn' : '');
    updateDash('Ta', Ta.toFixed(0), (S.hvac || S.Ta >= 38) ? 'warn' : '');
    updateDash('P', S.effP.toFixed(0), S.throttle ? 'warn' : '');
    updateDash('R', S.baseR.toFixed(2), S.paste ? 'warn' : '');
    updateDash('Fan', fanRPM, '');
    updateDash('Eff', Math.max(0, cooling), cooling > 70 ? 'good' : cooling > 50 ? '' : 'warn');
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

    // HVAC tint
    S.hvacTint += (S.hvac ? 0.07 : -0.07); S.hvacTint = Math.max(0, Math.min(1, S.hvacTint));
    document.getElementById('hvacOverlay').style.background = `rgba(220,38,38,${S.hvacTint * 0.06})`;

    // Thermal gradient across layers
    const ht01 = Math.max(0, (Tj - 40) / 65);

    // Die glow + pulse at high temperature
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

    // Die cells heatmap
    document.querySelectorAll('.die-cell').forEach((c, i) => {
        const row = Math.floor(i / 6), col = i % 6;
        const dx = col - 2.5, dy = row - 1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const heat = Math.max(0, 1 - dist / 3.2);
        const cr = Math.round(ht01 * 150 * heat), ca = 0.12 + heat * 0.25 * ht01;
        c.style.background = `rgba(${255 - cr},${80 - cr / 2},${20},${ca + 0.06})`;
    });

    // Heat propagates: die → paste → heatsink (lagged thermal conduction)
    S.pasteHeat += (ht01 * 0.82 - S.pasteHeat) * 0.022;
    S.heatsinkHeat += (S.pasteHeat * 0.70 - S.heatsinkHeat) * 0.016;

    // Paste color driven by pasteHeat (lags behind die)
    const pH = S.pasteHeat;
    if (!S.paste) document.getElementById('pasteTrack').style.background =
        `linear-gradient(90deg,#E8E8D0,rgba(${200 + Math.round(pH * 55)},${200 - Math.round(pH * 40)},${160 - Math.round(pH * 55)},1),#E8E8D0)`;

    // Heatsink: CENTER-HOT gradient — heat spreads outward from die contact
    const fins = document.querySelectorAll('.hs-fin');
    const nFins = fins.length;
    fins.forEach((f, i) => {
        const centerDist = Math.abs(i / (nFins - 1) - 0.5) * 2; // 0=center 1=edge
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

// ══════════════════════════════════════
//  PASTE VISUAL  (animated degradation)
// ══════════════════════════════════════
// Heights of each paste segment (1=full, low=gap/crack)
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
        // Pristine: solid gradient, no segments visible
        pt.style.background = '';
        pt.style.backgroundImage = 'linear-gradient(90deg,#E8E8D0,#F0F0E0,#E8E8D0)';
        _pasteDivs.forEach(p => { p.el.style.height = '0%'; p.el.style.background = 'transparent'; });
        return;
    }
    pt.style.backgroundImage = '';
    pt.style.background = '#EAE4CC';
    _pasteDivs.forEach(({ el, targetH }) => {
        // Each segment grows in at slightly different times
        const h = Math.min(targetH, progress * (1 + targetH * 0.4));
        const col = targetH < 0.4 ? '#C8A060' : '#D8C890';
        el.style.height = (h * 100) + '%';
        el.style.background = col;
        el.style.outline = targetH < 0.4 ? '1px solid rgba(220,100,0,.3)' : 'none';
    });
}

// ══════════════════════════════════════
//  EXPLODE ANIMATION  (CSS-transition based)
// ══════════════════════════════════════
// Layer heights: Shroud=180, Heatsink=66, Paste=12, Die=80, PCB=66
// LAYER_POS defines assembled (ass) and exploded (exp) top values in px.
// "ass" positions stack all layers into the GPU card shape at screen centre.
// "exp" positions spread layers downward, centred in the 520 px scene:
//   Total column height = 180+15+66+15+12+15+80+15+66 = 464 px
//   Top margin = (520-464)/2 = 28 px  →  bottom = 492 px  (all within scene)
//
//   Layer    h    exp-top  exp-bot  gap
//   Shroud  180    28       208      —
//   HS       66   223       289     15px
//   Paste    12   304       316     15px
//   Die      80   331       411     15px
//   PCB      66   426       492     15px
const LAYER_POS = {
    elShroud: { ass: 190, exp: 20 },
    elHeatsink: { ass: 252, exp: 215 },
    elPaste: { ass: 274, exp: 285 },
    elDie: { ass: 240, exp: 310 },
    elPCB: { ass: 247, exp: 410 },
};
// Snap all layers to assembled positions on page load
Object.keys(LAYER_POS).forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.transition = 'none'; el.style.top = LAYER_POS[id].ass + 'px'; }
});
// Open stagger (ms): shroud first, deeper layers follow
// OPEN_DELAY / CLOSE_DELAY are kept as dead references for documentation.
// The 4-stage animateExplode() now uses hard-coded setTimeout delays instead.
const OPEN_DELAY = { elShroud: 0, elHeatsink: 90, elPaste: 170, elDie: 230, elPCB: 0 };
const CLOSE_DELAY = { elShroud: 260, elHeatsink: 160, elPaste: 70, elDie: 0, elPCB: 0 };

let _explodeTimers = []; // holds setTimeout IDs so they can be cancelled on re-click

// ══════════════════════════════════════════════════════════════════
//  animateExplode(target)
//  Orchestrates the 4-stage mechanical disassembly sequence.
//  target = 1 → open (assemble → explode)
//  target = 0 → close (explode → assemble)
//
//  Stage timings (open):           Stage timings (close):
//    0 ms    fans coast to stop       0 ms    die + paste collapse
//    400 ms  shroud lifts             750 ms  heatsink settles
//    1300 ms heatsink follows         1600 ms shroud lands
//    2150 ms paste + die reveal       2550 ms assembled shown
//
//  cubic-bezier(.34,1.56,.64,1) — "overshoot" easing:
//    the layer moves PAST its target then springs back, like a real
//    mechanical part settling.  To remove overshoot use (.22,1,.36,1).
//
//  To adjust timing: change the ms values in the setTimeout calls below.
//  To change the spread between layers: edit LAYER_POS exp values.
// ══════════════════════════════════════════════════════════════════
function animateExplode(target) {
    _explodeTimers.forEach(t => clearTimeout(t));
    _explodeTimers = [];
    const es = document.getElementById('explodedScene');
    const asc = document.getElementById('assembledScene');

    if (target === 1) {
        // ══ OPEN: PCB drops first ══
        S.cameraZoomTarget = 1.06;
        es.style.display = 'block';
        es.style.opacity = '0';
        es.style.transition = 'opacity 0.3s';
        document.getElementById('elShroud').style.zIndex = '10';

        // Snap all to perfectly centered assembled positions
        Object.keys(LAYER_POS).forEach(id => {
            const el = document.getElementById(id);
            el.style.transition = 'none';
            el.style.top = LAYER_POS[id].ass + 'px';
        });
        es.getBoundingClientRect(); // force reflow

        asc.style.transition = 'opacity 0.35s';
        asc.style.opacity = '0';
        asc.style.pointerEvents = 'none';
        es.style.opacity = '1';
        S.explodeProg = 0.05;

        // Stage 1 (50ms): PCB drops down first
        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elPCB');
            el.style.transition = 'top 0.9s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elPCB.exp + 'px';
        }, 50));

        // Stage 2 (400ms): Die & Paste move down
        _explodeTimers.push(setTimeout(() => {
            ['elDie', 'elPaste'].forEach((id, i) => {
                setTimeout(() => {
                    const el = document.getElementById(id);
                    el.style.transition = 'top 0.7s cubic-bezier(.34,1.56,.64,1)';
                    el.style.top = LAYER_POS[id].exp + 'px';
                }, i * 150);
            });
        }, 400));

        // Stage 3 (1000ms): Heatsink moves up
        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elHeatsink');
            el.style.transition = 'top 0.9s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elHeatsink.exp + 'px';
        }, 1000));

        // Stage 4 (1500ms): Shroud moves up
        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elShroud');
            el.style.transition = 'top 0.9s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elShroud.exp + 'px';
        }, 1500));

        // Labels + full prog
        _explodeTimers.push(setTimeout(() => {
            document.querySelectorAll('.exp-layer').forEach(l => l.classList.add('show-lbl'));
            document.getElementById('dieTempLbl').style.opacity = '1';
            S.explodeProg = 1;
        }, 2200));

    } else {
        // ══ CLOSE: Reverse Assembly ══
        document.querySelectorAll('.exp-layer').forEach(l => l.classList.remove('show-lbl'));
        document.getElementById('dieTempLbl').style.opacity = '0';
        S.cameraZoomTarget = 1.0;

        // Stage 1 (0ms): Shroud settles
        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elShroud');
            el.style.transition = 'top 0.85s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elShroud.ass + 'px';
        }, 0));

        // Stage 2 (400ms): Heatsink settles
        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elHeatsink');
            el.style.transition = 'top 0.85s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elHeatsink.ass + 'px';
        }, 400));

        // Stage 3 (800ms): Die & Paste collapse
        _explodeTimers.push(setTimeout(() => {
            ['elPaste', 'elDie'].forEach((id, i) => {
                setTimeout(() => {
                    const el = document.getElementById(id);
                    el.style.transition = 'top 0.7s cubic-bezier(.34,1.56,.64,1)';
                    el.style.top = LAYER_POS[id].ass + 'px';
                }, i * 100);
            });
        }, 800));

        // Stage 4 (1200ms): PCB rises into place
        _explodeTimers.push(setTimeout(() => {
            const el = document.getElementById('elPCB');
            el.style.transition = 'top 0.85s cubic-bezier(.34,1.56,.64,1)';
            el.style.top = LAYER_POS.elPCB.ass + 'px';
        }, 1200));

        // Wait for all pieces to be perfectly hidden behind the shroud before cross-fading
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
// easeOut: cubic ease-out curve (t³).  Used for manual RAF interpolations if needed.
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

// ══════════════════════════════════════
//  CALC BOX
//  Renders the Tj = Ta + P×R formula with live numbers into #cbFormula.
//  Only called when S.calc is true ("Show Calculation" button is on).
//  The colour of the result text is driven by tempColorHex() so it
//  matches the current heat state.
// ══════════════════════════════════════
function updateCalcBox() {
    const Tj = S.currentTj, Ta = S.hvac ? 40 : S.Ta;
    const col = tempColorHex(Tj);
    document.getElementById('cbFormula').innerHTML =
        `T<sub>j</sub> = T<sub>a</sub> + (P &times; R&theta;)<br>` +
        `&nbsp;&nbsp;&nbsp;= ${Ta} + (${S.effP.toFixed(0)} &times; ${S.baseR.toFixed(2)})<br>` +
        `&nbsp;&nbsp;&nbsp;= <strong style="color:${col}">${Tj.toFixed(1)} &deg;C</strong>` +
        (S.throttle ? `<br><span style="color:#DC2626;font-size:11px;font-weight:400">&nbsp;&nbsp;&nbsp;⚠ Thermal throttle active</span>` : '');
}

// ══════════════════════════════════════
//  MAIN ANIMATION LOOP  (runs every frame via requestAnimationFrame)
//  This is the heartbeat of the simulation. Every visual that changes
//  continuously (fan spin, float, particles, airflow) is driven from here.
//
//  Compute rate  — thermal physics runs every 200 ms to avoid excessive CPU.
//  Float speed   — dt * 0.65. Lower = slower drift.
//  Camera zoom   — lerp factor 0.12. Lower = slower zoom transition.
//  Fan momentum  — lerp factor 0.06. Raise toward 1.0 for instant RPM.
// ══════════════════════════════════════
let lastTs = 0, lastCompute = 0;
function mainLoop(ts) {
    // dt = seconds since last frame, clamped to 50 ms to avoid huge jumps after tab switch
    const dt = Math.min((ts - lastTs) / 1000, 0.05); lastTs = ts;

    // Run thermal physics + dashboard update at 5 Hz (every 200 ms)
    if (ts - lastCompute > 200) { computeTarget(); updateDisplay(); lastCompute = ts; }

    // ── GPU float + camera zoom ───────────────────────────
    // ── GPU float + camera zoom ───────────────────────────
    S.floatT += dt * 0.65; // advance float time accumulator
    S.cameraZoom += (S.cameraZoomTarget - S.cameraZoom) * 0.12; // lerp zoom
    const fp = 1 - Math.min(1, S.explodeProg * 8); // 1=assembled, 0=exploded
    const float = Math.sin(S.floatT) * 6 * fp;          // vertical float ±6 px
    const floatRot = Math.sin(S.floatT * 0.78) * 1.5 * fp; // gentle tilt ±1.5°
    const gs = document.documentElement.style.getPropertyValue('--gs') || '1';
    const totalScale = (parseFloat(gs) * S.cameraZoom).toFixed(3);

    // Apply the EXACT same transform to both scenes so they overlap perfectly
    const transformString = `translate(-50%,calc(-50% + ${float.toFixed(2)}px)) rotate(${floatRot.toFixed(2)}deg) scale(${totalScale})`;

    document.getElementById('assembledScene').style.transform = transformString;
    document.getElementById('explodedScene').style.transform = transformString;
    // ── Fan momentum ──────────────────────────────────
    S.fanTargetRPM = S.fanPct * 35; // 100% duty → 3500 RPM
    S.fanCurrentRPM += (S.fanTargetRPM - S.fanCurrentRPM) * 0.06; // inertia
    // Fans always spin — assembled and exploded. No speed suppression in exploded view.
    S.fanAngle += (S.fanCurrentRPM / 3500) * 0.30 + 0.001;
    const blur01 = Math.min(1, (S.fanCurrentRPM / 3500 - 0.15) / 0.75); // motion blur
    const tempPct = Math.max(0, (S.currentTj - 40) / 65); // blade colour heat tint

    // Draw all 3 assembled-view fans
    [['fc1', 37], ['fc2', 37], ['fc3', 37]].forEach(([id, r]) => {
        const c = document.getElementById(id); if (!c) return;
        drawFan(c.getContext('2d'), r, r, r, S.fanAngle, Math.max(0, blur01), tempPct);
    });
    // Draw all 3 exploded-view fans (same angle and blur — continuous motion)
    [['efc1', 37], ['efc2', 37], ['efc3', 37]].forEach(([id, r]) => {
        const c = document.getElementById(id); if (!c) return;
        drawFan(c.getContext('2d'), r, r, r, S.fanAngle, Math.max(0, blur01), tempPct);
    });

    // Airflow driven by actual (momentum-smoothed) fan RPM
    drawAirflow(S.fanCurrentRPM, dt);

    // Heat particles float up from the die when exploded and hot
    spawnHeatParticle();
    drawHeatParticles();

    requestAnimationFrame(mainLoop);
}

// ══════════════════════════════════════
//  CONTROLS
//  All UI interaction handlers live here.
//  Each handler updates S state then calls computeTarget() + updateDisplay()
//  so the dashboard and visuals immediately reflect the change.
// ══════════════════════════════════════

// syncSlider: paints the filled-track gradient onto a range input.
// Change '#2563EB' to recolour the filled portion, '#CBD5E1' for the empty portion.
function syncSlider(el) {
    const pct = (el.value - el.min) / (el.max - el.min) * 100;
    el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
}
// Wire up each range input on startup
['slTa', 'slP', 'slR', 'slFan'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => { syncSlider(el); onSlider(id); });
    syncSlider(el); // paint initial gradient
});

// onSlider: maps each slider ID to its S field.
//   slR divides by 100 because slider is 5-50 but S.R is in decimal °C/W.
function onSlider(id) {
    if (id === 'slTa' && !S.hvac) S.Ta = +document.getElementById('slTa').value;
    if (id === 'slP') S.P = +document.getElementById('slP').value;
    if (id === 'slR') S.R = document.getElementById('slR').value / 100;
    if (id === 'slFan' && S.fanMode === 'manual') S.fanPct = +document.getElementById('slFan').value;
    computeTarget(); updateDisplay();
}

// setFanMode: 'auto' = Tj-driven curve; 'manual' = slider-locked.
function setFanMode(m) {
    S.fanMode = m;
    document.getElementById('fanAutoBtn').className = 'tog-btn' + (m === 'auto' ? ' on' : '');
    document.getElementById('fanManBtn').className = 'tog-btn' + (m === 'manual' ? ' on' : '');
    document.getElementById('fanSlRow').style.display = m === 'manual' ? 'flex' : 'none';
    computeTarget(); updateDisplay();
}

// togglePaste: adds 0.15 °C/W resistance penalty + renders cracked paste visual.
function togglePaste() {
    S.paste = !S.paste;
    document.getElementById('btnPaste').className = 'sc-btn' + (S.paste ? ' on-paste' : '');
    buildPasteVisual();
    computeTarget(); updateDisplay();
}

// toggleHvac: forces Ta = 40 °C to simulate cooling system failure.
function toggleHvac() {
    S.hvac = !S.hvac;
    document.getElementById('btnHvac').className = 'sc-btn' + (S.hvac ? ' on-hvac' : '');
    if (S.hvac) { document.getElementById('slTa').value = 40; syncSlider(document.getElementById('slTa')); }
    computeTarget(); updateDisplay();
}

// resetAll: returns every slider and toggle to its default state.
//   To change the default scenario, edit the literal values here.
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

// toggleCalc: shows/hides the live formula panel.
function toggleCalc() {
    S.calc = !S.calc;
    const btn = document.getElementById('calcBtn');
    btn.className = 'calc-btn' + (S.calc ? ' on' : '');
    btn.textContent = S.calc ? '✕ Hide Calculation' : '∑ Show Calculation';
    const box = document.getElementById('calcBox');
    if (S.calc) { box.classList.add('show'); updateCalcBox(); }
    else box.classList.remove('show');
}

// handleClick: any click on the GPU viewport toggles the exploded view.
//   Clicks inside the formula panel or on sliders are ignored.
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

// ══════════════════════════════════════
//  INIT
// ══════════════════════════════════════
buildPasteVisual();
computeTarget();
updateDisplay();
requestAnimationFrame(mainLoop);
