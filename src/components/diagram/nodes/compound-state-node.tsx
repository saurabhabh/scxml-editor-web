'use client';

import {
  getAdditionalClasses,
  visualStylesToCSS,
} from '@/lib/utils/visual-style-utils';
import type { CompoundStateNodeData } from '@/types/hierarchical-node';
import { ChevronDown, ChevronRight, Plus, Square } from 'lucide-react';
import React, { memo, useCallback, useMemo } from 'react';
import { Handle, Position, useReactFlow, type NodeProps } from 'reactflow';
import { ChildStateNode } from './child-state-node';

export interface CompoundStateNodeProps
  extends NodeProps<CompoundStateNodeData> {
  onChildrenToggle?: (nodeId: string, isExpanded: boolean) => void;
  onChildAdd?: (parentId: string) => void;
}

// Helper component to recursively render child nodes
const RenderChildNode = ({
  childId,
  childLayout,
  descendants,
}: {
  childId: string;
  childLayout: any;
  descendants: any[];
}) => {
  const node = descendants.find((d) => d.id === childId);
  if (!node) return null;

  const isContainer = childLayout.type === 'container';
  const { x, y, width, height, children: nestedLayouts } = childLayout;

  if (isContainer) {
    // Render container with its children
    return (
      <div
        className='absolute border-2 border-dashed border-purple-300 bg-purple-50/80 rounded-lg'
        style={{ left: x, top: y, width, height }}
      >
        {/* Container header */}
        <div className='p-2 bg-white/90 border-b border-purple-200 rounded-t-lg'>
          <div className='flex items-center space-x-2'>
            <Square className='h-3 w-3 text-purple-600' />
            <span className='text-sm font-semibold text-gray-900'>
              {node.data.label}
            </span>
            <span className='text-xs uppercase tracking-wide font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700'>
              {node.data.stateType}
            </span>
          </div>
        </div>

        {/* Container children */}
        <div className='p-2 relative'>
          {Object.entries(nestedLayouts || {}).map(
            ([nestedId, nestedLayout]: [string, any]) => (
              <RenderChildNode
                key={nestedId}
                childId={nestedId}
                childLayout={{
                  ...nestedLayout,
                  // Positions are relative to parent container, no need to adjust
                  x: nestedLayout.x,
                  y: nestedLayout.y,
                }}
                descendants={descendants}
              />
            )
          )}
        </div>
      </div>
    );
  } else {
    // Render simple state
    return (
      <ChildStateNode
        key={node.id}
        node={node}
        position={{ x, y }}
        size={{ width, height }}
        isActive={node.data.isActive}
        onClick={(nodeId) => console.log('Child clicked:', nodeId)}
        onDoubleClick={(nodeId) => console.log('Child double-clicked:', nodeId)}
      />
    );
  }
};

export const CompoundStateNode = memo<CompoundStateNodeProps>(
  ({ data, selected, id, onChildrenToggle, onChildAdd }) => {
    const reactFlowInstance = useReactFlow();

    const {
      label,
      stateType,
      isInitial = false,
      isActive = false,
      entryActions = [],
      exitActions = [],
      visualStyles,
      children = [],
      containerMetadata,
      descendants = [],
      onLabelChange,
      onStateTypeChange,
      onActionsChange,
      isEditing = false,
    } = data;
    console.log('descendants', descendants);
    const [editingLabel, setEditingLabel] = React.useState(false);
    const [tempLabel, setTempLabel] = React.useState(label);

    const isExpanded = containerMetadata?.isExpanded ?? true;
    const padding = containerMetadata?.padding ?? 20;
    const minSize = containerMetadata?.minSize ?? { width: 200, height: 150 };

    // Track the node's dimensions to prevent resize during drag using ref to avoid re-renders
    const cachedDimensionsRef = React.useRef<{
      width: number;
      height: number;
    } | null>(null);
    const lastContentHashRef = React.useRef<string>('');

    // Create a hash of content that should trigger resize
    const contentHash = React.useMemo(() => {
      return `${descendants.length}-${isExpanded}-${
        containerMetadata?.padding || 20
      }-${JSON.stringify(containerMetadata?.minSize)}-${stateType}`;
    }, [
      descendants.length,
      isExpanded,
      containerMetadata?.padding,
      containerMetadata?.minSize,
      stateType,
    ]);

    // Clear cached dimensions when content changes
    if (contentHash !== lastContentHashRef.current) {
      cachedDimensionsRef.current = null;
      lastContentHashRef.current = contentHash;
    }

    // Helper function to recursively calculate layout for containers and their children
    const calculateHierarchicalLayout = useCallback(
      (nodeId: string, availableNodes: any[], depth: number = 0): any => {
        const directChildren = availableNodes.filter(
          (n) => n.parentId === nodeId
        );

        if (directChildren.length === 0) {
          return {
            width: 200,
            height: 100,
            childLayouts: {},
          };
        }

        // Separate containers and simple states
        const containers = directChildren.filter(
          (c) => c.childIds && c.childIds.length > 0
        );
        const simpleStates = directChildren.filter(
          (c) => !c.childIds || c.childIds.length === 0
        );

        const childLayouts: Record<string, any> = {};
        let maxWidth = 0;
        let currentY = 10; // Start with padding from top

        // First, layout all container children compactly
        if (containers.length > 0) {
          // Use single row for 1-2 containers, 2 columns for 3+
          const cols = containers.length <= 2 ? containers.length : 2;
          const rows = Math.ceil(containers.length / cols);

          // Pre-calculate all container sizes
          const containerSizes = containers.map((container) => {
            const childLayout = calculateHierarchicalLayout(
              container.id,
              availableNodes,
              depth + 1
            );
            return {
              container,
              childLayout,
              width: Math.max(200, childLayout.width + 30),
              height: Math.max(140, childLayout.height + 50),
            };
          });

          for (let row = 0; row < rows; row++) {
            let rowMaxHeight = 0;
            let currentX = 10; // Start X position for this row

            for (let col = 0; col < cols; col++) {
              const idx = row * cols + col;
              if (idx >= containers.length) break;

              const {
                container,
                childLayout,
                width: containerWidth,
                height: containerHeight,
              } = containerSizes[idx];

              // Position containers compactly, one after another
              const x = currentX;
              const y = currentY;

              childLayouts[container.id] = {
                x,
                y,
                width: containerWidth,
                height: containerHeight,
                children: childLayout.childLayouts,
                type: 'container',
              };

              // Move X position for next container
              currentX += containerWidth + 15; // Just add the width plus small gap
              rowMaxHeight = Math.max(rowMaxHeight, containerHeight);
            }

            maxWidth = Math.max(maxWidth, currentX);
            currentY += rowMaxHeight + 15;
          }
        }

        // Then layout simple states compactly below containers
        if (simpleStates.length > 0) {
          // Determine optimal column count based on number of states
          const cols =
            simpleStates.length <= 3
              ? simpleStates.length
              : simpleStates.length <= 6
              ? 3
              : 4;
          const rows = Math.ceil(simpleStates.length / cols);

          // Calculate each state's width individually
          const stateWidths = simpleStates.map((s) =>
            Math.max(120, (s.data.label || '').length * 8 + 30)
          );
          const stateHeight = 50;

          let stateIndex = 0;
          for (let row = 0; row < rows; row++) {
            let currentX = 10; // Start position for each row

            for (
              let col = 0;
              col < cols && stateIndex < simpleStates.length;
              col++
            ) {
              const state = simpleStates[stateIndex];
              const stateWidth = stateWidths[stateIndex];

              childLayouts[state.id] = {
                x: currentX,
                y: currentY,
                width: stateWidth,
                height: stateHeight,
                children: {},
                type: 'simple',
              };

              currentX += stateWidth + 10; // Move to next position
              stateIndex++;
            }

            maxWidth = Math.max(maxWidth, currentX);
            currentY += stateHeight + 10;
          }
        }

        return {
          width: Math.max(200, maxWidth),
          height: Math.max(100, currentY + 10),
          childLayouts,
        };
      },
      []
    );

    // Calculate the full layout for this container and its children
    const layout = useMemo(() => {
      if (!isExpanded || descendants.length === 0) {
        return {
          width: minSize.width,
          height: minSize.height,
          childLayouts: {},
        };
      }
      return calculateHierarchicalLayout(id, descendants);
    }, [id, descendants, isExpanded, minSize, calculateHierarchicalLayout]);

    // Calculate container size dynamically based on content
    const containerSize = useMemo(() => {
      // Debug logging
      debugger;

      // Priority 1: Use cached dimensions (prevents resize during drag)
      if (cachedDimensionsRef.current) {
        return cachedDimensionsRef.current;
      }

      // Priority 2: Use explicit data dimensions
      if (data.width && data.height) {
        const size = { width: data.width, height: data.height };
        // Cache this size for future drag operations
        cachedDimensionsRef.current = size;
        return size;
      }

      const headerHeight = 60;
      const statusBarHeight = 30;

      let requiredWidth = minSize.width;
      let requiredHeight = minSize.height;

      if (isExpanded && layout) {
        // Use the pre-calculated layout
        requiredWidth = Math.max(requiredWidth, layout.width);
        requiredHeight = Math.max(
          requiredHeight,
          headerHeight + statusBarHeight + layout.height
        );
      } else if (isExpanded) {
        // Default expanded size with space for add child button
        requiredHeight = Math.max(
          requiredHeight,
          headerHeight + 120 + padding * 2
        );
      } else {
        // Collapsed size
        requiredHeight = headerHeight + padding * 2;
      }

      const finalSize = {
        width: Math.max(minSize.width, requiredWidth + 30),
        height: Math.max(minSize.height, requiredHeight + 30),
      };

      // Cache calculated dimensions for future use (prevents recalculation during drag)
      cachedDimensionsRef.current = finalSize;

      return finalSize;
    }, [
      data.width,
      data.height,
      descendants,
      isExpanded,
      padding,
      minSize,
      id,
      contentHash,
    ]);

    // Handle label editing
    const handleLabelDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onLabelChange) {
          setEditingLabel(true);
          setTempLabel(label);
        }
      },
      [onLabelChange, label]
    );

    const handleLabelSubmit = useCallback(() => {
      if (onLabelChange && tempLabel.trim() !== label) {
        onLabelChange(tempLabel.trim());
      }
      setEditingLabel(false);
    }, [onLabelChange, tempLabel, label]);

    const handleLabelCancel = useCallback(() => {
      setTempLabel(label);
      setEditingLabel(false);
    }, [label]);

    const handleLabelKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
          handleLabelSubmit();
        } else if (e.key === 'Escape') {
          handleLabelCancel();
        }
      },
      [handleLabelSubmit, handleLabelCancel]
    );

    // Handle expand/collapse
    const handleToggleExpanded = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const newExpanded = !isExpanded;
        onChildrenToggle?.(id, newExpanded);
      },
      [isExpanded, onChildrenToggle, id]
    );

    // Handle adding new child
    const handleAddChild = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onChildAdd?.(id);
      },
      [onChildAdd, id]
    );

    // Generate base CSS classes
    const getBaseClasses = () => {
      // Check if this container has a history wrapper
      const hasHistoryWrapper =
        (data as any).historyStates && (data as any).historyStates.length > 0;

      let baseClasses = 'overflow-visible isolate';

      // Only add border if there's no history wrapper
      if (!hasHistoryWrapper) {
        baseClasses += ' border-2 border-dashed';

        // Different styling for compound vs parallel states
        if (stateType === 'parallel') {
          baseClasses +=
            ' border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 shadow-orange-200/50';
        } else {
          baseClasses += ' border-purple-300 bg-purple-50/80';
        }
      } else {
        // Just background, no border when history wrapper exists
        if (stateType === 'parallel') {
          baseClasses += ' bg-orange-50/40';
        } else {
          baseClasses += ' bg-purple-50/40';
        }
      }

      return baseClasses;
    };

    // Convert visual styles to CSS properties
    const inlineStyles = {
      ...(visualStyles ? visualStylesToCSS(visualStyles) : {}),
      width: containerSize.width,
      height: containerSize.height,
      minWidth: containerSize.width,
      minHeight: containerSize.height,
    };

    // Get additional classes for shadows, transitions, etc.
    const additionalClasses = visualStyles
      ? getAdditionalClasses(visualStyles, isActive, selected)
      : stateType === 'parallel'
      ? 'shadow-orange-200/60 shadow-lg hover:shadow-orange-300/80 hover:shadow-xl transition-all duration-300 hover:border-orange-500'
      : 'shadow-lg hover:shadow-xl transition-all duration-300';

    const nodeClasses = `${getBaseClasses()} ${additionalClasses}`;

    // Get icon for state type
    const getStateIcon = () => {
      switch (stateType) {
        case 'parallel':
          return (
            <div className='flex items-center space-x-1'>
              <div className='flex'>
                <Square className='h-4 w-4 text-orange-600 fill-orange-200' />
                <Square className='h-4 w-4 text-orange-600 fill-orange-200 -ml-1' />
              </div>
              <span className='text-xs text-orange-700 font-semibold'>⚡</span>
            </div>
          );
        case 'compound':
        default:
          return <Square className='h-4 w-4 text-purple-600' />;
      }
    };

    return (
      <div
        className={nodeClasses}
        style={{
          ...inlineStyles,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Connection handles */}
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

        {/* Container header */}
        <div className={`p-3 bg-white/90 border-b border-gray-200`}>
          <div className='flex items-center justify-between'>
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

            <div className='flex items-center space-x-2'>
              {isInitial && (
                <div className='bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium'>
                  Initial
                </div>
              )}

              <span
                className={`text-xs uppercase tracking-wide font-medium px-2 py-1 rounded-full ${
                  stateType === 'compound'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-orange-100 text-orange-700'
                }`}
              >
                {stateType}
              </span>

              <button
                onClick={handleToggleExpanded}
                className='p-1 hover:bg-gray-100 rounded transition-colors'
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className='h-4 w-4 text-gray-600' />
                ) : (
                  <ChevronRight className='h-4 w-4 text-gray-600' />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Container content area */}
        {isExpanded && (
          <div
            className='flex-1 relative min-h-[100px]'
            style={{ padding: padding }}
          >
            {descendants.length > 0 ? (
              <>
                {/* Status bar showing child count */}
                <div className='text-xs text-gray-600 font-medium mb-3 px-2'>
                  Child States (
                  {
                    descendants.filter((d) => {
                      const isDirectChildByParentId = d.parentId === id;
                      const isDirectChildByArray =
                        children?.includes(d.id) &&
                        !descendants.some(
                          (sibling) =>
                            sibling.id !== id &&
                            sibling.parentId === id &&
                            sibling.childIds?.includes(d.id)
                        );
                      return isDirectChildByParentId || isDirectChildByArray;
                    }).length
                  }
                  )
                </div>

                {/* Visual child nodes container */}
                <div
                  className='relative w-full h-full overflow-visible'
                  style={{ minHeight: '200px' }}
                >
                  {Object.entries(layout.childLayouts || {}).map(
                    ([childId, childLayout]: [string, any]) => (
                      <RenderChildNode
                        key={childId}
                        childId={childId}
                        childLayout={childLayout}
                        descendants={descendants}
                      />
                    )
                  )}
                </div>
              </>
            ) : (
              <div className='flex flex-col items-center justify-center h-full text-gray-400 py-8'>
                <div className='text-sm mb-2'>No child states</div>
                <button
                  onClick={handleAddChild}
                  className='flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors'
                >
                  <Plus className='h-3 w-3' />
                  <span>Add Child State</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Actions indicator (if present) */}
        {(entryActions.length > 0 || exitActions.length > 0) && (
          <div className='px-3 pb-3'>
            <div className='text-xs text-gray-600 border-t border-gray-200 pt-2'>
              {entryActions.length > 0 && (
                <span className='bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md font-medium mr-1'>
                  Entry ({entryActions.length})
                </span>
              )}
              {exitActions.length > 0 && (
                <span className='bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-md font-medium'>
                  Exit ({exitActions.length})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

CompoundStateNode.displayName = 'CompoundStateNode';
