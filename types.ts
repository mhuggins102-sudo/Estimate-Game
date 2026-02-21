export enum GameState {
  MENU = 'MENU',
  PREP = 'PREP',        // Viewing level info
  FLASH = 'FLASH',      // Objects are visible briefly
  REVEAL_MISSION = 'REVEAL_MISSION', // Interstitial for hidden targets
  REFLASH = 'REFLASH',  // Perk triggered re-view
  GUESS = 'GUESS',      // Betting interface (Perks used here)
  REVEAL = 'REVEAL',    // Counting animation
  RESULT = 'RESULT',    // Round summary
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

// Reduced to 4 distinct colors for the mosaic
export enum ObjectColor {
  RED = 'red',
  BLUE = 'blue',
  GREEN = 'green',
  YELLOW = 'yellow',
  WHITE = 'white', // Filler color
}

export enum ObjectShape {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  TRIANGLE = 'triangle',
  STAR = 'star',
  SIX_POINT_STAR = 'six_point_star',
  HEART = 'heart',
  TEXT = 'text',
  DIAMOND = 'diamond',
  ARROW = 'arrow',
  RING = 'ring',
  FRAME = 'frame'
}

export interface GameObject {
  id: string;
  x: number; // Percentage 0-100 (Left)
  y: number; // Percentage 0-100 (Top)
  w: number; // Percentage 0-100 (Width)
  h: number; // Percentage 0-100 (Height)
  rotation?: number; // Degrees 0-360
  zIndex?: number;
  
  color: ObjectColor;
  shape: ObjectShape;
  borderWidth?: number; // For Mondrian style framing
  strokeWidth?: number; // For Rings/Frames and hollow shapes (0.0 to 0.5 relative to size)
  hollow?: boolean;     // If true, only the border is visible (stroke-only rendering)
  char?: string; // For text shapes
  area: number; // The actual visible percentage of total screen area
}

export interface RoundConfig {
  level: number;
  targetCash: number;
  duration: number; // ms to show objects
  
  targetColor: ObjectColor; 
  targetArea: number; // The actual answer (0-100)
  
  isClassified: boolean; // If true, reveal target color AFTER flash
}

export enum PerkType {
  FLASH_BOOST = 'Flash Boost (+3s)',
  FREE_PASS = 'Free Pass (Skip)',
  ODDS_BOOST = 'Odds Boost (1.5x)',
  DOUBLE_LOOT = 'Double Loot (2x Perks)',
  LIMITLESS_BET = 'Limitless Bet (Max 100%)',
  CHANGE_TARGET = 'Change Target',
  SPY_DRONE = 'Spy Drone (Reveal Other)'
}

export interface PlayerState {
  cash: number;
  maxCash: number;
  level: number;
  inventory: PerkType[];
  history: { level: number; win: boolean; amount: number; perksEarned?: string[] }[];
}