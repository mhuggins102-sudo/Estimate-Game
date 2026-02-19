import React, { useState, useEffect } from 'react';
import { PerkType, ObjectColor } from '../types';

interface Props {
  maxCountGuess: number;
  currentCash: number;
  onLockIn: (guess: number, range: number, bet: number) => void;
  activePerks: PerkType[];
  targetColor: ObjectColor;
}

// Format dollar amounts compactly
function fmtMoney(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000)        return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

// Tailwind colour names keyed by ObjectColor
const COLOR_META: Record<ObjectColor, { tw: string; hex: string; label: string }> = {
  [ObjectColor.RED]:    { tw: 'red',    hex: '#ef4444', label: 'RED'    },
  [ObjectColor.BLUE]:  { tw: 'blue',   hex: '#3b82f6', label: 'BLUE'   },
  [ObjectColor.GREEN]: { tw: 'green',  hex: '#22c55e', label: 'GREEN'  },
  [ObjectColor.YELLOW]:{ tw: 'yellow', hex: '#eab308', label: 'YELLOW' },
  [ObjectColor.WHITE]: { tw: 'slate',  hex: '#94a3b8', label: 'WHITE'  },
};

interface TrackSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  /** 0–1 fraction for the filled track */
  filledFraction?: number;
  accentHex: string;
  /** Optional band to highlight (0–100 scale matching value range) */
  bandMin?: number;
  bandMax?: number;
}

/** Custom slider: invisible native input on top of a fully-custom visual track */
const TrackSlider: React.FC<TrackSliderProps> = ({
  min, max, value, onChange, accentHex, bandMin, bandMax,
}) => {
  const pct = (value - min) / (max - min);          // 0..1

  const bandMinPct = bandMin !== undefined ? Math.max(0, (bandMin - min) / (max - min)) : null;
  const bandMaxPct = bandMax !== undefined ? Math.min(1, (bandMax - min) / (max - min)) : null;

  return (
    <div className="relative h-8 flex items-center select-none">
      {/* ── Visual track ── */}
      <div className="relative w-full h-[6px] rounded-full bg-slate-700">

        {/* Filled portion */}
        <div
          className="absolute left-0 top-0 h-full rounded-full opacity-40"
          style={{ width: `${pct * 100}%`, background: accentHex }}
        />

        {/* Range band (only on the estimate track) */}
        {bandMinPct !== null && bandMaxPct !== null && (
          <div
            className="absolute top-0 h-full rounded-full"
            style={{
              left:       `${bandMinPct * 100}%`,
              width:      `${(bandMaxPct - bandMinPct) * 100}%`,
              background: accentHex,
              opacity:    0.28,
            }}
          />
        )}

        {/* Band boundary ticks */}
        {bandMinPct !== null && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-[2px] rounded-full opacity-60"
            style={{ left: `${bandMinPct * 100}%`, background: accentHex }}
          />
        )}
        {bandMaxPct !== null && (
          <div
            className="absolute top-[-3px] bottom-[-3px] w-[2px] rounded-full opacity-60"
            style={{ left: `${bandMaxPct * 100}%`, background: accentHex }}
          />
        )}

        {/* Thumb */}
        <div
          className="absolute top-1/2 w-[18px] h-[18px] rounded-full border-2 border-white shadow-md -translate-y-1/2 -translate-x-1/2"
          style={{ left: `${pct * 100}%`, background: accentHex }}
        />
      </div>

      {/* Invisible native input on top for interaction */}
      <input
        type="range"
        min={min} max={max} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
};

export const BettingInterface: React.FC<Props> = ({
  currentCash, onLockIn, activePerks, targetColor,
}) => {
  const minBet      = Math.ceil(currentCash * 0.1);
  const maxBetLimit = activePerks.includes(PerkType.LIMITLESS_BET)
    ? currentCash
    : Math.floor(currentCash * 0.5);

  const [guessPct,  setGuessPct]  = useState<number>(25);
  const [marginPct, setMarginPct] = useState<number>(20);
  const [bet,       setBet]       = useState<number>(
    Math.max(minBet, Math.min(maxBetLimit, Math.floor(currentCash * 0.25)))
  );

  useEffect(() => {
    if (bet < minBet)      setBet(minBet);
    if (bet > maxBetLimit) setBet(maxBetLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minBet, maxBetLimit]);

  // Derived values
  const marginDecimal = marginPct / 100;
  const rangeMin      = Math.max(0,   guessPct * (1 - marginDecimal));
  const rangeMax      = Math.min(100, guessPct * (1 + marginDecimal));

  let multiplier = 1 + (40 / marginPct);
  if (multiplier > 50)   multiplier = 50;
  if (multiplier < 1.01) multiplier = 1.01;
  if (activePerks.includes(PerkType.ODDS_BOOST)) multiplier *= 1.5;

  const potentialReturn = Math.floor(bet * multiplier);
  const profit          = potentialReturn - bet;

  const cm   = COLOR_META[targetColor] ?? COLOR_META[ObjectColor.RED];
  const cHex = cm.hex;

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 overflow-hidden">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-3 border-b border-slate-700"
        style={{ background: `linear-gradient(135deg, ${cHex}18, ${cHex}08)` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
            style={{ background: cHex, boxShadow: `0 0 8px ${cHex}99` }}
          />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Color</span>
        </div>
        <span className="text-base font-black tracking-widest uppercase" style={{ color: cHex }}>
          {cm.label}
        </span>
      </div>

      {/* ── CONTROLS ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 px-5 py-5">

        {/* ESTIMATE */}
        <div>
          {/* Label row */}
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Your Estimate</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-3xl font-black text-white tabular-nums">{guessPct}</span>
              <span className="text-base font-bold text-slate-400">%</span>
            </div>
          </div>

          {/* Track — shows the winning range as a highlighted band */}
          <TrackSlider
            min={0} max={100} value={guessPct}
            onChange={setGuessPct}
            accentHex="#3b82f6"
            bandMin={rangeMin}
            bandMax={rangeMax}
          />

          {/* Range labels */}
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[9px] text-slate-500 font-mono">0%</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
              <span className="text-[10px] font-bold text-blue-400">
                {rangeMin.toFixed(1)}% &ndash; {rangeMax.toFixed(1)}%
              </span>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60" />
            </div>
            <span className="text-[9px] text-slate-500 font-mono">100%</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-800" />

        {/* CONFIDENCE */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confidence</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[11px] font-bold text-purple-400">±</span>
              <span className="text-2xl font-black text-white tabular-nums">{marginPct}</span>
              <span className="text-sm font-bold text-slate-400">%</span>
            </div>
          </div>
          <TrackSlider
            min={1} max={50} value={marginPct}
            onChange={setMarginPct}
            accentHex="#a855f7"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-slate-500">Tight (high odds)</span>
            <span className="text-[9px] text-slate-500">Wide (safe)</span>
          </div>
        </div>

        {/* WAGER */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wager</span>
            <span className="text-2xl font-black text-white tabular-nums">{fmtMoney(bet)}</span>
          </div>
          <TrackSlider
            min={minBet} max={maxBetLimit} value={bet}
            onChange={setBet}
            accentHex="#22c55e"
          />
          <div className="flex justify-between mt-1.5">
            <span className="text-[9px] text-slate-500">{fmtMoney(minBet)}</span>
            <span className="text-[9px] text-slate-500">{fmtMoney(maxBetLimit)}</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <div className="px-5 pb-5 flex flex-col gap-3">
        {/* Stats bar */}
        <div className="flex items-stretch rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
          {/* Odds */}
          <div className="flex-1 flex flex-col items-center justify-center py-2.5 border-r border-slate-700">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Odds</span>
            <span className="text-lg font-black text-yellow-400">×{multiplier.toFixed(2)}</span>
          </div>

          {/* Net profit */}
          <div className="flex-1 flex flex-col items-center justify-center py-2.5">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Net Profit</span>
            <span className="text-lg font-black text-green-400">+{fmtMoney(profit)}</span>
          </div>
        </div>

        {/* Lock In button */}
        <button
          onClick={() => onLockIn(guessPct, marginPct, bet)}
          className="w-full py-3.5 rounded-xl font-black text-base uppercase tracking-[0.18em] text-white transition-all active:scale-[0.97] shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${cHex}cc, ${cHex}88)`,
            boxShadow:  `0 4px 20px ${cHex}50`,
          }}
        >
          Lock It In
        </button>
      </div>
    </div>
  );
};
