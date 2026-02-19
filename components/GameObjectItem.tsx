import React from 'react';
import { GameObject, ObjectColor, ObjectShape } from '../types';

interface Props {
  obj: GameObject;
  variant?: 'normal' | 'preview'; // 'normal' = full color, 'preview' = dimmed/ghosted
  targetColor?: ObjectColor; // Needed for preview mode to highlight target slightly
  highlightedColor?: ObjectColor | null; // New prop for dimming logic
}

export const GameObjectItem: React.FC<Props> = ({ obj, variant = 'normal', targetColor, highlightedColor }) => {
  
  const isWhite = obj.color === ObjectColor.WHITE;
  const isTarget = obj.color === targetColor;
  
  const isMasking = highlightedColor && obj.color !== highlightedColor;

  // Base style for the container (bounding box)
  const containerStyle: React.CSSProperties = {
    left: `${obj.x}%`,
    top: `${obj.y}%`,
    width: `${obj.w}%`,
    height: `${obj.h}%`,
    position: 'absolute',
    zIndex: obj.zIndex || 1,
    
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none', 
    
    transition: 'opacity 0.2s ease, filter 0.2s ease', 
  };

  // Visual Logic
  if (variant === 'preview') {
      if (isTarget) {
          containerStyle.opacity = 0.3; 
          containerStyle.filter = 'grayscale(0.2)';
      } else {
          containerStyle.opacity = 0.05;
          containerStyle.filter = 'grayscale(1)';
      }
      if (highlightedColor) {
           containerStyle.opacity = 0;
      }

  } else {
      // Normal Mode
      if (highlightedColor) {
          if (isMasking) {
             // Masking Mode: Turn pure white to blend with BG or occlude
             containerStyle.opacity = 1; 
             containerStyle.filter = 'none'; // Remove filters
          } else {
             // Highlighted Target
             containerStyle.opacity = 1;
             containerStyle.filter = 'drop-shadow(0 0 6px rgba(0,0,0,0.5)) drop-shadow(0 0 4px rgba(255,255,255,0.2))'; 
          }
      } else {
          containerStyle.opacity = 1;
          // Add drop shadow for depth (3D Feel)
          containerStyle.filter = 'drop-shadow(1px 2px 3px rgba(0,0,0,0.3))';
      }
  }

  // If masking, force white, otherwise use object color
  const bg = isMasking ? '#ffffff' : getColorHex(obj.color);
  
  // rotation wrapper
  const rotationStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      transform: `rotate(${obj.rotation || 0}deg)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
  };

  const renderContent = () => {
      // SVG based rendering for consistent 'Illusion' style and complex shapes with holes
      const strokeW = obj.strokeWidth || 0.2; // fraction of size
      
      // We render all non-rect shapes as SVGs to handle holes and scaling perfectly
      switch (obj.shape) {
          case ObjectShape.TEXT:
              return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                      <text x="50" y="50" fontSize="85" fill={bg} textAnchor="middle" dominantBaseline="central" fontWeight="900" style={{fontFamily: 'Arial, sans-serif'}}>
                          {obj.char}
                      </text>
                  </svg>
              );
          case ObjectShape.RING: {
               // Logic: Hit if distance is between (0.5 - stroke) and 0.5.
               // Visual: SVG stroke is centered. 
               // If we want inner edge at 0.5-stroke and outer at 0.5.
               // Average radius = 0.5 - stroke/2.
               // Width = stroke.
               // Example: Stroke 0.2. Range 0.3 to 0.5.
               // Center = 0.4 (40). Width = 0.2 (20).
               const cx = 50;
               const cy = 50;
               const radius = (0.5 - strokeW / 2) * 100;
               const sw = strokeW * 100;
               
               return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={bg} strokeWidth={sw} />
                  </svg>
               );
          }
          case ObjectShape.FRAME: {
               // Logic: Hit if < thickness or > 1-thickness.
               // Visual: Rect stroke is centered.
               // We want stroke to go from 0 to thickness.
               // Center = thickness/2. Width = thickness.
               // Rect inset by thickness/2.
               const sw = strokeW * 100;
               const inset = sw / 2;
               const width = 100 - sw;
               
               return (
                   <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                       <rect x={inset} y={inset} width={width} height={width} fill="none" stroke={bg} strokeWidth={sw} />
                   </svg>
               );
          }
          case ObjectShape.CIRCLE:
               return (
                   <div style={{...rotationStyle, backgroundColor: bg, borderRadius: '50%'}} />
               );
          case ObjectShape.RECTANGLE:
               return (
                   <div style={{...rotationStyle, backgroundColor: bg}} />
               );
          case ObjectShape.TRIANGLE:
              return (
                   <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                       <polygon points="50,5 5,95 95,95" fill={bg} />
                   </svg>
              );
          case ObjectShape.DIAMOND:
              return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                       <polygon points="50,0 100,50 50,100 0,50" fill={bg} />
                  </svg>
              );
          case ObjectShape.STAR: // 5-point
              return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                       <polygon points="50,5 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35" fill={bg} />
                  </svg>
              );
          case ObjectShape.SIX_POINT_STAR:
              return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                       {/* Two triangles */}
                       <polygon points="50,5 15,75 85,75" fill={bg} />
                       <polygon points="50,95 15,25 85,25" fill={bg} />
                  </svg>
              );
          case ObjectShape.HEART:
               return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                      <path d="M50 85 C50 85 10 55 10 30 C10 15 25 5 40 5 C50 5 50 15 50 15 C50 15 50 5 60 5 C75 5 90 15 90 30 C90 55 50 85 50 85Z" fill={bg} />
                  </svg>
               );
          case ObjectShape.ARROW:
               return (
                  <svg viewBox="0 0 100 100" width="100%" height="100%" style={rotationStyle}>
                      <polygon points="50,5 5,50 25,50 25,95 75,95 75,50 95,50" fill={bg} />
                  </svg>
               );
          default:
               return <div style={{...rotationStyle, backgroundColor: bg}} />;
      }
  };

  return <div style={containerStyle}>{renderContent()}</div>;
};

function getColorHex(color: ObjectColor): string {
  switch (color) {
    case ObjectColor.RED: return '#ef4444'; // Red 500
    case ObjectColor.BLUE: return '#3b82f6'; // Blue 500
    case ObjectColor.GREEN: return '#22c55e'; // Green 500
    case ObjectColor.YELLOW: return '#eab308'; // Yellow 500
    case ObjectColor.WHITE: return '#ffffff'; 
    default: return '#ffffff';
  }
}