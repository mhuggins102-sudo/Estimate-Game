import React from 'react';
import { GameObject, ObjectColor, ObjectShape } from '../types';

interface Props {
  obj: GameObject;
  variant?: 'normal' | 'preview';
  targetColor?: ObjectColor;
  highlightedColor?: ObjectColor | null;
}

// Flat, saturated colours — no gradients, no 3-D shading.
const FLAT_COLOR: Record<ObjectColor, string> = {
  [ObjectColor.RED]:    '#ef4444',
  [ObjectColor.BLUE]:  '#3b82f6',
  [ObjectColor.GREEN]: '#22c55e',
  [ObjectColor.YELLOW]:'#eab308',
  [ObjectColor.WHITE]: '#f8fafc',
};

export const GameObjectItem: React.FC<Props> = ({
  obj,
  variant = 'normal',
  targetColor,
  highlightedColor,
}) => {
  const isTarget  = obj.color === targetColor;
  const isMasking = !!(highlightedColor && obj.color !== highlightedColor);

  // The colour to actually paint.  When masking non-target shapes, use white
  // so they blend into the background.
  const paintColor = isMasking ? '#ffffff' : FLAT_COLOR[obj.color] ?? FLAT_COLOR[ObjectColor.WHITE];

  // ── Container ──────────────────────────────────────────────────────────────
  const containerStyle: React.CSSProperties = {
    position:       'absolute',
    left:           `${obj.x}%`,
    top:            `${obj.y}%`,
    width:          `${obj.w}%`,
    height:         `${obj.h}%`,
    zIndex:         obj.zIndex ?? 1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    pointerEvents:  'none',
    transition:     'opacity 0.2s ease',
    transform:      `rotate(${obj.rotation || 0}deg)`,
    transformOrigin:'center center',
  };

  if (variant === 'preview') {
    containerStyle.opacity = highlightedColor ? 0 : isTarget ? 0.30 : 0.05;
    if (!isTarget && !highlightedColor) containerStyle.filter = 'grayscale(1)';
  } else {
    if (highlightedColor && !isMasking) {
      containerStyle.filter = 'drop-shadow(0 0 6px rgba(0,0,0,0.5))';
    } else if (!highlightedColor) {
      containerStyle.filter = 'drop-shadow(1px 2px 3px rgba(0,0,0,0.30))';
    }
  }

  // ── Shape renderer ─────────────────────────────────────────────────────────
  // For hollow objects we use stroke with no fill; for solid we use flat fill.
  const isHollow = !!(obj.hollow || obj.shape === ObjectShape.RING || obj.shape === ObjectShape.FRAME);
  const sw = Math.max(0.05, Math.min(0.45, obj.strokeWidth ?? 0.15));

  // Hollow params in SVG units (viewBox 0 0 100 100)
  const svgStrokeW = sw * 100;                      // Total stroke width in SVG units
  const halfSW     = svgStrokeW / 2;               // Stroke extends halfSW each way from path

  const solidFill   = isHollow ? 'none'       : paintColor;
  const strokeColor = isHollow ? paintColor   : 'none';
  const strokeWidth = isHollow ? svgStrokeW   : 0;

  const renderShape = () => {
    switch (obj.shape) {

      // ── CIRCLE / RING (always circular) ─────────────────────────────────
      case ObjectShape.CIRCLE:
      case ObjectShape.RING: {
        // For hollow: path at radius (50 - halfSW) so stroke spans [50-sw*100, 50]
        const r = isHollow ? 50 - halfSW : 49;
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <circle cx={50} cy={50} r={r}
              fill={solidFill}
              stroke={strokeColor}
              strokeWidth={isHollow ? svgStrokeW : 0}
            />
          </svg>
        );
      }

      // ── RECTANGLE / FRAME (always rectangular) ───────────────────────────
      case ObjectShape.RECTANGLE:
      case ObjectShape.FRAME: {
        if (isHollow) {
          // Rect path sits at half stroke inside the box
          const inset = halfSW;
          const dim   = 100 - svgStrokeW;
          return (
            <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
              <rect x={inset} y={inset} width={dim} height={dim}
                fill="none"
                stroke={strokeColor}
                strokeWidth={svgStrokeW}
              />
            </svg>
          );
        }
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <rect x={0} y={0} width={100} height={100} fill={solidFill} />
          </svg>
        );
      }

      // ── TRIANGLE ─────────────────────────────────────────────────────────
      case ObjectShape.TRIANGLE:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <polygon points="50,5 5,95 95,95"
              fill={solidFill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );

      // ── DIAMOND ──────────────────────────────────────────────────────────
      case ObjectShape.DIAMOND:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <polygon points="50,0 100,50 50,100 0,50"
              fill={solidFill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );

      // ── 5-POINT STAR ─────────────────────────────────────────────────────
      case ObjectShape.STAR:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <polygon
              points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35"
              fill={solidFill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );

      // ── 6-POINT STAR ─────────────────────────────────────────────────────
      case ObjectShape.SIX_POINT_STAR:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <polygon points="50,5 15,75 85,75"  fill={solidFill} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
            <polygon points="50,95 15,25 85,25" fill={solidFill} stroke={strokeColor} strokeWidth={strokeWidth} strokeLinejoin="round" />
          </svg>
        );

      // ── HEART ────────────────────────────────────────────────────────────
      case ObjectShape.HEART: {
        const hPath = "M50 85 C50 85 10 55 10 30 C10 15 25 5 40 5 C50 5 50 15 50 15 C50 15 50 5 60 5 C75 5 90 15 90 30 C90 55 50 85 50 85Z";
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <path d={hPath}
              fill={solidFill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );
      }

      // ── ARROW ────────────────────────────────────────────────────────────
      case ObjectShape.ARROW:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <polygon points="50,5 5,50 25,50 25,95 75,95 75,50 95,50"
              fill={solidFill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
            />
          </svg>
        );

      // ── TEXT (rendered as styled character) ──────────────────────────────
      case ObjectShape.TEXT:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <text
              x="50" y="54"
              fontSize="88"
              fill={paintColor}
              textAnchor="middle"
              dominantBaseline="middle"
              fontWeight="900"
              fontFamily="Arial Black, Arial, sans-serif"
            >{obj.char ?? '?'}</text>
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 100 100" width="100%" height="100%" overflow="visible">
            <circle cx={50} cy={50} r={49} fill={solidFill} />
          </svg>
        );
    }
  };

  return <div style={containerStyle}>{renderShape()}</div>;
};
