import { GameObject, ObjectColor, ObjectShape, RoundConfig } from '../types';

const TARGET_COLORS = [ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW];

// ── CANVAS-BASED PIXEL SAMPLING ───────────────────────────────────────────────
// Exact hex colors matching GameObjectItem.tsx FLAT_COLOR.
// These are used to paint objects onto an offscreen canvas so we can read back
// real pixel values — eliminating any gap between the math and what renders.
const COLOR_HEX: Record<ObjectColor, string> = {
    [ObjectColor.RED]:    '#ef4444',
    [ObjectColor.BLUE]:   '#3b82f6',
    [ObjectColor.GREEN]:  '#22c55e',
    [ObjectColor.YELLOW]: '#eab308',
    [ObjectColor.WHITE]:  '#f8fafc',
};

// RGB components for nearest-colour classification of anti-aliased edge pixels.
const COLOR_RGB: Record<ObjectColor, [number, number, number]> = {
    [ObjectColor.RED]:    [239, 68,  68 ],
    [ObjectColor.BLUE]:   [59,  130, 246],
    [ObjectColor.GREEN]:  [34,  197, 94 ],
    [ObjectColor.YELLOW]: [234, 179, 8  ],
    [ObjectColor.WHITE]:  [248, 250, 252],
};

function classifyPixel(r: number, g: number, b: number): ObjectColor {
    let best: ObjectColor = ObjectColor.WHITE;
    let bestDist = Infinity;
    for (const color of ([...TARGET_COLORS, ObjectColor.WHITE] as ObjectColor[])) {
        const [cr, cg, cb] = COLOR_RGB[color];
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (d < bestDist) { bestDist = d; best = color; }
    }
    return best;
}

/**
 * Draw one GameObject onto a Canvas 2D context.
 * Coordinates mirror GameObjectItem.tsx SVG rendering exactly:
 * - Same polygon vertices (normalised 0-100 coordinates)
 * - Same bezier control points for HEART
 * - Rotation around bounding-box centre, matching CSS transform-origin:center
 * - Hollow shapes use stroke-only (no fill), solid shapes use flat fill
 */
function drawObjOnCanvas(
    ctx: CanvasRenderingContext2D,
    obj: GameObject,
    cw: number,  // canvas width  in pixels
    ch: number,  // canvas height in pixels
): void {
    const ow  = (obj.w / 100) * cw;
    const oh  = (obj.h / 100) * ch;
    const pcx = (obj.x / 100) * cw + ow / 2;   // pivot centre x (canvas px)
    const pcy = (obj.y / 100) * ch + oh / 2;   // pivot centre y (canvas px)
    const rot = (obj.rotation ?? 0) * (Math.PI / 180);

    const isHollow = !!(obj.hollow || obj.shape === ObjectShape.RING || obj.shape === ObjectShape.FRAME);
    const sw  = Math.max(0.05, Math.min(0.45, obj.strokeWidth ?? 0.15));
    const hex = COLOR_HEX[obj.color] ?? '#f8fafc';

    // Translate to object centre, rotate.  All shape coordinates below are in
    // the object's local space with (0,0) at the object centre.
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.rotate(rot);

    // Map normalised (0-100) SVG-viewBox coords → local canvas pixels
    const lx = (v: number) => (v / 100 - 0.5) * ow;
    const ly = (v: number) => (v / 100 - 0.5) * oh;

    ctx.beginPath();

    switch (obj.shape) {

        // ── CIRCLE / RING ─────────────────────────────────────────────────────
        // SVG solid:  <circle r="49">         → r = 49% of width
        // SVG hollow: <circle r="50-halfSW">  → r = (50 - sw*50)% of width,
        //             stroke-width = sw * 100 SVG units = sw * ow canvas px
        case ObjectShape.CIRCLE:
        case ObjectShape.RING: {
            const halfSW = sw * 50;
            const r = isHollow
                ? Math.max(0.5, (50 - halfSW) / 100 * ow)
                : 49 / 100 * ow;
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            if (isHollow) {
                ctx.strokeStyle = hex;
                ctx.lineWidth   = sw * ow;
                ctx.stroke();
            } else {
                ctx.fillStyle = hex;
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        // ── RECTANGLE / FRAME ─────────────────────────────────────────────────
        // SVG hollow: rect path inset by halfSW, stroke-width = sw*100 units.
        // Outer stroke edge is at the container boundary; inner edge at sw*ow.
        case ObjectShape.RECTANGLE:
        case ObjectShape.FRAME: {
            if (isHollow) {
                const lineW = sw * Math.min(ow, oh);
                const ins   = lineW / 2;
                ctx.rect(-ow / 2 + ins, -oh / 2 + ins, ow - 2 * ins, oh - 2 * ins);
                ctx.strokeStyle = hex;
                ctx.lineWidth   = lineW;
                ctx.stroke();
            } else {
                ctx.rect(-ow / 2, -oh / 2, ow, oh);
                ctx.fillStyle = hex;
                ctx.fill();
            }
            ctx.restore();
            return;
        }

        // ── TRIANGLE ─────────────────────────────────────────────────────────
        // SVG: polygon points="50,5 5,95 95,95"
        case ObjectShape.TRIANGLE: {
            const pts = [[50,5],[5,95],[95,95]];
            ctx.moveTo(lx(pts[0][0]), ly(pts[0][1]));
            for (let i = 1; i < pts.length; i++) ctx.lineTo(lx(pts[i][0]), ly(pts[i][1]));
            ctx.closePath();
            break;
        }

        // ── DIAMOND ───────────────────────────────────────────────────────────
        // SVG: polygon points="50,0 100,50 50,100 0,50"
        case ObjectShape.DIAMOND: {
            const pts = [[50,0],[100,50],[50,100],[0,50]];
            ctx.moveTo(lx(pts[0][0]), ly(pts[0][1]));
            for (let i = 1; i < pts.length; i++) ctx.lineTo(lx(pts[i][0]), ly(pts[i][1]));
            ctx.closePath();
            break;
        }

        // ── 5-POINT STAR ──────────────────────────────────────────────────────
        // SVG: polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35"
        case ObjectShape.STAR: {
            const pts = [[50,5],[61,35],[98,35],[68,57],[79,91],[50,70],[21,91],[32,57],[2,35],[39,35]];
            ctx.moveTo(lx(pts[0][0]), ly(pts[0][1]));
            for (let i = 1; i < pts.length; i++) ctx.lineTo(lx(pts[i][0]), ly(pts[i][1]));
            ctx.closePath();
            break;
        }

        // ── 6-POINT STAR ──────────────────────────────────────────────────────
        // SVG: two polygons — "50,5 15,75 85,75" and "50,95 15,25 85,25"
        case ObjectShape.SIX_POINT_STAR: {
            const t1 = [[50,5],[15,75],[85,75]];
            ctx.moveTo(lx(t1[0][0]), ly(t1[0][1]));
            for (let i = 1; i < t1.length; i++) ctx.lineTo(lx(t1[i][0]), ly(t1[i][1]));
            ctx.closePath();
            const t2 = [[50,95],[15,25],[85,25]];
            ctx.moveTo(lx(t2[0][0]), ly(t2[0][1]));
            for (let i = 1; i < t2.length; i++) ctx.lineTo(lx(t2[i][0]), ly(t2[i][1]));
            ctx.closePath();
            break;
        }

        // ── HEART ─────────────────────────────────────────────────────────────
        // Replicates SVG path exactly:
        // "M50 85 C50 85 10 55 10 30  C10 15 25 5 40 5  C50 5 50 15 50 15
        //  C50 15 50 5 60 5  C75 5 90 15 90 30  C90 55 50 85 50 85 Z"
        case ObjectShape.HEART: {
            ctx.moveTo(lx(50), ly(85));
            ctx.bezierCurveTo(lx(50), ly(85), lx(10), ly(55), lx(10), ly(30));
            ctx.bezierCurveTo(lx(10), ly(15), lx(25), ly(5),  lx(40), ly(5));
            ctx.bezierCurveTo(lx(50), ly(5),  lx(50), ly(15), lx(50), ly(15));
            ctx.bezierCurveTo(lx(50), ly(15), lx(50), ly(5),  lx(60), ly(5));
            ctx.bezierCurveTo(lx(75), ly(5),  lx(90), ly(15), lx(90), ly(30));
            ctx.bezierCurveTo(lx(90), ly(55), lx(50), ly(85), lx(50), ly(85));
            ctx.closePath();
            break;
        }

        // ── ARROW ─────────────────────────────────────────────────────────────
        // SVG: polygon points="50,5 5,50 25,50 25,95 75,95 75,50 95,50"
        case ObjectShape.ARROW: {
            const pts = [[50,5],[5,50],[25,50],[25,95],[75,95],[75,50],[95,50]];
            ctx.moveTo(lx(pts[0][0]), ly(pts[0][1]));
            for (let i = 1; i < pts.length; i++) ctx.lineTo(lx(pts[i][0]), ly(pts[i][1]));
            ctx.closePath();
            break;
        }

        // ── TEXT ──────────────────────────────────────────────────────────────
        // Draw the actual glyph using canvas text API — the only truly accurate
        // way to measure character ink coverage.
        // SVG uses: fontSize=88, textAnchor=middle, dominantBaseline=middle
        case ObjectShape.TEXT: {
            const fontSize = Math.min(ow, oh) * 0.88;
            ctx.font             = `900 ${fontSize}px "Arial Black", Arial, sans-serif`;
            ctx.textAlign        = 'center';
            ctx.textBaseline     = 'middle';
            ctx.fillStyle        = hex;
            ctx.fillText(obj.char ?? '?', 0, 0);
            ctx.restore();
            return;
        }

        // ── DEFAULT (circle fallback) ──────────────────────────────────────────
        default: {
            ctx.arc(0, 0, ow / 2 * 0.49, 0, Math.PI * 2);
            break;
        }
    }

    if (isHollow) {
        ctx.strokeStyle = hex;
        ctx.lineWidth   = sw * Math.min(ow, oh);
        ctx.stroke();
    } else {
        ctx.fillStyle = hex;
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Render all objects onto an offscreen canvas (same draw order as React),
 * then read every pixel and classify its colour.
 * Returns per-colour totals and per-row (Y) distribution for the sweep animation.
 */
function sampleViaCanvas(
    objects: GameObject[],
    SX: number,
    SY: number,
): { raw: Record<ObjectColor, number>; vDist: Record<ObjectColor, number[]> } {
    const canvas  = document.createElement('canvas');
    canvas.width  = SX;
    canvas.height = SY;
    const ctx = canvas.getContext('2d')!;

    // White background — matches the board's bg-white CSS class
    ctx.fillStyle = COLOR_HEX[ObjectColor.WHITE];
    ctx.fillRect(0, 0, SX, SY);

    // Draw objects in array order: objects[0] = largest bounding box = behind,
    // objects[n-1] = smallest = in front.  This replicates React's render order
    // where each subsequent element sits on top via position:absolute + zIndex.
    for (const obj of objects) {
        drawObjOnCanvas(ctx, obj, SX, SY);
    }

    const imageData = ctx.getImageData(0, 0, SX, SY);
    const data      = imageData.data; // RGBA, 4 bytes per pixel

    const raw: Record<ObjectColor, number> = {
        [ObjectColor.RED]: 0, [ObjectColor.BLUE]: 0,
        [ObjectColor.GREEN]: 0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0,
    };
    const vDist: Record<ObjectColor, number[]> = {
        [ObjectColor.RED]:    new Array(SY).fill(0),
        [ObjectColor.BLUE]:   new Array(SY).fill(0),
        [ObjectColor.GREEN]:  new Array(SY).fill(0),
        [ObjectColor.YELLOW]: new Array(SY).fill(0),
        [ObjectColor.WHITE]:  new Array(SY).fill(0),
    };

    for (let j = 0; j < SY; j++) {
        for (let i = 0; i < SX; i++) {
            const base  = (j * SX + i) * 4;
            const color = classifyPixel(data[base], data[base + 1], data[base + 2]);
            raw[color]++;
            vDist[color][j]++;
        }
    }

    return { raw, vDist };
}

// ── ROUND CONFIG ──────────────────────────────────────────────────────────────
export const generateRoundConfig = (level: number, currentCash: number): RoundConfig => {
    let targetCash = 1000;
    if      (level <= 10) targetCash = 1000;
    else if (level <= 20) targetCash = 20000;
    else if (level <= 30) targetCash = 500000;
    else if (level <= 40) targetCash = 12500000;
    else                  targetCash = 312500000;

    const targetColor = TARGET_COLORS[Math.floor(Math.random() * 4)];
    const isClassified = level > 5 && Math.random() > 0.4;
    return { level, targetCash, duration: 3000, targetColor, targetArea: 0, isClassified };
};

// ── UTILITIES ─────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function rnd(a: number, b: number) { return a + Math.random() * (b - a); }
function rndInt(a: number, b: number) { return Math.floor(rnd(a, b + 0.999)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function solid(
    id: string, x: number, y: number, w: number, h: number,
    color: ObjectColor, shape: ObjectShape, rotation = 0,
): GameObject {
    return { id, x, y, w, h, rotation, color, shape, hollow: false, zIndex: 0, area: 0 };
}
function hollow(
    id: string, x: number, y: number, w: number, h: number,
    color: ObjectColor, shape: ObjectShape, rotation = 0, sw = 0.15,
): GameObject {
    return { id, x, y, w, h, rotation, color, shape, hollow: true, strokeWidth: sw, zIndex: 0, area: 0 };
}

// Shapes that work well as dense tile-grid cells (each distinct look)
const TILE_SHAPES = [
    ObjectShape.RECTANGLE,
    ObjectShape.CIRCLE,
    ObjectShape.DIAMOND,
];

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 1 – REGULAR GRID
// ─────────────────────────────────────────────────────────────────────────────
function genRegularGrid(): GameObject[] {
    const shape = pick([
        ObjectShape.CIRCLE,    ObjectShape.DIAMOND,
        ObjectShape.TRIANGLE,  ObjectShape.STAR,
        ObjectShape.RECTANGLE, ObjectShape.HEART,
        ObjectShape.ARROW,     ObjectShape.SIX_POINT_STAR,
    ]);
    const useHollow = Math.random() < 0.30;
    const sw = rnd(0.12, 0.22);

    const cellSize = rnd(6.5, 14);
    const step     = cellSize * rnd(1.08, 1.30);

    const pattern    = rndInt(0, 3);
    const colorOrder = shuffle([0, 1, 2, 3]);

    const objs: GameObject[] = [];
    let idx = 0;
    for (let row = -1; row * step < 105; row++) {
        for (let c = -1; c * step < 105; c++) {
            const x = c * step;
            const y = row * step;
            let ci: number;
            switch (pattern) {
                case 0:  ci = ((c   % 4) + 4) % 4; break;
                case 1:  ci = ((row % 4) + 4) % 4; break;
                case 2:  ci = (((c + row)   % 4) + 4) % 4; break;
                default: ci = (((c * 2 + row) % 4) + 4) % 4; break;
            }
            const color = TARGET_COLORS[colorOrder[ci]];
            const rot   = rnd(-12, 12);

            if (useHollow) {
                objs.push(hollow(`g-${idx++}`, x, y, cellSize, cellSize, color, shape, rot, sw));
            } else {
                objs.push(solid(`g-${idx++}`, x, y, cellSize, cellSize, color, shape, rot));
            }
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 2 – CONCENTRIC NESTED
// ─────────────────────────────────────────────────────────────────────────────
function genConcentricNested(): GameObject[] {
    const shape = pick([
        ObjectShape.CIRCLE,  ObjectShape.HEART,
        ObjectShape.DIAMOND, ObjectShape.STAR,
        ObjectShape.RECTANGLE, ObjectShape.SIX_POINT_STAR,
    ]);
    const layers     = rndInt(5, 9);
    const cx         = rnd(30, 70);
    const cy         = rnd(30, 70);
    const maxSize    = rnd(65, 96);
    const shrink     = rnd(0.60, 0.78);
    const colorStart = rndInt(0, 3);
    const baseRot  = rnd(0, 360);
    const rotStep  = rnd(2, 12);

    const objs: GameObject[] = [];
    let size = maxSize;
    for (let l = 0; l < layers; l++) {
        objs.push(solid(
            `cn-${l}`,
            cx - size / 2, cy - size / 2, size, size,
            TARGET_COLORS[(colorStart + l) % 4], shape,
            baseRot + l * rotStep,
        ));
        size *= shrink;
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 3 – SCATTERED SAME SHAPE
// ─────────────────────────────────────────────────────────────────────────────
function genScattered(): GameObject[] {
    const candidates = [
        { shape: ObjectShape.CIRCLE,       useHollow: false },
        { shape: ObjectShape.CIRCLE,       useHollow: true  },
        { shape: ObjectShape.RING,         useHollow: true  },
        { shape: ObjectShape.DIAMOND,      useHollow: false },
        { shape: ObjectShape.DIAMOND,      useHollow: true  },
        { shape: ObjectShape.STAR,         useHollow: false },
        { shape: ObjectShape.HEART,        useHollow: false },
        { shape: ObjectShape.TRIANGLE,     useHollow: false },
        { shape: ObjectShape.SIX_POINT_STAR, useHollow: false },
        { shape: ObjectShape.ARROW,        useHollow: false },
    ];
    const { shape, useHollow } = pick(candidates);
    const count = rndInt(28, 52);
    const sw    = rnd(0.10, 0.20);
    const colors = shuffle([...TARGET_COLORS]);

    const objs: GameObject[] = [];
    for (let i = 0; i < count; i++) {
        const size = Math.max(3, rnd(4, 24) * Math.pow(Math.random(), 0.5));
        const x    = rnd(-3, 100 - size + 3);
        const y    = rnd(-3, 100 - size + 3);
        const color = colors[i % 4];
        const rot  = rnd(0, 360);

        if (useHollow) {
            objs.push(hollow(`sc-${i}`, x, y, size, size, color, shape, rot, sw));
        } else {
            objs.push(solid(`sc-${i}`, x, y, size, size, color, shape, rot));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 4 – BOLD RECTANGULAR BLOCKS (Mondrian-inspired)
// ─────────────────────────────────────────────────────────────────────────────
function genBoldBlocks(): GameObject[] {
    const numHCuts = rndInt(1, 3);
    const numVCuts = rndInt(1, 3);

    const hPts = Array.from({ length: numHCuts }, () => rnd(15, 85)).sort((a, b) => a - b);
    const vPts = Array.from({ length: numVCuts }, () => rnd(15, 85)).sort((a, b) => a - b);

    const ys = [0, ...hPts, 100];
    const xs = [0, ...vPts, 100];

    const cells: { x: number; y: number; w: number; h: number }[] = [];
    for (let r = 0; r < ys.length - 1; r++) {
        for (let c = 0; c < xs.length - 1; c++) {
            cells.push({
                x: xs[c], y: ys[r],
                w: xs[c + 1] - xs[c],
                h: ys[r + 1] - ys[r],
            });
        }
    }

    const shuffledCells = shuffle(cells);
    const colorArea: Record<ObjectColor, number> = {
        [ObjectColor.RED]:    0, [ObjectColor.BLUE]:   0,
        [ObjectColor.GREEN]:  0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0,
    };

    const objs: GameObject[] = [];
    shuffledCells.forEach((cell, i) => {
        let color: ObjectColor;
        if (i < 4) {
            color = TARGET_COLORS[i];
        } else {
            color = TARGET_COLORS.reduce((a, b) => colorArea[a] <= colorArea[b] ? a : b);
        }
        colorArea[color] += cell.w * cell.h;

        const gap = 1.0;
        objs.push(solid(
            `bb-${i}`,
            cell.x + gap / 2, cell.y + gap / 2,
            cell.w - gap,     cell.h - gap,
            color, ObjectShape.RECTANGLE, 0,
        ));
    });

    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 5 – PARALLEL STRIPES
// ─────────────────────────────────────────────────────────────────────────────
function genParallelStripes(): GameObject[] {
    const angleDeg   = pick([0, 30, 45, 60, 90]);
    const numStripes = rndInt(4, 9);
    const colors     = shuffle([...TARGET_COLORS]);

    const objs: GameObject[] = [];

    if (angleDeg === 0 || angleDeg === 90) {
        const stripeSize = 100 / numStripes;
        for (let i = 0; i < numStripes; i++) {
            const color = colors[i % 4];
            if (angleDeg === 0) {
                objs.push(solid(`ps-${i}`, 0, i * stripeSize, 100, stripeSize, color, ObjectShape.RECTANGLE));
            } else {
                objs.push(solid(`ps-${i}`, i * stripeSize, 0, stripeSize, 100, color, ObjectShape.RECTANGLE));
            }
        }
    } else {
        const shape    = pick([ObjectShape.CIRCLE, ObjectShape.DIAMOND, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE]);
        const cellSize = rnd(5.5, 11);
        const step     = cellSize * rnd(1.08, 1.25);
        const rad      = angleDeg * (Math.PI / 180);
        const cosA     = Math.cos(rad), sinA = Math.sin(rad);
        const bandW    = 100 / numStripes;

        let idx = 0;
        for (let row = -3; row * step < 110; row++) {
            for (let c = -3; c * step < 110; c++) {
                const x = c * step, y = row * step;
                const proj     = (x + cellSize / 2) * cosA + (y + cellSize / 2) * sinA;
                const bandIdx  = Math.floor(proj / bandW);
                const color    = colors[((bandIdx % 4) + 4) % 4];
                const rot      = angleDeg + rnd(-10, 10);
                objs.push(solid(`ps-${idx++}`, x, y, cellSize, cellSize, color, shape, rot));
            }
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 6 – LARGE OVERLAPPING SHAPES
// ─────────────────────────────────────────────────────────────────────────────
function genLargeOverlapping(): GameObject[] {
    const shape  = pick([
        ObjectShape.CIRCLE,      ObjectShape.HEART,
        ObjectShape.DIAMOND,     ObjectShape.STAR,
        ObjectShape.SIX_POINT_STAR, ObjectShape.TRIANGLE,
    ]);
    const colors  = shuffle([...TARGET_COLORS]);
    const numBig  = rndInt(4, 6);

    const objs: GameObject[] = [];

    for (let i = 0; i < numBig; i++) {
        const cx = rnd(25, 75);
        const cy = rnd(25, 75);
        const w  = rnd(32, 60);
        const h  = w * rnd(0.75, 1.30);
        objs.push(solid(
            `lo-${i}`, cx - w / 2, cy - h / 2, w, h,
            colors[i % 4], shape, rnd(0, 360),
        ));
    }

    const accentCount = rndInt(8, 18);
    for (let i = 0; i < accentCount; i++) {
        const w = rnd(3, 13);
        const h = w * rnd(0.8, 1.2);
        objs.push(solid(
            `lo-sm-${i}`,
            rnd(0, 100 - w), rnd(0, 100 - h), w, h,
            colors[rndInt(0, 3)], shape, rnd(0, 360),
        ));
    }

    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 7 – WAVY STRIPES
// Dense tile grid; colour follows a dual-sine-wave formula for organic ribbons.
// Uses a random tile shape so it looks visually distinct from other grid styles.
// ─────────────────────────────────────────────────────────────────────────────
function genWavyStripes(): GameObject[] {
    const tileShape  = pick(TILE_SHAPES);
    const cellSize   = rnd(4.5, 7.5);
    const step       = cellSize + 0.25;
    const colorOrder = shuffle([0, 1, 2, 3]);

    const numBands  = rndInt(4, 9);
    const bandW     = 100 / numBands;
    const waveAmp1  = rnd(5, 22);
    const waveFreq1 = rnd(0.03, 0.10);
    const waveAmp2  = rnd(1, 7);
    const waveFreq2 = rnd(0.07, 0.18);
    const direction = pick(['h', 'v', 'd'] as const);

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -2; row * step < 108; row++) {
        for (let c = -2; c * step < 108; c++) {
            const x  = c * step;
            const y  = row * step;
            const cx = x + cellSize / 2;
            const cy = y + cellSize / 2;

            let pos: number;
            if (direction === 'h') {
                pos = cy
                    + waveAmp1 * Math.sin(cx * waveFreq1)
                    + waveAmp2 * Math.sin(cx * waveFreq2 + 1.5);
            } else if (direction === 'v') {
                pos = cx
                    + waveAmp1 * Math.sin(cy * waveFreq1)
                    + waveAmp2 * Math.sin(cy * waveFreq2 + 0.7);
            } else {
                const diag = cx * 0.707 + cy * 0.707;
                const perp = cx * 0.707 - cy * 0.707;
                pos = diag + waveAmp1 * Math.sin(perp * waveFreq1 * 1.4);
            }

            const period     = bandW * 4;
            const normalized = ((pos % period) + period * 100) % period;
            const bandIdx    = Math.floor(normalized / bandW) % 4;
            const color      = TARGET_COLORS[colorOrder[bandIdx]];

            objs.push(solid(`wv-${idx++}`, x, y, cellSize, cellSize, color, tileShape));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 8 – RADIAL PIE / PINWHEEL
// Colour by angle from focal point. Random tile shape for visual variety.
// ─────────────────────────────────────────────────────────────────────────────
function genRadialPie(): GameObject[] {
    const tileShape  = pick(TILE_SHAPES);
    const cellSize   = rnd(4.5, 7.5);
    const step       = cellSize + 0.25;
    const colorOrder = shuffle([0, 1, 2, 3]);

    const numWedges = rndInt(4, 16);
    const cx        = rnd(28, 72);
    const cy        = rnd(28, 72);
    const twist     = rnd(-0.05, 0.05);
    const innerGap  = Math.random() < 0.25 ? rnd(6, 16) : 0;

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -2; row * step < 108; row++) {
        for (let c = -2; c * step < 108; c++) {
            const x  = c * step;
            const y  = row * step;
            const dx = x + cellSize / 2 - cx;
            const dy = y + cellSize / 2 - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < innerGap) continue;

            const angle        = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
            const twistedAngle = (angle + dist * twist + Math.PI * 40) % (Math.PI * 2);
            const wedgeIdx     = Math.floor(twistedAngle / (Math.PI * 2 / numWedges)) % 4;
            const color        = TARGET_COLORS[colorOrder[wedgeIdx]];

            objs.push(solid(`rp-${idx++}`, x, y, cellSize, cellSize, color, tileShape));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 9 – CONCENTRIC WAVE RINGS
// Colour by radial distance with optional wave. Random tile shape.
// ─────────────────────────────────────────────────────────────────────────────
function genConcentricWaveRings(): GameObject[] {
    const tileShape  = pick(TILE_SHAPES);
    const cellSize   = rnd(4.5, 7.0);
    const step       = cellSize + 0.25;
    const colorOrder = shuffle([0, 1, 2, 3]);

    const cx       = rnd(25, 75);
    const cy       = rnd(25, 75);
    const ringBand = rnd(5, 16);
    const waveAmp  = rnd(0, 5);
    const waveFreq = rndInt(3, 9);
    const squishX  = rnd(0.65, 1.35);

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -2; row * step < 108; row++) {
        for (let c = -2; c * step < 108; c++) {
            const x  = c * step;
            const y  = row * step;
            const dx = (x + cellSize / 2 - cx) * squishX;
            const dy = (y + cellSize / 2 - cy) / squishX;

            const angle  = Math.atan2(dy, dx);
            const dist   = Math.sqrt(dx * dx + dy * dy)
                         + waveAmp * Math.sin(angle * waveFreq);

            const period     = ringBand * 4;
            const normalized = ((dist % period) + period * 100) % period;
            const ringIdx    = Math.floor(normalized / ringBand) % 4;
            const color      = TARGET_COLORS[colorOrder[ringIdx]];

            objs.push(solid(`cr-${idx++}`, x, y, cellSize, cellSize, color, tileShape));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 10 – CHARACTER / TEXT GRID
// ─────────────────────────────────────────────────────────────────────────────
function genTextGrid(): GameObject[] {
    const CHARS = [
        'A', 'B', 'E', 'H', 'K', 'M', 'N', 'R', 'S', 'T', 'W', 'X',
        '3', '5', '6', '8', '+', '■', '●', '◆',
    ];
    const colorOrder = shuffle([0, 1, 2, 3]);
    const useGrid    = Math.random() < 0.6;
    const objs: GameObject[] = [];

    if (useGrid) {
        const cellSize = rnd(10, 16);
        const step     = cellSize * rnd(1.10, 1.25);
        const pattern  = rndInt(0, 2);
        const char     = pick(CHARS);
        let idx = 0;

        for (let row = -1; row * step < 108; row++) {
            for (let c = -1; c * step < 108; c++) {
                const x = c * step;
                const y = row * step;
                let ci: number;
                switch (pattern) {
                    case 0:  ci = ((c         % 4) + 4) % 4; break;
                    case 1:  ci = ((row        % 4) + 4) % 4; break;
                    default: ci = (((c + row)  % 4) + 4) % 4; break;
                }
                const color = TARGET_COLORS[colorOrder[ci]];
                const obj: GameObject = {
                    ...solid(`tx-${idx++}`, x, y, cellSize, cellSize, color, ObjectShape.TEXT),
                    char,
                };
                objs.push(obj);
            }
        }
    } else {
        const count = rndInt(22, 48);
        for (let i = 0; i < count; i++) {
            const size  = rnd(6, 22);
            const x     = rnd(-2, 98 - size);
            const y     = rnd(-2, 98 - size);
            const color = TARGET_COLORS[colorOrder[i % 4]];
            const char  = pick(CHARS);
            const rot   = rnd(0, 360);
            const obj: GameObject = {
                ...solid(`tx-${i}`, x, y, size, size, color, ObjectShape.TEXT, rot),
                char,
            };
            objs.push(obj);
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 11 – VORONOI MOSAIC
// Nearest-neighbour Voronoi colouring — organic amoeba-like colour regions.
// Uses larger cells so the region boundaries are clearly visible.
// ─────────────────────────────────────────────────────────────────────────────
function genVoronoi(): GameObject[] {
    const cellSize      = rnd(5.5, 9.0);   // slightly larger for more visible regions
    const step          = cellSize + 0.25;
    const colorOrder    = shuffle([0, 1, 2, 3]);
    const seedsPerColor = rndInt(2, 5);

    const seeds: { cx: number; cy: number; ci: number }[] = [];
    for (let c = 0; c < 4; c++) {
        for (let s = 0; s < seedsPerColor; s++) {
            seeds.push({ cx: rnd(5, 95), cy: rnd(5, 95), ci: c });
        }
    }

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -2; row * step < 108; row++) {
        for (let c = -2; c * step < 108; c++) {
            const x  = c * step;
            const y  = row * step;
            const cx = x + cellSize / 2;
            const cy = y + cellSize / 2;

            let minDist = Infinity, nearestCI = 0;
            for (const s of seeds) {
                const dx = cx - s.cx, dy = cy - s.cy;
                const d  = dx * dx + dy * dy;
                if (d < minDist) { minDist = d; nearestCI = s.ci; }
            }

            const color = TARGET_COLORS[colorOrder[nearestCI]];
            objs.push(solid(`vo-${idx++}`, x, y, cellSize, cellSize, color, ObjectShape.RECTANGLE));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 12 – STAGGERED DOT GRID (Halftone)
// ─────────────────────────────────────────────────────────────────────────────
function genStaggeredDots(): GameObject[] {
    const shape      = pick([ObjectShape.CIRCLE, ObjectShape.DIAMOND, ObjectShape.RECTANGLE]);
    const useHollow  = Math.random() < 0.25;
    const sw         = rnd(0.12, 0.22);
    const cellSize   = rnd(6, 12);
    const step       = cellSize * rnd(1.10, 1.30);
    const colorOrder = shuffle([0, 1, 2, 3]);
    const pattern    = rndInt(0, 2);

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -1; row * step < 108; row++) {
        const offsetX = (row % 2 === 0) ? 0 : step / 2;
        for (let c = -2; c * step < 115; c++) {
            const x  = c * step + offsetX;
            const y  = row * step;
            const sz = cellSize * rnd(0.82, 1.00);

            let ci: number;
            switch (pattern) {
                case 0:  ci = ((c        % 4) + 4) % 4; break;
                case 1:  ci = ((row      % 4) + 4) % 4; break;
                default: ci = (((c + row) % 4) + 4) % 4; break;
            }
            const color = TARGET_COLORS[colorOrder[ci]];

            if (useHollow) {
                objs.push(hollow(`sd-${idx++}`, x, y, sz, sz, color, shape, 0, sw));
            } else {
                objs.push(solid(`sd-${idx++}`, x, y, sz, sz, color, shape));
            }
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 13 – MIXED-SHAPE MOSAIC
// ─────────────────────────────────────────────────────────────────────────────
function genMixedShapes(): GameObject[] {
    const allShapes = shuffle([
        ObjectShape.CIRCLE,      ObjectShape.DIAMOND,
        ObjectShape.TRIANGLE,    ObjectShape.STAR,
        ObjectShape.HEART,       ObjectShape.RECTANGLE,
        ObjectShape.SIX_POINT_STAR, ObjectShape.ARROW,
    ]);
    const shapePool  = allShapes.slice(0, rndInt(3, 5));
    const useHollow  = Math.random() < 0.20;
    const sw         = rnd(0.12, 0.20);
    const cellSize   = rnd(7, 14);
    const step       = cellSize * rnd(1.10, 1.28);
    const colorOrder = shuffle([0, 1, 2, 3]);
    const pattern    = rndInt(0, 3);

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -1; row * step < 108; row++) {
        for (let c = -1; c * step < 108; c++) {
            const x     = c * step;
            const y     = row * step;
            const shape = shapePool[idx % shapePool.length];
            const rot   = rnd(-15, 15);

            let ci: number;
            switch (pattern) {
                case 0:  ci = ((c            % 4) + 4) % 4; break;
                case 1:  ci = ((row          % 4) + 4) % 4; break;
                case 2:  ci = (((c + row)    % 4) + 4) % 4; break;
                default: ci = (((c * 2 + row) % 4) + 4) % 4; break;
            }
            const color = TARGET_COLORS[colorOrder[ci]];

            if (useHollow) {
                objs.push(hollow(`ms-${idx++}`, x, y, cellSize, cellSize, color, shape, rot, sw));
            } else {
                objs.push(solid(`ms-${idx++}`, x, y, cellSize, cellSize, color, shape, rot));
            }
        }
    }
    return objs;
}

// ── GENERATOR ROTATION ────────────────────────────────────────────────────────
const ALL_GENERATORS: Array<() => GameObject[]> = [
    genRegularGrid,
    genConcentricNested,
    genScattered,
    genBoldBlocks,
    genParallelStripes,
    genLargeOverlapping,
    genWavyStripes,
    genRadialPie,
    genConcentricWaveRings,
    genTextGrid,
    genVoronoi,
    genStaggeredDots,
    genMixedShapes,
];

let _generatorQueue: Array<() => GameObject[]> = [];

function getNextGenerator(): () => GameObject[] {
    if (_generatorQueue.length === 0) {
        _generatorQueue = shuffle([...ALL_GENERATORS]);
    }
    return _generatorQueue.pop()!;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export const generateObjects = (
    config: RoundConfig,
    attempts = 0,
): { objects: GameObject[]; breakdown: Record<ObjectColor, number>; verticalDistribution: Record<ObjectColor, number[]> } => {

    const generator = getNextGenerator();
    const objects = generator();

    // ── ENSURE ALL COLOURS ARE PRESENT ───────────────────────────────────────
    const present = new Set(objects.map(o => o.color));
    TARGET_COLORS.forEach(c => {
        if (!present.has(c)) {
            objects.push(solid(`forced-${c}`, rnd(40, 50), rnd(40, 50), 8, 8, c, ObjectShape.CIRCLE));
        }
    });

    // ── DEPTH SORT ────────────────────────────────────────────────────────────
    // Larger bounding-box area → lower zIndex → drawn behind.
    objects.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    objects.forEach((o, i) => { o.zIndex = i; });

    // ── CANVAS PIXEL SAMPLING ─────────────────────────────────────────────────
    // 350×350 = 122,500 pixels.  Draw every object on an offscreen canvas
    // (same order and colours as on-screen), then read back pixel colours.
    // This is exact — no mathematical approximation of shape boundaries.
    const SX = 350, SY = 350, TOTAL = SX * SY;

    const { raw, vDist } = sampleViaCanvas(objects, SX, SY);

    // Convert to percentages
    const breakdown = {} as Record<ObjectColor, number>;
    for (const c of TARGET_COLORS) breakdown[c] = (raw[c] / TOTAL) * 100;
    breakdown[ObjectColor.WHITE] = (raw[ObjectColor.WHITE] / TOTAL) * 100;
    const whitePct = breakdown[ObjectColor.WHITE];

    // ── CONSTRAINT CHECK ──────────────────────────────────────────────────────
    const hasZeroArea = TARGET_COLORS.some(c => breakdown[c] < 0.5);
    if ((whitePct > 60 || hasZeroArea) && attempts < 6) {
        return generateObjects(config, attempts + 1);
    }

    return { objects, breakdown, verticalDistribution: vDist };
};
