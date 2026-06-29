//Your JavaScript goes in here

    // ══════════════════════════════════════════════════════
    //  CONSTANTS & CONFIG
    // ══════════════════════════════════════════════════════
    const IC = [
      { name: 'PCIe Gen4', short: 'PCIe4', bw: 64, color: '#2563EB', colorL: '#DBEAFE', lanes: 16 },
      { name: 'PCIe Gen5', short: 'PCIe5', bw: 128, color: '#7C3AED', colorL: '#EDE9FE', lanes: 16 },
      { name: 'NVLink 4', short: 'NVLink', bw: 900, color: '#16A34A', colorL: '#DCFCE7', lanes: 18 }
    ];

    // Data size steps (GB)
    const D_STEPS = [1, 2, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 100];
    // Tc steps (ms)
    const TC_STEPS = [10, 15, 20, 25, 30, 40, 50, 75, 100, 125, 150, 200, 250, 400, 500];

    // ── State ──
    let S = { icIdx: 0, dataIdx: 4, tcIdx: 5, scenario: 'host-gpu' };

    function getData() { return D_STEPS[S.dataIdx]; }
    function getTc() { return TC_STEPS[S.tcIdx]; }
    function getBW() { return IC[S.icIdx].bw; }

    function calcTt() { return (getData() / getBW()) * 1000; }  // ms
    function calcTotal() { return getTc() + calcTt(); }
    function calcUtil() { return (getTc() / calcTotal()) * 100; }

    // ══════════════════════════════════════════════════════
    //  CANVAS ENGINE
    // ══════════════════════════════════════════════════════
    const canvas = document.getElementById('c');
    const cx = canvas.getContext('2d');
    let animT = 0;

    // Particle system — data packets flowing through lanes
    let particles = [];
    const MAX_PARTICLES = 80;

    function spawnParticle(srcX, srcY, dstX, dstY, laneY, ic) {
      const speed = ic.bw / 64; // relative speed
      const baseSpeed = 0.003 + 0.003 * speed + Math.random() * 0.002;

      if (S.scenario === 'gpu-gpu') {
        if (S.icIdx === 2) {
          // NVLink: direct, noticeably faster & denser
          particles.push({
            x: srcX, y: srcY,
            tx: dstX, ty: dstY,
            laneY,
            t: 0,
            speed: baseSpeed * 1.55,
            size: 2.2 + Math.random() * 1.8,
            alpha: 0.8 + Math.random() * 0.2,
            color: ic.color,
            trail: [],
            scenario: 'gpu-gpu',
            type: 'nvlink'
          });
        } else {
          // PCIe: two segments, pauses at CPU
          particles.push({
            segment: 1,
            x1: srcX, y1: srcY,
            x2: dstX, y2: dstY,
            laneY,
            t: 0,
            speed: baseSpeed * 1.1,
            size: 3 + Math.random() * 2.5,
            alpha: 0.7 + Math.random() * 0.3,
            color: ic.color,
            trail: [],
            scenario: 'gpu-gpu',
            type: 'pcie',
            pauseTimer: 0
          });
        }
      } else {
        // Host->GPU
        particles.push({
          x: srcX, y: srcY,
          tx: dstX, ty: dstY,
          laneY,
          t: 0,
          speed: baseSpeed,
          size: 3 + Math.random() * 2.5,
          alpha: 0.7 + Math.random() * 0.3,
          color: ic.color,
          trail: [],
          scenario: 'host-gpu'
        });
      }
    }

    function resize() {
      const vp = document.getElementById('vp');
      canvas.width = vp.clientWidth * (window.devicePixelRatio || 1);
      canvas.height = vp.clientHeight * (window.devicePixelRatio || 1);
      canvas.style.width = vp.clientWidth + 'px';
      canvas.style.height = vp.clientHeight + 'px';
      cx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    }
    window.addEventListener('resize', () => { resize(); particles = []; });
    resize();

    // Easing
    function easeInOut(t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
    function easeOut(t) { return 1 - Math.pow(1 - t, 2); }

    // ── Round rect helper ──
    function rr(x, y, w, h, r) {
      cx.beginPath();
      cx.moveTo(x + r, y);
      cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r);
      cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
      cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r);
      cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r);
      cx.closePath();
    }

    // ── Draw a GPU/CPU chip ──
    function drawChip(x, y, w, h, label, sublabel, color, active, utilPct) {
      // Shadow
      cx.shadowColor = 'rgba(0,0,0,0.15)';
      cx.shadowBlur = active ? 20 : 8;

      // Body
      cx.fillStyle = active ? '#1E293B' : '#334155';
      rr(x, y, w, h, 10);
      cx.fill();
      cx.shadowBlur = 0;

      // Border glow
      cx.strokeStyle = color;
      cx.lineWidth = active ? 2 : 1;
      rr(x, y, w, h, 10);
      cx.stroke();

      // Inner bezel
      cx.strokeStyle = 'rgba(148,163,184,.12)';
      cx.lineWidth = 1;
      rr(x + 6, y + 6, w - 12, h - 12, 7);
      cx.stroke();



      // Utilization bar (inside chip)
      if (active && utilPct !== undefined) {
        const barX = x + 12, barY = y + h - 14, barW = w - 24, barH = 5;
        cx.fillStyle = 'rgba(255,255,255,0.1)';
        rr(barX, barY, barW, barH, 3);
        cx.fill();
        const fillW = barW * Math.min(utilPct / 100, 1);
        const utilColor = utilPct > 90 ? '#22C55E' : utilPct > 70 ? '#84CC16' : utilPct > 50 ? '#EAB308' : '#EF4444';
        const gU = cx.createLinearGradient(barX, 0, barX + fillW, 0);
        gU.addColorStop(0, utilColor + 'cc');
        gU.addColorStop(1, utilColor);
        cx.fillStyle = gU;
        rr(barX, barY, fillW, barH, 3);
        cx.fill();
      }

      // Label
      cx.fillStyle = 'rgba(255,255,255,0.9)';
      cx.font = `600 12px sans-serif`;
      cx.textAlign = 'center';
      cx.fillText(label, x + w / 2, y + 14);

      // Sub-label
      cx.fillStyle = color + 'aa';
      cx.font = `500 10px monospace`;
      cx.fillText(sublabel, x + w / 2, y + h - 20);
    }

    // ── Draw the interconnect bus ──
    function drawBus(x1, y1, x2, y2, ic, util, animPhase) {
      const laneCount = Math.min(ic.lanes, 8); // visual lanes
      const busH = laneCount * 5 + (laneCount - 1) * 2;
      const busY = (y1 + y2) / 2 - busH / 2;
      const midX = (x1 + x2) / 2;

      // ── Bus background track ──
      cx.fillStyle = 'rgba(30,41,59,0.06)';
      rr(x1, busY - 4, x2 - x1, busH + 8, 6);
      cx.fill();

      // ── Lane tracks ──
      for (let i = 0; i < laneCount; i++) {
        const ly = busY + i * 7;
        cx.fillStyle = 'rgba(30,41,59,0.18)';
        cx.fillRect(x1, ly, x2 - x1, 4);
      }

      // ── Active data fill glow ──
      if (animPhase > 0) {
        const progress = easeInOut(Math.min(animPhase, 1));
        const fillW = (x2 - x1) * progress;

        const busGrad = cx.createLinearGradient(x1, 0, x1 + fillW, 0);
        busGrad.addColorStop(0, ic.color + '33');
        busGrad.addColorStop(0.7, ic.color + '66');
        busGrad.addColorStop(1, ic.color + 'cc');
        cx.fillStyle = busGrad;
        rr(x1, busY - 2, fillW, busH + 4, 4);
        cx.fill();

        // Shimmer pulse
        const shimmerX = x1 + fillW - 30 + Math.sin(animT * 4) * 8;
        const shGrad = cx.createRadialGradient(shimmerX, busY + busH / 2, 0, shimmerX, busY + busH / 2, 40);
        shGrad.addColorStop(0, ic.color + '88');
        shGrad.addColorStop(1, 'transparent');
        cx.fillStyle = shGrad;
        cx.fillRect(x1, busY - 2, x2 - x1, busH + 4);
      }

      // ── Bus border ──
      cx.strokeStyle = animPhase > 0 ? ic.color + '88' : 'rgba(148,163,184,0.3)';
      cx.lineWidth = animPhase > 0 ? 1.5 : 1;
      rr(x1, busY - 2, x2 - x1, busH + 4, 4);
      cx.stroke();


      return { busY, busH, midX };
    }

    // ── Timeline bar ──
    function drawTimeline(cx2, x, y, w, Tc, Tt, ic, animProg) {
      const total = Tc + Tt;
      const tcW = (w * Tc / total);
      const ttW = (w * Tt / total);
      const h = 24;

      // Track
      cx2.fillStyle = 'rgba(30,41,59,0.07)';
      rr(x, y, w, h, 5);
      cx2.fill();

      // Transfer portion
      const ttVisible = Math.min(ttW, ttW * animProg * 2);
      if (ttVisible > 0) {
        const tGrad = cx2.createLinearGradient(x, 0, x + ttVisible, 0);
        tGrad.addColorStop(0, ic.color + 'aa');
        tGrad.addColorStop(1, ic.color);
        cx2.fillStyle = tGrad;
        cx2.beginPath();
        cx2.moveTo(x + 5, y);
        cx2.lineTo(x + ttVisible, y);
        cx2.lineTo(x + ttVisible, y + h);
        cx2.lineTo(x + 5, y + h);
        cx2.arcTo(x, y + h, x, y + h - 5, 5);
        cx2.lineTo(x, y + 5);
        cx2.arcTo(x, y, x + 5, y, 5);
        cx2.closePath();
        cx2.fill();
      }

      // Compute portion
      const computeStart = Math.max(0, animProg * 2 - 1);
      const computeVisible = tcW * computeStart;
      if (computeVisible > 0) {
        const cGrad = cx2.createLinearGradient(x + ttW, 0, x + ttW + computeVisible, 0);
        cGrad.addColorStop(0, '#22C55Eaa');
        cGrad.addColorStop(1, '#22C55E');
        cx2.fillStyle = cGrad;
        const cx3 = x + ttW;
        const cw = computeVisible;
        if (cw > 4) {
          cx2.beginPath();
          cx2.moveTo(cx3, y);
          if (computeVisible >= tcW - 1) {
            cx2.lineTo(x + w - 5, y); cx2.arcTo(x + w, y, x + w, y + 5, 5);
            cx2.lineTo(x + w, y + h - 5); cx2.arcTo(x + w, y + h, x + w - 5, y + h, 5);
          } else {
            cx2.lineTo(cx3 + cw, y); cx2.lineTo(cx3 + cw, y + h);
          }
          cx2.lineTo(cx3, y + h);
          cx2.closePath();
          cx2.fill();
        }
      }

      // Border
      cx2.strokeStyle = 'rgba(148,163,184,0.35)';
      cx2.lineWidth = 1;
      rr(x, y, w, h, 5);
      cx2.stroke();

      // Divider
      if (animProg > 0.5 && ttW > 8) {
        cx2.strokeStyle = 'rgba(255,255,255,0.6)';
        cx2.lineWidth = 1.5;
        cx2.setLineDash([3, 3]);
        cx2.beginPath();
        cx2.moveTo(x + ttW, y + 2);
        cx2.lineTo(x + ttW, y + h - 2);
        cx2.stroke();
        cx2.setLineDash([]);
      }

      // Labels inside
      if (animProg > 0.35 && ttW > 30) {
        cx2.fillStyle = '#fff';
        cx2.font = `600 9px sans-serif`;
        cx2.textAlign = 'center';
        cx2.fillText('Tt', x + ttW / 2, y + h / 2 + 3.5);
      }
      if (animProg > 0.85 && tcW > 30) {
        cx2.fillStyle = '#fff';
        cx2.font = `600 9px sans-serif`;
        cx2.textAlign = 'center';
        cx2.fillText('Tc', x + ttW + tcW / 2, y + h / 2 + 3.5);
      }
    }

    // ── Utilization arc ──
    function drawUtilArc(cx2, cx3, cy, r, util, color) {
      const start = -Math.PI / 2;
      const end = start + (Math.PI * 2 * util / 100);

      // Track
      cx2.beginPath();
      cx2.arc(cx3, cy, r, 0, Math.PI * 2);
      cx2.strokeStyle = 'rgba(148,163,184,0.2)';
      cx2.lineWidth = 10;
      cx2.stroke();

      // Fill
      cx2.beginPath();
      cx2.arc(cx3, cy, r, start, end);
      cx2.strokeStyle = color;
      cx2.lineWidth = 10;
      cx2.lineCap = 'round';
      cx2.stroke();
      cx2.lineCap = 'butt';

      // Centre text
      cx2.fillStyle = color;
      cx2.font = `700 18px monospace`;
      cx2.textAlign = 'center';
      cx2.fillText(util.toFixed(1) + '%', cx3, cy + 6);

      cx2.fillStyle = '#94A3B8';
      cx2.font = `500 9px sans-serif`;
      cx2.fillText('GPU UTIL', cx3, cy + 20);
    }

    // ── Main draw loop ──
    let transferProgress = 0;   // 0→1 as transfer animates
    let lastIC = -1;
    let lastD = -1;

    function draw() {
      requestAnimationFrame(draw);
      animT += 0.016;

      // Advance transfer animation
      const ic = IC[S.icIdx];
      const D = getData();
      const Tc = getTc();
      const Tt = calcTt();
      const util = calcUtil();

      // Speed of animation proportional to BW
      const animSpeed = 0.008 + (ic.bw / 900) * 0.022;
      transferProgress = (transferProgress + animSpeed) % 1;

      // Reset particles on IC or data change
      if (lastIC !== S.icIdx || lastD !== S.dataIdx) {
        particles = [];
        lastIC = S.icIdx;
        lastD = S.dataIdx;
      }

      const W = canvas.width / (window.devicePixelRatio || 1);
      const H = canvas.height / (window.devicePixelRatio || 1);
      cx.clearRect(0, 0, W, H);

      const isNarrow = W < 480;

      // ── Layout geometry ──
      const chipW = isNarrow ? Math.min(W * 0.34, 110) : Math.min(W * 0.22, 140);
      const chipH = isNarrow ? 70 : 90;
      const margin = isNarrow ? 12 : 32;
      const midY = H * 0.38;
      const chipY = midY - chipH / 2;

      let cpuX, gpuX, gpuAX, gpuBX;
      let hasCPU = true;
      let bus1_X1, bus1_X2, bus2_X1, bus2_X2;
      let mainBus_X1, mainBus_X2;

      if (S.scenario === 'gpu-gpu') {
        gpuAX = margin;
        gpuBX = W - margin - chipW;

        if (S.icIdx === 2) {
          hasCPU = false;
          mainBus_X1 = gpuAX + chipW + 10;
          mainBus_X2 = gpuBX - 10;
        } else {
          hasCPU = true;
          cpuX = W / 2 - chipW / 2;
          bus1_X1 = gpuAX + chipW + 10;
          bus1_X2 = cpuX - 10;
          bus2_X1 = cpuX + chipW + 10;
          bus2_X2 = gpuBX - 10;
        }
      } else {
        hasCPU = true;
        cpuX = margin;
        gpuX = W - margin - chipW;
        mainBus_X1 = cpuX + chipW + 10;
        mainBus_X2 = gpuX - 10;
      }

      // Draw Chips
      if (S.scenario === 'gpu-gpu') {
        // GPU A (left)
        drawChip(gpuAX, chipY, chipW, chipH, 'GPU A', ic.short, ic.color, true, util);

        if (hasCPU) {
          // CPU/PCIe Root Complex (middle)
          drawChip(cpuX, chipY, chipW, chipH, 'PCIe Root Complex', 'System Hub', '#94A3B8', false, undefined);
          // GPU B (right)
          drawChip(gpuBX, chipY, chipW, chipH, 'GPU B', ic.short, ic.color, true, util);

          // Draw two interconnect buses
          drawBus(bus1_X1, chipY, bus1_X2, chipY + chipH, ic, util, transferProgress);
          drawBus(bus2_X1, chipY, bus2_X2, chipY + chipH, ic, util, transferProgress);
        } else {
          // GPU B (right)
          drawChip(gpuBX, chipY, chipW, chipH, 'GPU B', ic.short, ic.color, true, util);
          // Draw one direct interconnect bus
          drawBus(mainBus_X1, chipY, mainBus_X2, chipY + chipH, ic, util, transferProgress);
        }
      } else {
        // Host -> GPU
        drawChip(cpuX, chipY, chipW, chipH, 'CPU HOST', 'System RAM', '#94A3B8', false, undefined);
        drawChip(gpuX, chipY, chipW, chipH, 'GPU', ic.short, ic.color, true, util);
        drawBus(mainBus_X1, chipY, mainBus_X2, chipY + chipH, ic, util, transferProgress);
      }

      // ── Particle system update & draw ──
      const laneCount = Math.min(ic.lanes, 8);
      const busH = laneCount * 5 + (laneCount - 1) * 2;
      const busY = chipY + chipH / 2 - busH / 2;

      // Spawn particles
      const spawnRate = Math.floor(ic.bw / 64 * 1.5);
      const maxP = (S.scenario === 'gpu-gpu' && S.icIdx === 2) ? 120 : MAX_PARTICLES;
      const chance = (S.scenario === 'gpu-gpu' && S.icIdx === 2) ? 0.35 : 0.15;
      if (particles.length < maxP && Math.random() < chance * spawnRate) {
        const laneIdx = Math.floor(Math.random() * laneCount);
        const ly = busY + laneIdx * 7 + 2;
        if (S.scenario === 'gpu-gpu') {
          if (S.icIdx === 2) {
            spawnParticle(mainBus_X1, ly, mainBus_X2, ly, ly, ic);
          } else {
            spawnParticle(bus1_X1, ly, bus1_X2, ly, ly, ic);
          }
        } else {
          spawnParticle(mainBus_X1, ly, mainBus_X2, ly, ly, ic);
        }
      }

      // Update particles
      particles = particles.filter(p => {
        if (p.scenario === 'gpu-gpu' && p.type === 'pcie') {
          if (p.segment === 1) {
            p.t += p.speed;
            if (p.t >= 1) {
              p.t = 1;
              p.segment = 'pause';
              p.pauseTimer = 10 + Math.random() * 10;
            }
          } else if (p.segment === 'pause') {
            p.pauseTimer--;
            if (p.pauseTimer <= 0) {
              p.segment = 2;
              p.t = 0;
            }
          } else if (p.segment === 2) {
            p.t += p.speed;
            if (p.t >= 1) {
              return false; // complete
            }
          }
          return true;
        } else {
          p.t += p.speed * (ic.bw / 64) * 0.6;
          return p.t < 1;
        }
      });

      // Render particles
      for (const p of particles) {
        let px, py = p.laneY;
        if (p.scenario === 'gpu-gpu' && p.type === 'pcie') {
          if (p.segment === 1) {
            px = p.x1 + (p.x2 - p.x1) * easeOut(p.t);
          } else if (p.segment === 'pause') {
            px = p.x2;
          } else if (p.segment === 2) {
            px = bus2_X1 + (bus2_X2 - bus2_X1) * easeOut(p.t);
          }
        } else {
          px = p.x + (p.tx - p.x) * easeOut(p.t);
        }

        // Trail
        p.trail.push({ x: px, y: py });
        if (p.trail.length > 10) p.trail.shift();

        // Draw trail
        for (let i = 1; i < p.trail.length; i++) {
          const ta = (i / p.trail.length) * p.alpha * 0.6;
          cx.strokeStyle = p.color + Math.round(ta * 255).toString(16).padStart(2, '0');
          cx.lineWidth = p.size * 0.5;
          cx.beginPath();
          cx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          cx.lineTo(p.trail[i].x, p.trail[i].y);
          cx.stroke();
        }

        // Particle head
        cx.beginPath();
        cx.arc(px, py, p.size, 0, Math.PI * 2);
        cx.fillStyle = p.color + Math.round(p.alpha * 255).toString(16).padStart(2, '0');
        cx.fill();

        // Glow
        const gGlow = cx.createRadialGradient(px, py, 0, px, py, p.size * 3);
        gGlow.addColorStop(0, p.color + '55');
        gGlow.addColorStop(1, 'transparent');
        cx.fillStyle = gGlow;
        cx.beginPath();
        cx.arc(px, py, p.size * 3, 0, Math.PI * 2);
        cx.fill();
      }

      // ── Bandwidth label on bus ──
      if (S.scenario === 'gpu-gpu' && hasCPU) {
        const mid1_X = (bus1_X1 + bus1_X2) / 2;
        cx.fillStyle = ic.color;
        cx.font = `700 12px monospace`;
        cx.textAlign = 'center';
        cx.fillText(ic.bw + ' GB/s', mid1_X, busY + busH / 2 + 4.5);
        cx.fillStyle = '#94A3B8';
        cx.font = `400 9px sans-serif`;
        cx.fillText(ic.name, mid1_X, busY + busH + 16);

        const mid2_X = (bus2_X1 + bus2_X2) / 2;
        cx.fillStyle = ic.color;
        cx.font = `700 12px monospace`;
        cx.textAlign = 'center';
        cx.fillText(ic.bw + ' GB/s', mid2_X, busY + busH / 2 + 4.5);
        cx.fillStyle = '#94A3B8';
        cx.font = `400 9px sans-serif`;
        cx.fillText(ic.name, mid2_X, busY + busH + 16);
      } else {
        const midBusX = (mainBus_X1 + mainBus_X2) / 2;
        cx.fillStyle = ic.color;
        cx.font = `700 13px monospace`;
        cx.textAlign = 'center';
        cx.fillText(ic.bw + ' GB/s', midBusX, busY + busH / 2 + 4.5);
        cx.fillStyle = '#94A3B8';
        cx.font = `400 9px sans-serif`;
        cx.fillText(ic.name, midBusX, busY + busH + 16);
      }

      // ── Data size badge (floating above bus) ──
      const badgeW = isNarrow ? 64 : 80;
      let badgeX, badgeY = busY - 48, midBadgeX;
      if (S.scenario === 'gpu-gpu' && hasCPU) {
        midBadgeX = W / 2;
        badgeX = midBadgeX - badgeW / 2;
        badgeY = chipY - 34; // Float above CPU
      } else {
        midBadgeX = (mainBus_X1 + mainBus_X2) / 2;
        badgeX = midBadgeX - badgeW / 2;
      }

      cx.fillStyle = 'rgba(255,255,255,0.95)';
      cx.shadowColor = 'rgba(0,0,0,0.08)';
      cx.shadowBlur = 8;
      rr(badgeX, badgeY, badgeW, 22, 5);
      cx.fill();
      cx.shadowBlur = 0;
      cx.strokeStyle = ic.color + '66';
      cx.lineWidth = 1;
      rr(badgeX, badgeY, badgeW, 22, 5);
      cx.stroke();
      cx.fillStyle = ic.color;
      cx.font = `700 11px monospace`;
      cx.textAlign = 'center';
      cx.fillText(D + ' GB', midBadgeX, badgeY + 14.5);

      // ── Scenario type label ──
      if (S.scenario === 'gpu-gpu') {
        cx.fillStyle = S.icIdx === 2 ? '#16A34A' : '#7C3AED';
        cx.font = `600 12px sans-serif`;
        cx.textAlign = 'center';
        cx.fillText(S.icIdx === 2 ? 'Direct GPU-to-GPU Communication' : 'CPU-Mediated Communication', W / 2, 28);
      }

      // ── Timeline bar (below chips) ──
      const tlY = chipY + chipH + (isNarrow ? 28 : 38);
      const tlX = S.scenario === 'gpu-gpu' ? gpuAX : cpuX;
      const tlW = S.scenario === 'gpu-gpu' ? (gpuBX + chipW - gpuAX) : (gpuX + chipW - cpuX);
      drawTimeline(cx, tlX, tlY, tlW, Tc, Tt, ic, transferProgress);

      // Timeline axis labels
      const ttFmt = Tt < 1 ? Tt.toFixed(2) + ' ms' : Tt.toFixed(1) + ' ms';
      const tcFmt = Tc < 1000 ? Tc + ' ms' : (Tc / 1000).toFixed(1) + ' s';
      const totFmt = (Tc + Tt) < 1000 ? (Tc + Tt).toFixed(1) + ' ms' : ((Tc + Tt) / 1000).toFixed(2) + ' s';

      cx.fillStyle = ic.color;
      cx.font = `500 9px sans-serif`;
      cx.textAlign = 'left';
      cx.fillText('Tt = ' + ttFmt, tlX, tlY + 36);
      cx.fillStyle = '#22C55E';
      cx.textAlign = 'center';
      cx.fillText('Tc = ' + tcFmt, tlX + tlW / 2, tlY + 36);
      cx.fillStyle = '#475569';
      cx.textAlign = 'right';
      cx.fillText('Total = ' + totFmt, tlX + tlW, tlY + 36);

      // ── Utilization arc (bottom right area) ──
      if (!isNarrow) {
        const arcCX = W - 70;
        const arcCY = H - 80;
        const arcR = 40;
        drawUtilArc(cx, arcCX, arcCY, arcR, util, utilColor);
      }

      // ── Workload status label ──
      const mode = util >= 90 ? 'COMPUTE-BOUND'
        : util >= 70 ? 'MODERATE I/O'
          : util >= 50 ? 'I/O BOTTLENECK'
            : 'I/O BOUND (CRITICAL)';
      const modeColor = util >= 90 ? '#22C55E' : util >= 70 ? '#84CC16' : util >= 50 ? '#EAB308' : '#EF4444';

      cx.fillStyle = modeColor;
      cx.font = `700 ${isNarrow ? 11 : 12}px monospace`;
      cx.textAlign = 'center';
      cx.fillText('▶ ' + mode, W / 2, H - (isNarrow ? 14 : 18));

      // ── I/O Bound warning flash ──
      if (util < 50) {
        const flashAlpha = 0.04 + 0.03 * Math.sin(animT * 5);
        cx.fillStyle = `rgba(239,68,68,${flashAlpha})`;
        cx.fillRect(0, 0, W, H);
      }
    }

    // ══════════════════════════════════════════════════════
    //  UI UPDATE
    // ══════════════════════════════════════════════════════
    function update() {
      const ic = IC[S.icIdx];
      const D = getData();
      const Tc = getTc();
      const Tt = calcTt();
      const tot = calcTotal();
      const util = calcUtil();

      // Dashboard cards
      const bwPct = (ic.bw / 900) * 100;
      const ttPct = Math.min(Tt / 2000 * 100, 100);
      const utilPct = util;
      const utilCls = util >= 90 ? 'good' : util >= 70 ? '' : util >= 50 ? 'warn' : 'crit';
      const ttCls = Tt > Tc ? 'crit' : Tt > Tc * 0.5 ? 'warn' : '';

      setDC('dcBW', 'vBW', ic.bw, '', bwPct, ic.color);
      setDC('dcTt', 'vTt', Tt.toFixed(Tt < 1 ? 2 : 1), ttCls, ttPct, '#EA580C');
      setDC('dcTotal', 'vTotal', tot.toFixed(1), '', 0, '#475569');
      setDC('dcUtil', 'vUtil', util.toFixed(1), utilCls, utilPct,
        util >= 90 ? '#22C55E' : util >= 70 ? '#84CC16' : util >= 50 ? '#EAB308' : '#EF4444');

      // Mode card
      const modeCard = document.getElementById('dcMode');
      const modeV = document.getElementById('vMode');
      const modeSub = document.getElementById('vModeSub');
      if (util >= 90) {
        modeCard.className = 'dc good';
        modeV.textContent = 'Compute';
        modeSub.textContent = 'Bound ✓';
      } else if (util >= 70) {
        modeCard.className = 'dc';
        modeV.textContent = 'Moderate';
        modeSub.textContent = 'I/O Overhead';
      } else if (util >= 50) {
        modeCard.className = 'dc warn';
        modeV.textContent = 'I/O';
        modeSub.textContent = 'Bottleneck';
      } else {
        modeCard.className = 'dc crit';
        modeV.textContent = 'I/O Bound';
        modeSub.textContent = 'GPU Starved';
      }

      // Header pill
      const pill = document.getElementById('statusPill');
      const ptxt = document.getElementById('statusTxt');
      if (util >= 90) { pill.className = 'hd-pill pill-ok'; ptxt.textContent = 'Compute-Bound'; }
      else if (util >= 50) { pill.className = 'hd-pill pill-warn'; ptxt.textContent = 'I/O Overhead'; }
      else { pill.className = 'hd-pill pill-io'; ptxt.textContent = 'I/O Bound'; }

      updateInfoCard();
      if (calcOpen) updateCalcPanel();
    }

    function setDC(cardId, valId, val, cls, barPct, barColor) {
      const card = document.getElementById(cardId);
      card.className = 'dc' + (cls ? ' ' + cls : '');
      document.getElementById(valId).textContent = val;
      const bar = card.querySelector('.dc-bar-fill');
      if (bar && barPct !== undefined) {
        bar.style.width = Math.min(barPct, 100) + '%';
        bar.style.background = barColor || 'var(--blue)';
      }
    }

    // ══════════════════════════════════════════════════════
    //  SLIDER FILL HELPER
    // ══════════════════════════════════════════════════════
    function fillSlider(el, pct) {
      el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
    }

    // ── Transfer Scenario selector ──
    function setScenario(scen) {
      S.scenario = scen;
      document.getElementById('scen0').classList.toggle('active', scen === 'host-gpu');
      document.getElementById('scen1').classList.toggle('active', scen === 'gpu-gpu');

      const nvlinkBtn = document.getElementById('ic2');
      if (scen === 'host-gpu') {
        nvlinkBtn.disabled = true;
        nvlinkBtn.style.opacity = '0.4';
        nvlinkBtn.style.cursor = 'not-allowed';
        nvlinkBtn.style.pointerEvents = 'none';
        const sub = nvlinkBtn.querySelector('small');
        if (sub) sub.textContent = 'GPU-GPU Only';
        if (S.icIdx === 2) {
          setIC(1);
        }
      } else {
        nvlinkBtn.disabled = false;
        nvlinkBtn.style.opacity = '';
        nvlinkBtn.style.cursor = '';
        nvlinkBtn.style.pointerEvents = '';
        const sub = nvlinkBtn.querySelector('small');
        if (sub) sub.textContent = '900 GB/s';
      }

      particles = [];
      update();
    }

    function updateLegend() {
      const legend = document.getElementById('legendContent');
      const isNVLink = S.icIdx === 2;
      const icColor = isNVLink ? '#7C3AED' : '#2563EB';

      if (S.scenario === 'host-gpu') {
        legend.innerHTML = `
      <div style="display: flex; gap: 8px;">
        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: #94A3B8; margin-top: 2px; flex-shrink: 0;"></span>
        <div><b>CPU HOST (System RAM)</b>: The master processor stages data batches in slow DRAM before transmission.</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: ${icColor}; margin-top: 2px; flex-shrink: 0;"></span>
        <div><b>GPU Node</b>: Accelerator processor. Tensors must be loaded into VRAM to run neural network computations.</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <span style="display: inline-block; width: 14px; height: 3px; background: ${icColor}; margin-top: 7px; flex-shrink: 0;"></span>
        <div><b>PCIe Bus</b>: The motherboard lanes (Gen4/Gen5) connecting the Host to the GPU.</div>
      </div>
    `;
      } else {
        if (isNVLink) {
          legend.innerHTML = `
        <div style="display: flex; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: ${icColor}; margin-top: 2px; flex-shrink: 0;"></span>
          <div><b>GPU A & B Nodes</b>: Accelerator processors that directly exchange weights/parameters during training.</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <span style="display: inline-block; width: 14px; height: 3px; background: ${icColor}; margin-top: 7px; flex-shrink: 0;"></span>
          <div><b>NVLink Bus</b>: Direct, high-bandwidth interconnect bypassing the CPU Host completely.</div>
        </div>
      `;
        } else {
          legend.innerHTML = `
        <div style="display: flex; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: ${icColor}; margin-top: 2px; flex-shrink: 0;"></span>
          <div><b>GPU A & B Nodes</b>: Communicating accelerators that must transfer parameters over PCIe.</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 4px; background: #94A3B8; margin-top: 2px; flex-shrink: 0;"></span>
          <div><b>PCIe Root Complex (System Hub)</b>: The motherboard's controller. Data must route up through the hub and bounce back down.</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <span style="display: inline-block; width: 14px; height: 3px; background: ${icColor}; margin-top: 7px; flex-shrink: 0;"></span>
          <div><b>PCIe Bus</b>: The physical motherboard slot tracks mediating the CPU-bound GPU-to-GPU transfer.</div>
        </div>
      `;
        }
      }
    }

    function updateInfoCard() {
      const card = document.getElementById('infoCard');
      const title = document.getElementById('infoTitle');
      const list = document.getElementById('infoList');
      const isNVLink = S.icIdx === 2;

      if (isNVLink) {
        card.className = 'info-card nvlink';
        title.textContent = 'NVLink Architecture';
        list.innerHTML =
          `<li>Direct GPU fabric</li>` +
          `<li>GPU-to-GPU communication</li>` +
          `<li>Shared memory access</li>` +
          `<li>High-bandwidth interconnect</li>`;
      } else {
        card.className = 'info-card';
        title.textContent = 'PCIe Architecture';
        list.innerHTML =
          `<li>Tree topology</li>` +
          `<li>CPU-mediated transfers</li>` +
          `<li>Standard system interconnect</li>` +
          `<li>Lower bandwidth</li>`;
      }
      updateLegend();
    }

    // ── Interconnect selector ──
    function setIC(idx) {
      S.icIdx = idx;
      document.querySelectorAll('.ic-btn').forEach((b, i) => {
        b.classList.toggle('active', i === idx);
      });
      particles = [];
      update();
    }

    // ── Data slider ──
    document.getElementById('slData').addEventListener('input', function () {
      S.dataIdx = +this.value;
      const D = getData();
      const el = document.getElementById('vData');
      el.textContent = D + ' GB';
      el.className = 'sl-val' + (D >= 50 ? ' crit' : D >= 25 ? ' hot' : D >= 10 ? ' warn' : '');
      fillSlider(this, (+this.value / 19) * 100);
      particles = [];
      update();
    });

    // ── Tc slider ──
    document.getElementById('slTc').addEventListener('input', function () {
      S.tcIdx = +this.value;
      const Tc = getTc();
      document.getElementById('vTc').textContent = Tc < 1000 ? Tc + ' ms' : (Tc / 1000).toFixed(1) + ' s';
      fillSlider(this, (+this.value / 13) * 100);
      update();
    });

    // ── Preset ──
    function setPreset(icIdx, dataIdx, tcIdx) {
      if (icIdx === 2) {
        setScenario('gpu-gpu');
      } else if (icIdx === 0 && dataIdx === 4 && tcIdx === 5) {
        setScenario('host-gpu');
      }
      S.icIdx = icIdx;
      S.dataIdx = dataIdx;
      S.tcIdx = tcIdx;
      particles = [];

      const slD = document.getElementById('slData');
      slD.value = dataIdx;
      const D = getData();
      const dEl = document.getElementById('vData');
      dEl.textContent = D + ' GB';
      dEl.className = 'sl-val' + (D >= 50 ? ' crit' : D >= 25 ? ' hot' : D >= 10 ? ' warn' : '');
      fillSlider(slD, (dataIdx / 19) * 100);

      const slTc = document.getElementById('slTc');
      slTc.value = tcIdx;
      document.getElementById('vTc').textContent = getTc() + ' ms';
      fillSlider(slTc, (tcIdx / 13) * 100);

      document.querySelectorAll('.ic-btn').forEach((b, i) => {
        b.classList.toggle('active', i === icIdx);
      });
      update();
    }

    function resetAll() {
      setScenario('host-gpu');
      setPreset(0, 4, 5);
    }

    // ══════════════════════════════════════════════════════
    //  EQUATIONS PANEL
    // ══════════════════════════════════════════════════════
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
      const ic = IC[S.icIdx];
      const D = getData();
      const Tc = getTc();
      const Tt = calcTt();
      const tot = calcTotal();
      const util = calcUtil();
      const ioBound = Tt > Tc;
      const hlU = util >= 90 ? 'hl-g' : util >= 50 ? 'hl' : 'hl-r';

      document.getElementById('calcInner').innerHTML =
        `<b>T<sub>t</sub> = D / Bandwidth</b><br>` +
        `&nbsp;&nbsp;= ${D} GB / ${ic.bw} GB/s<br>` +
        `&nbsp;&nbsp;= <span class="hl">${Tt.toFixed(3)} ms</span><br><br>` +

        `<b>T<sub>total</sub> = T<sub>c</sub> + T<sub>t</sub></b><br>` +
        `&nbsp;&nbsp;= ${Tc} ms + ${Tt.toFixed(3)} ms<br>` +
        `&nbsp;&nbsp;= <span class="hl">${tot.toFixed(3)} ms</span><br><br>` +

        `<b>GPU Util = T<sub>c</sub> / (T<sub>c</sub> + T<sub>t</sub>) × 100</b><br>` +
        `&nbsp;&nbsp;= ${Tc} / ${tot.toFixed(3)} × 100<br>` +
        `&nbsp;&nbsp;= <span class="${hlU}">${util.toFixed(2)}%</span>` +
        (ioBound
          ? ` &nbsp;<span class="hl-r">&#9888; I/O-Bound (T<sub>t</sub> &gt; T<sub>c</sub>)</span>`
          : ` &nbsp;<span class="hl-g">&#10003; Compute-Bound</span>`);
    }

    // ══════════════════════════════════════════════════════
    //  OBSERVATIONS TABLE
    // ══════════════════════════════════════════════════════
    let observations = [];

    function recordObs() {
      const ic = IC[S.icIdx];
      const D = getData();
      const Tc = getTc();
      const Tt = calcTt();
      const tot = calcTotal();
      const util = calcUtil();
      const n = observations.length + 1;
      observations.push({ n, ic, D, Tc, Tt, tot, util });

      const tbody = document.getElementById('obsBody');
      if (n === 1) tbody.innerHTML = '';
      const row = tbody.insertRow();
      const mode = util >= 90 ? 'Compute' : util >= 50 ? 'Mod I/O' : 'I/O Bound';
      const modeColor = util >= 90 ? 'color:var(--green);font-weight:700'
        : util >= 50 ? 'color:var(--yellow);font-weight:700'
          : 'color:var(--red);font-weight:700';
      row.innerHTML =
        `<td>${n}</td>` +
        `<td>${ic.short}</td>` +
        `<td>${D}GB</td>` +
        `<td>${Tc}ms</td>` +
        `<td>${Tt.toFixed(2)}ms</td>` +
        `<td>${tot.toFixed(2)}ms</td>` +
        `<td>${util.toFixed(1)}</td>` +
        `<td style="${modeColor}">${mode}</td>`;

      const btn = document.getElementById('recBtn');
      btn.classList.add('flash');
      setTimeout(() => btn.classList.remove('flash'), 500);
      tbody.closest('.tbl-wrap').scrollTop = 9999;
    }

    function clearObs() {
      observations = [];
      document.getElementById('obsBody').innerHTML =
        '<tr><td colspan="8" class="tbl-empty">No readings yet — adjust parameters and record</td></tr>';
    }

    function exportCSV() {
      if (!observations.length) return;
      const h = '#,Interconnect,D(GB),Tc(ms),Tt(ms),Total(ms),Util(%),Mode';
      const rows = observations.map(o =>
        [o.n, o.ic.name, o.D, o.Tc, o.Tt.toFixed(3), o.tot.toFixed(3), o.util.toFixed(2),
        o.util >= 90 ? 'Compute-Bound' : o.util >= 50 ? 'Moderate I/O' : 'I/O Bound'].join(','));
      const a = document.createElement('a');
      a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
      a.download = 'pcie_nvlink_observations.csv';
      a.click();
    }

    // ══════════════════════════════════════════════════════
    //  INIT
    // ══════════════════════════════════════════════════════
    fillSlider(document.getElementById('slData'), (4 / 19) * 100);
    fillSlider(document.getElementById('slTc'), (5 / 13) * 100);
    setScenario('host-gpu');
    requestAnimationFrame(draw);
 