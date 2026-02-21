import { GameObject, ObjectColor, ObjectShape, RoundConfig } from '../types';

const TARGET_COLORS = [ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW];

// ── POLYGON DEFINITIONS ───────────────────────────────────────────────────────
// Normalized [0,1] coordinates for each polygon shape.
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
    triangle:    [[0.5, 0.05], [0.05, 0.95], [0.95, 0.95]] as number[][],
    diamond:     [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]] as number[][],
    star5: [
        [0.5, 0.05], [0.61, 0.35], [0.98, 0.35], [0.68, 0.57],
        [0.79, 0.91], [0.5, 0.70], [0.21, 0.91], [0.32, 0.57],
        [0.02, 0.35], [0.39, 0.35],
    ] as number[][],
    arrow: [
        [0.5, 0.05], [0.05, 0.5], [0.25, 0.5],
        [0.25, 0.95], [0.75, 0.95], [0.75, 0.5], [0.95, 0.5],
    ] as number[][],
    star6tri1:   [[0.5, 0.05], [0.15, 0.75], [0.85, 0.75]] as number[][],
    star6tri2:   [[0.5, 0.95], [0.15, 0.25], [0.85, 0.25]] as number[][],
    pentagon: (() => {
        const pts: number[][] = [];
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            pts.push([0.5 + 0.48 * Math.cos(a), 0.5 + 0.48 * Math.sin(a)]);
        }
        return pts;
    })(),
    hexagon: (() => {
        const pts: number[][] = [];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            pts.push([0.5 + 0.48 * Math.cos(a), 0.5 + 0.48 * Math.sin(a)]);
        }
        return pts;
    })(),
    cross: [
        [0.33, 0], [0.67, 0], [0.67, 0.33], [1, 0.33], [1, 0.67],
        [0.67, 0.67], [0.67, 1], [0.33, 1], [0.33, 0.67], [0, 0.67],
        [0, 0.33], [0.33, 0.33],
    ] as number[][],
    parallelogram: [
        [0.25, 0], [1, 0], [0.75, 1], [0, 1],
    ] as number[][],
};

// ── SOLID SHAPE HIT TEST (normalized 0-1 coords) ─────────────────────────────
// Returns true if the point (nx,ny) is inside the solid version of the shape.
function isPointInSolidNorm(nx: number, ny: number, shape: ObjectShape): boolean {
    const cx = nx - 0.5;
    const cy = ny - 0.5;
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
            const dx = Math.abs(nx - 0.5);
            return ny <= 0.92 - dx * 1.6;
        }
        case ObjectShape.TEXT:
            // Treat text bounding box as full rectangle for hit-testing
            return true;
        default:
            return distSq <= 0.25;
    }
}

// ── MAIN HIT TEST ─────────────────────────────────────────────────────────────
// Applies position/rotation transform, then delegates to isPointInSolidNorm.
// For hollow objects it subtracts the inner region (scaled inner shape).
function isPointInShape(px: number, py: number, obj: GameObject): boolean {
    // Transform to local space (relative to object top-left)
    let lx = px - obj.x;
    let ly = py - obj.y;

    // Apply inverse rotation around the object's centre
    if (obj.rotation) {
        const hx = obj.w / 2;
        const hy = obj.h / 2;
        const rad = -obj.rotation * (Math.PI / 180);
        const cosR = Math.cos(rad);
        const sinR = Math.sin(rad);
        const dx = lx - hx;
        const dy = ly - hy;
        lx = dx * cosR - dy * sinR + hx;
        ly = dx * sinR + dy * cosR + hy;
    }

    // Normalize to [0,1] within the object's bounding box
    const nx = lx / obj.w;
    const ny = ly / obj.h;

    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return false;

    // Check outer solid shape
    const solidHit = isPointInSolidNorm(nx, ny, obj.shape);
    if (!solidHit) return false;

    // For solid shapes we're done
    if (!obj.hollow) return true;

    // ── HOLLOW SHAPES ──────────────────────────────────────────────────────────
    // A hollow shape has its interior removed.  The "stroke width" (sw) is a
    // fraction of the object's size: the inner boundary is the same shape
    // scaled to (1 – 2·sw) and centred at (0.5, 0.5).
    const sw = Math.max(0.05, Math.min(0.45, obj.strokeWidth ?? 0.15));
    const innerScale = 1 - 2 * sw;

    if (innerScale <= 0) return true; // So thick it fills the whole shape

    // Map the point into the inner shape's coordinate space
    const inx = (nx - sw) / innerScale;
    const iny = (ny - sw) / innerScale;

    // If outside the inner bounding box, the point is definitely in the stroke
    if (inx < 0 || inx > 1 || iny < 0 || iny > 1) return true;

    // If the point is inside the inner solid shape, it's in the hollow interior
    const innerHit = isPointInSolidNorm(inx, iny, obj.shape);
    return !innerHit;
}

export const generateRoundConfig = (level: number, currentCash: number): RoundConfig => {
    let targetCash = 1000;
    if (level <= 10)      targetCash = 1000;
    else if (level <= 20) targetCash = 20000;
    else if (level <= 30) targetCash = 500000;
    else if (level <= 40) targetCash = 12500000;
    else                  targetCash = 312500000;

    const duration = 3000;
    const targetColor = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
    const isClassified = level > 5 && Math.random() > 0.4;

    return { level, targetCash, duration, targetColor, targetArea: 0, isClassified };
};

function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function rnd(min: number, max: number) { return min + Math.random() * (max - min); }
function rndInt(min: number, max: number) { return Math.floor(rnd(min, max + 1)); }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

// All playable shapes (excluding TEXT which is too hard to hit-test reliably for hollows)
const ALL_SHAPES = [
    ObjectShape.CIRCLE, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE,
    ObjectShape.DIAMOND, ObjectShape.STAR, ObjectShape.SIX_POINT_STAR,
    ObjectShape.HEART, ObjectShape.ARROW, ObjectShape.RING, ObjectShape.FRAME,
];
const SOLID_SHAPES = [
    ObjectShape.CIRCLE, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE,
    ObjectShape.DIAMOND, ObjectShape.STAR, ObjectShape.SIX_POINT_STAR,
    ObjectShape.HEART, ObjectShape.ARROW,
];
const HOLLOW_SHAPES = [
    ObjectShape.CIRCLE, ObjectShape.RECTANGLE, ObjectShape.TRIANGLE,
    ObjectShape.DIAMOND, ObjectShape.STAR, ObjectShape.HEART,
    ObjectShape.RING, ObjectShape.FRAME,
];

// Helper to make a solid game object
function makeSolid(
    id: string, x: number, y: number, w: number, h: number,
    color: ObjectColor, shape: ObjectShape, rotation = 0,
): GameObject {
    return { id, x, y, w, h, rotation, color, shape, hollow: false, zIndex: 0, area: 0 };
}

// Helper to make a hollow game object
function makeHollow(
    id: string, x: number, y: number, w: number, h: number,
    color: ObjectColor, shape: ObjectShape, rotation = 0, strokeWidth = 0.15,
): GameObject {
    return { id, x, y, w, h, rotation, color, shape, hollow: true, strokeWidth, zIndex: 0, area: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE GENERATORS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STYLE 1 – LAYERED COMPOSITION
 * A painter's arrangement: a few large shapes behind, medium in the middle,
 * small scattered in front. Mix of solid and hollow at every layer.
 */
function genLayeredComposition(): GameObject[] {
    const objs: GameObject[] = [];
    const shuffled = shuffle([...TARGET_COLORS]);
    let idx = 0;

    // 4 large anchor shapes (one per color), potentially overlapping
    shuffled.forEach((color, ci) => {
        const w = rnd(30, 58);
        const h = rnd(28, 55);
        const x = rnd(-5, 100 - w + 5);
        const y = rnd(-5, 100 - h + 5);
        const shape = pick(SOLID_SHAPES);
        const rot = rnd(0, 360);
        objs.push(makeSolid(`lc-lg-${ci}`, x, y, w, h, color, shape, rot));
    });

    // 14-20 medium shapes, ~50% hollow
    const medCount = rndInt(14, 20);
    for (let i = 0; i < medCount; i++) {
        const w = rnd(9, 22);
        const h = rnd(9, 22);
        const x = rnd(-4, 100 - w + 4);
        const y = rnd(-4, 100 - h + 4);
        const color = pick(TARGET_COLORS);
        const rot = rnd(0, 360);
        if (Math.random() < 0.50) {
            const sw = rnd(0.10, 0.25);
            objs.push(makeHollow(`lc-md-${i}`, x, y, w, h, color, pick(HOLLOW_SHAPES), rot, sw));
        } else {
            objs.push(makeSolid(`lc-md-${i}`, x, y, w, h, color, pick(SOLID_SHAPES), rot));
        }
    }

    // 20-30 small shapes, mostly solid
    const smCount = rndInt(20, 30);
    for (let i = 0; i < smCount; i++) {
        const w = rnd(2.5, 8);
        const h = rnd(2.5, 8);
        const x = rnd(0, 100 - w);
        const y = rnd(0, 100 - h);
        const color = pick(TARGET_COLORS);
        const rot = rnd(0, 360);
        if (Math.random() < 0.25) {
            objs.push(makeHollow(`lc-sm-${i}`, x, y, w, h, color, pick(HOLLOW_SHAPES), rot, rnd(0.15, 0.30)));
        } else {
            objs.push(makeSolid(`lc-sm-${i}`, x, y, w, h, color, pick(SOLID_SHAPES), rot));
        }
    }

    return objs;
}

/**
 * STYLE 2 – DENSE MOSAIC
 * Canvas divided into a grid; each cell gets a randomly chosen shape,
 * some solid, some hollow, at varied scales within the cell.
 * Colors assigned by a shuffled pattern across the grid.
 */
function genDenseMosaic(): GameObject[] {
    const objs: GameObject[] = [];
    const cols = rndInt(5, 9);
    const rows = rndInt(5, 9);
    const cellW = 100 / cols;
    const cellH = 100 / rows;

    // Random color-assignment pattern (2D modular arithmetic with random offsets)
    const offsets = [rndInt(0, 3), rndInt(0, 3)];

    let idx = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const colorIdx = ((c * offsets[0] + r * offsets[1] + (c ^ r)) % 4 + 4) % 4;
            const color = TARGET_COLORS[colorIdx];
            const shape = pick(ALL_SHAPES);

            // Shape fits within cell with some padding, slight random scale
            const scaleFactor = rnd(0.55, 0.95);
            const w = cellW * scaleFactor;
            const h = cellH * scaleFactor;
            const xOff = (cellW - w) / 2 + (Math.random() - 0.5) * cellW * 0.1;
            const yOff = (cellH - h) / 2 + (Math.random() - 0.5) * cellH * 0.1;
            const x = c * cellW + xOff;
            const y = r * cellH + yOff;
            const rot = pick([0, 15, 30, 45, 60, 90, 120, 135, 180]) + rnd(-10, 10);

            const isHollow = (shape === ObjectShape.RING || shape === ObjectShape.FRAME) || Math.random() < 0.30;
            if (isHollow) {
                const sw = rnd(0.12, 0.28);
                objs.push(makeHollow(`dm-${idx++}`, x, y, w, h, color, shape, rot, sw));
            } else {
                objs.push(makeSolid(`dm-${idx++}`, x, y, w, h, color, shape, rot));
            }
        }
    }
    return objs;
}

/**
 * STYLE 3 – EXPLOSIVE SCATTER
 * 3-5 "explosion" focal points, each dominated by one color.
 * Shapes radiate outward: large near center, smaller at edges.
 * Intense mixing where blasts overlap. Mix of all shape types.
 */
function genExplosiveScatter(): GameObject[] {
    const objs: GameObject[] = [];
    const numBlasts = rndInt(3, 5);
    const blastColors = shuffle([...TARGET_COLORS]).slice(0, numBlasts);
    let idx = 0;

    for (let b = 0; b < numBlasts; b++) {
        const bcx = rnd(15, 85);
        const bcy = rnd(15, 85);
        const color = blastColors[b % blastColors.length];
        const blastShape = pick(SOLID_SHAPES);
        const count = rndInt(18, 30);

        for (let i = 0; i < count; i++) {
            // Concentrated distribution near centre using power law
            const r = Math.pow(Math.random(), 0.45) * 48;
            const angle = rnd(0, Math.PI * 2);
            const px = bcx + r * Math.cos(angle);
            const py = bcy + r * Math.sin(angle);

            // Larger near centre, smaller at edges
            const sizeBase = Math.max(2.5, 18 - r * 0.3);
            const w = sizeBase * rnd(0.7, 1.4);
            const h = sizeBase * rnd(0.7, 1.4);

            const rot = rnd(0, 360);
            if (Math.random() < 0.20) {
                objs.push(makeHollow(`es-${idx++}`, px - w / 2, py - h / 2, w, h, color, pick(HOLLOW_SHAPES), rot, rnd(0.12, 0.22)));
            } else {
                objs.push(makeSolid(`es-${idx++}`, px - w / 2, py - h / 2, w, h, color, blastShape, rot));
            }
        }
    }

    // Sparse inter-blast fill with all colors
    for (let i = 0; i < 20; i++) {
        const w = rnd(3, 11);
        const h = rnd(3, 11);
        const x = rnd(0, 100 - w);
        const y = rnd(0, 100 - h);
        const color = pick(TARGET_COLORS);
        const rot = rnd(0, 360);
        if (Math.random() < 0.35) {
            objs.push(makeHollow(`es-bg-${i}`, x, y, w, h, color, pick(HOLLOW_SHAPES), rot, rnd(0.12, 0.22)));
        } else {
            objs.push(makeSolid(`es-bg-${i}`, x, y, w, h, color, pick(SOLID_SHAPES), rot));
        }
    }

    return objs;
}

/**
 * STYLE 4 – BOLD STRIPE FIELDS
 * Wide diagonal/straight stripes of solid color form a bold background.
 * Hollow outlines of DIFFERENT colors are scattered across the whole canvas,
 * creating a layered complexity where the hollow shapes overlap stripe colors.
 */
function genBoldStripeFields(): GameObject[] {
    const objs: GameObject[] = [];
    const angle = pick([0, 30, 45, 60, 90]) * (Math.PI / 180);
    const numStripes = rndInt(4, 7);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const stripeW = 100 / numStripes;
    let idx = 0;

    // Dense grid to fill stripe regions with solid shapes
    const cellSize = rnd(5, 10);
    const spacing  = cellSize * 1.35;

    for (let row = -3; row * spacing < 120; row++) {
        for (let col = -3; col * spacing < 120; col++) {
            const bx = col * spacing;
            const by = row * spacing;
            const proj = bx * cos + by * sin;
            const stripeIdx = Math.floor(proj / stripeW);
            const colorIdx = ((stripeIdx % 4) + 4) % 4;
            const color = TARGET_COLORS[colorIdx];

            // All background cells: solid, slight random rotation
            const rot = stripeIdx * 45 + rnd(-20, 20);
            objs.push(makeSolid(`sf-bg-${idx++}`, bx, by, cellSize, cellSize, color, pick(SOLID_SHAPES), rot));
        }
    }

    // Hollow overlay shapes scattered everywhere (different sizes, heavy rotation)
    const hollowCount = rndInt(30, 50);
    for (let i = 0; i < hollowCount; i++) {
        const w = rnd(6, 28);
        const h = rnd(6, 28);
        const x = rnd(-4, 100 - w + 4);
        const y = rnd(-4, 100 - h + 4);
        const color = pick(TARGET_COLORS);
        const rot = rnd(0, 360);
        const sw = rnd(0.10, 0.30);
        objs.push(makeHollow(`sf-ov-${i}`, x, y, w, h, color, pick(HOLLOW_SHAPES), rot, sw));
    }

    return objs;
}

/**
 * STYLE 5 – CRYSTALLINE LATTICE
 * Objects arranged on an offset triangular/diamond lattice.
 * Alternating rows are offset; shape and hollow/solid alternate systematically.
 * Colors assigned by quadrant-ish position with randomized band angle.
 */
function genCrystallineLattice(): GameObject[] {
    const objs: GameObject[] = [];
    const cellW = rnd(8, 15);
    const cellH = cellW * rnd(0.7, 1.3);
    const angle  = rnd(0, 60) * (Math.PI / 180); // Color-band angle
    const cos    = Math.cos(angle);
    const sin    = Math.sin(angle);
    const bandW  = rnd(20, 40);

    let idx = 0;
    for (let row = -2; row * cellH < 110; row++) {
        const offset = (row % 2 === 0) ? 0 : cellW / 2;
        for (let col = -2; col * cellW < 110; col++) {
            const cx = col * cellW + offset;
            const cy = row * cellH;

            // Color by projection onto band axis
            const proj = cx * cos + cy * sin;
            const bandIdx = Math.floor(proj / bandW);
            const colorIdx = ((bandIdx % 4) + 4) % 4;
            const color = TARGET_COLORS[colorIdx];

            // Shape type alternates by lattice position
            const latticeType = (row + col) % 4;
            const shapeList = [SOLID_SHAPES, HOLLOW_SHAPES, SOLID_SHAPES, HOLLOW_SHAPES];
            const shape = pick(shapeList[Math.abs(latticeType)]);

            const sizeScale = rnd(0.55, 0.88);
            const w = cellW * sizeScale;
            const h = cellH * sizeScale;
            const rot = rnd(-45, 45) + (row % 2) * 30;

            const isHollow = latticeType === 1 || latticeType === 3;
            if (isHollow) {
                objs.push(makeHollow(`cl-${idx++}`, cx - w / 2, cy - h / 2, w, h, color, shape, rot, rnd(0.12, 0.25)));
            } else {
                objs.push(makeSolid(`cl-${idx++}`, cx - w / 2, cy - h / 2, w, h, color, shape, rot));
            }
        }
    }
    return objs;
}

/**
 * STYLE 6 – ORBITAL SYSTEMS
 * 3-5 orbital systems, each with rings of hollow outlines at multiple radii
 * and solid shapes scattered along the orbit paths like "planets".
 * Systems overlap creating complex colour mixing.
 */
function genOrbitalSystems(): GameObject[] {
    const objs: GameObject[] = [];
    const numSystems = rndInt(3, 5);
    let idx = 0;

    for (let s = 0; s < numSystems; s++) {
        const scx = rnd(10, 90);
        const scy = rnd(10, 90);
        const numOrbits = rndInt(3, 6);
        const colorStart = rndInt(0, 3);
        const maxRadius = rnd(20, 45);

        for (let orbit = 0; orbit < numOrbits; orbit++) {
            const r = maxRadius * ((orbit + 1) / numOrbits);
            const color = TARGET_COLORS[(colorStart + orbit) % 4];

            // Large hollow ring outline for this orbit
            const ringSize = r * 2;
            const sw = rnd(0.04, 0.10);
            const shape = pick([ObjectShape.RING, ObjectShape.FRAME, ObjectShape.CIRCLE, ObjectShape.DIAMOND]);
            objs.push(makeHollow(
                `os-ring-${idx++}`,
                scx - ringSize / 2, scy - ringSize / 2,
                ringSize, ringSize,
                color, shape, rnd(0, 360), sw,
            ));

            // Solid "planets" scattered along the orbit
            const numPlanets = rndInt(3, 7);
            for (let p = 0; p < numPlanets; p++) {
                const a = (p / numPlanets) * Math.PI * 2 + rnd(-0.3, 0.3);
                const pr = r + rnd(-r * 0.12, r * 0.12);
                const px = scx + pr * Math.cos(a);
                const py = scy + pr * Math.sin(a);
                const sz = rnd(2, 7);
                const planetShape = pick(SOLID_SHAPES);
                const planetColor = Math.random() < 0.7 ? color : pick(TARGET_COLORS);
                objs.push(makeSolid(
                    `os-planet-${idx++}`,
                    px - sz / 2, py - sz / 2, sz, sz,
                    planetColor, planetShape, rnd(0, 360),
                ));
            }
        }

        // Central solid "sun"
        const sunSize = rnd(4, 10);
        objs.push(makeSolid(
            `os-sun-${idx++}`,
            scx - sunSize / 2, scy - sunSize / 2, sunSize, sunSize,
            TARGET_COLORS[(colorStart + 2) % 4],
            pick(SOLID_SHAPES), rnd(0, 360),
        ));
    }

    // Extra small scattered shapes to fill gaps
    for (let i = 0; i < 15; i++) {
        const w = rnd(2, 6);
        const h = rnd(2, 6);
        objs.push(makeSolid(
            `os-fill-${i}`,
            rnd(0, 100 - w), rnd(0, 100 - h), w, h,
            pick(TARGET_COLORS), pick(SOLID_SHAPES), rnd(0, 360),
        ));
    }

    return objs;
}

// ── MAIN EXPORT ───────────────────────────────────────────────────────────────

export const generateObjects = (
    config: RoundConfig,
    attempts = 0,
): { objects: GameObject[]; breakdown: Record<ObjectColor, number>; verticalDistribution: Record<ObjectColor, number[]> } => {

    const styles = [
        genLayeredComposition,
        genDenseMosaic,
        genExplosiveScatter,
        genBoldStripeFields,
        genCrystallineLattice,
        genOrbitalSystems,
    ];
    const generator = pick(styles);
    const objects = generator();

    // ── ENSURE ALL COLOURS ARE PRESENT ───────────────────────────────────────
    // Insert a small guaranteed-visible shape for any missing colour.
    const presentColors = new Set(objects.map(o => o.color));
    TARGET_COLORS.forEach(c => {
        if (!presentColors.has(c)) {
            objects.push(makeSolid(
                `forced-${c}`,
                rnd(35, 55), rnd(35, 55), 10, 10,
                c, ObjectShape.CIRCLE, 0,
            ));
        }
    });

    // ── DEPTH SORT ────────────────────────────────────────────────────────────
    // Larger bounding boxes draw first (behind); smaller draw last (in front).
    // This applies a natural painter's algorithm for solid shapes.
    // For hollow shapes the bounding box is larger than the visible area, but
    // we still want big hollow outlines behind smaller solid details.
    objects.sort((a, b) => (b.w * b.h) - (a.w * a.h));
    objects.forEach((o, i) => { o.zIndex = i; });

    // ── PIXEL-ACCURATE COLOUR SAMPLING ────────────────────────────────────────
    // We cast a 350×350 grid of sample points across the 0–100% canvas.
    // For each sample we find the *topmost* visible object (highest zIndex)
    // and credit that object's colour.  Uncovered pixels count as WHITE.
    //
    // Important: objects are sorted so that objects[n-1] has the highest zIndex
    // (smallest, drawn in front).  Iterating k from n-1 downward finds the
    // frontmost hit first, which is exactly the pixel the player sees.
    const SAMPLES_X = 350;
    const SAMPLES_Y = 350;
    const TOTAL     = SAMPLES_X * SAMPLES_Y;

    const breakdown: Record<ObjectColor, number> = {
        [ObjectColor.RED]: 0, [ObjectColor.BLUE]: 0,
        [ObjectColor.GREEN]: 0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0,
    };
    const verticalDistribution: Record<ObjectColor, number[]> = {
        [ObjectColor.RED]:    new Array(SAMPLES_Y).fill(0),
        [ObjectColor.BLUE]:   new Array(SAMPLES_Y).fill(0),
        [ObjectColor.GREEN]:  new Array(SAMPLES_Y).fill(0),
        [ObjectColor.YELLOW]: new Array(SAMPLES_Y).fill(0),
        [ObjectColor.WHITE]:  new Array(SAMPLES_Y).fill(0),
    };

    // Sample centres are at the middle of each cell: offset by half a cell size.
    const stepX = 100 / SAMPLES_X;
    const stepY = 100 / SAMPLES_Y;

    for (let i = 0; i < SAMPLES_X; i++) {
        const px = i * stepX + stepX / 2;   // x-coordinate in % (0–100)
        for (let j = 0; j < SAMPLES_Y; j++) {
            const py = j * stepY + stepY / 2; // y-coordinate in %

            // Find the topmost object covering this pixel.
            // objects is sorted largest→smallest; highest index = smallest = on top.
            let hitColor: ObjectColor = ObjectColor.WHITE;
            for (let k = objects.length - 1; k >= 0; k--) {
                if (isPointInShape(px, py, objects[k])) {
                    hitColor = objects[k].color;
                    break;
                }
            }

            breakdown[hitColor]++;
            verticalDistribution[hitColor][j]++;
        }
    }

    // Convert raw counts to percentage (0–100)
    const resultBreakdown: Record<ObjectColor, number> = {} as Record<ObjectColor, number>;
    for (const c of TARGET_COLORS) {
        resultBreakdown[c] = (breakdown[c] / TOTAL) * 100;
    }
    const whitePct = (breakdown[ObjectColor.WHITE] / TOTAL) * 100;

    // ── CONSTRAINT CHECK ──────────────────────────────────────────────────────
    // Each colour must cover at least 0.5% of the canvas, and white ≤ 60%.
    // If the generated puzzle fails, retry (up to 6 times).
    const hasZeroArea = TARGET_COLORS.some(c => resultBreakdown[c] < 0.5);
    if ((whitePct > 60 || hasZeroArea) && attempts < 6) {
        return generateObjects(config, attempts + 1);
    }

    return { objects, breakdown: resultBreakdown, verticalDistribution };
};
