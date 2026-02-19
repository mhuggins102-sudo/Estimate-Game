import React, { useState, useEffect } from 'react';
import { PerkType, ObjectColor } from '../types';

interface Props {
  maxCountGuess: number; 
  currentCash: number;
  onLockIn: (guess: number, range: number, bet: number) => void;
  activePerks: PerkType[];
  targetColor: ObjectColor;
}

export const BettingInterface: React.FC<Props> = ({ currentCash, onLockIn, activePerks, targetColor }) => {
  // Betting Constraints
  const minBet = Math.ceil(currentCash * 0.1);
  const maxBetLimit = activePerks.includes(PerkType.LIMITLESS_BET) ? currentCash : Math.floor(currentCash * 0.5);
  
  // Guess state (Percentage 0-100)
  const [guessPct, setGuessPct] = useState<number>(25); 
  
  // Margin state (Percentage of Guess 0-50%)
  const [marginPct, setMarginPct] = useState<number>(20); 
  
  // Default bet to 25% of cash, clamped between min and max
  const defaultBet = Math.floor(currentCash * 0.25);
  const [bet, setBet] = useState<number>(Math.max(minBet, Math.min(maxBetLimit, defaultBet)));

  useEffect(() => {
    if (bet < minBet) setBet(minBet);
    if (bet > maxBetLimit && !activePerks.includes(PerkType.LIMITLESS_BET)) setBet(maxBetLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minBet, maxBetLimit, activePerks]); 

  // Calculations
  const marginDecimal = marginPct / 100;
  
  const rangeMin = Math.max(0, guessPct * (1 - marginDecimal));
  const rangeMax = Math.min(100, guessPct * (1 + marginDecimal));
  
  // Payout Calculation
  let multiplier = 1 + (40 / marginPct);
  if (multiplier > 50) multiplier = 50;
  if (multiplier < 1.01) multiplier = 1.01; 
  if (activePerks.includes(PerkType.ODDS_BOOST)) multiplier *= 1.5;

  const potentialReturn = Math.floor(bet * multiplier);
  const profit = potentialReturn - bet;

  const sliderStyle = { touchAction: 'none' } as React.CSSProperties;

  return (
    <div className="w-full max-w-sm bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col mx-auto">
       {/* Header */}
       <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
             <div className={`w-3 h-3 rounded-full bg-${targetColor}-500 shadow-[0_0_10px_currentColor]`} />
             <span className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">TARGET COLOR</span>
          </div>
          <span className={`text-lg font-black text-${targetColor}-500 uppercase tracking-wider`}>{targetColor}</span>
       </div>

       {/* Controls */}
       <div className="p-4 flex flex-col gap-4 flex-1 justify-center relative">
          
          {/* Range Display */}
          <div className="flex justify-center mb-1">
               <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-1 flex flex-col items-center">
                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Projected Range</span>
                   <span className="text-lg font-black text-white">{rangeMin.toFixed(1)}% - {rangeMax.toFixed(1)}%</span>
               </div>
          </div>

          {/* Estimate */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
               <label className="text-blue-400 text-[10px] font-bold tracking-widest uppercase">Estimate</label>
               <span className="text-2xl font-black text-blue-500">{guessPct}<span className="text-sm text-blue-500/60">%</span></span>
            </div>
            <input 
              type="range" min={0} max={100} value={guessPct} onChange={(e) => setGuessPct(Number(e.target.value))}
              className="w-full h-2 bg-slate-900 rounded-full appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
              style={sliderStyle}
            />
          </div>

          {/* Confidence */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
               <label className="text-purple-400 text-[10px] font-bold tracking-widest uppercase">Confidence</label>
               <div className="text-right">
                   <span className="text-xl font-black text-purple-500">+/- {marginPct}<span className="text-xs text-purple-500/60">%</span></span>
               </div>
            </div>
            <input 
               type="range" min={1} max={50} value={marginPct} onChange={(e) => setMarginPct(Number(e.target.value))}
               className="w-full h-2 bg-slate-900 rounded-full appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 transition-all"
               style={sliderStyle}
            />
          </div>
          
          <div className="h-px bg-slate-700/50" />

          {/* Wager */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
               <div className="flex flex-col">
                   <label className="text-green-400 text-[10px] font-bold tracking-widest uppercase">Wager</label>
               </div>
               <span className="text-2xl font-black text-green-500">${bet}</span>
            </div>
            <input 
               type="range" min={minBet} max={maxBetLimit} value={bet} onChange={(e) => setBet(Number(e.target.value))}
               className="w-full h-2 bg-slate-900 rounded-full appearance-none cursor-pointer accent-green-500 hover:accent-green-400 transition-all"
               style={sliderStyle}
            />
            <div className="flex justify-between text-[9px] font-bold text-slate-500 mt-1 px-1">
                <span>${minBet}</span>
                <span>${maxBetLimit}</span>
            </div>
          </div>
       </div>

       {/* Footer / Stats */}
       <div className="bg-slate-900/80 p-4 shrink-0 border-t border-slate-700 space-y-3">
           {/* Stats Row */}
           <div className="flex justify-between items-center text-sm">
               <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Odds</span>
                  <span className="text-lg font-bold text-yellow-400">x{multiplier.toFixed(2)}</span>
               </div>
               <div className="flex flex-col items-end">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Potential Return</span>
                  <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-green-400">${potentialReturn}</span>
                      <span className="text-[10px] font-bold text-green-600">(+${profit})</span>
                  </div>
               </div>
           </div>

           <button 
             onClick={() => onLockIn(guessPct, marginPct, bet)}
             className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg uppercase tracking-[0.2em] rounded-xl shadow-lg active:scale-[0.98] transition-all"
           >
             Lock It In
           </button>
       </div>
    </div>
  );
};