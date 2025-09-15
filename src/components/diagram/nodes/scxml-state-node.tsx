// scxml-state-node
'use client';

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Circle, Square, Target } from 'lucide-react';
import {
  visualStylesToCSS,
  getAdditionalClasses,
} from '@/lib/utils/visual-style-utils';

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
  // Dimensions from viz:xywh
  width?: number;
  height?: number;
  // Editing capabilities
  onLabelChange?: (newLabel: string) => void;
  onStateTypeChange?: (
    newStateType: 'simple' | 'compound' | 'final' | 'parallel'
  ) => void;
  onActionsChange?: (entryActions: string[], exitActions: string[]) => void;
  isEditing?: boolean;
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
      onLabelChange,
      onStateTypeChange,
      onActionsChange,
      isEditing = false,
    } = data;

    const [editingLabel, setEditingLabel] = React.useState(false);
    const [editingActions, setEditingActions] = React.useState(false);
    const [tempLabel, setTempLabel] = React.useState(label);
    const [tempEntryActions, setTempEntryActions] = React.useState(
      entryActions.join('\n')
    );
    const [tempExitActions, setTempExitActions] = React.useState(
      exitActions.join('\n')
    );

    const hasEntryActions = entryActions.length > 0;
    const hasExitActions = exitActions.length > 0;
    const hasActions = hasEntryActions || hasExitActions;

    // Handle label editing
    const handleLabelDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onLabelChange) {
        setEditingLabel(true);
        setTempLabel(label);
      }
    };

    const handleLabelSubmit = () => {
      if (onLabelChange && tempLabel.trim() !== label) {
        onLabelChange(tempLabel.trim());
      }
      setEditingLabel(false);
    };

    const handleLabelCancel = () => {
      setTempLabel(label);
      setEditingLabel(false);
    };

    const handleLabelKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLabelSubmit();
      } else if (e.key === 'Escape') {
        handleLabelCancel();
      }
    };

    // Handle actions editing
    const handleActionsDoubleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onActionsChange) {
        setEditingActions(true);
      }
    };

    const handleActionsSubmit = () => {
      if (onActionsChange) {
        const newEntryActions = tempEntryActions
          .split('\n')
          .filter((action) => action.trim());
        const newExitActions = tempExitActions
          .split('\n')
          .filter((action) => action.trim());
        onActionsChange(newEntryActions, newExitActions);
      }
      setEditingActions(false);
    };

    const handleActionsCancel = () => {
      setTempEntryActions(entryActions.join('\n'));
      setTempExitActions(exitActions.join('\n'));
      setEditingActions(false);
    };

    // Update temp values when data changes from external sources
    React.useEffect(() => {
      setTempLabel(label);
    }, [label]);

    React.useEffect(() => {
      setTempEntryActions(entryActions.join('\n'));
      setTempExitActions(exitActions.join('\n'));
    }, [entryActions, exitActions]);

    // Generate base CSS classes
    const getBaseClasses = () => {
      let baseClasses = 'overflow-hidden isolate';

      // Only add minimum sizes if no explicit dimensions are provided via data
      if (!data.width && !data.height) {
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
      }

      return baseClasses;
    };

    // Convert visual styles to CSS properties and apply dimensions from data
    const inlineStyles = {
      ...(visualStyles ? visualStylesToCSS(visualStyles) : {}),
      // Apply width and height from node data (set by viz:xywh)
      ...(data.width && { width: data.width }),
      ...(data.height && { height: data.height }),
    };

    // Debug logging for height changes
    React.useEffect(() => {
      if (data.height) {
        console.log(`Node ${label} height change:`, {
          height: data.height,
          width: data.width,
          nodeId: data.label
        });
      }
    }, [data.height, data.width, label, data.label]);

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
      <div
        className={nodeClasses}
        style={{
          ...inlineStyles,
          position: 'relative',
          zIndex: 1,
          overflow: 'visible',
          // Ensure fixed dimensions when specified
          ...(data.width && { minWidth: data.width, maxWidth: data.width }),
          ...(data.height && { minHeight: data.height, maxHeight: data.height }),
        }}
      >
        {/* Dynamic connection handles based on actual node dimensions */}
        <Handle
          type='target'
          position={Position.Top}
          style={{
            left: '50%',
            top: '-4px',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          style={{
            left: '50%',
            bottom: '-4px',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='target'
          position={Position.Left}
          style={{
            left: '-4px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='source'
          position={Position.Right}
          style={{
            right: '-4px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />

        <div className={`p-4 ${data.height ? 'h-full overflow-hidden' : ''}`}>
          {/* State header with icon and name */}
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center space-x-2 flex-1'>
              {getStateIcon()}
              {editingLabel ? (
                <input
                  type='text'
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  onBlur={handleLabelSubmit}
                  onKeyDown={handleLabelKeyDown}
                  className='font-semibold text-gray-900 text-base bg-white border border-blue-300 rounded px-2 py-1 min-w-0 flex-1'
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className='font-semibold text-gray-900 text-base cursor-pointer hover:bg-blue-50 px-2 py-1 rounded'
                  onDoubleClick={handleLabelDoubleClick}
                  title='Double-click to edit state name'
                >
                  {label}
                </span>
              )}
            </div>
            {isInitial && (
              <div className='bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium'>
                Initial
              </div>
            )}
          </div>

          {/* Actions indicator */}
          {(hasActions || editingActions) && (
            <div className='mt-3 pt-3 border-t border-gray-200/50'>
              {editingActions ? (
                <div className='space-y-3'>
                  <div>
                    <label className='block text-xs font-medium text-gray-700 mb-1'>
                      Entry Actions (one per line):
                    </label>
                    <textarea
                      value={tempEntryActions}
                      onChange={(e) => setTempEntryActions(e.target.value)}
                      className='w-full text-xs border border-gray-300 rounded px-2 py-1 min-h-[3rem]'
                      placeholder='log("Entering state")'
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div>
                    <label className='block text-xs font-medium text-gray-700 mb-1'>
                      Exit Actions (one per line):
                    </label>
                    <textarea
                      value={tempExitActions}
                      onChange={(e) => setTempExitActions(e.target.value)}
                      className='w-full text-xs border border-gray-300 rounded px-2 py-1 min-h-[3rem]'
                      placeholder='log("Exiting state")'
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div className='flex space-x-2'>
                    <button
                      onClick={handleActionsSubmit}
                      className='text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600'
                    >
                      Save
                    </button>
                    <button
                      onClick={handleActionsCancel}
                      className='text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600'
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className='flex flex-wrap gap-1'>
                  {/* {hasEntryActions && (
                    <span
                      className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium cursor-pointer hover:bg-blue-200'
                      onDoubleClick={handleActionsDoubleClick}
                      title='Double-click to edit actions'
                    >
                      Entry ({entryActions.length})
                    </span>
                  )}
                  {hasExitActions && (
                    <span
                      className='bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md font-medium cursor-pointer hover:bg-orange-200'
                      onDoubleClick={handleActionsDoubleClick}
                      title='Double-click to edit actions'
                    >
                      Exit ({exitActions.length})
                    </span>
                  )} */}
                  {onActionsChange && !hasActions && (
                    <span
                      className='bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-medium cursor-pointer hover:bg-gray-200'
                      onDoubleClick={handleActionsDoubleClick}
                      title='Double-click to add actions'
                    >
                      + Add Actions
                    </span>
                  )}
                </div>
              )}
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
