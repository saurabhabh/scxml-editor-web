'use client';

import React from 'react';
import { BaseEdge, getBezierPath, getSmoothStepPath, type EdgeProps, type EdgeMarker, MarkerType, Position } from 'reactflow';

export interface SCXMLTransitionEdgeData {
  event?: string;
  condition?: string;
  actions?: string[];
  labelOffset?: { x: number; y: number };
  offset?: number;        // Path offset for parallel edges
  labelOffsetY?: number;  // Label Y-axis offset for parallel edges
  fullLabel?: string;     // Full label text for tooltip
}

/**
 * Calculate an offset smoothstep path for parallel edges
 * Creates a stepped path with perpendicular offset for cleaner routing
 */
function getOffsetSmoothStepPath({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  offset,
}: {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  sourcePosition: Position;
  targetPosition: Position;
  offset: number;
}): [string, number, number] {
  // Use getSmoothStepPath with offset parameter
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
    offset: offset, // This offsets the path perpendicular to the direct line
  });

  // Return path and label position from getSmoothStepPath (already accounts for offset)
  return [path, labelX, labelY];
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
  // Safely extract data properties FIRST
  const event = data?.event;
  const condition = data?.condition;
  const actions = data?.actions || [];
  const labelOffset = data?.labelOffset || { x: 0, y: 0 };
  const offset = data?.offset || 0;
  const labelOffsetY = data?.labelOffsetY || 0;

  // Calculate edge path - use offset path for parallel edges, standard bezier otherwise
  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (offset !== 0) {
    // Use smoothstep path with offset for parallel edges
    [edgePath, labelX, labelY] = getOffsetSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      offset,
    });
  } else {
    // Standard smoothstep path for single edges
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 8,
    });
  }

  // Determine edge styling based on transition properties
  const getEdgeColor = () => {
    if (selected) return condition ? '#ef4444' : '#3b82f6'; // Keep color based on type when selected
    if (condition) return '#ef4444'; // red-500 (conditional transitions)
    return '#3b82f6'; // blue-500 (non-conditional/event transitions)
  };

  const getStrokeStyle = () => {
    if (condition) return 'solid'; // Solid for conditional
    return 'dashed'; // Dashed for non-conditional
  };

  const strokeWidth = selected ? 3 : actions.length > 0 ? 2.5 : 2;
  const edgeColor = getEdgeColor();

  // Create label content
  const getLabelContent = () => {
    const parts: string[] = [];
    if (event) parts.push(`${event}`);
    if (condition) parts.push(`${condition}`);
    if (actions.length > 0)
      parts.push(`/ ${actions.length} action${actions.length > 1 ? 's' : ''}`);
    return parts.join(' ');
  };

  // Truncate label to prevent overflow
  const truncateLabel = (text: string, maxLength: number = 15) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const fullLabelContent = getLabelContent();
  const labelContent = truncateLabel(fullLabelContent);

  // Update marker color to match edge color
  const updatedMarkerEnd =
    markerEnd && typeof markerEnd === 'object'
      ? ({ ...(markerEnd as EdgeMarker), color: edgeColor } as EdgeMarker)
      : ({
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: edgeColor,
        } as EdgeMarker);

  return (
    <>
      {/* Render edge using BaseEdge for consistent marker styling */}
      <BaseEdge
        path={edgePath}
        markerEnd={updatedMarkerEnd as any}
        style={{
          ...style,
          stroke: edgeColor,
          strokeWidth: strokeWidth,
          strokeDasharray: getStrokeStyle() === 'dashed' ? '8,4' : 'none',
        }}
      />
      {/* Render label on top (higher layer) */}
      {labelContent && (
        <g style={{ pointerEvents: 'all', zIndex: 10000 }}>
          <foreignObject
            width={Math.max(labelContent.length * 8, 60)}
            height={26}
            x={labelX - Math.max(labelContent.length * 8, 60) / 2 + labelOffset.x}
            y={labelY - 13 + labelOffset.y + labelOffsetY}
            style={{ overflow: 'visible', zIndex: 10000 }}
          >
            <div
              className="px-2 py-1 rounded text-xs font-semibold text-center"
              style={{
                fontSize: '12px',
                lineHeight: '1.2',
                whiteSpace: 'nowrap',
                position: 'relative',
                zIndex: 10000,
                backgroundColor: condition ? '#ef4444' : '#3b82f6', // Red for conditional, blue for non-conditional
                color: '#fff',
                opacity: 0.95,
                cursor: 'pointer',
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
