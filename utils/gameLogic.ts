import { GameObject, ObjectColor, ObjectShape, RoundConfig } from '../types';

const TARGET_COLORS = [ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW];
const CHARS = ['A', 'B', 'C', 'X', 'Y', 'Z', '7', '8', '9', '?', '!', '$', '%', '&', '#', 'Q', 'R', 'K'];

// 5x5 Bitmaps for coarse hit testing of text shapes.
const CHAR_BITMAPS: Record<string, number[]> = {
    'A': [0,1,1,1,0, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 1,0,0,0,1],
    'B': [1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0],
    'C': [0,1,1,1,1, 1,1,0,0,0, 1,0,0,0,0, 1,1,0,0,0, 0,1,1,1,1],
    'X': [1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,1,0,1,0, 1,0,0,0,1],
    'Y': [1,0,0,0,1, 0,1,0,1,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0],
    'Z': [1,1,1,1,1, 0,0,0,1,0, 0,0,1,0,0, 0,1,0,0,0, 1,1,1,1,1],
    '7': [1,1,1,1,1, 0,0,0,0,1, 0,0,0,1,0, 0,0,1,0,0, 0,0,1,0,0],
    '8': [0,1,1,1,0, 1,0,0,0,1, 0,1,1,1,0, 1,0,0,0,1, 0,1,1,1,0],
    '9': [0,1,1,1,0, 1,0,0,0,1, 0,1,1,1,1, 0,0,0,0,1, 0,1,1,1,0],
    '?': [0,1,1,1,0, 1,0,0,0,1, 0,0,1,1,0, 0,0,0,0,0, 0,0,1,0,0],
    '!': [0,0,1,0,0, 0,0,1,0,0, 0,0,1,0,0, 0,0,0,0,0, 0,0,1,0,0],
    '$': [0,0,1,0,0, 0,1,1,1,0, 1,0,1,0,0, 0,1,1,1,0, 0,0,1,0,0],
    '%': [1,1,0,0,1, 1,1,0,1,0, 0,0,1,0,0, 0,1,0,1,1, 1,0,0,1,1],
    '&': [0,1,1,0,0, 1,0,0,1,0, 0,1,1,0,0, 1,0,0,1,0, 0,1,1,0,1],
    '#': [0,1,0,1,0, 1,1,1,1,1, 0,1,0,1,0, 1,1,1,1,1, 0,1,0,1,0],
    'Q': [0,1,1,1,0, 1,0,0,0,1, 1,0,0,0,1, 1,0,0,1,1, 0,1,1,1,1],
    'R': [1,1,1,1,0, 1,0,0,0,1, 1,1,1,1,0, 1,0,1,0,0, 1,0,0,1,1],
    'K': [1,0,0,1,0, 1,0,1,0,0, 1,1,0,0,0, 1,0,1,0,0, 1,0,0,1,1],
};

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

const POLYGONS = {
    [ObjectShape.TRIANGLE]: [[0.5, 0.05], [0.05, 0.95], [0.95, 0.95]],
    [ObjectShape.DIAMOND]: [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]],
    [ObjectShape.STAR]: [
        [0.5, 0.05], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57],
        [0.79, 0.91], [0.5, 0.70], [0.21, 0.91], [0.32, 0.57],
        [0.02, 0.35], [0.39, 0.35]
    ],
    [ObjectShape.ARROW]: [
        [0.5, 0.05], [0.05, 0.5], [0.25, 0.5], [0.25, 0.95],
        [0.75, 0.95], [0.75, 0.5], [0.95, 0.5]
    ],
    [ObjectShape.SIX_POINT_STAR]: {
        tri1: [[0.5, 0.05], [0.15, 0.75], [0.85, 0.75]],
        tri2: [[0.5, 0.95], [0.15, 0.25], [0.85, 0.25]]
    }
};

function isPointInShape(x: number, y: number, obj: GameObject): boolean {
    let lx = x - obj.x;
    let ly = y - obj.y;

    if (obj.rotation) {
        const cx = obj.w / 2;
        const cy = obj.h / 2;
        const rad = -obj.rotation * (Math.PI / 180);
        const rx = (lx - cx) * Math.cos(rad) - (ly - cy) * Math.sin(rad) + cx;
        const ry = (lx - cx) * Math.sin(rad) + (ly - cy) * Math.cos(rad) + cy;
        lx = rx;
        ly = ry;
    }

    const nx = lx / obj.w;
    const ny = ly / obj.h;

    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;

    const cx = nx - 0.5;
    const cy = ny - 0.5;
    const distSq = cx*cx + cy*cy;

    switch (obj.shape) {
        case ObjectShape.RECTANGLE:
            return true;
        case ObjectShape.FRAME: {
            const thickness = obj.strokeWidth || 0.2;
            const innerMin = thickness;
            const innerMax = 1 - thickness;
            if (nx > innerMin && nx < innerMax && ny > innerMin && ny < innerMax) return false;
            return true;
        }
        case ObjectShape.CIRCLE: return distSq <= 0.25;
        case ObjectShape.RING: {
            const thickness = obj.strokeWidth || 0.2;
            const outerR = 0.5;
            const innerR = 0.5 - thickness;
            const dist = Math.sqrt(distSq);
            return dist <= outerR && dist >= innerR;
        }
        case ObjectShape.TRIANGLE: return pointInPolygon(nx, ny, POLYGONS[ObjectShape.TRIANGLE]);
        case ObjectShape.DIAMOND: return pointInPolygon(nx, ny, POLYGONS[ObjectShape.DIAMOND]);
        case ObjectShape.STAR: return pointInPolygon(nx, ny, POLYGONS[ObjectShape.STAR]);
        case ObjectShape.ARROW: return pointInPolygon(nx, ny, POLYGONS[ObjectShape.ARROW]);
        case ObjectShape.SIX_POINT_STAR: {
            const { tri1, tri2 } = POLYGONS[ObjectShape.SIX_POINT_STAR];
            return pointInPolygon(nx, ny, tri1) || pointInPolygon(nx, ny, tri2);
        }
        case ObjectShape.HEART: {
            if (ny < 0.25) {
                if (nx < 0.5) return Math.pow(nx - 0.25, 2) + Math.pow(ny - 0.25, 2) <= 0.05;
                return Math.pow(nx - 0.75, 2) + Math.pow(ny - 0.25, 2) <= 0.05;
            }
            if (ny >= 0.25) {
                const dx = Math.abs(nx - 0.5);
                return ny <= 0.85 - (dx * 1.5);
            }
            return false;
        }
        case ObjectShape.TEXT: {
            const char = obj.char || '?';
            const bitmap = CHAR_BITMAPS[char];
            if (!bitmap) return true;
            const gx = Math.floor(nx * 5);
            const gy = Math.floor(ny * 5);
            const idx = (Math.min(4, Math.max(0, gy)) * 5) + Math.min(4, Math.max(0, gx));
            return bitmap[idx] === 1;
        }
        default: return distSq <= 0.22;
    }
}

export const generateRoundConfig = (level: number, currentCash: number): RoundConfig => {
    let targetCash = 1000;
    if (level <= 10) targetCash = 1000;
    else if (level <= 20) targetCash = 20000;
    else if (level <= 30) targetCash = 500000;
    else if (level <= 40) targetCash = 12500000;
    else targetCash = 312500000;

    const duration = 3000;
    const targetColor = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
    const isClassified = level > 5 && Math.random() > 0.4;

    return { level, targetCash, duration, targetColor, targetArea: 0, isClassified };
};

// Shuffle an array in place (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export const generateObjects = (config: RoundConfig, attempts = 0): { objects: GameObject[], breakdown: Record<ObjectColor, number>, verticalDistribution: Record<ObjectColor, number[]> } => {
    const objects: GameObject[] = [];

    // Six Illusion-inspired art styles
    const styles = [
        'wave_interference',
        'radial_petals',
        'stripe_overlay',
        'mondrian_blocks',
        'scatter_bloom',
        'concentric_rings',
    ];
    const style = styles[Math.floor(Math.random() * styles.length)];

    // ── STYLE: Wave Interference ─────────────────────────────────────────────
    // Dense regular grid of shapes whose color is determined by overlapping
    // sinusoidal waves — produces moiré-like interference patterns.
    if (style === 'wave_interference') {
        const shapeChoices = [ObjectShape.CIRCLE, ObjectShape.DIAMOND, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE];
        const shape = shapeChoices[Math.floor(Math.random() * shapeChoices.length)];
        const cellSize = 7 + Math.random() * 4;      // 7–11 %
        const spacing  = cellSize * 1.25;

        // Two independent wave frequencies
        const f1 = 0.18 + Math.random() * 0.28;
        const f2 = 0.10 + Math.random() * 0.20;
        const f3 = 0.22 + Math.random() * 0.30;
        const f4 = 0.08 + Math.random() * 0.18;

        let idx = 0;
        for (let row = -1; row * spacing < 110; row++) {
            for (let col = -1; col * spacing < 110; col++) {
                const x = col * spacing;
                const y = row * spacing;
                // Interference value in [-2, 2]
                const v = Math.sin(col * f1 + row * f2) + Math.sin(col * f3 - row * f4);
                const colorIdx = Math.floor(((v + 2) / 4) * 4) % 4;
                const color = TARGET_COLORS[colorIdx];

                objects.push({
                    id: `wi-${idx++}`,
                    x, y, w: cellSize, h: cellSize,
                    rotation: Math.round(Math.random() * 3) * 90,
                    color, shape,
                    zIndex: 0, area: 0,
                });
            }
        }
    }

    // ── STYLE: Radial Petals (Mandala) ────────────────────────────────────────
    // Objects placed in angular wedge-segments radiating from a central point,
    // like a mandala or compass rose. Colour is determined by which "petal"
    // (angular slice) the position falls in.
    else if (style === 'radial_petals') {
        const cx = 50, cy = 50;
        const numPetals = [4, 6, 8][Math.floor(Math.random() * 3)];
        const maxR = 52;
        const numRings = 8;

        const shapeChoices = [ObjectShape.CIRCLE, ObjectShape.DIAMOND, ObjectShape.TRIANGLE, ObjectShape.STAR];
        const segShape = shapeChoices[Math.floor(Math.random() * shapeChoices.length)];

        // Assign colours to petals, cycling through the 4 target colours
        const colorOffset = Math.floor(Math.random() * 4);
        const petalColors: ObjectColor[] = [];
        for (let p = 0; p < numPetals; p++) {
            petalColors.push(TARGET_COLORS[(p + colorOffset) % 4]);
        }

        let idx = 0;
        for (let ring = 1; ring <= numRings; ring++) {
            const r = (ring / numRings) * maxR;
            const countInRing = numPetals * ring;
            const size = (maxR / numRings) * 0.90;

            for (let i = 0; i < countInRing; i++) {
                const angle = (i / countInRing) * Math.PI * 2;
                const petalIdx = Math.floor((angle / (Math.PI * 2)) * numPetals) % numPetals;
                const color = petalColors[petalIdx];
                const px = cx + r * Math.cos(angle);
                const py = cy + r * Math.sin(angle);

                objects.push({
                    id: `rp-${idx++}`,
                    x: px - size / 2,
                    y: py - size / 2,
                    w: size, h: size,
                    rotation: (angle * 180 / Math.PI) + Math.random() * 15 - 7.5,
                    color, shape: segShape,
                    zIndex: 0, area: 0,
                });
            }
        }
        // Centre medallion
        const centreColor = petalColors[colorOffset % numPetals];
        objects.push({ id: 'rp-centre', x: cx - 7, y: cy - 7, w: 14, h: 14, rotation: 0, color: centreColor, shape: ObjectShape.CIRCLE, zIndex: 1, area: 0 });
    }

    // ── STYLE: Stripe Overlay ─────────────────────────────────────────────────
    // Parallel diagonal stripe bands, each filled with shapes of one colour.
    // The stripe angle and width vary, making colour proportions hard to judge.
    else if (style === 'stripe_overlay') {
        const angle = (20 + Math.random() * 45) * (Math.PI / 180);
        const stripeWidth = 14 + Math.random() * 18;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const cellSize = 6 + Math.random() * 4;
        const spacing  = cellSize * 1.3;

        const shapeChoices = [ObjectShape.CIRCLE, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE, ObjectShape.DIAMOND, ObjectShape.STAR];
        const shape = shapeChoices[Math.floor(Math.random() * shapeChoices.length)];

        let idx = 0;
        for (let row = -4; row * spacing < 115; row++) {
            for (let col = -4; col * spacing < 115; col++) {
                const x = col * spacing;
                const y = row * spacing;
                const proj = x * cos + y * sin;
                const stripeIdx = Math.floor(proj / stripeWidth);
                const colorIdx = ((stripeIdx % 4) + 4) % 4;
                const jx = (Math.random() - 0.5) * spacing * 0.35;
                const jy = (Math.random() - 0.5) * spacing * 0.35;

                objects.push({
                    id: `so-${idx++}`,
                    x: x + jx, y: y + jy,
                    w: cellSize, h: cellSize,
                    rotation: stripeIdx * 45 + (Math.random() - 0.5) * 30,
                    color: TARGET_COLORS[colorIdx], shape,
                    zIndex: 0, area: 0,
                });
            }
        }
    }

    // ── STYLE: Mondrian Blocks ────────────────────────────────────────────────
    // Canvas subdivided into irregular rectangles à la Mondrian, each filled
    // solidly with one colour. Span sizes are randomised, colours balanced.
    else if (style === 'mondrian_blocks') {
        const baseGrid = 6 + Math.floor(Math.random() * 4); // 6–9
        const cellW = 100 / baseGrid;
        const cellH = 100 / baseGrid;
        const occupied: boolean[][] = Array.from({ length: baseGrid }, () => new Array(baseGrid).fill(false));

        // Track area per colour so we can balance them
        const colorArea: Record<ObjectColor, number> = {
            [ObjectColor.RED]: 0, [ObjectColor.BLUE]: 0,
            [ObjectColor.GREEN]: 0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0,
        };

        let objIdx = 0;
        for (let row = 0; row < baseGrid; row++) {
            for (let col = 0; col < baseGrid; col++) {
                if (occupied[row][col]) continue;

                const maxSW = Math.min(3, baseGrid - col);
                const maxSH = Math.min(3, baseGrid - row);
                let spanW = 1 + Math.floor(Math.random() * maxSW);
                let spanH = 1 + Math.floor(Math.random() * maxSH);

                // Verify all cells are free; fall back to 1×1 if not
                let allFree = true;
                outer: for (let r = row; r < row + spanH; r++) {
                    for (let c = col; c < col + spanW; c++) {
                        if (occupied[r][c]) { allFree = false; break outer; }
                    }
                }
                if (!allFree) { spanW = 1; spanH = 1; }

                // Mark cells occupied
                for (let r = row; r < row + spanH; r++)
                    for (let c = col; c < col + spanW; c++)
                        occupied[r][c] = true;

                // Assign the colour with the least area so far
                const color = TARGET_COLORS.reduce((a, b) => colorArea[a] <= colorArea[b] ? a : b);
                colorArea[color] += spanW * spanH;

                // Slight inset gap between blocks
                const gap = 1.2;
                objects.push({
                    id: `mb-${objIdx++}`,
                    x: col * cellW + gap / 2,
                    y: row * cellH + gap / 2,
                    w: spanW * cellW - gap,
                    h: spanH * cellH - gap,
                    rotation: 0,
                    color, shape: ObjectShape.RECTANGLE,
                    zIndex: 0, area: 0,
                });
            }
        }
    }

    // ── STYLE: Scatter Bloom ──────────────────────────────────────────────────
    // Several focal "bloom" clusters, each dominated by one colour. Shapes are
    // densest at the cluster centre and fade outward. A sparse background field
    // ties the clusters together.
    else if (style === 'scatter_bloom') {
        const numBlooms = 3 + Math.floor(Math.random() * 3);
        const shuffledColors = shuffle([...TARGET_COLORS]);

        const shapeChoices = [ObjectShape.CIRCLE, ObjectShape.STAR, ObjectShape.DIAMOND, ObjectShape.HEART, ObjectShape.TRIANGLE, ObjectShape.SIX_POINT_STAR];
        const bloomShape = shapeChoices[Math.floor(Math.random() * shapeChoices.length)];

        let idx = 0;
        for (let b = 0; b < numBlooms; b++) {
            const bcx = 15 + Math.random() * 70;
            const bcy = 15 + Math.random() * 70;
            const bloomColor = shuffledColors[b % shuffledColors.length];
            const count = 30 + Math.floor(Math.random() * 25);

            for (let i = 0; i < count; i++) {
                // Power-law distribution — concentrated near centre
                const r = Math.pow(Math.random(), 0.55) * 40;
                const a = Math.random() * Math.PI * 2;
                const bx = bcx + r * Math.cos(a);
                const by = bcy + r * Math.sin(a);
                const size = Math.max(2.5, 13 - r * 0.22);

                objects.push({
                    id: `sb-${idx++}`,
                    x: bx - size / 2,
                    y: by - size / 2,
                    w: size, h: size,
                    rotation: Math.random() * 360,
                    color: bloomColor, shape: bloomShape,
                    zIndex: 0, area: 0,
                });
            }
        }

        // Sparse background scatter
        for (let i = 0; i < 25; i++) {
            const size = 3 + Math.random() * 9;
            objects.push({
                id: `sb-bg-${i}`,
                x: Math.random() * (100 - size),
                y: Math.random() * (100 - size),
                w: size, h: size,
                rotation: Math.random() * 360,
                color: TARGET_COLORS[Math.floor(Math.random() * 4)],
                shape: bloomShape,
                zIndex: 0, area: 0,
            });
        }
    }

    // ── STYLE: Concentric Rings ───────────────────────────────────────────────
    // Several groups of concentric shapes sharing a common centre, creating an
    // eye-like or target-board composition. Layers alternate colour and shape.
    else {
        const groups = 4 + Math.floor(Math.random() * 5);
        const ringShapes = [ObjectShape.CIRCLE, ObjectShape.RING, ObjectShape.STAR, ObjectShape.DIAMOND, ObjectShape.FRAME];

        let idx = 0;
        for (let g = 0; g < groups; g++) {
            const gcx = 10 + Math.random() * 80;
            const gcy = 10 + Math.random() * 80;
            const layers = 4 + Math.floor(Math.random() * 4);
            let size = 35 + Math.random() * 25;
            const colorStart = Math.floor(Math.random() * 4);

            for (let l = 0; l < layers; l++) {
                const color = TARGET_COLORS[(colorStart + l) % 4];
                const shape = ringShapes[l % ringShapes.length];
                const strokeW = 0.15 + Math.random() * 0.15;

                objects.push({
                    id: `cr-${idx++}`,
                    x: gcx - size / 2,
                    y: gcy - size / 2,
                    w: size, h: size,
                    rotation: l * 22.5,
                    color, shape, strokeWidth: strokeW,
                    zIndex: -l,
                    area: 0,
                });
                size *= 0.62;
            }
        }
    }

    // ── FORCE ALL COLOURS to appear ──────────────────────────────────────────
    // Ensures constraint check passes by inserting a small marker for any missing colour.
    const presentColors = new Set(objects.map(o => o.color));
    TARGET_COLORS.forEach(c => {
        if (!presentColors.has(c)) {
            objects.push({
                id: `forced-${c}`,
                x: 38 + Math.random() * 24,
                y: 38 + Math.random() * 24,
                w: 12, h: 12, rotation: 0, color: c, shape: ObjectShape.CIRCLE,
                zIndex: 200, area: 0,
            });
        }
    });

    // ── DEPTH SORT ────────────────────────────────────────────────────────────
    // Larger objects draw first (behind); smaller objects draw last (in front).
    // For grid/stripe styles this is a no-op; for bloom/petals it adds depth.
    objects.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    objects.forEach((o, i) => { o.zIndex = i; });

    // ── EXACT PIXEL-SAMPLE CALCULATION ───────────────────────────────────────
    const breakdown: Record<ObjectColor, number> = {
        [ObjectColor.RED]: 0, [ObjectColor.BLUE]: 0,
        [ObjectColor.GREEN]: 0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0,
    };

    const SAMPLES_X = 350;
    const SAMPLES_Y = 350;
    const TOTAL_SAMPLES = SAMPLES_X * SAMPLES_Y;

    const verticalDistribution: Record<ObjectColor, number[]> = {
        [ObjectColor.RED]:    new Array(SAMPLES_Y).fill(0),
        [ObjectColor.BLUE]:   new Array(SAMPLES_Y).fill(0),
        [ObjectColor.GREEN]:  new Array(SAMPLES_Y).fill(0),
        [ObjectColor.YELLOW]: new Array(SAMPLES_Y).fill(0),
        [ObjectColor.WHITE]:  new Array(SAMPLES_Y).fill(0),
    };

    for (let i = 0; i < SAMPLES_X; i++) {
        for (let j = 0; j < SAMPLES_Y; j++) {
            const px = (i / SAMPLES_X) * 100 + (100 / SAMPLES_X) / 2;
            const py = (j / SAMPLES_Y) * 100 + (100 / SAMPLES_Y) / 2;

            let topObj: GameObject | null = null;
            for (let k = objects.length - 1; k >= 0; k--) {
                if (isPointInShape(px, py, objects[k])) {
                    topObj = objects[k];
                    break;
                }
            }

            if (topObj) {
                breakdown[topObj.color]++;
                verticalDistribution[topObj.color][j]++;
            } else {
                breakdown[ObjectColor.WHITE]++;
                verticalDistribution[ObjectColor.WHITE][j]++;
            }
        }
    }

    const resultBreakdown: Record<ObjectColor, number> = {} as Record<ObjectColor, number>;
    for (const c of TARGET_COLORS) {
        resultBreakdown[c] = (breakdown[c] / TOTAL_SAMPLES) * 100;
    }
    const whitePct = (breakdown[ObjectColor.WHITE] / TOTAL_SAMPLES) * 100;

    // ── CONSTRAINT CHECK ──────────────────────────────────────────────────────
    const hasZeroArea = TARGET_COLORS.some(c => resultBreakdown[c] < 0.5);

    if ((whitePct > 60 || hasZeroArea) && attempts < 6) {
        return generateObjects(config, attempts + 1);
    }

    return { objects, breakdown: resultBreakdown, verticalDistribution };
};
