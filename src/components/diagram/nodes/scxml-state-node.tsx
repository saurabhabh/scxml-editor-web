'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Circle, Square, Target } from 'lucide-react';

export interface SCXMLStateNodeData {
  label: string;
  stateType: 'simple' | 'compound' | 'final' | 'parallel';
  isInitial?: boolean;
  isActive?: boolean;
  entryActions?: string[];
  exitActions?: string[];
  onEntryActions?: string[];
  onExitActions?: string[];
}

export const SCXMLStateNode = memo<NodeProps<SCXMLStateNodeData>>(({ data, selected }) => {
  const { 
    label, 
    stateType, 
    isInitial = false,
    isActive = false,
    entryActions = [], 
    exitActions = [] 
  } = data;

  const hasEntryActions = entryActions.length > 0;
  const hasExitActions = exitActions.length > 0;
  const hasActions = hasEntryActions || hasExitActions;

  // Determine node styling based on state type and simulation state
  const getNodeStyles = () => {
    const baseStyles = "rounded-xl border-2 bg-white shadow-lg transition-all duration-300 min-w-[140px] min-h-[80px] hover:shadow-xl";
    
    if (isActive) {
      return `${baseStyles} border-green-500 bg-gradient-to-br from-green-50 to-green-100 shadow-xl ring-4 ring-green-200 ring-opacity-50`;
    }
    
    if (selected) {
      return `${baseStyles} border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-xl ring-2 ring-blue-300`;
    }

    switch (stateType) {
      case 'final':
        return `${baseStyles} border-red-400 bg-gradient-to-br from-red-50 to-red-100`;
      case 'compound':
        return `${baseStyles} border-purple-400 bg-gradient-to-br from-purple-50 to-purple-100`;
      case 'parallel':
        return `${baseStyles} border-orange-400 bg-gradient-to-br from-orange-50 to-orange-100`;
      default: // simple
        return `${baseStyles} border-slate-400 bg-gradient-to-br from-slate-50 to-slate-100`;
    }
  };

  // Get icon for state type
  const getStateIcon = () => {
    switch (stateType) {
      case 'final':
        return <Target className="h-4 w-4 text-red-600" />;
      case 'compound':
        return <Square className="h-4 w-4 text-purple-600" />;
      case 'parallel':
        return <Square className="h-4 w-4 text-orange-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className={getNodeStyles()}>
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors"
      />

      <div className="p-4">
        {/* State header with icon and name */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {getStateIcon()}
            <span className="font-semibold text-gray-900 text-base">{label}</span>
          </div>
          {isInitial && (
            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
              Initial
            </div>
          )}
        </div>

        {/* Actions indicator */}
        {hasActions && (
          <div className="mt-3 pt-3 border-t border-gray-200/50">
            <div className="flex flex-wrap gap-1">
              {hasEntryActions && (
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium">
                  Entry ({entryActions.length})
                </span>
              )}
              {hasExitActions && (
                <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md font-medium">
                  Exit ({exitActions.length})
                </span>
              )}
            </div>
          </div>
        )}

        {/* State type indicator for compound/parallel states */}
        {(stateType === 'compound' || stateType === 'parallel') && (
          <div className="mt-3 pt-3 border-t border-gray-200/50">
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
              {stateType}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

SCXMLStateNode.displayName = 'SCXMLStateNode';