import { GameObject, ObjectColor, ObjectShape, RoundConfig } from '../types';

const TARGET_COLORS = [ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW];

// ── POLYGON HIT-TEST HELPERS ─────────────────────────────────────────────────
function pointInPolygon(x: number, y: number, vertices: number[][]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i][0], yi = vertices[i][1];
        const xj = vertices[j][0], yj = vertices[j][1];
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

const POLY = {
    triangle:  [[0.5, 0.05], [0.05, 0.95], [0.95, 0.95]] as number[][],
    diamond:   [[0.5, 0],    [1, 0.5],     [0.5, 1],     [0, 0.5]] as number[][],
    star5: [
        [0.5, 0.05], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57],
        [0.79, 0.91], [0.5, 0.70], [0.21, 0.91], [0.32, 0.57],
        [0.02, 0.35], [0.39, 0.35],
    ] as number[][],
    arrow: [
        [0.5, 0.05], [0.05, 0.5],  [0.25, 0.5],
        [0.25, 0.95],[0.75, 0.95], [0.75, 0.5], [0.95, 0.5],
    ] as number[][],
    star6tri1: [[0.5, 0.05], [0.15, 0.75], [0.85, 0.75]] as number[][],
    star6tri2: [[0.5, 0.95], [0.15, 0.25], [0.85, 0.25]] as number[][],
};

// ── SOLID SHAPE HIT-TEST (normalised 0-1 coords) ──────────────────────────────
function isPointInSolidNorm(nx: number, ny: number, shape: ObjectShape): boolean {
    const cx = nx - 0.5, cy = ny - 0.5;
    const distSq = cx * cx + cy * cy;
    switch (shape) {
        case ObjectShape.RECTANGLE:
        case ObjectShape.FRAME:
            return true;
        case ObjectShape.CIRCLE:
        case ObjectShape.RING:
            return distSq <= 0.25;
        case ObjectShape.TRIANGLE:
            return pointInPolygon(nx, ny, POLY.triangle);
        case ObjectShape.DIAMOND:
            return pointInPolygon(nx, ny, POLY.diamond);
        case ObjectShape.STAR:
            return pointInPolygon(nx, ny, POLY.star5);
        case ObjectShape.ARROW:
            return pointInPolygon(nx, ny, POLY.arrow);
        case ObjectShape.SIX_POINT_STAR:
            return pointInPolygon(nx, ny, POLY.star6tri1) || pointInPolygon(nx, ny, POLY.star6tri2);
        case ObjectShape.HEART: {
            if (ny < 0.5) {
                if (nx < 0.5) return Math.pow(nx - 0.25, 2) + Math.pow(ny - 0.25, 2) <= 0.055;
                return Math.pow(nx - 0.75, 2) + Math.pow(ny - 0.25, 2) <= 0.055;
            }
            return ny <= 0.92 - Math.abs(nx - 0.5) * 1.6;
        }
        case ObjectShape.TEXT:
            return true; // full bounding box
        default:
            return distSq <= 0.25;
    }
}

// ── MAIN SHAPE HIT-TEST ───────────────────────────────────────────────────────
// Handles position, rotation and hollow subtraction.
function isPointInShape(px: number, py: number, obj: GameObject): boolean {
    let lx = px - obj.x;
    let ly = py - obj.y;

    if (obj.rotation) {
        const hx = obj.w / 2, hy = obj.h / 2;
        const rad = -obj.rotation * (Math.PI / 180);
        const cosR = Math.cos(rad), sinR = Math.sin(rad);
        const dx = lx - hx, dy = ly - hy;
        lx = dx * cosR - dy * sinR + hx;
        ly = dx * sinR + dy * cosR + hy;
    }

    const nx = lx / obj.w;
    const ny = ly / obj.h;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;

    if (!isPointInSolidNorm(nx, ny, obj.shape)) return false;
    if (!obj.hollow) return true;

    // Hollow: inner region uses the same shape scaled by (1 – 2·sw), centred at (0.5,0.5).
    const sw = Math.max(0.05, Math.min(0.45, obj.strokeWidth ?? 0.15));
    const innerScale = 1 - 2 * sw;
    if (innerScale <= 0) return true;

    const inx = (nx - sw) / innerScale;
    const iny = (ny - sw) / innerScale;
    if (inx < 0 || inx > 1 || iny < 0 || iny > 1) return true;
    return !isPointInSolidNorm(inx, iny, obj.shape);
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

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 1 – REGULAR GRID
// All cells the same shape, colours assigned by a simple position formula
// (column stripes / row stripes / diagonal / XOR). Sizes and gap vary each
// time so consecutive rounds look different. Optionally all hollow.
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

    // Color pattern: 0=col, 1=row, 2=diagonal, 3=double-diagonal
    const pattern = rndInt(0, 3);
    const colorOrder = shuffle([0, 1, 2, 3]); // which TARGET_COLOR maps to which index

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
// The same shape drawn 5-9 times, each smaller, all centred at one point.
// Colours cycle so each layer is a different colour. The painter's algorithm
// (large behind, small in front) produces the nested-heart / bullseye look.
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
    // Small per-layer rotation gives a sense of depth without clutter
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
// Many instances of one shape, randomly scattered. Size varies from tiny to
// medium. Either all solid OR all hollow (not mixed). White space visible.
// Like the scattered-rings card in Illusion.
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
        // Bias toward smaller sizes (power-law)
        const size = Math.max(3, rnd(4, 24) * Math.pow(Math.random(), 0.5));
        const x    = rnd(-3, 100 - size + 3);
        const y    = rnd(-3, 100 - size + 3);
        const color = colors[i % 4]; // cycle colours evenly
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
// STYLE 4 – BOLD RECTANGULAR BLOCKS
// Canvas subdivided into irregular rectangles (Mondrian-inspired). Each block
// is one solid colour; block sizes vary to make area estimation difficult.
// ─────────────────────────────────────────────────────────────────────────────
function genBoldBlocks(): GameObject[] {
    // Horizontal cuts define row heights; vertical cuts define column widths.
    const numHCuts = rndInt(1, 3); // 2-4 rows
    const numVCuts = rndInt(1, 3); // 2-4 cols

    const hPts = Array.from({ length: numHCuts }, () => rnd(15, 85)).sort((a, b) => a - b);
    const vPts = Array.from({ length: numVCuts }, () => rnd(15, 85)).sort((a, b) => a - b);

    const ys = [0, ...hPts, 100];
    const xs = [0, ...vPts, 100];

    // Collect all cells
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

    // Assign colours so each appears at least once; balance by area thereafter
    const shuffledCells = shuffle(cells);
    const colorArea: Record<ObjectColor, number> = {
        [ObjectColor.RED]:    0, [ObjectColor.BLUE]:   0,
        [ObjectColor.GREEN]:  0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0,
    };

    const objs: GameObject[] = [];
    shuffledCells.forEach((cell, i) => {
        // First 4 cells: one of each colour; after that: pick least-covered
        let color: ObjectColor;
        if (i < 4) {
            color = TARGET_COLORS[i];
        } else {
            color = TARGET_COLORS.reduce((a, b) => colorArea[a] <= colorArea[b] ? a : b);
        }
        colorArea[color] += cell.w * cell.h;

        const gap = 1.0; // thin gap between blocks
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
// Bold parallel stripes in 4 colours. Axis-aligned (0° or 90°) or diagonal
// (30°, 45°, 60°). All shapes in the stripe are the same type.
// ─────────────────────────────────────────────────────────────────────────────
function genParallelStripes(): GameObject[] {
    const angleDeg  = pick([0, 30, 45, 60, 90]);
    const numStripes = rndInt(4, 9);        // total stripes (cycles through 4 colours)
    const colors     = shuffle([...TARGET_COLORS]);

    const objs: GameObject[] = [];

    if (angleDeg === 0 || angleDeg === 90) {
        // ── Axis-aligned: simple solid rectangles ────────────────────────────
        const stripeSize = 100 / numStripes;
        for (let i = 0; i < numStripes; i++) {
            const color = colors[i % 4];
            if (angleDeg === 0) { // horizontal bands
                objs.push(solid(`ps-${i}`, 0, i * stripeSize, 100, stripeSize, color, ObjectShape.RECTANGLE));
            } else {              // vertical bands
                objs.push(solid(`ps-${i}`, i * stripeSize, 0, stripeSize, 100, color, ObjectShape.RECTANGLE));
            }
        }
    } else {
        // ── Diagonal: dense grid of one shape, coloured by stripe band ───────
        // Shape fills each grid cell; colour is determined by which diagonal
        // band the cell's centre falls in — exactly like the Illusion card.
        const shape    = pick([ObjectShape.CIRCLE, ObjectShape.DIAMOND, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE]);
        const cellSize = rnd(5.5, 11);
        const step     = cellSize * rnd(1.08, 1.25);
        const rad      = angleDeg * (Math.PI / 180);
        const cosA     = Math.cos(rad), sinA = Math.sin(rad);
        // Stripe bandwidth in projection units (width of each colour band)
        const bandW    = 100 / numStripes;

        let idx = 0;
        for (let row = -3; row * step < 110; row++) {
            for (let c = -3; c * step < 110; c++) {
                const x = c * step, y = row * step;
                // Project cell centre onto the stripe normal direction
                const proj     = (x + cellSize / 2) * cosA + (y + cellSize / 2) * sinA;
                const bandIdx  = Math.floor(proj / bandW);
                const color    = colors[((bandIdx % 4) + 4) % 4];
                // Align rotation to stripe direction for a cleaner look
                const rot      = angleDeg + rnd(-10, 10);
                objs.push(solid(`ps-${idx++}`, x, y, cellSize, cellSize, color, shape, rot));
            }
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 6 – LARGE OVERLAPPING SHAPES
// 4-6 large shapes of ONE type, one colour each, heavily overlapping near
// the canvas centre. A handful of smaller accents of the same shape.
// Like the organic-blob cards in Illusion — simple but deceptive.
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

    // Large shapes — clustered around centre with some random spread
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

    // Small accents of the same shape scattered everywhere
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
// Dense grid of small cells coloured by a dual-sine-wave formula.
// The interference between two waves with different frequencies creates the
// same organic ribbon look seen on real Illusion cards — but the boundaries
// appear straight while the actual colour percentages deceive the eye.
// ─────────────────────────────────────────────────────────────────────────────
function genWavyStripes(): GameObject[] {
    const cellSize   = rnd(4.5, 7.5);
    const step       = cellSize + 0.25;
    const colorOrder = shuffle([0, 1, 2, 3]);

    const numBands  = rndInt(4, 9);       // full colour cycles across canvas
    const bandW     = 100 / numBands;
    const waveAmp1  = rnd(5, 22);         // primary wave amplitude (% units)
    const waveFreq1 = rnd(0.03, 0.10);
    const waveAmp2  = rnd(1, 7);          // secondary wave (creates interference)
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

            // Position along the band axis, perturbed by the wave function
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

            objs.push(solid(`wv-${idx++}`, x, y, cellSize, cellSize, color, ObjectShape.RECTANGLE));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 8 – RADIAL PIE / PINWHEEL
// Each cell is coloured by its angle from a focal point, creating pie-slice
// or spiral patterns. The optional twist parameter morphs a clean pie into a
// pinwheel — a classic Illusion card motif.
// ─────────────────────────────────────────────────────────────────────────────
function genRadialPie(): GameObject[] {
    const cellSize   = rnd(4.5, 7.5);
    const step       = cellSize + 0.25;
    const colorOrder = shuffle([0, 1, 2, 3]);

    const numWedges = rndInt(4, 16);            // total angular wedges
    const cx        = rnd(28, 72);
    const cy        = rnd(28, 72);
    const twist     = rnd(-0.05, 0.05);         // spiral coefficient (0 = flat pie)
    const innerGap  = Math.random() < 0.25 ? rnd(6, 16) : 0; // optional blank centre

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

            objs.push(solid(`rp-${idx++}`, x, y, cellSize, cellSize, color, ObjectShape.RECTANGLE));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 9 – CONCENTRIC WAVE RINGS
// Distance from a focal point determines the colour band, with an optional
// angular wave that turns clean circles into flower-petal or star-ripple rings.
// The squish ratio makes elliptical variants for added visual variety.
// ─────────────────────────────────────────────────────────────────────────────
function genConcentricWaveRings(): GameObject[] {
    const cellSize   = rnd(4.5, 7.0);
    const step       = cellSize + 0.25;
    const colorOrder = shuffle([0, 1, 2, 3]);

    const cx       = rnd(25, 75);
    const cy       = rnd(25, 75);
    const ringBand = rnd(5, 16);            // colour band width (% units)
    const waveAmp  = rnd(0, 5);            // angular perturbation amplitude
    const waveFreq = rndInt(3, 9);         // petal count when waveAmp > 0
    const squishX  = rnd(0.65, 1.35);     // ellipse aspect ratio

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

            objs.push(solid(`cr-${idx++}`, x, y, cellSize, cellSize, color, ObjectShape.RECTANGLE));
        }
    }
    return objs;
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE 10 – CHARACTER / TEXT GRID
// A regular grid (or loose scatter) of alphanumeric characters, each solid-
// filled in one of the four colours. The research notes that real Illusion
// cards include "occasional letter or number" — this makes that a full style.
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
        const pattern  = rndInt(0, 2); // 0=cols, 1=rows, 2=diagonal
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
        // Scattered characters of varying sizes
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
// Scatter several "seed" points per colour.  Every grid cell is coloured by
// whichever seed is closest (nearest-neighbour / Voronoi rule).  This creates
// organic, amoeba-like blobs with no clear boundaries — impossible to estimate
// by tracing outlines, forcing pure area judgement.
// ─────────────────────────────────────────────────────────────────────────────
function genVoronoi(): GameObject[] {
    const cellSize      = rnd(4.5, 7.5);
    const step          = cellSize + 0.25;
    const colorOrder    = shuffle([0, 1, 2, 3]);
    const seedsPerColor = rndInt(2, 5);

    // Place seed points for each colour
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

            // Find nearest seed (squared distance — no sqrt needed for ordering)
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
// Alternating rows are offset by half a column width, producing hexagonal
// close-packing reminiscent of classic halftone printing.  Circles, diamonds
// or rectangles tile the canvas; colour follows col / row / diagonal striping.
// Slight per-cell size variation gives a hand-drawn, organic quality.
// ─────────────────────────────────────────────────────────────────────────────
function genStaggeredDots(): GameObject[] {
    const shape      = pick([ObjectShape.CIRCLE, ObjectShape.DIAMOND, ObjectShape.RECTANGLE]);
    const useHollow  = Math.random() < 0.25;
    const sw         = rnd(0.12, 0.22);
    const cellSize   = rnd(6, 12);
    const step       = cellSize * rnd(1.10, 1.30);
    const colorOrder = shuffle([0, 1, 2, 3]);
    const pattern    = rndInt(0, 2); // 0=cols, 1=rows, 2=diagonal

    const objs: GameObject[] = [];
    let idx = 0;

    for (let row = -1; row * step < 108; row++) {
        const offsetX = (row % 2 === 0) ? 0 : step / 2;
        for (let c = -2; c * step < 115; c++) {
            const x  = c * step + offsetX;
            const y  = row * step;
            // Slightly vary size for visual texture
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
// A regular grid where each cell is independently drawn with one of 3-4 chosen
// shapes, cycling through the pool.  Colour follows a position rule (col / row
// / diagonal / double-diagonal).  Mixing shapes in one card prevents the eye
// from grouping by shape — only area comparison works.  Optionally all hollow.
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

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────
export const generateObjects = (
    config: RoundConfig,
    attempts = 0,
): { objects: GameObject[]; breakdown: Record<ObjectColor, number>; verticalDistribution: Record<ObjectColor, number[]> } => {

    const generator = pick([
        genRegularGrid,
        genConcentricNested,
        genScattered,
        genBoldBlocks,
        genParallelStripes,
        genLargeOverlapping,
        genWavyStripes,          // dual-sine wavy ribbons
        genRadialPie,            // pie/pinwheel radial slices
        genConcentricWaveRings,  // distance-based rings with petal waves
        genTextGrid,             // character/letter grid
        genVoronoi,              // NEW — nearest-seed organic blobs
        genStaggeredDots,        // NEW — hex-offset halftone dot grid
        genMixedShapes,          // NEW — multi-shape mosaic, colour by position
    ]);
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
    // For concentric shapes this produces the correct nested look.
    objects.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    objects.forEach((o, i) => { o.zIndex = i; });

    // ── PIXEL-ACCURATE COLOUR SAMPLING ────────────────────────────────────────
    // 350×350 = 122 500 samples. Each sample finds the topmost visible object.
    // For hollow objects the interior is transparent (falls through to whatever
    // is underneath, exactly matching what the player sees on screen).
    const SX = 350, SY = 350, TOTAL = SX * SY;
    const stepX = 100 / SX, stepY = 100 / SY;

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

    for (let i = 0; i < SX; i++) {
        const px = i * stepX + stepX / 2;
        for (let j = 0; j < SY; j++) {
            const py = j * stepY + stepY / 2;

            // Iterate from front (highest zIndex = last in sorted array) to back.
            let hitColor: ObjectColor = ObjectColor.WHITE;
            for (let k = objects.length - 1; k >= 0; k--) {
                if (isPointInShape(px, py, objects[k])) {
                    hitColor = objects[k].color;
                    break;
                }
            }
            raw[hitColor]++;
            vDist[hitColor][j]++;
        }
    }

    // Convert to percentages
    const breakdown = {} as Record<ObjectColor, number>;
    for (const c of TARGET_COLORS) breakdown[c] = (raw[c] / TOTAL) * 100;
    const whitePct = (raw[ObjectColor.WHITE] / TOTAL) * 100;

    // ── CONSTRAINT CHECK ──────────────────────────────────────────────────────
    const hasZeroArea = TARGET_COLORS.some(c => breakdown[c] < 0.5);
    if ((whitePct > 60 || hasZeroArea) && attempts < 6) {
        return generateObjects(config, attempts + 1);
    }

    return { objects, breakdown, verticalDistribution: vDist };
};
