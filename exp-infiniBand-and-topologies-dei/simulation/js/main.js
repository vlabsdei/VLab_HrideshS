
        // ══════════════════════════════════════════════════════
        //  CONSTANTS & CONFIG
        // ══════════════════════════════════════════════════════
        const LINKS = [
            { name: 'NDR', bw: 400, bwBytes: 400e9 / 8, color: '#0891B2', colorL: '#CFFAFE' },  // 50 GB/s
            { name: 'XDR', bw: 800, bwBytes: 800e9 / 8, color: '#7C3AED', colorL: '#EDE9FE' }   // 100 GB/s
        ];

        const N_STEPS = [32, 64, 128, 256, 512, 1024];
        const N_LABELS = ['32', '64', '128', '256', '512', '1024'];
        const PAYLOAD_STEPS = [1, 10, 50, 100, 500];   // MB
        const PAYLOAD_LABELS = ['1 MB', '10 MB', '50 MB', '100 MB', '500 MB'];

        const T_SWITCH_US = 200;    // switch processing latency in µs (0.2 µs = 200 ns)
        const PROP_DELAY_US = 5;   // propagation delay in µs per hop (0.05 µs = 50 ns)
        const DISTANCE_M = 10;     // assumed avg cable distance metres

        // State
        let S = { topo: 'fattree', linkIdx: 0, nIdx: 1, payloadIdx: 1 };

        function getN() { return N_STEPS[S.nIdx]; }
        function getPayloadMB() { return PAYLOAD_STEPS[S.payloadIdx]; }
        function getLink() { return LINKS[S.linkIdx]; }

        // Hop count
        function calcHops(topo, N) {
            if (topo === 'fattree') return 4;
            return Math.floor(Math.cbrt(N));
        }

        // Serialization latency: Ts = S / BW  [ms]
        function calcTs() {
            const S_bytes = getPayloadMB() * 1e6;
            return (S_bytes / getLink().bwBytes) * 1000;
        }

        // Hop delay: H * T_switch  [µs]
        function calcHopDelay(H) {
            return H * T_SWITCH_US;
        }

        // Total network delay: Ts + hop delay + propagation  [ms]
        function calcTnet(topo, N) {
            const H = calcHops(topo, N);
            const Ts = calcTs();
            const hop = calcHopDelay(H);
            const prop = H * PROP_DELAY_US;
            return Ts + (hop + prop) / 1000;   // convert µs → ms then add
        }

        // ══════════════════════════════════════════════════════
        //  CANVAS ENGINE
        // ══════════════════════════════════════════════════════
        const canvas = document.getElementById('c');
        const cx = canvas.getContext('2d');
        let animT = 0;
        let packetT = 0;   // 0→1 packet travel progress
        let torusRotX = 0.5;
        let torusRotY = 0.4;
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        function resize() {
            const vp = document.getElementById('vp');
            canvas.width = vp.clientWidth * (window.devicePixelRatio || 1);
            canvas.height = vp.clientHeight * (window.devicePixelRatio || 1);
            canvas.style.width = vp.clientWidth + 'px';
            canvas.style.height = vp.clientHeight + 'px';
            cx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        }
        window.addEventListener('resize', resize);
        resize();

        // Interactive 3D drag controls for Torus
        canvas.addEventListener('mousedown', (e) => {
            if (S.topo !== 'torus') return;
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            torusRotY += dx * 0.008;
            torusRotX += dy * 0.008;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Touch support for mobile devices
        canvas.addEventListener('touchstart', (e) => {
            if (S.topo !== 'torus') return;
            if (e.touches.length === 1) {
                isDragging = true;
                lastMouseX = e.touches[0].clientX;
                lastMouseY = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            if (e.touches.length === 1) {
                const dx = e.touches[0].clientX - lastMouseX;
                const dy = e.touches[0].clientY - lastMouseY;
                torusRotY += dx * 0.008;
                torusRotX += dy * 0.008;
                lastMouseX = e.touches[0].clientX;
                lastMouseY = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => { isDragging = false; });
        window.addEventListener('touchcancel', () => { isDragging = false; });

        // Round-rect helper
        function rr(x, y, w, h, r) {
            cx.beginPath();
            cx.moveTo(x + r, y);
            cx.lineTo(x + w - r, y); cx.arcTo(x + w, y, x + w, y + r, r);
            cx.lineTo(x + w, y + h - r); cx.arcTo(x + w, y + h, x + w - r, y + h, r);
            cx.lineTo(x + r, y + h); cx.arcTo(x, y + h, x, y + h - r, r);
            cx.lineTo(x, y + r); cx.arcTo(x, y, x + r, y, r);
            cx.closePath();
        }

        function easeInOut(t) { return t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

        // Draw a switch/node box
        function drawSwitch(x, y, w, h, label, color, isActive, pulse) {
            cx.shadowColor = isActive ? color + '55' : 'rgba(0,0,0,0.1)';
            cx.shadowBlur = isActive ? 14 : 6;
            cx.fillStyle = isActive ? '#1E293B' : '#334155';
            rr(x, y, w, h, 8);
            cx.fill();
            cx.shadowBlur = 0;

            cx.strokeStyle = color + (isActive ? 'dd' : '66');
            cx.lineWidth = isActive ? 2 : 1;
            rr(x, y, w, h, 8);
            cx.stroke();

            if (isActive && pulse > 0) {
                cx.strokeStyle = color + Math.round(pulse * 0.6 * 255).toString(16).padStart(2, '0');
                cx.lineWidth = 3;
                rr(x - 2, y - 2, w + 4, h + 4, 10);
                cx.stroke();
            }

            cx.fillStyle = 'rgba(255,255,255,0.88)';
            cx.font = `600 10px 'IBM Plex Sans',sans-serif`;
            cx.textAlign = 'center';
            cx.fillText(label, x + w / 2, y + h / 2 + 3.5);
        }

        // Draw a compute node (small circle)
        function drawNode(x, y, r, color, lit) {
            cx.beginPath();
            cx.arc(x, y, r, 0, Math.PI * 2);
            cx.fillStyle = lit ? color : '#475569';
            cx.fill();
            if (lit) {
                cx.beginPath();
                cx.arc(x, y, r + 3, 0, Math.PI * 2);
                cx.fillStyle = color + '33';
                cx.fill();
            }
        }

        // Draw link line between two points with optional active glow
        function drawLink(x1, y1, x2, y2, color, active, width) {
            cx.beginPath();
            cx.moveTo(x1, y1);
            cx.lineTo(x2, y2);
            cx.strokeStyle = active ? color : 'rgba(148,163,184,0.35)';
            cx.lineWidth = active ? (width || 2) : 1;
            if (active) {
                cx.shadowColor = color + '66';
                cx.shadowBlur = 6;
            }
            cx.stroke();
            cx.shadowBlur = 0;
        }

        // Animated packet dot along a path segment
        function drawPacket(x1, y1, x2, y2, t, color, size) {
            const px = x1 + (x2 - x1) * t;
            const py = y1 + (y2 - y1) * t;

            // Glow
            const g = cx.createRadialGradient(px, py, 0, px, py, size * 4);
            g.addColorStop(0, color + 'aa');
            g.addColorStop(1, 'transparent');
            cx.fillStyle = g;
            cx.beginPath();
            cx.arc(px, py, size * 4, 0, Math.PI * 2);
            cx.fill();

            // Core
            cx.beginPath();
            cx.arc(px, py, size, 0, Math.PI * 2);
            cx.fillStyle = color;
            cx.fill();

            // White centre
            cx.beginPath();
            cx.arc(px, py, size * 0.4, 0, Math.PI * 2);
            cx.fillStyle = 'rgba(255,255,255,0.85)';
            cx.fill();
        }

        // ── Fat-Tree topology drawing ──
        function drawFatTree(W, H, N, link, progress) {
            const color = link.color;
            const isNarrow = W < 500;
            const H_HOPS = 4; // fixed

            // Layout: spine layer (top), leaf layer (middle), endpoints (bottom)
            let spineCount, leafCount, endpCount, nodeCount;
            if (S.nIdx === 0) { // N = 32
                spineCount = 2; leafCount = 4; endpCount = 8; nodeCount = 8;
            } else if (S.nIdx === 1) { // N = 64
                spineCount = 3; leafCount = 5; endpCount = 10; nodeCount = 10;
            } else if (S.nIdx === 2) { // N = 128
                spineCount = 4; leafCount = 6; endpCount = 12; nodeCount = 12;
            } else if (S.nIdx === 3) { // N = 256
                spineCount = 5; leafCount = 8; endpCount = 14; nodeCount = 14;
            } else if (S.nIdx === 4) { // N = 512
                spineCount = 6; leafCount = 10; endpCount = 16; nodeCount = 16;
            } else { // N = 1024
                spineCount = 8; leafCount = 12; endpCount = 18; nodeCount = 18;
            }

            const sw = isNarrow ? 32 : (leafCount > 8 ? 44 : 56);
            const sh = isNarrow ? 16 : (leafCount > 8 ? 20 : 26);
            const nodeR = isNarrow ? 4 : (endpCount > 12 ? 5 : 7);

            const esw = isNarrow ? 22 : (endpCount > 12 ? 28 : 36);
            const esh = isNarrow ? 12 : (endpCount > 12 ? 16 : 20);

            const layerSpineY = H * 0.16;
            const layerLeafY = H * 0.35;
            const layerEndpY = H * 0.54;
            const layerNodeY = H * 0.70;

            const pad = isNarrow ? 30 : 50;
            const availW = W - pad * 2;

            // Spine positions
            const spineXs = Array.from({ length: spineCount }, (_, i) =>
                pad + availW * (i + 0.5) / spineCount);
            // Leaf positions
            const leafXs = Array.from({ length: leafCount }, (_, i) =>
                pad + availW * (i + 0.5) / leafCount);
            // Endpoint (switch) positions
            const endpXs = Array.from({ length: endpCount }, (_, i) =>
                pad + availW * (i + 0.5) / endpCount);
            // Compute node positions
            const nodeXs = Array.from({ length: nodeCount }, (_, i) =>
                pad + availW * (i + 0.5) / nodeCount);

            // Determine which path is active (animating)
            const activeSrc = Math.floor(nodeCount * 0.15);
            const activeDst = Math.floor(nodeCount * 0.85);
            const srcLeafIdx = Math.floor(activeSrc * leafCount / nodeCount);
            const dstLeafIdx = Math.floor(activeDst * leafCount / nodeCount);
            const srcEndpIdx = Math.floor(activeSrc * endpCount / nodeCount);
            const dstEndpIdx = Math.floor(activeDst * endpCount / nodeCount);
            const midSpineIdx = Math.floor(spineCount / 2);

            // Path segments: node → endp → leaf → spine → leaf → endp → node  (4 hops)
            const pathSegments = [
                { x1: nodeXs[activeSrc], y1: layerNodeY, x2: endpXs[srcEndpIdx], y2: layerEndpY },
                { x1: endpXs[srcEndpIdx], y1: layerEndpY, x2: leafXs[srcLeafIdx], y2: layerLeafY },
                { x1: leafXs[srcLeafIdx], y1: layerLeafY, x2: spineXs[midSpineIdx], y2: layerSpineY },
                { x1: spineXs[midSpineIdx], y1: layerSpineY, x2: leafXs[dstLeafIdx], y2: layerLeafY },
                { x1: leafXs[dstLeafIdx], y1: layerLeafY, x2: endpXs[dstEndpIdx], y2: layerEndpY },
                { x1: endpXs[dstEndpIdx], y1: layerEndpY, x2: nodeXs[activeDst], y2: layerNodeY },
            ];

            // Draw all background links first
            cx.setLineDash([]);
            // Spine ↔ Leaf
            for (let s = 0; s < spineCount; s++) {
                for (let l = 0; l < leafCount; l++) {
                    const active = (progress > 0) && (
                        (s === midSpineIdx && (l === srcLeafIdx || l === dstLeafIdx))
                    );
                    drawLink(spineXs[s], layerSpineY + sh / 2, leafXs[l], layerLeafY, color, active, 1.5);
                }
            }
            // Leaf ↔ Endpoint
            for (let l = 0; l < leafCount; l++) {
                for (let e = 0; e < endpCount; e++) {
                    if (Math.abs(e * leafCount / endpCount - l) < 1.5) {
                        const active = (progress > 0) && (
                            (l === srcLeafIdx && e === srcEndpIdx) || (l === dstLeafIdx && e === dstEndpIdx)
                        );
                        drawLink(leafXs[l], layerLeafY + sh / 2, endpXs[e], layerEndpY, color, active, 1.5);
                    }
                }
            }
            // Endpoint ↔ Nodes
            for (let e = 0; e < endpCount; e++) {
                for (let n = 0; n < nodeCount; n++) {
                    if (Math.round(n * endpCount / nodeCount) === e) {
                        const active = (progress > 0) && ((n === activeSrc && e === srcEndpIdx) || (n === activeDst && e === dstEndpIdx));
                        drawLink(endpXs[e], layerEndpY + sh / 2, nodeXs[n], layerNodeY, color, active, 1.5);
                    }
                }
            }

            // Draw spine switches
            for (let s = 0; s < spineCount; s++) {
                const isSrc = s === midSpineIdx && progress > 0;
                const pulse = isSrc ? 0.5 + 0.5 * Math.sin(animT * 5) : 0;
                drawSwitch(spineXs[s] - sw / 2, layerSpineY, sw, sh,
                    isNarrow ? 'SP' : 'Spine', color, isSrc, pulse);
            }
            // Leaf switches
            for (let l = 0; l < leafCount; l++) {
                const isAct = (l === srcLeafIdx || l === dstLeafIdx) && progress > 0;
                const pulse = isAct ? 0.5 + 0.5 * Math.sin(animT * 5 + l) : 0;
                drawSwitch(leafXs[l] - sw / 2, layerLeafY, sw, sh,
                    isNarrow ? 'LF' : 'Leaf', color, isAct, pulse);
            }
            // Endpoint switches
            for (let e = 0; e < endpCount; e++) {
                const isAct = (e === srcEndpIdx || e === dstEndpIdx) && progress > 0;
                const pulse = isAct ? 0.4 + 0.4 * Math.sin(animT * 4 + e) : 0;
                drawSwitch(endpXs[e] - esw / 2, layerEndpY, esw, esh,
                    isNarrow ? 'EP' : 'Edge', color, isAct, pulse);
            }
            // Compute nodes
            for (let n = 0; n < nodeCount; n++) {
                const isAct = (n === activeSrc || n === activeDst) && progress > 0;
                drawNode(nodeXs[n], layerNodeY, nodeR, color, isAct);
            }

            // Animate packet along path
            if (progress > 0) {
                const totalSegs = pathSegments.length;
                const segIdx = Math.min(Math.floor(progress * totalSegs), totalSegs - 1);
                const segT = (progress * totalSegs) - segIdx;
                const seg = pathSegments[segIdx];
                drawPacket(seg.x1, seg.y1, seg.x2, seg.y2, easeInOut(segT), color, isNarrow ? 5 : 7);
            }

            // Layer labels
            cx.fillStyle = 'rgba(148,163,184,0.65)';
            cx.font = `500 9px 'IBM Plex Sans',sans-serif`;
            cx.textAlign = 'left';
            cx.fillText('SPINE', 4, layerSpineY + sh / 2 + 3);
            cx.fillText('LEAF', 4, layerLeafY + sh / 2 + 3);
            cx.fillText('EDGE', 4, layerEndpY + sh / 2 + 3);
            cx.fillText('NODES', 4, layerNodeY + 4);

            // Hop count badge
            const badgeX = W - (isNarrow ? 70 : 85);
            const badgeY = H * 0.10;
            cx.fillStyle = 'rgba(255,255,255,0.95)';
            cx.shadowColor = 'rgba(0,0,0,0.08)'; cx.shadowBlur = 8;
            rr(badgeX, badgeY, isNarrow ? 64 : 78, 30, 7);
            cx.fill(); cx.shadowBlur = 0;
            cx.strokeStyle = color + '88'; cx.lineWidth = 1;
            rr(badgeX, badgeY, isNarrow ? 64 : 78, 30, 7);
            cx.stroke();
            cx.fillStyle = color;
            cx.font = `700 16px 'IBM Plex Mono',monospace`;
            cx.textAlign = 'center';
            cx.fillText('H = ' + H_HOPS, badgeX + (isNarrow ? 32 : 39), badgeY + 12);
            cx.fillStyle = '#94A3B8';
            cx.font = `400 9px 'IBM Plex Sans',sans-serif`;
            cx.fillText('Fixed hops', badgeX + (isNarrow ? 32 : 39), badgeY + 25);
        }

        // ── 3D Torus topology drawing ──
        function drawTorus(W, H, N, link, progress) {
            const color = link.color;
            const H_HOPS = Math.floor(Math.cbrt(N));
            const isNarrow = W < 500;

            // Determine rings and nodes counts based on cluster size step
            let ringsCount, nodesPerRing;
            if (S.nIdx === 0) { // N = 32
                ringsCount = 8; nodesPerRing = 4;
            } else if (S.nIdx === 1) { // N = 64
                ringsCount = 10; nodesPerRing = 5;
            } else if (S.nIdx === 2) { // N = 128
                ringsCount = 12; nodesPerRing = 6;
            } else if (S.nIdx === 3) { // N = 256
                ringsCount = 16; nodesPerRing = 6;
            } else if (S.nIdx === 4) { // N = 512
                ringsCount = 18; nodesPerRing = 8;
            } else { // N = 1024
                ringsCount = 20; nodesPerRing = 10;
            }

            const R = Math.min(W, H) * (isNarrow ? 0.16 : 0.22);
            const r = Math.min(W, H) * (isNarrow ? 0.05 : 0.07);
            const center_y = H * 0.44;

            // Rotation angles based on global drag state or auto-rotation
            const rotX = torusRotX;
            const rotY = torusRotY;
            const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
            const cosY = Math.cos(rotY), sinY = Math.sin(rotY);

            const TEAL = '#7C3AED';

            // Source/destination indices on the torus grid
            const halfI = Math.floor(ringsCount / 2);
            const halfJ = Math.floor(nodesPerRing / 2);

            // Path: travel around major rings, then around tube
            const path = [];
            for (let i = 0; i <= halfI; i++) {
                path.push({ i: i, j: 0 });
            }
            for (let j = 1; j <= halfJ; j++) {
                path.push({ i: halfI, j: j });
            }

            // Generate 3D coordinates, rotate, and project
            const nodes = [];
            const cameraDist = 400;
            for (let i = 0; i < ringsCount; i++) {
                for (let j = 0; j < nodesPerRing; j++) {
                    const theta = (i * 2 * Math.PI) / ringsCount;
                    const phi = (j * 2 * Math.PI) / nodesPerRing;

                    // 3D coords centered at (0,0,0)
                    const x0 = (R + r * Math.cos(phi)) * Math.cos(theta);
                    const z0 = (R + r * Math.cos(phi)) * Math.sin(theta);
                    const y0 = r * Math.sin(phi);

                    // X-rotation
                    const y1 = y0 * cosX - z0 * sinX;
                    const z1 = y0 * sinX + z0 * cosX;
                    const x1 = x0;

                    // Y-rotation
                    const x2 = x1 * cosY + z1 * sinY;
                    const z2 = -x1 * sinY + z1 * cosY;
                    const y2 = y1;

                    // Perspective projection
                    const zoom = cameraDist / (cameraDist + z2);
                    const sx = W / 2 + x2 * zoom;
                    const sy = center_y + y2 * zoom;

                    nodes.push({
                        i, j,
                        x: sx,
                        y: sy,
                        z: z2,
                        zoom
                    });
                }
            }

            const getNode = (i, j) => {
                const ri = (i + ringsCount) % ringsCount;
                const rj = (j + nodesPerRing) % nodesPerRing;
                return nodes[ri * nodesPerRing + rj];
            };

            // Generate all unique link segments
            const links = [];
            const isPathLink = (nA, nB) => {
                for (let p = 0; p < path.length - 1; p++) {
                    const pA = path[p];
                    const pB = path[p + 1];
                    if (
                        (nA.i === pA.i && nA.j === pA.j && nB.i === pB.i && nB.j === pB.j) ||
                        (nA.i === pB.i && nA.j === pB.j && nB.i === pA.i && nB.j === pA.j)
                    ) {
                        return true;
                    }
                }
                return false;
            };

            for (let i = 0; i < ringsCount; i++) {
                for (let j = 0; j < nodesPerRing; j++) {
                    const nA = getNode(i, j);

                    // Connect to next ring node
                    const nB = getNode(i + 1, j);
                    links.push({
                        nA, nB,
                        depth: (nA.z + nB.z) / 2,
                        active: isPathLink(nA, nB)
                    });

                    // Connect to next tube node
                    const nC = getNode(i, j + 1);
                    links.push({
                        nA, nB: nC,
                        depth: (nA.z + nC.z) / 2,
                        active: isPathLink(nA, nC)
                    });
                }
            }

            // Sort back-to-front by depth (larger z drawn first)
            links.sort((a, b) => b.depth - a.depth);
            const sortedNodes = [...nodes].sort((a, b) => b.z - a.z);

            const maxDepth = R + r + 20;

            // Draw all links
            for (let k = 0; k < links.length; k++) {
                const l = links[k];
                const active = l.active && progress > 0;

                cx.beginPath();
                cx.moveTo(l.nA.x, l.nA.y);
                cx.lineTo(l.nB.x, l.nB.y);

                if (active) {
                    cx.strokeStyle = color;
                    cx.lineWidth = 2.5;
                    cx.shadowColor = color + '66';
                    cx.shadowBlur = 6;
                } else {
                    const norm = Math.max(0, Math.min(1, (l.depth + maxDepth) / (2 * maxDepth)));
                    const alpha = 0.04 + 0.32 * (1.0 - norm);
                    cx.strokeStyle = `rgba(148,163,184,${alpha})`;
                    cx.lineWidth = 1;
                }
                cx.stroke();
                cx.shadowBlur = 0;
            }

            // Draw nodes
            const nodeR = isNarrow ? 5 : 7;
            for (let k = 0; k < sortedNodes.length; k++) {
                const n = sortedNodes[k];
                const isSrc = n.i === 0 && n.j === 0;
                const isDst = n.i === halfI && n.j === halfJ;
                const isPath = progress > 0 && path.some(p => p.i === n.i && p.j === n.j);
                const lit = isSrc || isDst || isPath;

                const norm = Math.max(0, Math.min(1, (n.z + maxDepth) / (2 * maxDepth)));
                const rFactor = 0.5 + 0.6 * (1.0 - norm);
                const currentR = nodeR * rFactor;

                if (isSrc || isDst) {
                    cx.beginPath();
                    cx.arc(n.x, n.y, currentR + 4, 0, Math.PI * 2);
                    cx.fillStyle = (isSrc ? color : TEAL) + '22';
                    cx.fill();
                }

                cx.beginPath();
                cx.arc(n.x, n.y, currentR, 0, Math.PI * 2);
                cx.fillStyle = lit ? (isSrc ? color : isDst ? TEAL : color + 'cc') : '#334155';
                cx.fill();

                cx.beginPath();
                cx.arc(n.x, n.y, currentR, 0, Math.PI * 2);
                cx.strokeStyle = lit ? (isSrc ? color : isDst ? TEAL : color + '88') : `rgba(148,163,184,${0.08 + 0.3 * (1.0 - norm)})`;
                cx.lineWidth = lit ? 2 : 1;
                cx.stroke();

                if (isSrc || isDst) {
                    cx.fillStyle = '#fff';
                    cx.font = `700 ${Math.max(6, Math.round(8 * rFactor))}px 'IBM Plex Mono',monospace`;
                    cx.textAlign = 'center';
                    cx.fillText(isSrc ? 'SRC' : 'DST', n.x, n.y + 3 * rFactor);
                }
            }

            // Animate packet along path segments
            if (progress > 0 && path.length > 1) {
                const totalSegs = path.length - 1;
                const segIdx = Math.min(Math.floor(progress * totalSegs), totalSegs - 1);
                const segT = (progress * totalSegs) - segIdx;
                const pA = getNode(path[segIdx].i, path[segIdx].j);
                const pB = getNode(path[segIdx + 1].i, path[segIdx + 1].j);
                drawPacket(pA.x, pA.y, pB.x, pB.y, easeInOut(segT), color, isNarrow ? 5 : 7);
            }

            // Hop count badge (top right)
            const badgeX = W - (isNarrow ? 80 : 96);
            const badgeY = H * 0.10;
            cx.fillStyle = 'rgba(255,255,255,0.95)';
            cx.shadowColor = 'rgba(0,0,0,0.08)'; cx.shadowBlur = 8;
            rr(badgeX, badgeY, isNarrow ? 74 : 88, 30, 7);
            cx.fill(); cx.shadowBlur = 0;
            cx.strokeStyle = color + '88'; cx.lineWidth = 1;
            rr(badgeX, badgeY, isNarrow ? 74 : 88, 30, 7);
            cx.stroke();
            cx.fillStyle = color;
            cx.font = `700 16px 'IBM Plex Mono',monospace`;
            cx.textAlign = 'center';
            cx.fillText('H = ' + H_HOPS, badgeX + (isNarrow ? 37 : 44), badgeY + 12);
            cx.fillStyle = '#94A3B8';
            cx.font = `400 9px 'IBM Plex Sans',sans-serif`;
            cx.fillText('⌊³√' + N + '⌋', badgeX + (isNarrow ? 37 : 44), badgeY + 25);
        }

        // ── Bottom stats strip ──
        function drawStats(W, H, Ts, Tnet, H_hops, link, topo, progress) {
            const isNarrow = W < 500;
            const stripY = H * 0.82;
            const col1 = isNarrow ? W * 0.18 : W * 0.22;
            const col2 = isNarrow ? W * 0.5 : W * 0.5;
            const col3 = isNarrow ? W * 0.82 : W * 0.78;

            // Timeline bar
            const tlX = isNarrow ? 20 : 40;
            const tlW = W - (isNarrow ? 40 : 80);
            const tlY = stripY + 6;
            const tlH = 20;

            cx.fillStyle = 'rgba(30,41,59,0.06)';
            rr(tlX, tlY, tlW, tlH, 5); cx.fill();

            // Serialization portion (blue)
            const totalDelay = Tnet;
            const tsW = Math.max(4, (Ts / totalDelay) * tlW * easeInOut(Math.min(progress * 2, 1)));
            const hopW = Math.max(4, tlW * easeInOut(Math.min(progress * 2, 1))) - tsW;

            if (tsW > 2) {
                const gTs = cx.createLinearGradient(tlX, 0, tlX + tsW, 0);
                gTs.addColorStop(0, link.color + 'aa');
                gTs.addColorStop(1, link.color);
                cx.fillStyle = gTs;
                cx.beginPath();
                cx.moveTo(tlX + 5, tlY); cx.lineTo(tlX + tsW, tlY); cx.lineTo(tlX + tsW, tlY + tlH);
                cx.lineTo(tlX + 5, tlY + tlH);
                cx.arcTo(tlX, tlY + tlH, tlX, tlY + tlH - 5, 5);
                cx.lineTo(tlX, tlY + 5); cx.arcTo(tlX, tlY, tlX + 5, tlY, 5);
                cx.closePath(); cx.fill();
            }
            if (hopW > 2 && progress > 0.5) {
                const gHop = cx.createLinearGradient(tlX + tsW, 0, tlX + tsW + hopW, 0);
                gHop.addColorStop(0, '#22C55Eaa'); gHop.addColorStop(1, '#22C55E');
                cx.fillStyle = gHop;
                cx.fillRect(tlX + tsW, tlY, hopW, tlH);
            }

            cx.strokeStyle = 'rgba(148,163,184,0.3)'; cx.lineWidth = 1;
            rr(tlX, tlY, tlW, tlH, 5); cx.stroke();

            // Divider
            if (progress > 0.5 && tsW > 8) {
                cx.strokeStyle = 'rgba(255,255,255,0.6)'; cx.lineWidth = 1.5;
                cx.setLineDash([3, 3]);
                cx.beginPath(); cx.moveTo(tlX + tsW, tlY + 2); cx.lineTo(tlX + tsW, tlY + tlH - 2); cx.stroke();
                cx.setLineDash([]);
            }

            // Labels in bar
            if (progress > 0.3 && tsW > 22) {
                cx.fillStyle = '#fff'; cx.font = `600 9px 'IBM Plex Sans',sans-serif`; cx.textAlign = 'center';
                cx.fillText('Ts', tlX + tsW / 2, tlY + tlH / 2 + 3.5);
            }
            if (progress > 0.7 && hopW > 22) {
                cx.fillStyle = '#fff'; cx.font = `600 9px 'IBM Plex Sans',sans-serif`; cx.textAlign = 'center';
                cx.fillText('Hop+Prop', tlX + tsW + hopW / 2, tlY + tlH / 2 + 3.5);
            }

            // Values below
            const valY = tlY + tlH + 16;
            cx.font = `500 10px 'IBM Plex Mono',monospace`;
            cx.textAlign = 'left';
            cx.fillStyle = link.color;
            cx.fillText('Ts = ' + Ts.toFixed(3) + ' ms', tlX, valY);
            cx.textAlign = 'right';
            cx.fillStyle = '#22C55E';
            cx.fillText('T_net = ' + Tnet.toFixed(3) + ' ms', tlX + tlW, valY);
            cx.textAlign = 'center';
            cx.fillStyle = '#94A3B8';
            cx.fillText(link.name + ' · ' + H_hops + ' hops · ' + getPayloadMB() + ' MB', tlX + tlW / 2, valY);
        }

        // ── Main draw ──
        function draw() {
            requestAnimationFrame(draw);
            animT += 0.016;

            // Auto-rotate 3D Torus when not dragging
            if (!isDragging) {
                torusRotX += 0.003;
                torusRotY += 0.002;
            }

            // Update mouse cursor style based on topology and interaction state
            if (S.topo === 'torus') {
                canvas.style.cursor = isDragging ? 'grabbing' : 'grab';
            } else {
                canvas.style.cursor = 'default';
            }

            const link = getLink();
            const speed = 0.006 + (link.bw / 800) * 0.014;
            packetT = (packetT + speed) % 1;

            const W = canvas.width / (window.devicePixelRatio || 1);
            const H = canvas.height / (window.devicePixelRatio || 1);
            cx.clearRect(0, 0, W, H);

            const N = getN();
            const topo = S.topo;
            const H_hops = calcHops(topo, N);
            const Ts = calcTs();
            const Tnet = calcTnet(topo, N);

            if (topo === 'fattree') {
                drawFatTree(W, H, N, link, packetT);
            } else {
                drawTorus(W, H, N, link, packetT);
            }

            drawStats(W, H, Ts, Tnet, H_hops, link, topo, packetT);

            // Topology label top-left
            cx.fillStyle = topo === 'fattree' ? link.color : '#7C3AED';
            cx.font = `600 12px 'IBM Plex Sans',sans-serif`;
            cx.textAlign = 'left';
            cx.fillText(topo === 'fattree' ? 'Fat-Tree Topology' : '3D Torus Topology', 10, 22);
        }

        // ══════════════════════════════════════════════════════
        //  UI UPDATE
        // ══════════════════════════════════════════════════════
        function update() {
            const N = getN();
            const link = getLink();
            const topo = S.topo;
            const H = calcHops(topo, N);
            const Ts = calcTs();
            const hopUS = calcHopDelay(H);
            const Tnet = calcTnet(topo, N);

            // Latency rating thresholds (ms)
            const isLow = Tnet < 0.5;
            const isMid = Tnet < 2.0;
            const isHigh = Tnet < 10;

            // Dashboard
            const hopCls = H > 10 ? 'crit' : H > 6 ? 'hot' : H > 4 ? 'warn' : 'good';
            setDC('dcHops', 'vHops', H, hopCls);
            document.getElementById('barHops').style.width = Math.min((H / 16) * 100, 100) + '%';
            document.getElementById('barHops').style.background = H > 10 ? 'var(--red)' : H > 6 ? 'var(--orange)' : H > 4 ? 'var(--yellow)' : 'var(--green)';

            const tsCls = Ts > 5 ? 'crit' : Ts > 1 ? 'hot' : Ts > 0.1 ? 'warn' : '';
            setDC('dcTs', 'vTs', Ts.toFixed(3), tsCls);
            document.getElementById('barTs').style.width = Math.min((Ts / 10) * 100, 100) + '%';
            document.getElementById('barTs').style.background = Ts > 5 ? 'var(--red)' : Ts > 1 ? 'var(--orange)' : 'var(--blue)';

            setDC('dcHopDelay', 'vHopDelay', hopUS.toFixed(2), '');

            const tnetCls = Tnet > 8 ? 'crit' : Tnet > 3 ? 'hot' : Tnet > 1 ? 'warn' : 'good';
            setDC('dcTnet', 'vTnet', Tnet.toFixed(3), tnetCls);
            document.getElementById('barTnet').style.width = Math.min((Tnet / 12) * 100, 100) + '%';
            document.getElementById('barTnet').style.background = Tnet > 8 ? 'var(--red)' : Tnet > 3 ? 'var(--orange)' : Tnet > 1 ? 'var(--yellow)' : 'var(--green)';

            const rCard = document.getElementById('dcRating');
            const rVal = document.getElementById('vRating');
            const rSub = document.getElementById('vRatingSub');
            if (isLow) { rCard.className = 'dc good'; rVal.textContent = 'Low'; rSub.textContent = '< 0.5 ms'; }
            else if (isMid) { rCard.className = 'dc warn'; rVal.textContent = 'Med'; rSub.textContent = '< 2 ms'; }
            else if (isHigh) { rCard.className = 'dc hot'; rVal.textContent = 'High'; rSub.textContent = '< 10 ms'; }
            else { rCard.className = 'dc crit'; rVal.textContent = 'V.High'; rSub.textContent = '> 10 ms'; }

            // Header pill
            const pill = document.getElementById('statusPill');
            const ptxt = document.getElementById('statusTxt');
            if (isLow) { pill.className = 'hd-pill pill-ok'; ptxt.textContent = 'Low Latency'; }
            else if (isMid) { pill.className = 'hd-pill pill-warn'; ptxt.textContent = 'Med Latency'; }
            else { pill.className = 'hd-pill pill-crit'; ptxt.textContent = 'High Latency'; }

            updateCalcPanel();
        }

        function setDC(cardId, valId, val, cls) {
            document.getElementById(cardId).className = 'dc' + (cls ? ' ' + cls : '');
            document.getElementById(valId).textContent = val;
        }

        // ══════════════════════════════════════════════════════
        //  CONTROLS
        // ══════════════════════════════════════════════════════
        function fillSlider(el, pct) {
            el.style.background = `linear-gradient(90deg,#2563EB ${pct}%,#CBD5E1 ${pct}%)`;
        }

        function updateLegend(topo) {
            const legend = document.getElementById('legendContent');
            const link = getLink();
            if (topo === 'fattree') {
                legend.innerHTML = `
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #334155; border: 1.5px solid ${link.color}; margin-top: 2px; flex-shrink: 0;"></span>
                        <div><b>Edge Switches (EP)</b>: Access-layer switches that connect directly to compute nodes at the bottom.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #334155; border: 1.5px solid ${link.color}; margin-top: 2px; flex-shrink: 0;"></span>
                        <div><b>Leaf Switches (LF)</b>: Aggregation-layer switches routing local edge traffic up to spine switches.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #334155; border: 1.5px solid ${link.color}; margin-top: 2px; flex-shrink: 0;"></span>
                        <div><b>Spine Switches (SP)</b>: Core-layer switches interconnecting all leaf switches to provide full network throughput.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #475569; margin-top: 3px; flex-shrink: 0;"></span>
                        <div><b>Compute Nodes (Bottom layer)</b>: Endpoints (GPU server hosts) that initiate and receive messages.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 14px; height: 3px; background: ${link.color}; margin-top: 7px; flex-shrink: 0;"></span>
                        <div><b>Active routing path</b>: Highlighted links showing the active path traversed by the packet.</div>
                    </div>
                `;
            } else {
                legend.innerHTML = `
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #334155; border: 1px solid rgba(148,163,184,0.3); margin-top: 2px; flex-shrink: 0;"></span>
                        <div><b>3D Torus Node (Integrated Router)</b>: In a Torus, every compute node is integrated with its own built-in router. Each circle is both a GPU endpoint and a routing switch.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${link.color}; border: 1.5px solid ${link.color}; margin-top: 2px; flex-shrink: 0;"></span>
                        <div><b>SRC Node (Source)</b>: The initiator endpoint for the active message payload transmission.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #7C3AED; border: 1.5px solid #7C3AED; margin-top: 2px; flex-shrink: 0;"></span>
                        <div><b>DST Node (Destination)</b>: The target receiver endpoint on the torus mesh.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; width: 14px; height: 3px; background: ${link.color}; margin-top: 7px; flex-shrink: 0;"></span>
                        <div><b>Active Ring Path</b>: Thick highlighted path showing how the packet routes along major ring and minor tube dimensions.</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <span style="display: inline-block; font-size: 10px; color: #94A3B8; margin-top: 1px; flex-shrink: 0;">👁</span>
                        <div><b>Z-Depth Occlusion</b>: Nodes/cables in the background are scaled down and faded, giving a realistic 3D spatial perspective.</div>
                    </div>
                `;
            }
        }

        function setTopo(topo) {
            S.topo = topo;
            packetT = 0;
            document.getElementById('topoFT').classList.toggle('active', topo === 'fattree');
            document.getElementById('topoTR').classList.toggle('active', topo === 'torus');

            // Info card
            const card = document.getElementById('infoCard');
            const title = document.getElementById('infoTitle');
            const list = document.getElementById('infoList');
            if (topo === 'fattree') {
                card.className = 'info-card';
                title.textContent = 'Fat-Tree (Spine-Leaf)';
                list.innerHTML =
                    '<li>Fixed hop count: H = 4 always</li>' +
                    '<li>Full bisection bandwidth</li>' +
                    '<li>Predictable, uniform latency</li>' +
                    '<li>High cabling cost</li>';
            } else {
                card.className = 'info-card torus';
                title.textContent = '3D Torus Network';
                list.innerHTML =
                    '<li>Variable hops: H = ⌊³√N⌋</li>' +
                    '<li>Latency grows with cluster size</li>' +
                    '<li>Lower cabling cost per node</li>' +
                    '<li>Wrap-around links reduce diameter</li>';
            }
            updateLegend(topo);
            update();
        }

        function setLink(idx) {
            S.linkIdx = idx;
            packetT = 0;
            document.querySelectorAll('.link-btn').forEach((b, i) =>
                b.classList.toggle('active', i === idx));
            updateLegend(S.topo);
            update();
        }

        document.getElementById('slN').addEventListener('input', function () {
            S.nIdx = +this.value;
            packetT = 0;
            const el = document.getElementById('vN');
            el.textContent = N_LABELS[S.nIdx];
            const N = getN();
            el.className = 'sl-val' + (N >= 512 ? ' crit' : N >= 256 ? ' hot' : N >= 128 ? ' warn' : '');
            fillSlider(this, (S.nIdx / 5) * 100);
            update();
        });

        document.getElementById('slPayload').addEventListener('input', function () {
            S.payloadIdx = +this.value;
            packetT = 0;
            const el = document.getElementById('vPayload');
            el.textContent = PAYLOAD_LABELS[S.payloadIdx];
            el.className = 'sl-val' + (S.payloadIdx >= 4 ? ' crit' : S.payloadIdx >= 3 ? ' hot' : S.payloadIdx >= 2 ? ' warn' : '');
            fillSlider(this, (S.payloadIdx / 4) * 100);
            update();
        });

        // setPreset(topo, linkIdx, nIdx, payloadIdx)
        function setPreset(topo, linkIdx, nIdx, payloadIdx) {
            S.topo = topo;
            S.linkIdx = linkIdx;
            S.nIdx = nIdx;
            S.payloadIdx = payloadIdx;
            packetT = 0;

            // Sync topo buttons
            document.getElementById('topoFT').classList.toggle('active', topo === 'fattree');
            document.getElementById('topoTR').classList.toggle('active', topo === 'torus');

            // Sync link buttons
            document.querySelectorAll('.link-btn').forEach((b, i) =>
                b.classList.toggle('active', i === linkIdx));

            // Sync N slider
            const slN = document.getElementById('slN');
            slN.value = nIdx;
            fillSlider(slN, (nIdx / 5) * 100);
            const nEl = document.getElementById('vN');
            nEl.textContent = N_LABELS[nIdx];
            const N = N_STEPS[nIdx];
            nEl.className = 'sl-val' + (N >= 512 ? ' crit' : N >= 256 ? ' hot' : N >= 128 ? ' warn' : '');

            // Sync payload slider
            const slP = document.getElementById('slPayload');
            slP.value = payloadIdx;
            fillSlider(slP, (payloadIdx / 4) * 100);
            const pEl = document.getElementById('vPayload');
            pEl.textContent = PAYLOAD_LABELS[payloadIdx];
            pEl.className = 'sl-val' + (payloadIdx >= 4 ? ' crit' : payloadIdx >= 3 ? ' hot' : payloadIdx >= 2 ? ' warn' : '');

            // Update info card
            setTopo(topo);   // also calls update()
        }

        function resetAll() {
            setPreset('fattree', 0, 1, 1);
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
            const N = getN();
            const link = getLink();
            const topo = S.topo;
            const H = calcHops(topo, N);
            const Ts = calcTs();
            const hopUS = calcHopDelay(H);
            const propUS = H * PROP_DELAY_US;
            const Tnet = calcTnet(topo, N);
            const isFT = topo === 'fattree';

            document.getElementById('calcInner').innerHTML =
                `<b>T<sub>s</sub> = S / Bandwidth</b><br>` +
                `&nbsp;&nbsp;= ${getPayloadMB()}MB / ${link.bw} Gbps<br>` +
                `&nbsp;&nbsp;= <span class="hl">${Ts.toFixed(4)} ms</span><br><br>` +

                `<b>H = ` + (isFT ? `4 (Fat-Tree fixed)` : `⌊³√N⌋ = ⌊³√${N}⌋`) + `</b><br>` +
                `&nbsp;&nbsp;= <span class="${isFT ? 'hl-g' : 'hl-p'}">${H} hops</span><br><br>` +

                `<b>Hop Delay = H × T<sub>switch</sub></b><br>` +
                `&nbsp;&nbsp;= ${H} × ${T_SWITCH_US} µs = <span class="hl">${hopUS} µs</span><br><br>` +

                `<b>T<sub>net</sub> = T<sub>s</sub> + (H × T<sub>sw</sub>) + (H × T<sub>prop</sub>)</b><br>` +
                `&nbsp;&nbsp;= ${Ts.toFixed(4)} + (${hopUS}/1000) + (${propUS}/1000)<br>` +
                `&nbsp;&nbsp;= <span class="${Tnet > 5 ? 'hl-r' : Tnet > 1 ? 'hl-o' : 'hl-g'}">${Tnet.toFixed(4)} ms</span>`;
        }

        // ══════════════════════════════════════════════════════
        //  OBSERVATIONS TABLE
        // ══════════════════════════════════════════════════════
        let observations = [];

        function recordObs() {
            const N = getN();
            const link = getLink();
            const topo = S.topo;
            const H = calcHops(topo, N);
            const Ts = calcTs();
            const Tnet = calcTnet(topo, N);
            const n = observations.length + 1;
            observations.push({ n, topo, N, link, H, Ts, Tnet });

            const tbody = document.getElementById('obsBody');
            if (n === 1) tbody.innerHTML = '';
            const row = tbody.insertRow();
            const isFT = topo === 'fattree';
            const latCls = Tnet > 8 ? 'color:var(--red);font-weight:700'
                : Tnet > 3 ? 'color:var(--orange);font-weight:700'
                    : Tnet > 1 ? 'color:var(--yellow);font-weight:700'
                        : 'color:var(--green);font-weight:700';
            row.innerHTML =
                `<td>${n}</td>` +
                `<td>${isFT ? 'F-Tree' : 'Torus'}</td>` +
                `<td>${N}</td>` +
                `<td>${link.name}</td>` +
                `<td>${getPayloadMB()}MB</td>` +
                `<td>${H}</td>` +
                `<td>${Ts.toFixed(3)}</td>` +
                `<td style="${latCls}">${Tnet.toFixed(3)}</td>`;

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
            const h = '#,Topology,N,Link,Payload,Hops,Ts(ms),Tnet(ms)';
            const rows = observations.map(o =>
                [o.n, o.topo === 'fattree' ? 'Fat-Tree' : '3D Torus', o.N, o.link.name,
                getPayloadMB() + 'MB', o.H, o.Ts.toFixed(4), o.Tnet.toFixed(4)].join(','));
            const a = document.createElement('a');
            a.href = 'data:text/csv,' + encodeURIComponent([h, ...rows].join('\n'));
            a.download = 'infiniband_topology_observations.csv';
            a.click();
        }

        // ══════════════════════════════════════════════════════
        //  INIT
        // ══════════════════════════════════════════════════════
        fillSlider(document.getElementById('slN'), (S.nIdx / 5) * 100);
        fillSlider(document.getElementById('slPayload'), (S.payloadIdx / 4) * 100);
        updateLegend('fattree');
        update();
        requestAnimationFrame(draw);
    