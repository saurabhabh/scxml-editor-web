// scxml-state-node
'use client';

import React, { memo, useMemo } from 'react';
import { Handle, Position, type NodeProps, useStore } from 'reactflow';
import { Circle, Square, Target, Trash2 } from 'lucide-react';
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
  stateType: 'simple' | 'compound' | 'final' | 'parallel' | 'history';
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
  onDelete?: () => void;
  isEditing?: boolean;
}

export const SCXMLStateNode = memo<NodeProps<SCXMLStateNodeData>>(
  ({ data, selected, id }) => {
    // Get edges from store to check if this node has any connections
    const edges = useStore((state) => state.edges);
    const hasConnections = useMemo(() => {
      return edges.some((edge) => edge.source === id || edge.target === id);
    }, [edges, id]);

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
      onDelete,
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
      let baseClasses = 'overflow-hidden isolate rounded-xl';

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

    // Determine state characteristics for styling
    const getStateCharacteristics = () => {
      const labelLower = label.toLowerCase();
      const actionCount = entryActions.length + exitActions.length;

      // Check for state types
      if (
        isInitial ||
        labelLower.includes('idle') ||
        labelLower.includes('initial')
      ) {
        return { type: 'initial', color: '#10b981', bg: '#ecfdf5' }; // Green
      }
      if (
        labelLower.includes('error') ||
        labelLower.includes('fail') ||
        labelLower.includes('exception')
      ) {
        return { type: 'error', color: '#dc2626', bg: '#fef2f2' }; // Red
      }
      if (
        stateType === 'final' ||
        labelLower.includes('final') ||
        labelLower.includes('complete')
      ) {
        return { type: 'terminal', color: '#7c3aed', bg: '#f3e8ff' }; // Purple
      }
      if (actionCount >= 3) {
        return { type: 'complex', color: '#f59e0b', bg: '#fffbeb' }; // Orange
      }
      if (actionCount >= 1) {
        return { type: 'operational', color: '#3b82f6', bg: '#eff6ff' }; // Blue
      }
      return { type: 'simple', color: '#3b82f6', bg: '#eff6ff' }; // Blue default
    };

    const stateChar = getStateCharacteristics();

    // Convert visual styles to CSS properties and apply dimensions from data
    const inlineStyles = {
      ...(visualStyles
        ? visualStylesToCSS(visualStyles)
        : {
            background: `linear-gradient(135deg, ${stateChar.bg} 0%, ${stateChar.bg}99 50%, ${stateChar.bg}66 100%)`,
            borderColor: stateChar.color,
            borderWidth: '2px',
          }),
      // Apply width and height from node data (set by viz:xywh)
      ...(data.width && { width: data.width }),
      ...(data.height && { height: data.height }),
    };

    // Debug logging for height changes
    React.useEffect(() => {
      if (data.height) {
      }
    }, [data.height, data.width, label, data.label]);

    // Get additional classes for shadows, transitions, etc.
    const additionalClasses = visualStyles
      ? getAdditionalClasses(visualStyles, isActive, selected)
      : 'shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[1.02] hover:z-10 ring-2 ring-opacity-0 hover:ring-opacity-30 ring-blue-400';

    const nodeClasses = `${getBaseClasses()} ${additionalClasses} backdrop-blur-sm border-2`;

    // Apply border style
    if (visualStyles?.borderStyle) {
      inlineStyles.borderStyle = visualStyles.borderStyle;
    }

    // Get icon for state type with matching colors
    const getStateIcon = () => {
      const iconColor = stateChar.color;

      // Special handling for history states
      if (label.toLowerCase().includes('history')) {
        return (
          <Circle
            className='h-4 w-4'
            style={{ color: iconColor }}
            fill='currentColor'
          />
        );
      }

      switch (stateType) {
        case 'final':
          return <Target className='h-4 w-4' style={{ color: iconColor }} />;
        case 'compound':
          return <Square className='h-4 w-4' style={{ color: iconColor }} />;
        case 'parallel':
          return (
            <div className='flex items-center space-x-1'>
              <div className='flex'>
                <Square
                  className='h-3 w-3'
                  style={{ color: iconColor, fill: `${iconColor}33` }}
                />
                <Square
                  className='h-3 w-3 -ml-1'
                  style={{ color: iconColor, fill: `${iconColor}33` }}
                />
              </div>
              <span className='text-xs font-bold' style={{ color: iconColor }}>
                ⚡
              </span>
            </div>
          );
        default:
          return <Circle className='h-4 w-4' style={{ color: iconColor }} />;
      }
    };

    return (
      <div
        className={`${nodeClasses} group`}
        style={{
          ...inlineStyles,
          position: 'relative',
          zIndex: 10, // Higher z-index to render above edges
          overflow: 'visible',
          // Ensure fixed dimensions when specified
          ...(data.width && { minWidth: data.width, maxWidth: data.width }),
          ...(data.height && {
            minHeight: data.height,
            maxHeight: data.height,
          }),
        }}
      >
        {/* Dynamic connection handles - only show if node has connections */}

        <Handle
          type='target'
          position={Position.Top}
          id='top'
          style={{
            left: '50%',
            top: '0',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='source'
          position={Position.Bottom}
          id='bottom'
          style={{
            left: '50%',
            bottom: '0',
            transform: 'translate(-50%, 50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='target'
          position={Position.Left}
          id='left'
          style={{
            left: '0',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />
        <Handle
          type='source'
          position={Position.Right}
          id='right'
          style={{
            right: '0',
            top: '50%',
            transform: 'translate(50%, -50%)',
            zIndex: 10,
          }}
          className='!bg-slate-500 !border-white !w-4 !h-4 !border-2 hover:!bg-blue-500 transition-colors'
        />

        {/* Delete button - only show if onDelete is provided and not initial state */}
        {onDelete && !isInitial && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className='absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-lg shadow-sm transition-all duration-200 opacity-0 hover:opacity-100 group-hover:opacity-70 hover:!opacity-100 z-20 cursor-pointer'
            title='Delete state'
          >
            <Trash2 className='h-4 w-4 text-gray-600 hover:text-red-600 transition-colors' />
          </button>
        )}

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
                  className='font-bold text-gray-900 text-base bg-white border-2 border-blue-400 rounded-lg px-2 py-1 min-w-0 flex-1 shadow-sm'
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className='font-bold text-gray-800 text-lg cursor-pointer hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors'
                  onDoubleClick={handleLabelDoubleClick}
                  title='Double-click to edit state name'
                >
                  {label}
                </span>
              )}
            </div>
            {isInitial && (
              <div className='bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 text-xs px-2.5 py-1 rounded-full font-bold shadow-sm border border-green-300'>
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
