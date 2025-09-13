// scxml-state-node
'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Circle, Square, Target } from 'lucide-react';
import { visualStylesToCSS, getAdditionalClasses } from '@/lib/utils/visual-style-utils';

export interface VisualStyles {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
}

export interface SCXMLStateNodeData {
  label: string;
  stateType: 'simple' | 'compound' | 'final' | 'parallel';
  isInitial?: boolean;
  isActive?: boolean;
  entryActions?: string[];
  exitActions?: string[];
  onEntryActions?: string[];
  onExitActions?: string[];
  visualStyles?: VisualStyles;
}

export const SCXMLStateNode = memo<NodeProps<SCXMLStateNodeData>>(
  ({ data, selected }) => {
    const {
      label,
      stateType,
      isInitial = false,
      isActive = false,
      entryActions = [],
      exitActions = [],
      visualStyles,
    } = data;

    const hasEntryActions = entryActions.length > 0;
    const hasExitActions = exitActions.length > 0;
    const hasActions = hasEntryActions || hasExitActions;

    // Generate base CSS classes
    const getBaseClasses = () => {
      let baseClasses = 'overflow-hidden isolate';

      // Adjust size based on state type
      switch (stateType) {
        case 'compound':
          baseClasses += ' min-w-[180px] min-h-[100px]'; // Larger for compound states
          break;
        case 'parallel':
          baseClasses += ' min-w-[160px] min-h-[90px]'; // Larger for parallel states
          break;
        case 'final':
          baseClasses += ' min-w-[120px] min-h-[60px]'; // Smaller for final states
          break;
        default:
          baseClasses += ' min-w-[140px] min-h-[80px]';
      }

      return baseClasses;
    };

    // Convert visual styles to CSS properties
    const inlineStyles = visualStyles ? visualStylesToCSS(visualStyles) : {};
    
    // Get additional classes for shadows, transitions, etc.
    const additionalClasses = visualStyles 
      ? getAdditionalClasses(visualStyles, isActive, selected)
      : 'shadow-lg hover:shadow-xl transition-all duration-300';

    const nodeClasses = `${getBaseClasses()} ${additionalClasses}`;
    
    // Apply border style
    if (visualStyles?.borderStyle) {
      inlineStyles.borderStyle = visualStyles.borderStyle;
    }

    // Get icon for state type
    const getStateIcon = () => {
      // Special handling for history states
      if (label.toLowerCase().includes('history')) {
        return <Circle className='h-4 w-4 text-blue-600' fill='currentColor' />;
      }

      switch (stateType) {
        case 'final':
          return <Target className='h-4 w-4 text-red-600' />;
        case 'compound':
          return <Square className='h-4 w-4 text-purple-600' />;
        case 'parallel':
          return (
            <div className='flex'>
              <Square className='h-3 w-3 text-orange-600' />
              <Square className='h-3 w-3 text-orange-600 -ml-1' />
            </div>
          );
        default:
          return <Circle className='h-4 w-4 text-gray-600' />;
      }
    };

    return (
      <div className={nodeClasses} style={inlineStyles}>
        {/* Connection handles */}
        <Handle
          type='target'
          position={Position.Top}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='target'
          position={Position.Left}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='source'
          position={Position.Right}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />

        <div className='p-4'>
          {/* State header with icon and name */}
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center space-x-2'>
              {getStateIcon()}
              <span className='font-semibold text-gray-900 text-base'>
                {label}
              </span>
            </div>
            {isInitial && (
              <div className='bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium'>
                Initial
              </div>
            )}
          </div>

          {/* Actions indicator */}
          {hasActions && (
            <div className='mt-3 pt-3 border-t border-gray-200/50'>
              <div className='flex flex-wrap gap-1'>
                {hasEntryActions && (
                  <span className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium'>
                    Entry ({entryActions.length})
                  </span>
                )}
                {hasExitActions && (
                  <span className='bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md font-medium'>
                    Exit ({exitActions.length})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* State type indicator for compound/parallel states */}
          {(stateType === 'compound' || stateType === 'parallel') && (
            <div className='mt-3 pt-3 border-t border-gray-200/50'>
              <div className='flex items-center space-x-2'>
                <span
                  className={`text-xs uppercase tracking-wide font-medium px-2 py-1 rounded-full ${
                    stateType === 'compound'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {stateType}
                </span>
                {stateType === 'parallel' && (
                  <span className='text-xs text-gray-500'>⚡ Concurrent</span>
                )}
              </div>
            </div>
          )}

          {/* Special indicator for history states */}
          {label.toLowerCase().includes('history') && (
            <div className='mt-3 pt-3 border-t border-gray-200/50'>
              <span className='text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium'>
                📜 History
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);

SCXMLStateNode.displayName = 'SCXMLStateNode';
