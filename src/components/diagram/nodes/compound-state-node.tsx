'use client';

import React, { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from 'reactflow';
import { Square, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import {
  visualStylesToCSS,
  getAdditionalClasses,
} from '@/lib/utils/visual-style-utils';
import type {
  CompoundStateNodeData,
  HierarchicalNode,
} from '@/types/hierarchical-node';
import type { VisualStyles } from './scxml-state-node';
import { ChildStateNode } from './child-state-node';

export interface CompoundStateNodeProps
  extends NodeProps<CompoundStateNodeData> {
  onChildrenToggle?: (nodeId: string, isExpanded: boolean) => void;
  onChildAdd?: (parentId: string) => void;
}

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
      }-${JSON.stringify(containerMetadata?.minSize)}`;
    }, [
      descendants.length,
      isExpanded,
      containerMetadata?.padding,
      containerMetadata?.minSize,
    ]);

    // Clear cached dimensions when content changes
    if (contentHash !== lastContentHashRef.current) {
      cachedDimensionsRef.current = null;
      lastContentHashRef.current = contentHash;
    }

    // Calculate container size dynamically based on content
    const containerSize = useMemo(() => {
      // Debug logging
      console.log(
        `🔧 Container ${id} sizing - data.width: ${data.width}, data.height: ${data.height}, cached:`,
        cachedDimensionsRef.current
      );

      // Priority 1: Use cached dimensions (prevents resize during drag)
      if (cachedDimensionsRef.current) {
        console.log(
          `🔧 Using cached dimensions: ${cachedDimensionsRef.current.width}x${cachedDimensionsRef.current.height}`
        );
        return cachedDimensionsRef.current;
      }

      // Priority 2: Use explicit data dimensions
      if (data.width && data.height) {
        console.log(`🔧 Using explicit size: ${data.width}x${data.height}`);
        const size = { width: data.width, height: data.height };
        // Cache this size for future drag operations
        cachedDimensionsRef.current = size;
        return size;
      }

      const headerHeight = 60;
      const statusBarHeight = 30;

      let requiredWidth = minSize.width;
      let requiredHeight = minSize.height;

      if (isExpanded && descendants.length > 0) {
        const directChildren = descendants.filter((d) => d.parentId === id);

        // Analyze children to determine layout requirements
        const containerChildren = directChildren.filter(
          (child) => child.childIds && child.childIds.length > 0
        );
        const simpleChildren = directChildren.filter(
          (child) => !child.childIds || child.childIds.length === 0
        );

        console.log(
          `📏 Container ${id} sizing: ${containerChildren.length} containers, ${simpleChildren.length} simple`
        );

        // Calculate space needed for different types of content
        let contentHeight = statusBarHeight;
        let contentWidth = 0;

        // Containers need more vertical space (updated for larger containers)
        containerChildren.forEach((container, index) => {
          const containerHeight = Math.max(
            200,
            120 + (container.childIds?.length || 0) * 50 // Increased from 30 to 50
          );
          contentHeight += containerHeight + 20; // spacing between containers
          contentWidth = Math.max(contentWidth, 350); // Increased from 280 to 350 for wider containers
        });

        // Simple states can be arranged in a grid (updated for larger simple states)
        if (simpleChildren.length > 0) {
          const simpleColumns = Math.min(
            2, // Reduced from 3 to 2 for wider nodes
            Math.ceil(Math.sqrt(simpleChildren.length))
          );
          const simpleRows = Math.ceil(simpleChildren.length / simpleColumns);
          const simpleWidth = simpleColumns * 170 + (simpleColumns - 1) * 20; // Increased from 130 to 170
          const simpleHeight = simpleRows * 100 + (simpleRows - 1) * 20; // Increased from 70 to 100, spacing from 15 to 20

          contentHeight +=
            simpleHeight + (containerChildren.length > 0 ? 20 : 0);
          contentWidth = Math.max(contentWidth, simpleWidth);
        }

        requiredWidth = Math.max(requiredWidth, contentWidth + padding * 2);
        requiredHeight = Math.max(
          requiredHeight,
          headerHeight + contentHeight + padding * 2
        );

        console.log(
          `📏 Container ${id} calculated: ${requiredWidth}x${requiredHeight}`
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
        width: Math.max(minSize.width, requiredWidth),
        height: Math.max(minSize.height, requiredHeight),
      };
      console.log(
        `🔧 Container ${id} calculated size: ${finalSize.width}x${finalSize.height}`
      );

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
      let baseClasses = 'overflow-visible isolate border-2 border-dashed';

      // Different styling for compound vs parallel states
      if (stateType === 'parallel') {
        baseClasses += ' border-orange-300 bg-orange-50/80';
      } else {
        baseClasses += ' border-purple-300 bg-purple-50/80';
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
      : 'shadow-lg hover:shadow-xl transition-all duration-300';

    const nodeClasses = `${getBaseClasses()} ${additionalClasses}`;

    // Get icon for state type
    const getStateIcon = () => {
      switch (stateType) {
        case 'parallel':
          return (
            <div className='flex'>
              <Square className='h-4 w-4 text-orange-600' />
              <Square className='h-4 w-4 text-orange-600 -ml-1' />
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

              {/* Expand/Collapse button */}
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
            {/* Debug info */}
            {/* {process.env.NODE_ENV === 'development' && (
              <div className='text-xs text-red-600 mb-2 p-2 bg-red-50 rounded'>
                Debug: descendants={descendants.length}, direct children={descendants.filter(d => d.parentId === id).length}
                <br />
                Descendants: {descendants.map(d => `${d.id}(parent:${d.parentId})`).join(', ')}
              </div>
            )} */}

            {descendants.length > 0 ? (
              <>
                {/* Status bar showing child count */}
                <div className='text-xs text-gray-600 font-medium mb-3 px-2'>
                  Child States (
                  {descendants.filter((d) => d.parentId === id).length})
                </div>

                {/* Visual child nodes container */}
                <div
                  className='relative w-full h-full overflow-visible'
                  style={{ minHeight: '200px' }}
                >
                  {descendants
                    .filter((descendant) => descendant.parentId === id) // Only render direct children
                    .map((descendant, index) => {
                      if (process.env.NODE_ENV === 'development') {
                        console.log(
                          `🎨 Rendering child ${descendant.id} at index ${index} for container ${id}`
                        );
                      }
                      // Use the position calculated by the layout algorithm
                      // These should already be relative to the parent container
                      let nodeX = descendant.position?.x || 0;
                      let nodeY = descendant.position?.y || 0;

                      // Calculate smart positioning if not provided
                      if (nodeX === 0 && nodeY === 0) {
                        // Get all direct children for layout calculation
                        const directChildren = descendants.filter(
                          (d) => d.parentId === id
                        );
                        const containerChildren = directChildren.filter(
                          (child) => child.childIds && child.childIds.length > 0
                        );
                        const simpleChildren = directChildren.filter(
                          (child) =>
                            !child.childIds || child.childIds.length === 0
                        );

                        const isContainer =
                          descendant.childIds && descendant.childIds.length > 0;

                        if (isContainer) {
                          // Containers get priority positioning (vertical stack)
                          const containerIndex = containerChildren.findIndex(
                            (c) => c.id === descendant.id
                          );
                          nodeX = 20;
                          nodeY = 10 + containerIndex * 220; // Increased spacing for taller containers
                        } else {
                          // Simple states arranged in grid below containers
                          const simpleIndex = simpleChildren.findIndex(
                            (s) => s.id === descendant.id
                          );
                          const containerOffset =
                            containerChildren.length * 220; // Increased for taller containers
                          const columns = Math.min(2, simpleChildren.length); // Fewer columns for wider nodes
                          const row = Math.floor(simpleIndex / columns);
                          const col = simpleIndex % columns;

                          nodeX = 20 + col * 170; // Increased column spacing for wider nodes
                          nodeY = containerOffset + 20 + row * 100; // Increased row spacing for taller nodes
                        }

                        if (process.env.NODE_ENV === 'development') {
                          console.log(
                            `🎯 Smart positioning for ${descendant.id}: (${nodeX}, ${nodeY}) [container:${isContainer}]`
                          );
                        }
                      }

                      // Determine size dynamically based on node type and content
                      let nodeWidth = (descendant.data as any).width || 120;
                      let nodeHeight = (descendant.data as any).height || 60;

                      // For containers, calculate size based on children
                      if (
                        descendant.childIds &&
                        descendant.childIds.length > 0
                      ) {
                        const childCount = descendant.childIds.length;
                        // Calculate minimum width based on label length to prevent truncation
                        const labelWidth =
                          (descendant.data.label || '').length * 8 + 40; // ~8px per char + padding
                        nodeWidth = Math.max(
                          280,
                          labelWidth,
                          200 + childCount * 30
                        ); // Much wider for nested containers
                        nodeHeight = Math.max(
                          200,
                          120 + Math.ceil(childCount / 2) * 50
                        ); // Taller with more spacing
                      } else {
                        // Simple states need more space for labels
                        const labelWidth =
                          (descendant.data.label || '').length * 8 + 40;
                        nodeWidth = Math.max(150, labelWidth); // Width based on label length
                        nodeHeight = 80; // Taller for better visibility
                      }

                      // For nested containers, we need to handle them specially
                      const isNestedContainer =
                        descendant.childIds && descendant.childIds.length > 0;

                      return (
                        <div key={descendant.id}>
                          {isNestedContainer ? (
                            // Render nested container with its children
                            <div
                              className='absolute border-2 border-dashed border-purple-300 bg-purple-50/80 rounded-lg'
                              style={{
                                left: nodeX,
                                top: nodeY,
                                width: nodeWidth,
                                height: nodeHeight,
                              }}
                            >
                              <div className='p-2 bg-white/90 border-b border-purple-200 rounded-t-lg'>
                                <div className='flex items-center space-x-2'>
                                  <Square className='h-3 w-3 text-purple-600' />
                                  <span className='text-sm font-semibold text-gray-900'>
                                    {descendant.data.label}
                                  </span>
                                  <span className='text-xs uppercase tracking-wide font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-700'>
                                    {descendant.data.stateType}
                                  </span>
                                </div>
                              </div>
                              <div className='p-2 flex-1 relative'>
                                <div className='text-xs text-gray-600 mb-1'>
                                  {descendant?.childIds?.length} child states
                                </div>
                                {/* Render nested children */}
                                <div className='relative'>
                                  {descendants
                                    .filter(
                                      (child) =>
                                        child.parentId === descendant.id
                                    )
                                    .map((nestedChild, nestedIndex) => {
                                      const nestedChildren = descendants.filter(
                                        (child) =>
                                          child.parentId === descendant.id
                                      );
                                      const columns = Math.min(
                                        2,
                                        nestedChildren.length
                                      );
                                      const row = Math.floor(
                                        nestedIndex / columns
                                      );
                                      const col = nestedIndex % columns;

                                      // Calculate appropriate size for nested children
                                      const nestedChildLabelWidth =
                                        (nestedChild.data.label || '').length *
                                          6 +
                                        30; // Smaller multiplier for nested
                                      const nestedChildWidth = Math.max(
                                        120,
                                        nestedChildLabelWidth
                                      ); // Minimum 80px
                                      const nestedChildHeight = 80; // Fixed height for nested children

                                      const childX =
                                        5 + col * (nestedChildWidth + 10); // Dynamic spacing based on child width
                                      const childY =
                                        20 + row * (nestedChildHeight + 10); // Dynamic spacing based on child height

                                      return (
                                        <ChildStateNode
                                          key={nestedChild.id}
                                          node={nestedChild}
                                          position={{
                                            x: childX,
                                            y: childY,
                                          }}
                                          size={{
                                            width: nestedChildWidth,
                                            height: nestedChildHeight,
                                          }}
                                          isActive={nestedChild.data.isActive}
                                          onClick={(nodeId) =>
                                            console.log(
                                              'Nested child clicked:',
                                              nodeId
                                            )
                                          }
                                          onDoubleClick={(nodeId) =>
                                            console.log(
                                              'Nested child double-clicked:',
                                              nodeId
                                            )
                                          }
                                        />
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            // Render simple states as ChildStateNode
                            <ChildStateNode
                              node={descendant}
                              position={{
                                x: nodeX,
                                y: nodeY,
                              }}
                              size={{
                                width: nodeWidth,
                                height: nodeHeight,
                              }}
                              isActive={descendant.data.isActive}
                              onClick={(nodeId) => {
                                console.log('Child state clicked:', nodeId);
                                // TODO: Handle child state selection
                              }}
                              onDoubleClick={(nodeId) => {
                                console.log(
                                  'Child state double-clicked:',
                                  nodeId
                                );
                                // TODO: Handle child state editing
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
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
