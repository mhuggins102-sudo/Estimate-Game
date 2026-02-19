import React, { useState, useEffect, useRef } from 'react';
import { GameState, PlayerState, RoundConfig, GameObject, PerkType, ObjectColor } from './types';
import { INITIAL_CASH, MILESTONES, PERK_DESCRIPTIONS, DIFFICULTY_FACTOR, COLORS } from './constants';
import { generateRoundConfig, generateObjects } from './utils/gameLogic';
import { GameObjectItem } from './components/GameObjectItem';
import { BettingInterface } from './components/BettingInterface';
import { ArrowRight, Coins, Zap, RotateCcw, Play, Eye, Trophy, X, Briefcase, TrendingUp, ScanEye, MousePointerClick, LayoutDashboard, Undo2 } from 'lucide-react';

export default function App() {
  // -- State --
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [player, setPlayer] = useState<PlayerState>({
    cash: INITIAL_CASH,
    maxCash: INITIAL_CASH,
    level: 1,
    inventory: [],
    history: []
  });
  const [roundConfig, setRoundConfig] = useState<RoundConfig | null>(null);
  const [objects, setObjects] = useState<GameObject[]>([]);
  const [areaBreakdown, setAreaBreakdown] = useState<Record<ObjectColor, number>>({
      [ObjectColor.RED]: 0, [ObjectColor.BLUE]: 0, [ObjectColor.GREEN]: 0, [ObjectColor.YELLOW]: 0, [ObjectColor.WHITE]: 0
  });
  const [verticalDistribution, setVerticalDistribution] = useState<Record<ObjectColor, number[]> | null>(null);
  const [activePerks, setActivePerks] = useState<PerkType[]>([]);
  const [roundUsedPerks, setRoundUsedPerks] = useState<PerkType[]>([]); 
  const [isPerkMenuOpen, setIsPerkMenuOpen] = useState(false);
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [isSelectingTarget, setIsSelectingTarget] = useState(false);
  
  // Result View States
  const [isViewingBoard, setIsViewingBoard] = useState(false);
  const [highlightedColor, setHighlightedColor] = useState<ObjectColor | null>(null);

  // Guess & Result State
  // center = Guess %, range = Margin % (relative)
  const [userGuess, setUserGuess] = useState<{ center: number; range: number; bet: number } | null>(null);
  
  // Counting State
  const [revealedArea, setRevealedArea] = useState(0); // Current % counted
  const [sweepProgress, setSweepProgress] = useState(0); // 0 to 100 representing scan line Y position
  
  // -- Refs --
  const timerRef = useRef<number | null>(null);

  // -- Helpers --
  const getGroupedInventory = () => {
    const counts: Record<string, number> = {};
    player.inventory.forEach(p => {
        counts[p] = (counts[p] || 0) + 1;
    });
    return (Array.from(new Set(player.inventory)) as PerkType[]).map(p => ({
        type: p,
        count: counts[p]
    }));
  };

  // -- Game Flow Actions --

  const startGame = () => {
    setPlayer({ cash: INITIAL_CASH, maxCash: INITIAL_CASH, level: 1, inventory: [], history: [] });
    startRound(1, INITIAL_CASH);
  };

  const startRound = (level: number, currentCash: number) => {
    const config = generateRoundConfig(level, currentCash);
    
    // Generate objects and calculate true area
    const { objects: newObjects, breakdown, verticalDistribution: vDist } = generateObjects(config);
    config.targetArea = breakdown[config.targetColor]; 
    
    setRoundConfig(config);
    setObjects(newObjects);
    setAreaBreakdown(breakdown);
    setVerticalDistribution(vDist);
    setActivePerks([]);
    setRoundUsedPerks([]); 
    setRevealedArea(0);
    setSweepProgress(0);
    setUserGuess(null);
    setHintMessage(null);
    setIsSelectingTarget(false);
    
    // Reset View States
    setIsViewingBoard(false);
    setHighlightedColor(null);
    
    setGameState(GameState.PREP);
  };

  const togglePerkMenu = () => {
    if (gameState === GameState.GUESS && !isSelectingTarget) {
        setIsPerkMenuOpen(!isPerkMenuOpen);
    }
  };

  const usePerk = (perk: PerkType) => {
    if (activePerks.includes(perk) && perk !== PerkType.CHANGE_TARGET && perk !== PerkType.SPY_DRONE) return;
    if (perk !== PerkType.FREE_PASS && roundUsedPerks.includes(perk) && perk !== PerkType.CHANGE_TARGET && perk !== PerkType.SPY_DRONE) return; 

    const idx = player.inventory.indexOf(perk);
    if (idx > -1) {
        const newInv = [...player.inventory];
        newInv.splice(idx, 1);
        setPlayer(p => ({ ...p, inventory: newInv }));
        
        // Mark as used
        setRoundUsedPerks([...roundUsedPerks, perk]);

        // Logic
        if (perk === PerkType.FLASH_BOOST) {
            setActivePerks([...activePerks, perk]);
            setIsPerkMenuOpen(false);
            triggerReflash();
        } else if (perk === PerkType.FREE_PASS) {
            setActivePerks([...activePerks, perk]);
            setIsPerkMenuOpen(false);
            startRound(player.level, player.cash);
        } else if (perk === PerkType.CHANGE_TARGET) {
            setIsPerkMenuOpen(false);
            setIsSelectingTarget(true); // Enter selection mode
        } else if (perk === PerkType.SPY_DRONE) {
            setIsPerkMenuOpen(false);
            handleSpyDrone();
        } else {
            // Passive perks
            setActivePerks([...activePerks, perk]);
        }
    }
  };

  const handleTargetSelect = (newColor: ObjectColor) => {
      if (!roundConfig || !objects.length) return;
      
      const newArea = areaBreakdown[newColor];

      setRoundConfig({
          ...roundConfig,
          targetColor: newColor,
          targetArea: newArea
      });
      
      // Add perk to active list now that it's confirmed
      setActivePerks([...activePerks, PerkType.CHANGE_TARGET]);
      setIsSelectingTarget(false);
  };

  const handleSpyDrone = () => {
      if (!roundConfig) return;
      const options = [ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW].filter(c => c !== roundConfig.targetColor);
      const randomColor = options[Math.floor(Math.random() * options.length)];
      
      const area = areaBreakdown[randomColor];

      setHintMessage(`${randomColor.toUpperCase()} AREA: ${area.toFixed(1)}%`);
      setTimeout(() => setHintMessage(null), 4000);
      setActivePerks([...activePerks, PerkType.SPY_DRONE]);
  };

  const triggerReflash = () => {
    setGameState(GameState.REFLASH);
    timerRef.current = window.setTimeout(() => {
        setGameState(GameState.GUESS);
    }, 3000);
  };

  const handleStartFlash = () => {
    setGameState(GameState.FLASH);
    let duration = roundConfig!.duration;
    
    timerRef.current = window.setTimeout(() => {
        if (roundConfig?.isClassified) {
             setGameState(GameState.REVEAL_MISSION);
             setTimeout(() => {
                 setGameState(GameState.GUESS);
             }, 2000);
        } else {
             setGameState(GameState.GUESS);
        }
    }, duration);
  };

  const handleLockIn = (guess: number, margin: number, bet: number) => {
    setUserGuess({ center: guess, range: margin, bet });
    setGameState(GameState.REVEAL);
    setIsPerkMenuOpen(false);
    setHintMessage(null);
  };

  // -- Animation & Result Logic --
  useEffect(() => {
    if (gameState === GameState.REVEAL && roundConfig && verticalDistribution) {
        const sweepDuration = 2500; // ms
        const startTime = Date.now();
        const endArea = roundConfig.targetArea;
        const colorDist = verticalDistribution[roundConfig.targetColor];
        
        // Use 350 to match gameLogic
        const SAMPLES_Y = 350; 
        const SAMPLES_X = 350;
        const TOTAL_SAMPLES = SAMPLES_X * SAMPLES_Y;

        const interval = requestAnimationFrame(function animate() {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(1, elapsed / sweepDuration);
            
            // Update Sweep Line Position (0 to 100)
            const currentSweep = progress * 100;
            setSweepProgress(currentSweep);

            // Calculate exact area accumulated so far based on Y-distribution
            const sampleIndex = Math.floor(progress * SAMPLES_Y);
            let hitsSoFar = 0;
            for(let i=0; i < sampleIndex && i < SAMPLES_Y; i++) {
                hitsSoFar += colorDist[i] || 0;
            }
            
            // Add partial fraction for current line smoothness
            if (sampleIndex < SAMPLES_Y) {
                const fraction = (progress * SAMPLES_Y) - sampleIndex;
                hitsSoFar += (colorDist[sampleIndex] || 0) * fraction;
            }

            const currentPct = (hitsSoFar / TOTAL_SAMPLES) * 100;
            setRevealedArea(currentPct);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setRevealedArea(endArea); // Ensure exact match at end
                setTimeout(() => finalizeRound(), 500);
            }
        });

        return () => {
           cancelAnimationFrame(interval);
        };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const finalizeRound = () => {
    setPlayer(prevPlayer => {
        if (!userGuess || !roundConfig) return prevPlayer; 

        const trueArea = roundConfig.targetArea;
        const { center, range, bet } = userGuess; // Center is Guess%, Range is Margin%
        
        const marginDecimal = range / 100;
        const min = center * (1 - marginDecimal);
        const max = center * (1 + marginDecimal);

        const won = trueArea >= min && trueArea <= max;
        
        let winnings = 0; 
        if (won) {
            let multiplier = 1 + (40 / range);
            
            if (multiplier > 50) multiplier = 50;
            if (multiplier < 1.01) multiplier = 1.01;
            if (activePerks.includes(PerkType.ODDS_BOOST)) multiplier *= 1.5;
            
            const totalReturn = Math.floor(bet * multiplier);
            winnings = totalReturn - bet;
        } else {
            winnings = -bet;
        }

        const error = Math.abs(trueArea - center);
        const marginAbs = center * marginDecimal;
        const inBullseye = error < (marginAbs * 0.2); 

        const earnedPerks: string[] = [];
        if (inBullseye && won) {
            const perkKeys = Object.values(PerkType);
            const count = activePerks.includes(PerkType.DOUBLE_LOOT) ? 2 : 1;
            for(let i=0; i<count; i++) {
                const p = perkKeys[Math.floor(Math.random() * perkKeys.length)];
                earnedPerks.push(p);
            }
        }

        const newCash = prevPlayer.cash + winnings;
        const newMaxCash = Math.max(prevPlayer.maxCash, newCash);
        const nextInventory = [...prevPlayer.inventory, ...earnedPerks as PerkType[]];

        return {
            ...prevPlayer,
            cash: newCash,
            maxCash: newMaxCash,
            inventory: nextInventory,
            history: [...prevPlayer.history, { level: prevPlayer.level, win: won, amount: winnings, perksEarned: earnedPerks }]
        };
    });

    setGameState(GameState.RESULT);
  };

  const handleNextRound = () => {
    const currentLevel = player.level;
    const milestoneCheck = MILESTONES.find(m => m.level === currentLevel);
    
    if (player.cash <= 0) {
        setGameState(GameState.GAME_OVER);
        return;
    }
    if (milestoneCheck && player.cash < milestoneCheck.cash) {
        setGameState(GameState.GAME_OVER);
        return;
    }
    if (player.level >= 50) {
        setGameState(GameState.VICTORY);
        return;
    }

    const nextLevel = currentLevel + 1;
    setPlayer(p => ({ ...p, level: nextLevel }));
    startRound(nextLevel, player.cash);
  };

  const getSortedObjects = () => {
    if (!highlightedColor) return objects;
    
    // Split objects into 'bg' (masked) and 'fg' (highlighted)
    // We render highlighted last so they sit on top and don't get corners cut by white masks
    const bg = objects.filter(o => o.color !== highlightedColor);
    const fg = objects.filter(o => o.color === highlightedColor);
    return [...bg, ...fg];
  };

  // -- Renders --

  const renderBackground = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
       <div className="absolute top-0 left-0 w-full h-full bg-slate-900 z-0" />
    </div>
  );
  
  const standardButtonClass = "w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-lg uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2";
  const secondaryButtonClass = "w-full py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-bold text-lg uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2";

  // Sorting for render to prevent z-fighting clipping
  const renderObjects = getSortedObjects();

  if (gameState === GameState.MENU) {
    return (
      <div className="relative w-full h-screen flex flex-col items-center justify-center p-6 text-center font-sans bg-slate-900 z-50">
        {renderBackground()}
        <div className="z-10 animate-float pointer-events-none">
            <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500 mb-2 drop-shadow-2xl">
                AREA
            </h1>
            <h1 className="text-6xl font-black text-white mb-8 drop-shadow-2xl">
                GUESS
            </h1>
        </div>
        <div className="z-20 max-w-xs space-y-6">
            <p className="text-slate-300">
                Analyze the mosaic. Estimate the surface area percentage. Reach <span className="text-green-400 font-bold">$1,000</span> by Level 10.
            </p>
            <button 
                onClick={startGame} 
                className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-black text-xl rounded-full shadow-lg shadow-cyan-500/50 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative z-50"
            >
                <Play fill="currentColor" /> START GAME
            </button>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER || gameState === GameState.VICTORY) {
     const isVictory = gameState === GameState.VICTORY;
     return (
        <div className="relative w-full h-screen flex flex-col items-center justify-center p-6 text-center z-50 bg-slate-900">
           {renderBackground()}
           <div className="z-10 bg-slate-800/90 p-8 rounded-2xl border border-slate-700 backdrop-blur-md shadow-2xl max-w-sm w-full">
               {isVictory ? <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4" /> : <RotateCcw className="w-20 h-20 text-red-400 mx-auto mb-4" />}
               <h2 className={`text-4xl font-black mb-2 ${isVictory ? 'text-yellow-400' : 'text-red-500'}`}>
                   {isVictory ? 'CASINO BANKRUPTED!' : 'GAME OVER'}
               </h2>
               <div className="space-y-2 mb-6 text-left bg-slate-900/50 p-4 rounded-xl">
                   <div className="flex justify-between">
                       <span className="text-slate-400">Level Reached</span>
                       <span className="text-white font-bold">{player.level}</span>
                   </div>
                   <div className="flex justify-between">
                       <span className="text-slate-400">Highest Bankroll</span>
                       <span className="text-green-400 font-bold">${player.maxCash}</span>
                   </div>
                   <div className="flex justify-between pt-2 border-t border-slate-700">
                       <span className="text-slate-300">Final Balance</span>
                       <span className="text-white font-bold">${player.cash}</span>
                   </div>
               </div>
               
               <button onClick={startGame} className="w-full py-3 bg-white text-slate-900 font-bold rounded-xl hover:bg-slate-200 transition">
                   Play Again
               </button>
           </div>
        </div>
     );
  }

  const renderVisualRange = () => {
    if (!userGuess || !roundConfig) return null;
    const { center, range } = userGuess; // Center = Guess%, Range = Margin (+/-)
    
    const marginDecimal = range / 100;
    const guessMin = Math.max(0, center * (1 - marginDecimal));
    const guessMax = Math.min(100, center * (1 + marginDecimal));
    
    const marginAbs = center * marginDecimal;
    const bMin = Math.max(0, center - (marginAbs * 0.2));
    const bMax = Math.min(100, center + (marginAbs * 0.2));

    const rawLimit = guessMax + 10;
    const scaleMax = Math.min(100, Math.ceil(rawLimit / 5) * 5);

    const toPct = (val: number) => {
        const pct = (val / scaleMax) * 100;
        return Math.min(100, Math.max(0, pct));
    };

    return (
        <div className="w-full max-w-md px-4 pb-8 z-[60]">
            <div className="relative h-4 bg-slate-800 rounded-full w-full shadow-inner border border-slate-700">
                <div 
                    className="absolute top-0 bottom-0 bg-blue-500/40 border-x border-blue-400 rounded-sm"
                    style={{ left: `${toPct(guessMin)}%`, width: `${toPct(guessMax) - toPct(guessMin)}%` }}
                />
                <div 
                    className="absolute top-0.5 bottom-0.5 bg-yellow-400/80 rounded-sm z-10"
                    style={{ left: `${toPct(bMin)}%`, width: `${toPct(bMax) - toPct(bMin)}%` }}
                >
                     <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-cyan-400 font-bold text-xs whitespace-nowrap">
                        {center}%
                     </div>
                </div>
                <div 
                    className="absolute -top-2 -bottom-2 w-0.5 bg-white shadow-[0_0_10px_white] z-20"
                    style={{ left: `${toPct(revealedArea)}%` }}
                >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
                </div>
            </div>
            
            <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono uppercase tracking-wider">
                <span>0%</span>
                <span>{scaleMax}%</span>
            </div>
        </div>
    );
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-900">
      {renderBackground()}
      
      <div className="relative z-[60] px-4 py-3 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex justify-between items-center shadow-lg shrink-0">
        <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">BANKROLL</span>
            <div className="flex items-center gap-1 text-green-400 font-black text-xl">
                <Coins size={18} />
                ${player.cash}
            </div>
        </div>
        
        <div className="flex flex-col items-center">
             <div className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">LEVEL {player.level}</div>
             <div className="text-white font-bold text-sm">Goal: ${roundConfig?.targetCash}</div>
        </div>

        <button 
            onClick={togglePerkMenu}
            disabled={gameState !== GameState.GUESS || isSelectingTarget}
            className={`p-2 rounded-lg border flex items-center gap-2 transition-colors ${
                gameState === GameState.GUESS && !isSelectingTarget
                    ? 'bg-slate-800 border-slate-600 text-white hover:bg-slate-700' 
                    : 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
            }`}
        >
             <Briefcase size={16} />
             <div className="text-xs font-bold">{player.inventory.length} Perks</div>
        </button>
      </div>

      {hintMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[70] animate-entrance">
              <div className="bg-cyan-500/90 text-white px-6 py-2 rounded-full font-black shadow-[0_0_20px_rgba(6,182,212,0.5)] flex items-center gap-2">
                  <ScanEye size={20} />
                  {hintMessage}
              </div>
          </div>
      )}

      {isPerkMenuOpen && gameState === GameState.GUESS && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900">
                      <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <Briefcase size={16} className="text-cyan-400"/> Inventory
                      </h3>
                      <button onClick={() => setIsPerkMenuOpen(false)} className="text-slate-400 hover:text-white">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                      {player.inventory.length === 0 ? (
                          <div className="text-center text-slate-500 py-8 italic">No perks available. Win rounds to earn them!</div>
                      ) : (
                          getGroupedInventory().map((item, idx) => {
                              const isUsed = item.type !== PerkType.FREE_PASS && 
                                           item.type !== PerkType.CHANGE_TARGET && 
                                           item.type !== PerkType.SPY_DRONE && 
                                           roundUsedPerks.includes(item.type as PerkType);
                              return (
                                <div key={idx} className="bg-slate-700/50 p-3 rounded-lg border border-slate-600 flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-sm">{item.type}</span>
                                            {item.count > 1 && (
                                                <span className="bg-cyan-500 text-white text-[10px] font-black px-1.5 rounded-md">
                                                    x{item.count}
                                                </span>
                                            )}
                                        </div>
                                        {activePerks.includes(item.type as PerkType) && item.type !== PerkType.SPY_DRONE && item.type !== PerkType.CHANGE_TARGET ? (
                                            <span className="text-xs text-green-400 font-bold bg-green-400/10 px-2 py-1 rounded">ACTIVE</span>
                                        ) : isUsed ? (
                                            <span className="text-xs text-slate-500 font-bold bg-slate-800 px-2 py-1 rounded border border-slate-700">MAX 1/RND</span>
                                        ) : (
                                            <button 
                                                onClick={() => usePerk(item.type as PerkType)}
                                                className="text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded font-bold transition-colors"
                                            >
                                                USE
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 leading-tight">
                                        {PERK_DESCRIPTIONS[item.type as PerkType]}
                                    </p>
                                </div>
                              );
                          })
                      )}
                  </div>
              </div>
          </div>
      )}

      <div className="relative flex-1 w-full max-w-md mx-auto z-10 flex flex-col items-center justify-center">
        
        {(gameState === GameState.REVEAL || (gameState === GameState.RESULT && !isViewingBoard)) && roundConfig && (
            <div className="mb-4 text-center z-[60] animate-entrance">
                 <div className={`text-6xl font-black text-${roundConfig.targetColor}-400 drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)]`}>
                     {revealedArea.toFixed(1)}%
                 </div>
                 <div className="text-white font-bold text-sm uppercase tracking-widest">Actual Area</div>
            </div>
        )}

        {gameState === GameState.RESULT && isViewingBoard && (
            <div className="w-full max-w-sm grid grid-cols-4 gap-2 mb-6 z-[60] animate-entrance px-2">
                {[ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW].map(color => {
                    const area = areaBreakdown[color] || 0;
                    return (
                        <button
                            key={color}
                            onClick={() => setHighlightedColor(highlightedColor === color ? null : color)}
                            className={`
                                flex flex-col items-center justify-center py-4 rounded-lg shadow-lg transition-all duration-300 border border-white/10
                                ${COLORS[color]}
                                ${highlightedColor && highlightedColor !== color ? 'opacity-30 scale-95 blur-[1px]' : 'opacity-100 scale-100'}
                                ${highlightedColor === color ? 'ring-2 ring-white scale-110 z-10' : ''}
                            `}
                        >
                            <span className="text-white font-black text-xl drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                                {area.toFixed(0)}%
                            </span>
                        </button>
                    );
                })}
            </div>
        )}

        {(gameState === GameState.FLASH || gameState === GameState.REFLASH || gameState === GameState.REVEAL || (gameState === GameState.RESULT && isViewingBoard) || gameState === GameState.REVEAL_MISSION) && (
          <div className="relative w-full aspect-square max-w-[350px] bg-white border-4 border-slate-300 overflow-hidden shadow-2xl rounded-lg mb-8">
             <div className="absolute inset-0 z-0">
                {renderObjects.map(obj => (
                     <GameObjectItem 
                        key={`dim-${obj.id}`} 
                        obj={obj} 
                        isPopped={false} 
                        isDimmed={false}
                        shouldMove={false}
                        variant="preview"
                        targetColor={roundConfig?.targetColor}
                        highlightedColor={highlightedColor}
                     />
                 ))}
             </div>

             <div 
                className="absolute inset-0 z-10"
                style={{
                    clipPath: (gameState === GameState.REVEAL) 
                        ? `inset(0 0 ${100 - sweepProgress}% 0)` // Reveal from top down
                        : 'inset(0 0 0 0)'
                }}
             >
                {(gameState === GameState.FLASH || gameState === GameState.REFLASH || gameState === GameState.REVEAL || (gameState === GameState.RESULT && isViewingBoard)) && renderObjects.map(obj => (
                     <GameObjectItem 
                        key={`full-${obj.id}`} 
                        obj={obj} 
                        isPopped={false} 
                        isDimmed={false}
                        shouldMove={false}
                        variant="normal"
                        highlightedColor={highlightedColor}
                     />
                 ))}
             </div>

             {gameState === GameState.REVEAL && (
                 <div 
                    className="absolute w-full h-[2px] bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] z-20"
                    style={{ top: `${sweepProgress}%` }}
                 />
             )}
          </div>
        )}

        {gameState === GameState.PREP && roundConfig && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm z-20">
                <div className="text-center mb-8">
                    <h2 className="text-slate-300 text-lg uppercase tracking-widest mb-1">Target Color</h2>
                    
                    {roundConfig.isClassified ? (
                        <div className="space-y-2">
                             <h1 className="text-4xl font-black text-red-500 bg-slate-900/80 px-8 py-4 rounded-xl border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse inline-block">
                                 CLASSIFIED
                             </h1>
                             <p className="text-red-300 text-sm font-bold">Revealed after observation</p>
                        </div>
                    ) : (
                        <h1 className={`text-4xl font-black text-white bg-${roundConfig.targetColor}-500 px-8 py-4 rounded-2xl border-4 border-white/20 shadow-xl inline-block uppercase`}>
                            {roundConfig.targetColor}
                        </h1>
                    )}
                </div>

                <button 
                    onClick={handleStartFlash}
                    className="group relative px-8 py-4 bg-white text-slate-900 font-black text-xl rounded-full shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all active:scale-95"
                >
                    <span className="flex items-center gap-2">
                        <Eye className="group-hover:scale-110 transition-transform" /> 
                        OBSERVE
                    </span>
                </button>
            </div>
        )}

        {gameState === GameState.REVEAL_MISSION && roundConfig && (
             <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
                  <div className="text-center animate-entrance">
                        <div className="text-xs text-red-400 font-bold uppercase tracking-widest mb-1">TARGET CONFIRMED</div>
                        <div className="text-2xl font-black text-white mb-4">Estimate Area For:</div>
                        <div className={`text-4xl font-black text-white bg-${roundConfig.targetColor}-500 px-8 py-4 rounded-2xl border-4 border-white/20 shadow-xl inline-block uppercase`}>
                            {roundConfig.targetColor}
                        </div>
                  </div>
             </div>
        )}

        {gameState === GameState.GUESS && roundConfig && (
            <div className="w-full flex-1 z-30 flex flex-col items-center justify-center px-4 py-2 min-h-0">
               
               {isSelectingTarget ? (
                   <div className="w-full max-w-xl mx-auto p-5 bg-slate-900/95 rounded-3xl border border-slate-700 shadow-2xl backdrop-blur-md animate-entrance">
                       <h3 className="text-white font-bold text-center mb-6 uppercase tracking-widest flex items-center justify-center gap-2 text-xl">
                           <MousePointerClick size={24} /> Select New Target
                       </h3>
                       <div className="grid grid-cols-2 gap-4 mb-6">
                          {[ObjectColor.RED, ObjectColor.BLUE, ObjectColor.GREEN, ObjectColor.YELLOW].map(c => {
                              if (c === roundConfig.targetColor) return null; 
                              const bgClass = COLORS[c];
                              return (
                                  <button
                                    key={c}
                                    onClick={() => handleTargetSelect(c)}
                                    className={`p-6 rounded-2xl ${bgClass} hover:opacity-80 transition active:scale-95 flex flex-col items-center justify-center gap-2 border-4 border-transparent hover:border-white/50 shadow-xl`}
                                  >
                                      <span className="font-black text-slate-900 text-2xl uppercase tracking-wider">{c}</span>
                                  </button>
                              )
                          })}
                       </div>
                       <button onClick={() => setIsSelectingTarget(false)} className="w-full py-5 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700 transition text-xl">
                           Cancel
                       </button>
                   </div>
               ) : (
                   <BettingInterface 
                     maxCountGuess={100} 
                     currentCash={player.cash}
                     onLockIn={handleLockIn}
                     activePerks={activePerks}
                     targetColor={roundConfig.targetColor}
                   />
               )}
            </div>
        )}

        {gameState === GameState.RESULT && userGuess && !isViewingBoard && (
             <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-900/80 backdrop-blur-md z-[100]">
                 <div className="bg-slate-800 border border-slate-600 p-6 rounded-2xl shadow-2xl w-full max-w-sm text-center">
                     
                     {player.history[player.history.length-1].win ? (
                         <div className="mb-6">
                            <h2 className="text-4xl font-black text-green-400 mb-1">PAYOUT!</h2>
                            <p className="text-green-400 text-xl font-bold">
                                +${player.history[player.history.length-1].amount}
                            </p>
                         </div>
                     ) : (
                         <div className="mb-6">
                             <h2 className="text-4xl font-black text-red-500 mb-1">BUST!</h2>
                             <p className="text-red-400 text-xl font-bold">
                                 -${Math.abs(player.history[player.history.length-1].amount)}
                             </p>
                         </div>
                     )}

                     <div className="grid grid-cols-[0.8fr_1.2fr] gap-4 mb-6 text-left bg-slate-900/50 p-4 rounded-xl">
                         <div>
                             <div className="text-xs text-slate-500 uppercase font-bold">True Area</div>
                             <div className={`text-2xl font-bold text-${roundConfig?.targetColor}-400`}>
                                 {roundConfig?.targetArea.toFixed(1)}%
                             </div>
                         </div>
                         <div className="text-right">
                             <div className="text-xs text-slate-500 uppercase font-bold">Your Range</div>
                             <div className="text-xl font-bold text-cyan-400 whitespace-nowrap">
                                 {(userGuess.center * (1 - userGuess.range/100)).toFixed(1)}% - {(userGuess.center * (1 + userGuess.range/100)).toFixed(1)}%
                             </div>
                         </div>
                     </div>
                     
                     {player.history[player.history.length-1].perksEarned && player.history[player.history.length-1].perksEarned!.length > 0 && (
                         <div className="mb-6 py-2 px-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg flex flex-col items-center gap-2">
                             <div className="flex items-center gap-2">
                                <Zap className="text-yellow-400 fill-yellow-400" size={20} />
                                <div className="text-yellow-400 font-bold text-sm uppercase">Bullseye Hit!</div>
                             </div>
                             <div className="text-yellow-100 text-xs font-bold text-center">
                                 Earned: {player.history[player.history.length-1].perksEarned!.join(', ')}
                             </div>
                         </div>
                     )}

                     <div className="space-y-3">
                        <button onClick={handleNextRound} className={standardButtonClass}>
                             NEXT ROUND <ArrowRight size={20} />
                        </button>
                        <button onClick={() => { setIsViewingBoard(true); setHighlightedColor(null); }} className={secondaryButtonClass}>
                             VIEW BOARD <LayoutDashboard size={20} />
                        </button>
                     </div>
                 </div>
             </div>
        )}

        {gameState === GameState.RESULT && isViewingBoard && (
             <div className="fixed bottom-0 left-0 w-full p-4 bg-slate-900 border-t border-slate-800 z-[100] animate-entrance">
                  <div className="max-w-md mx-auto grid grid-cols-2 gap-4">
                      <button 
                         onClick={() => setIsViewingBoard(false)} 
                         className={secondaryButtonClass}
                      >
                         <Undo2 size={18} /> Back
                      </button>
                      <button onClick={handleNextRound} className={standardButtonClass}>
                          Next Round <ArrowRight size={18} />
                      </button>
                  </div>
             </div>
        )}
      </div>

      <div className="flex flex-col items-center pb-6">
         {(gameState === GameState.REVEAL || (gameState === GameState.RESULT && !isViewingBoard)) && renderVisualRange()}
      </div>

    </div>
  );
}