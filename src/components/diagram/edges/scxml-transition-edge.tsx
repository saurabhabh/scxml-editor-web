'use client';

import React from 'react';
import { 
  BaseEdge, 
  getStraightPath, 
  type EdgeProps
} from 'reactflow';

export interface SCXMLTransitionEdgeData {
  event?: string;
  condition?: string;
  actions?: string[];
}

export const SCXMLTransitionEdge: React.FC<EdgeProps<SCXMLTransitionEdgeData>> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Safely extract data properties
  const event = data?.event;
  const condition = data?.condition;
  const actions = data?.actions || [];

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
    if (actions.length > 0) parts.push(`/ ${actions.length} action${actions.length > 1 ? 's' : ''}`);
    return parts.join(' ');
  };

  const labelContent = getLabelContent();

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth,
          strokeDasharray: getStrokeStyle() === 'dashed' ? '8,4' : 
                          getStrokeStyle() === 'dotted' ? '2,2' : 'none',
        }}
      />
      {labelContent && (
        <foreignObject
          width={Math.max(labelContent.length * 8, 60)}
          height={24}
          x={labelX - (Math.max(labelContent.length * 8, 60) / 2)}
          y={labelY - 12}
        >
          <div
            className={`
              px-2 py-1 rounded text-xs font-medium shadow-sm border text-center
              ${selected 
                ? 'bg-blue-100 border-blue-300 text-blue-800' 
                : 'bg-white border-gray-300 text-gray-700'
              }
            `}
            style={{ fontSize: '11px' }}
          >
            {labelContent}
          </div>
        </foreignObject>
      )}
    </>
  );
};