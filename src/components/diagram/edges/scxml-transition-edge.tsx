'use client';

import React from 'react';
import { BaseEdge, getBezierPath, type EdgeProps, MarkerType } from 'reactflow';

export interface SCXMLTransitionEdgeData {
  event?: string;
  condition?: string;
  actions?: string[];
  labelOffset?: { x: number; y: number };
}

export const SCXMLTransitionEdge: React.FC<
  EdgeProps<SCXMLTransitionEdgeData>
> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}) => {
  // Use getBezierPath for smooth curves instead of getStraightPath
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Safely extract data properties
  const event = data?.event;
  const condition = data?.condition;
  const actions = data?.actions || [];
  const labelOffset = data?.labelOffset || { x: 0, y: 0 };

  // Determine edge styling based on transition properties
  const getEdgeColor = () => {
    if (selected) return '#3b82f6'; // blue-500
    if (event && condition) return '#2563eb'; // blue-600 (both event and condition)
    if (condition) return '#7c3aed'; // violet-600 (condition only)
    if (event) return '#6b7280'; // gray-500 (event only)
    return '#374151'; // gray-700 (always transition)
  };

  const getStrokeStyle = () => {
    if (event && condition) return 'solid';
    if (condition && !event) return 'dashed';
    if (!event && !condition) return 'dotted';
    return 'solid';
  };

  const strokeWidth = selected ? 3 : actions.length > 0 ? 2.5 : 2;
  const edgeColor = getEdgeColor();

  // Create label content
  const getLabelContent = () => {
    const parts: string[] = [];
    if (event) parts.push(`${event}`);
    if (condition) parts.push(`[${condition}]`);
    if (actions.length > 0)
      parts.push(`/ ${actions.length} action${actions.length > 1 ? 's' : ''}`);
    return parts.join(' ');
  };

  const labelContent = getLabelContent();

  // Define custom arrow marker with better visibility
  const customMarkerEnd = markerEnd || {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
    color: edgeColor,
  };

  return (
    <>
      {/* Define SVG markers for directional arrows */}
      <defs>
        <marker
          id={`arrow-${id}`}
          viewBox="0 0 20 20"
          refX="19"
          refY="10"
          markerWidth="15"
          markerHeight="15"
          orient="auto"
        >
          <path
            d="M 2 2 L 18 10 L 2 18 L 6 10 Z"
            fill={edgeColor}
            stroke="none"
          />
        </marker>
      </defs>
      {/* Render path first (lower layer) */}
      <path
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={
          getStrokeStyle() === 'dashed'
            ? '8,4'
            : getStrokeStyle() === 'dotted'
            ? '2,2'
            : 'none'
        }
        markerEnd={`url(#arrow-${id})`}
        className="react-flow__edge-path"
        style={{
          ...style,
          zIndex: 1,
        }}
      />
      {/* Render label on top (higher layer) */}
      {labelContent && (
        <g style={{ pointerEvents: 'all', zIndex: 10000 }}>
          <foreignObject
            width={Math.max(labelContent.length * 8, 60)}
            height={26}
            x={labelX - Math.max(labelContent.length * 8, 60) / 2 + labelOffset.x}
            y={labelY - 13 + labelOffset.y}
            style={{ overflow: 'visible', zIndex: 10000 }}
          >
            <div
              className={`
                px-2 py-1 rounded-md text-xs font-semibold shadow-md border text-center
                ${
                  selected
                    ? 'bg-blue-500 border-blue-600 text-white'
                    : 'bg-white border-gray-300 text-gray-800'
                }
              `}
              style={{
                fontSize: '11px',
                lineHeight: '1.2',
                whiteSpace: 'nowrap',
                position: 'relative',
                zIndex: 10000,
              }}
            >
              {labelContent}
            </div>
          </foreignObject>
        </g>
      )}
    </>
  );
};
