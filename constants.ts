import { ObjectColor } from './types';

export const INITIAL_CASH = 100;
export const DIFFICULTY_FACTOR = 25;

// Progression: 
// L10: $1,000
// L20: $20,000
// L30: $500,000 (20k * 25)
// L40: $12,500,000 (500k * 25)
// L50: $312,500,000
export const MILESTONES = [
  { level: 10, cash: 1000 },
  { level: 20, cash: 20000 },
  { level: 30, cash: 500000 },
  { level: 40, cash: 12500000 }, 
  { level: 50, cash: 312500000 },
];

export const COLORS = {
  [ObjectColor.RED]: 'bg-red-500',
  [ObjectColor.BLUE]: 'bg-blue-500',
  [ObjectColor.GREEN]: 'bg-green-500',
  [ObjectColor.YELLOW]: 'bg-yellow-400',
  [ObjectColor.WHITE]: 'bg-white',
};

export const PERK_DESCRIPTIONS = {
  'Flash Boost (+3s)': 'Re-flash the objects for 3 seconds to verify your count.',
  'Free Pass (Skip)': 'Discard this board and deal a new one at the same level.',
  'Odds Boost (1.5x)': 'Multiplies your potential winnings by 1.5x.',
  'Double Loot (2x Perks)': 'Award 2 perks instead of 1 when hitting a bullseye.',
  'Limitless Bet (Max 100%)': 'Removes the 50% bet limit, allowing you to go All In.',
  'Change Target': 'Switch the target to a different color on the board.',
  'Spy Drone (Reveal Other)': 'Reveals the exact area percentage of a non-target color.'
};