import { GameObject, ObjectColor, ObjectShape, RoundConfig } from '../types';

const TARGET_COLORS = [ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW];
const SHAPES = [
    ObjectShape.RECTANGLE, ObjectShape.CIRCLE, ObjectShape.TRIANGLE, 
    ObjectShape.STAR, ObjectShape.SIX_POINT_STAR, ObjectShape.DIAMOND, 
    ObjectShape.ARROW, ObjectShape.HEART, ObjectShape.RING, ObjectShape.FRAME,
    ObjectShape.TEXT 
];
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

export const generateObjects = (config: RoundConfig): { objects: GameObject[], breakdown: Record<ObjectColor, number>, verticalDistribution: Record<ObjectColor, number[]> } => {
  
  const targetCoverage = 40 + Math.random() * 60; 
  const objects: GameObject[] = [];
  
  // New "Art Style" Generator Logic
  const styles = ['stack_pile', 'neat_grid', 'concentric_chaos', 'big_vs_small', 'typographic_storm'];
  const style = styles[Math.floor(Math.random() * styles.length)];
  
  let currentCoverageEstimate = 0;
  let attempts = 0;

  if (style === 'stack_pile') {
      // Classic scattered look but sorted by size for depth
      // Large items at bottom (low z-index), small items on top (high z-index)
      const count = 30 + Math.floor(Math.random() * 30);
      for(let i=0; i<count; i++) {
          const w = 5 + Math.random() * 40;
          const h = w; // Keep aspect mostly 1:1 for shapes, vary for rects later
          const x = Math.random() * (100 - w);
          const y = Math.random() * (100 - h);
          const color = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
          const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
          
          objects.push({
              id: `stack-${i}`,
              x, y, w, h: shape === ObjectShape.RECTANGLE ? w * (0.5 + Math.random()) : w,
              rotation: Math.random() * 360,
              color, shape,
              zIndex: 0, // Will sort later
              char: shape === ObjectShape.TEXT ? CHARS[Math.floor(Math.random() * CHARS.length)] : undefined,
              area: 0
          });
      }
  } 
  else if (style === 'neat_grid') {
      // Mondrian-esque: Aligned to grid, no rotation or 45 deg
      const cols = 4 + Math.floor(Math.random() * 3);
      const rows = 4 + Math.floor(Math.random() * 3);
      const cw = 100/cols;
      const ch = 100/rows;
      
      for(let r=0; r<rows; r++) {
          for(let c=0; c<cols; c++) {
              if(Math.random() > 0.6) continue; // Sparse
              const color = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
              const shape = Math.random() > 0.7 ? ObjectShape.CIRCLE : ObjectShape.RECTANGLE;
              const size = 0.5 + Math.random() * 0.4; // % of cell
              
              const w = cw * size;
              const h = ch * size;
              const x = (c * cw) + (cw - w)/2;
              const y = (r * ch) + (ch - h)/2;
              
              objects.push({
                  id: `grid-${r}-${c}`,
                  x, y, w, h,
                  rotation: shape === ObjectShape.RECTANGLE && Math.random() > 0.8 ? 45 : 0,
                  color, shape,
                  zIndex: 0,
                  area: 0
              });
          }
      }
  }
  else if (style === 'concentric_chaos') {
      // Groups of objects centered on same point
      const groups = 5 + Math.floor(Math.random() * 5);
      for(let g=0; g<groups; g++) {
          const cx = 10 + Math.random() * 80;
          const cy = 10 + Math.random() * 80;
          const layers = 3 + Math.floor(Math.random() * 4);
          let size = 30 + Math.random() * 20;
          
          for(let l=0; l<layers; l++) {
              const color = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
              // Alternating shapes
              const shape = (l % 2 === 0) ? ObjectShape.CIRCLE : (Math.random() > 0.5 ? ObjectShape.RING : ObjectShape.STAR);
              
              objects.push({
                  id: `conc-${g}-${l}`,
                  x: cx - size/2,
                  y: cy - size/2,
                  w: size, h: size,
                  rotation: (l * 15) % 360,
                  color, shape,
                  zIndex: -l, // Larger on bottom
                  area: 0
              });
              size *= 0.6; // Shrink
          }
      }
  }
  else if (style === 'typographic_storm') {
      // Mostly text and symbols
      const count = 40 + Math.floor(Math.random() * 20);
      for(let i=0; i<count; i++) {
          const size = 10 + Math.random() * 30;
          const x = Math.random() * (100 - size);
          const y = Math.random() * (100 - size);
          const color = TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)];
          const char = CHARS[Math.floor(Math.random() * CHARS.length)];
          
          objects.push({
              id: `type-${i}`,
              x, y, w: size, h: size,
              rotation: (Math.random() - 0.5) * 60,
              color, shape: ObjectShape.TEXT, char,
              zIndex: 0, area: 0
          });
      }
  }
  else {
      // 'big_vs_small': Few giant objects, many tiny ones
      // Giant
      for(let i=0; i<5; i++) {
          const w = 40 + Math.random() * 20;
          const h = w;
          objects.push({
              id: `giant-${i}`,
              x: Math.random() * (100 - w),
              y: Math.random() * (100 - h),
              w, h, rotation: Math.random() * 360,
              color: TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)],
              shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
              zIndex: 0, area: 0
          });
      }
      // Tiny
      for(let i=0; i<50; i++) {
          const w = 3 + Math.random() * 5;
          objects.push({
              id: `tiny-${i}`,
              x: Math.random() * (100 - w),
              y: Math.random() * (100 - w),
              w, h: w, rotation: Math.random() * 360,
              color: TARGET_COLORS[Math.floor(Math.random() * TARGET_COLORS.length)],
              shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
              zIndex: 10, area: 0
          });
      }
  }

  // --- FORCE ALL COLORS ---
  const presentColors = new Set(objects.map(o => o.color));
  TARGET_COLORS.forEach((c) => {
      if (!presentColors.has(c)) {
          objects.push({
              id: `forced-${c}`,
              x: 40 + Math.random() * 20,
              y: 40 + Math.random() * 20,
              w: 15, h: 15, rotation: 0, color: c, shape: ObjectShape.CIRCLE,
              zIndex: 100, area: 0
          });
      }
  });

  // --- 3D Sorting ---
  // Sort objects so smaller ones are generally on top (higher index in array = drawn later)
  // We can also just randomize, but size-sorting gives a "pile" effect
  objects.sort((a, b) => (b.w * b.h) - (a.w * a.h)); 
  // Update zIndex prop for stability if needed, though array order dictates DOM order
  objects.forEach((o, i) => o.zIndex = i);

  // --- CALCULATION (Exact Pixel Count) ---
  const breakdown = {
      [ObjectColor.RED]: 0, [ObjectColor.BLUE]: 0, [ObjectColor.GREEN]: 0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0
  };

  const SAMPLES_X = 350; 
  const SAMPLES_Y = 350; 
  const TOTAL_SAMPLES = SAMPLES_X * SAMPLES_Y;
  
  const verticalDistribution: Record<ObjectColor, number[]> = {
      [ObjectColor.RED]: new Array(SAMPLES_Y).fill(0),
      [ObjectColor.BLUE]: new Array(SAMPLES_Y).fill(0),
      [ObjectColor.GREEN]: new Array(SAMPLES_Y).fill(0),
      [ObjectColor.YELLOW]: new Array(SAMPLES_Y).fill(0),
      [ObjectColor.WHITE]: new Array(SAMPLES_Y).fill(0),
  };

  for (let i = 0; i < SAMPLES_X; i++) {
      for (let j = 0; j < SAMPLES_Y; j++) {
          const px = (i / SAMPLES_X) * 100 + (100/SAMPLES_X)/2;
          const py = (j / SAMPLES_Y) * 100 + (100/SAMPLES_Y)/2;

          let topObj: GameObject | null = null;
          // Iterate backwards (top z-index first)
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

  const resultBreakdown: any = {};
  for (const c of TARGET_COLORS) {
      resultBreakdown[c] = (breakdown[c] / TOTAL_SAMPLES) * 100;
  }
  
  const whitePct = (breakdown[ObjectColor.WHITE] / TOTAL_SAMPLES) * 100;

  // --- CONSTRAINT CHECK ---
  const hasZeroAreaColor = TARGET_COLORS.some(c => resultBreakdown[c] < 0.5); 

  if (whitePct > 60 || hasZeroAreaColor) {
      if (attempts > 5) {
           // Fallback
      } else {
          // Retry
           return generateObjects(config);
      }
  }

  return { objects, breakdown: resultBreakdown, verticalDistribution };
};