import React from 'react';
import { GameObject, ObjectColor, ObjectShape } from '../types';

interface Props {
  obj: GameObject;
  variant?: 'normal' | 'preview';
  targetColor?: ObjectColor;
  highlightedColor?: ObjectColor | null;
}

// Light/dark stop pairs for the radial gradient per colour.
// Simulates a light source coming from the upper-left corner.
const GRADIENT_STOPS: Record<ObjectColor, { light: string; mid: string; dark: string }> = {
  [ObjectColor.RED]:    { light: '#ff9999', mid: '#ef4444', dark: '#7f1d1d' },
  [ObjectColor.BLUE]:  { light: '#93c5fd', mid: '#3b82f6', dark: '#1e3a8a' },
  [ObjectColor.GREEN]: { light: '#86efac', mid: '#22c55e', dark: '#14532d' },
  [ObjectColor.YELLOW]:{ light: '#fef08a', mid: '#eab308', dark: '#713f12' },
  [ObjectColor.WHITE]: { light: '#ffffff', mid: '#f1f5f9', dark: '#cbd5e1' },
};

export const GameObjectItem: React.FC<Props> = ({ obj, variant = 'normal', targetColor, highlightedColor }) => {
  const isTarget = obj.color === targetColor;
  const isMasking = !!(highlightedColor && obj.color !== highlightedColor);

  // Sanitise the object id for use in SVG gradient ids
  const safeId = obj.id.replace(/[^a-zA-Z0-9]/g, '_');
  const gradId   = `grad_${safeId}`;
  const specId   = `spec_${safeId}`;

  const containerStyle: React.CSSProperties = {
    left:     `${obj.x}%`,
    top:      `${obj.y}%`,
    width:    `${obj.w}%`,
    height:   `${obj.h}%`,
    position: 'absolute',
    zIndex:   obj.zIndex ?? 1,
    display:  'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    transition: 'opacity 0.2s ease, filter 0.2s ease',
  };

  if (variant === 'preview') {
    if (highlightedColor) {
      containerStyle.opacity = 0;
    } else if (isTarget) {
      containerStyle.opacity = 0.30;
      containerStyle.filter  = 'grayscale(0.2)';
    } else {
      containerStyle.opacity = 0.05;
      containerStyle.filter  = 'grayscale(1)';
    }
  } else {
    if (highlightedColor) {
      if (isMasking) {
        containerStyle.opacity = 1;
        containerStyle.filter  = 'none';
      } else {
        containerStyle.opacity = 1;
        containerStyle.filter  = 'drop-shadow(0 0 8px rgba(0,0,0,0.6)) drop-shadow(0 0 4px rgba(255,255,255,0.25))';
      }
    } else {
      containerStyle.opacity = 1;
      containerStyle.filter  = 'drop-shadow(1px 3px 4px rgba(0,0,0,0.40))';
    }
  }

  const rotationStyle: React.CSSProperties = {
    width:  '100%',
    height: '100%',
    transform: `rotate(${obj.rotation || 0}deg)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  // When masking, render the shape in white so non-target colours disappear.
  const useMask = isMasking;
  const stops = GRADIENT_STOPS[obj.color] ?? GRADIENT_STOPS[ObjectColor.WHITE];

  // SVG gradient defs shared by all shapes that use fill
  const GradDefs = () => (
    <defs>
      {/* Main radial gradient — simulates sphere lighting from upper-left */}
      <radialGradient id={gradId} cx="32%" cy="28%" r="72%" fx="22%" fy="18%">
        <stop offset="0%"   stopColor={stops.light} />
        <stop offset="55%"  stopColor={stops.mid}   />
        <stop offset="100%" stopColor={stops.dark}   />
      </radialGradient>
      {/* Specular highlight — small bright glint */}
      <radialGradient id={specId} cx="28%" cy="22%" r="32%">
        <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)"    />
      </radialGradient>
    </defs>
  );

  const fill      = useMask ? '#ffffff' : `url(#${gradId})`;
  const specFill  = useMask ? 'none'    : `url(#${specId})`;
  const strokeW   = obj.strokeWidth ?? 0.2;

  const renderContent = () => {
    switch (obj.shape) {

      // ── TEXT ────────────────────────────────────────────────────────────────
      case ObjectShape.TEXT:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <text
              x="50" y="50" fontSize="85"
              fill={fill}
              textAnchor="middle" dominantBaseline="central"
              fontWeight="900" style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            />
            {/* Render char via tspan so fill applies */}
            <text
              x="50" y="50" fontSize="85"
              fill={fill}
              textAnchor="middle" dominantBaseline="central"
              fontWeight="900" style={{ fontFamily: 'Arial Black, Arial, sans-serif' }}
            >{obj.char}</text>
          </svg>
        );

      // ── RING ─────────────────────────────────────────────────────────────────
      case ObjectShape.RING: {
        const r  = (0.5 - strokeW / 2) * 100;
        const sw = strokeW * 100;
        const strokeColor = useMask ? '#ffffff' : stops.mid;
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <defs>
              {/* Rings use a stroke so we apply a linear gradient along the stroke */}
              <linearGradient id={`${gradId}_rg`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={stops.light} />
                <stop offset="50%"  stopColor={stops.mid}   />
                <stop offset="100%" stopColor={stops.dark}   />
              </linearGradient>
            </defs>
            <circle cx={50} cy={50} r={r}
              fill="none"
              stroke={useMask ? '#ffffff' : `url(#${gradId}_rg)`}
              strokeWidth={sw + 1}
            />
            {/* Inner highlight arc */}
            {!useMask && (
              <circle cx={50} cy={50} r={r}
                fill="none"
                stroke="rgba(255,255,255,0.30)"
                strokeWidth={sw * 0.35}
                strokeDasharray={`${r * Math.PI * 0.4} ${r * Math.PI * 1.6}`}
                strokeDashoffset={`${r * Math.PI * 0.15}`}
              />
            )}
          </svg>
        );
      }

      // ── FRAME ────────────────────────────────────────────────────────────────
      case ObjectShape.FRAME: {
        const sw    = strokeW * 100;
        const inset = sw / 2;
        const dim   = 100 - sw;
        const strokeColor = useMask ? '#ffffff' : stops.mid;
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <defs>
              <linearGradient id={`${gradId}_fg`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor={stops.light} />
                <stop offset="100%" stopColor={stops.dark}   />
              </linearGradient>
            </defs>
            <rect x={inset} y={inset} width={dim} height={dim}
              fill="none"
              stroke={useMask ? '#ffffff' : `url(#${gradId}_fg)`}
              strokeWidth={sw}
            />
          </svg>
        );
      }

      // ── CIRCLE ───────────────────────────────────────────────────────────────
      case ObjectShape.CIRCLE:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <circle cx={50} cy={50} r={49} fill={fill} />
            <circle cx={50} cy={50} r={49} fill={specFill} />
          </svg>
        );

      // ── RECTANGLE ────────────────────────────────────────────────────────────
      case ObjectShape.RECTANGLE:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <rect x={0} y={0} width={100} height={100} fill={fill} />
            <rect x={0} y={0} width={100} height={100} fill={specFill} />
          </svg>
        );

      // ── TRIANGLE ─────────────────────────────────────────────────────────────
      case ObjectShape.TRIANGLE:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <polygon points="50,5 5,95 95,95" fill={fill} />
            <polygon points="50,5 5,95 95,95" fill={specFill} />
          </svg>
        );

      // ── DIAMOND ──────────────────────────────────────────────────────────────
      case ObjectShape.DIAMOND:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <polygon points="50,0 100,50 50,100 0,50" fill={fill} />
            <polygon points="50,0 100,50 50,100 0,50" fill={specFill} />
          </svg>
        );

      // ── STAR (5-point) ───────────────────────────────────────────────────────
      case ObjectShape.STAR:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" fill={fill} />
            <polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" fill={specFill} />
          </svg>
        );

      // ── SIX-POINT STAR ───────────────────────────────────────────────────────
      case ObjectShape.SIX_POINT_STAR:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <polygon points="50,5 15,75 85,75"  fill={fill} />
            <polygon points="50,95 15,25 85,25" fill={fill} />
            <polygon points="50,5 15,75 85,75"  fill={specFill} />
            <polygon points="50,95 15,25 85,25" fill={specFill} />
          </svg>
        );

      // ── HEART ────────────────────────────────────────────────────────────────
      case ObjectShape.HEART:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <path
              d="M50 85 C50 85 10 55 10 30 C10 15 25 5 40 5 C50 5 50 15 50 15 C50 15 50 5 60 5 C75 5 90 15 90 30 C90 55 50 85 50 85Z"
              fill={fill}
            />
            <path
              d="M50 85 C50 85 10 55 10 30 C10 15 25 5 40 5 C50 5 50 15 50 15 C50 15 50 5 60 5 C75 5 90 15 90 30 C90 55 50 85 50 85Z"
              fill={specFill}
            />
          </svg>
        );

      // ── ARROW ────────────────────────────────────────────────────────────────
      case ObjectShape.ARROW:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <polygon points="50,5 5,50 25,50 25,95 75,95 75,50 95,50" fill={fill} />
            <polygon points="50,5 5,50 25,50 25,95 75,95 75,50 95,50" fill={specFill} />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
            <GradDefs />
            <circle cx={50} cy={50} r={49} fill={fill} />
          </svg>
        );
    }
  };

  return <div style={containerStyle}>{renderContent()}</div>;
};
