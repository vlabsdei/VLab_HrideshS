
    // ══════════════════════════════════
    //  COLORS
    // ══════════════════════════════════
    const COL = {
      bg3: '#F1F5F9', bg4: '#E2E8F0', border: '#D6DCE5', border2: '#CBD5E1',
      t1: '#1E293B', t2: '#475569', t3: '#94A3B8',
      blue: '#2563EB', blueD: '#1E40AF', blueL: '#DBEAFE',
      red: '#DC2626', redL: '#FEE2E2', green: '#16A34A',
      white: '#FFFFFF'
    };

    // ══════════════════════════════════
    //  CONSTANTS
    // ══════════════════════════════════
    const PP_STEPS = [2, 4, 8, 16];
    const M_STEPS = [4, 8, 16, 32, 64];
    const COMPUTE_PER_LAYER_MS = 0.9;   // ms of compute per layer at 100% clock
    const MEM_PER_LAYER_GB = 0.85;  // GB of model memory per layer
    const ACT_MEM_PER_MB_GB = 0.04;  // GB of activation buffer per in-flight micro-batch

    let S = {
      layers: 64,
      ppIdx: 1,       // → 4
      mIdx: 2,        // → 16
      transfer: 1.2,  // ms per hop (NVLink 3.0)
      throttle: 100   // % clock
    };

    function getPP() { return PP_STEPS[S.ppIdx]; }
    function getM() { return M_STEPS[S.mIdx]; }

    // ══════════════════════════════════
    //  PHYSICS / FORMULAS
    // ══════════════════════════════════
    function calc() {
      const PP = getPP(), M = getM(), L = S.layers;
      const layersPerStage = L / PP;
      const Tcompute = COMPUTE_PER_LAYER_MS * layersPerStage * (100 / S.throttle);
      const Ttransfer = S.transfer;
      const Tlg = Tcompute + Ttransfer;
      const Tstep = (M + PP - 1) * Tlg;
      const Fbubble = (PP - 1) / (M + PP - 1);
      const totalModelMem = L * MEM_PER_LAYER_GB;
      const vramPerDevice = (totalModelMem / PP) + (M * ACT_MEM_PER_MB_GB);
      return { PP, M, L, layersPerStage, Tcompute, Ttransfer, Tlg, Tstep, Fbubble, totalModelMem, vramPerDevice };
    }

    // ══════════════════════════════════
    //  SLIDER FILL HELPER
    // ══════════════════════════════════
    function fillSlider(el, pct) {
      el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
    }

    // ══════════════════════════════════
    //  CONTROLS
    // ══════════════════════════════════
    const slLayers = document.getElementById('slLayers');
    const slPP = document.getElementById('slPP');
    const slM = document.getElementById('slM');
    const slThrottle = document.getElementById('slThrottle');

    slLayers.addEventListener('input', function () {
      S.layers = +this.value;
      document.getElementById('vLayers').textContent = S.layers;
      fillSlider(this, (S.layers - 32) / (128 - 32) * 100);
      update();
    });
    slPP.addEventListener('input', function () {
      S.ppIdx = +this.value;
      document.getElementById('vPP').textContent = getPP();
      fillSlider(this, (S.ppIdx / 3) * 100);
      update();
    });
    slM.addEventListener('input', function () {
      S.mIdx = +this.value;
      document.getElementById('vM').textContent = getM();
      fillSlider(this, (S.mIdx / 4) * 100);
      update();
    });
    slThrottle.addEventListener('input', function () {
      S.throttle = +this.value;
      const el = document.getElementById('vThrottle');
      el.textContent = S.throttle + '%';
      el.className = 'sl-val' + (S.throttle <= 70 ? ' crit' : S.throttle <= 85 ? ' hot' : '');
      fillSlider(this, (S.throttle - 60) / (100 - 60) * 100);
      update();
    });
    function onInterChange(v) {
      S.transfer = +v;
      update();
    }

    function preset(layers, ppIdx, mIdx, transfer, throttle) {
      if (layers !== null) { S.layers = layers; slLayers.value = layers; fillSlider(slLayers, (layers - 32) / (128 - 32) * 100); document.getElementById('vLayers').textContent = layers; }
      if (ppIdx !== null) { S.ppIdx = ppIdx; slPP.value = ppIdx; fillSlider(slPP, (ppIdx / 3) * 100); document.getElementById('vPP').textContent = PP_STEPS[ppIdx]; }
      if (mIdx !== null) { S.mIdx = mIdx; slM.value = mIdx; fillSlider(slM, (mIdx / 4) * 100); document.getElementById('vM').textContent = M_STEPS[mIdx]; }
      if (transfer !== null) { S.transfer = +transfer; document.getElementById('interSelect').value = transfer; }
      if (throttle !== null) {
        S.throttle = throttle; slThrottle.value = throttle;
        const el = document.getElementById('vThrottle');
        el.textContent = throttle + '%';
        el.className = 'sl-val' + (throttle <= 70 ? ' crit' : throttle <= 85 ? ' hot' : '');
        fillSlider(slThrottle, (throttle - 60) / (100 - 60) * 100);
      }
      update();
    }

    function resetDefaults() {
      preset(64, 1, 2, '1.2', 100);
    }

    // ══════════════════════════════════
    //  CANVAS — PIPELINE BUBBLE DIAGRAM
    // ══════════════════════════════════
    const canvas = document.getElementById('c');
    const ctx2 = canvas.getContext('2d');

    function resize() {
      const vp = document.getElementById('vp');
      canvas.width = vp.clientWidth;
      canvas.height = vp.clientHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function pathRoundRect(cx, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      cx.beginPath();
      cx.moveTo(x + r, y);
      cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r);
      cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
      cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r);
      cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r);
      cx.closePath();
    }

    function draw() {
      requestAnimationFrame(draw);
      const W = canvas.width, H = canvas.height;
      ctx2.clearRect(0, 0, W, H);

      const c = calc();
      const PP = c.PP, M = c.M;
      const totalSteps = M + PP - 1;

      const sidePad = 16, topPad = 10;
      ctx2.textAlign = 'left'; ctx2.textBaseline = 'top';
      ctx2.font = '700 10px system-ui,-apple-system,sans-serif';
      ctx2.fillStyle = COL.t3;
      ctx2.fillText(`PP=${PP} STAGES  ×  ${totalSteps} TIME SLOTS  (M=${M} micro-batches)`, sidePad, topPad);

      const rowLabelW = 46;
      const gridTop = topPad + 22;
      const gridBottom = H - 34;
      const gridLeft = sidePad + rowLabelW;
      const gridRight = W - sidePad;
      const gridW = gridRight - gridLeft;
      const gridH = gridBottom - gridTop;

      const cellGap = 1.5;
      const cellW = Math.max(2, (gridW - cellGap * (totalSteps - 1)) / totalSteps);
      const cellH = Math.max(6, (gridH - cellGap * (PP - 1)) / PP);
      const showLabels = cellW > 22 && cellH > 16;

      // animated time cursor (purely visual pacing, cycles across the schedule)
      const cursorT = (performance.now() / 420) % totalSteps;
      const activeCol = Math.floor(cursorT);

      for (let i = 0; i < PP; i++) {
        const y = gridTop + i * (cellH + cellGap);
        // row label
        ctx2.textAlign = 'right'; ctx2.textBaseline = 'middle';
        ctx2.font = '600 10px ui-monospace,monospace';
        ctx2.fillStyle = COL.t2;
        ctx2.fillText('GPU ' + i, gridLeft - 8, y + cellH / 2);

        for (let t = 0; t < totalSteps; t++) {
          const x = gridLeft + t * (cellW + cellGap);
          const busy = (t >= i) && (t < i + M);
          const isActiveCol = (t === activeCol);

          if (busy) {
            const mb = t - i;
            ctx2.fillStyle = isActiveCol ? '#3B82F6' : COL.blue;
            pathRoundRect(ctx2, x, y, cellW, cellH, 2); ctx2.fill();
            if (isActiveCol) {
              ctx2.strokeStyle = '#1E40AF'; ctx2.lineWidth = 1.4;
              pathRoundRect(ctx2, x, y, cellW, cellH, 2); ctx2.stroke();
            }
            if (showLabels) {
              ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
              ctx2.font = '600 9px ui-monospace,monospace';
              ctx2.fillStyle = '#fff';
              ctx2.fillText(mb, x + cellW / 2, y + cellH / 2);
            }
          } else {
            ctx2.fillStyle = isActiveCol ? '#FCA5A5' : '#FEE2E2';
            pathRoundRect(ctx2, x, y, cellW, cellH, 2); ctx2.fill();
            ctx2.save();
            ctx2.beginPath();
            pathRoundRect(ctx2, x, y, cellW, cellH, 2);
            ctx2.clip();
            ctx2.strokeStyle = 'rgba(220,38,38,.35)';
            ctx2.lineWidth = 1;
            for (let d = -cellH; d < cellW + cellH; d += 5) {
              ctx2.beginPath();
              ctx2.moveTo(x + d, y);
              ctx2.lineTo(x + d + cellH, y + cellH);
              ctx2.stroke();
            }
            ctx2.restore();
          }
        }
      }

      // cursor line
      const cursorX = gridLeft + cursorT * (cellW + cellGap);
      ctx2.strokeStyle = 'rgba(30,41,59,.55)';
      ctx2.lineWidth = 1.5;
      ctx2.beginPath();
      ctx2.moveTo(cursorX, gridTop - 4);
      ctx2.lineTo(cursorX, gridBottom + 4);
      ctx2.stroke();

      // axis caption
      ctx2.textAlign = 'left'; ctx2.textBaseline = 'top';
      ctx2.font = '500 10px system-ui,-apple-system,sans-serif';
      ctx2.fillStyle = COL.t3;
      ctx2.fillText('time slot →  (each column ≈ T\u2091\u2090\u02b8\u2091\u1d63\u208b\u2098\u1d63\u2092\u1d64\u1d56)', gridLeft, gridBottom + 12);

      ctx2.textAlign = 'right';
      ctx2.fillText(`bubble = ${(c.Fbubble * 100).toFixed(1)}%`, gridRight, gridBottom + 12);
    }

    // ══════════════════════════════════
    //  DASHBOARD / STATUS
    // ══════════════════════════════════
    function update() {
      const c = calc();
      document.getElementById('vBubble').textContent = (c.Fbubble * 100).toFixed(1);
      document.getElementById('vStep').textContent = c.Tstep.toFixed(1);
      document.getElementById('vVram').textContent = c.vramPerDevice.toFixed(2);
      document.getElementById('vTlg').textContent = c.Tlg.toFixed(2);

      let status, cls, pillCls;
      const pct = c.Fbubble * 100;
      if (pct < 15) { status = 'Efficient'; cls = 'good'; pillCls = 'pill-ok'; }
      else if (pct < 35) { status = 'Balanced'; cls = 'warn'; pillCls = 'pill-warn'; }
      else if (pct < 55) { status = 'Bubble-Heavy'; cls = 'hot'; pillCls = 'pill-hot'; }
      else { status = 'Severe Stalling'; cls = 'crit'; pillCls = 'pill-crit'; }

      document.getElementById('vStatus').textContent = status;
      document.getElementById('vStatusSub').textContent = `PP${c.PP} · M${c.M} · ${c.L}L`;

      document.getElementById('dcStatus').className = 'dc ' + cls;
      document.getElementById('dcBubble').className = 'dc ' + cls;
      document.getElementById('dcVram').className = 'dc ' + (c.vramPerDevice > 80 ? 'crit' : c.vramPerDevice > 50 ? 'warn' : 'waste');

      const pill = document.getElementById('statusPill');
      pill.className = 'hd-pill ' + pillCls;
      document.getElementById('statusTxt').textContent = status;

      updateCalcPanel();
    }

    // ══════════════════════════════════
    //  EQUATIONS PANEL
    // ══════════════════════════════════
    let calcOpen = false;
    function toggleCalc() {
      calcOpen = !calcOpen;
      const btn = document.getElementById('btnCalc');
      const sect = document.getElementById('calcSect');
      btn.className = 'hd-btn' + (calcOpen ? ' on' : '');
      btn.textContent = calcOpen ? 'Close Equations' : 'Equations';
      sect.style.display = calcOpen ? 'flex' : 'none';
      if (calcOpen) updateCalcPanel();
    }
    function updateCalcPanel() {
      if (!calcOpen) return;
      const c = calc();
      document.getElementById('calcInner').innerHTML =
        `<b>T<sub>layer_group</sub> = T<sub>compute</sub> + T<sub>transfer</sub></b><br>` +
        `&nbsp;&nbsp;= (${COMPUTE_PER_LAYER_MS} &times; ${c.layersPerStage.toFixed(1)} &times; 100/${S.throttle}) + ${c.Ttransfer}<br>` +
        `&nbsp;&nbsp;= ${c.Tcompute.toFixed(2)} + ${c.Ttransfer.toFixed(2)}<br>` +
        `&nbsp;&nbsp;= <span class="hl">${c.Tlg.toFixed(2)} ms</span><br><br>` +

        `<b>T<sub>step</sub> = (M + PP &minus; 1) &times; T<sub>layer_group</sub></b><br>` +
        `&nbsp;&nbsp;= (${c.M} + ${c.PP} &minus; 1) &times; ${c.Tlg.toFixed(2)}<br>` +
        `&nbsp;&nbsp;= <span class="hl">${c.Tstep.toFixed(1)} ms</span><br><br>` +

        `<b>F<sub>bubble</sub> = (PP &minus; 1) / (M + PP &minus; 1)</b><br>` +
        `&nbsp;&nbsp;= (${c.PP} &minus; 1) / (${c.M} + ${c.PP} &minus; 1)<br>` +
        `&nbsp;&nbsp;= <span class="${c.Fbubble > 0.35 ? 'hl-r' : 'hl-g'}">${(c.Fbubble * 100).toFixed(1)}%</span><br><br>` +

        `<b>VRAM<sub>device</sub> &asymp; Total Model Mem / PP + activations</b><br>` +
        `&nbsp;&nbsp;= (${c.L}&times;${MEM_PER_LAYER_GB}) / ${c.PP} + (${c.M}&times;${ACT_MEM_PER_MB_GB})<br>` +
        `&nbsp;&nbsp;= <span class="${c.vramPerDevice > 80 ? 'hl-r' : 'hl'}">${c.vramPerDevice.toFixed(2)} GB</span>` +
        (c.vramPerDevice > 80 ? ` &nbsp;<span class="hl-r">exceeds 80 GB</span>` : ` &nbsp;fits in 80 GB`);
    }

    // ══════════════════════════════════
    //  OBSERVATIONS TABLE
    // ══════════════════════════════════
    let observations = [];
    const INTER_LABEL = { '4.5': 'PCIe4', '2.4': 'PCIe5', '1.2': 'NVLink3', '0.6': 'NVLink4' };

    function recordObs() {
      const c = calc();
      const link = INTER_LABEL[String(S.transfer)] || (S.transfer + 'ms');
      const n = observations.length + 1;
      observations.push({ n, L: c.L, PP: c.PP, M: c.M, link, Tlg: c.Tlg, Tstep: c.Tstep, bubble: c.Fbubble * 100, vram: c.vramPerDevice });

      const tbody = document.getElementById('obsBody');
      if (n === 1) tbody.innerHTML = '';
      const row = tbody.insertRow();
      row.innerHTML =
        `<td>${n}</td><td>${c.L}</td><td>${c.PP}</td><td>${c.M}</td><td>${link}</td>` +
        `<td>${c.Tlg.toFixed(2)}</td><td>${c.Tstep.toFixed(1)}</td><td>${(c.Fbubble * 100).toFixed(1)}</td><td>${c.vramPerDevice.toFixed(2)}</td>`;

      const btn = document.getElementById('recBtn');
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 500);

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
      const h = 'Layers,PP,M,Link,Tlayer_group(ms),StepDuration(ms),BubbleFraction(%),VRAMperDevice(GB)';
      const rows = observations.map(o =>
        [o.L, o.PP, o.M, o.link, o.Tlg.toFixed(3), o.Tstep.toFixed(2), o.bubble.toFixed(2), o.vram.toFixed(3)].join(',')
      );
      const a = document.createElement('a');
      a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
      a.download = 'pipeline_parallelism_observations.csv';
      a.click();
    }

    // ══════════════════════════════════
    //  INIT
    // ══════════════════════════════════
    fillSlider(slLayers, (S.layers - 32) / (128 - 32) * 100);
    fillSlider(slPP, (S.ppIdx / 3) * 100);
    fillSlider(slM, (S.mIdx / 4) * 100);
    fillSlider(slThrottle, (S.throttle - 60) / (100 - 60) * 100);
    update();
    requestAnimationFrame(draw);
