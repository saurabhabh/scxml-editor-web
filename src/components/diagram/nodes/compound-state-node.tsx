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

    // Calculate container size dynamically based on content
    const containerSize = useMemo(() => {
      // Debug logging

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

      if (isExpanded && descendants.length > 0) {
        const directChildren = descendants.filter((d) => d.parentId === id);

        // Analyze children to determine layout requirements
        const containerChildren = directChildren.filter(
          (child) => child.childIds && child.childIds.length > 0
        );
        const simpleChildren = directChildren.filter(
          (child) => !child.childIds || child.childIds.length === 0
        );

        // Calculate the actual bounding box needed for all children
        let maxX = 0;
        let maxY = 0;

        // Calculate positions and sizes for container children
        const isParallelParent = data.stateType === 'parallel';
        let currentRowY = 10;
        let currentRowMaxHeight = 0;
        let currentRowX = 20;
        // Improved layout for parallel states - better spacing
        const maxContainersPerRow = isParallelParent
          ? Math.min(3, containerChildren.length)
          : 1;

        const containerSpacing = isParallelParent ? 30 : 25; // More space for parallel states

        containerChildren.forEach((container, index) => {
          const containerChildrenCount = container.childIds?.length || 0;

          // Calculate container size based on actual children dimensions
          const labelWidth = (container.data.label || '').length * 8 + 60;

          // Get actual grandchildren to calculate real dimensions needed
          const childIds = container.childIds || [];
          // Get actual grandchildren to calculate real dimensions needed
          const grandChildren = descendants.filter((gc) =>
            childIds.includes(gc.parentId || '')
          );
          let childrenWidth = 200; // minimum
          let childrenHeight = 120; // minimum

          if (grandChildren.length > 0) {
            // Calculate the actual space needed for grandchildren layout
            const grandChildColumns = Math.max(2, grandChildren.length);
            const grandChildRows = Math.ceil(
              grandChildren.length / grandChildColumns
            );

            // Calculate max width needed per column
            let maxWidthPerColumn = 0;
            grandChildren.forEach((grandChild) => {
              const grandChildLabelWidth =
                (grandChild.data.label || '').length * 8 + 40;
              const grandChildWidth = Math.max(120, grandChildLabelWidth);
              maxWidthPerColumn = Math.max(maxWidthPerColumn, grandChildWidth);
            });

            // Total width = columns * maxWidth + spacing
            childrenWidth =
              grandChildColumns * maxWidthPerColumn +
              (grandChildColumns - 1) * 15 +
              100; // padding
            // Total height = rows * height + spacing + header
            childrenHeight =
              80 + grandChildRows * 60 + (grandChildRows - 1) * 15 + 20; // header + rows + spacing + padding
          }

          const containerWidth = Math.max(320, labelWidth, childrenWidth);
          const containerHeight = Math.max(220, childrenHeight);

          // Calculate container position
          let containerX, containerY;

          if (
            maxContainersPerRow > 1 &&
            index % maxContainersPerRow === 0 &&
            index > 0
          ) {
            // Start new row
            currentRowY += currentRowMaxHeight + 25;
            currentRowX = 20;
            currentRowMaxHeight = 0;
          }

          containerX = currentRowX;
          containerY = currentRowY;

          // Update for next container in row
          currentRowX += containerWidth + containerSpacing;
          currentRowMaxHeight = Math.max(currentRowMaxHeight, containerHeight);

          // Update max bounds with better padding for parallel states
          const rightPadding = isParallelParent ? 30 : 20;
          const bottomPadding = isParallelParent ? 35 : 25;
          maxX = Math.max(maxX, containerX + containerWidth + rightPadding);
          maxY = Math.max(maxY, containerY + containerHeight + bottomPadding);

          // CRITICAL FIX: Update the descendant's position with calculated values
          container.position = { x: containerX, y: containerY };
        });

        // Calculate positions and sizes for simple children
        if (simpleChildren.length > 0) {
          // Position simple children below containers
          const containerOffset =
            currentRowY +
            currentRowMaxHeight +
            (containerChildren.length > 0 ? 25 : 0);
          const columns = Math.min(2, simpleChildren.length);

          simpleChildren.forEach((child, index) => {
            const row = Math.floor(index / columns);
            const col = index % columns;

            // Calculate child size based on label
            const labelWidth = (child.data.label || '').length * 8 + 40;
            const childWidth = Math.max(140, labelWidth);
            const childHeight = 80;

            // Calculate child position
            const childX = 20 + col * (childWidth + 25);
            const childY = containerOffset + 20 + row * 125;

            // Update max bounds
            maxX = Math.max(maxX, childX + childWidth + 20); // Add right margin
            maxY = Math.max(maxY, childY + childHeight + 25); // Add bottom margin

            // CRITICAL FIX: Update the simple child's position with calculated values
            child.position = { x: childX, y: childY };
          });
        }

        // Set required dimensions based on actual content bounds
        requiredWidth = Math.max(requiredWidth, maxX + padding);
        requiredHeight = Math.max(
          requiredHeight,
          headerHeight + maxY + padding
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
                      // Use the position calculated by the layout algorithm
                      // These should already be relative to the parent container
                      let nodeX = descendant.position?.x || 0;
                      let nodeY = descendant.position?.y || 0;
                      debugger;
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
                          // Containers positioning (matches size calculation logic)
                          const containerIndex = containerChildren.findIndex(
                            (c) => c.id === descendant.id
                          );

                          const isParallelParent =
                            data.stateType === 'parallel';
                          const maxContainersPerRow = isParallelParent
                            ? Math.min(3, containerChildren.length)
                            : 1;

                          if (maxContainersPerRow > 1) {
                            // Improved side by side layout for parallel containers
                            const row = Math.floor(
                              containerIndex / maxContainersPerRow
                            );
                            const col = containerIndex % maxContainersPerRow;
                            const containerWidth = Math.max(
                              340,
                              (descendant.data.label || '').length * 8 + 80
                            );

                            nodeX = 20 + col * (containerWidth + 30);
                            nodeY = 10 + row * 270; // Increased vertical spacing
                          } else {
                            // Vertical stacking for compound containers
                            nodeX = 20;
                            nodeY = 10 + containerIndex * 250;
                          }
                        } else {
                          // Simple states arranged in grid below containers
                          const simpleIndex = simpleChildren.findIndex(
                            (s) => s.id === descendant.id
                          );

                          // Calculate container offset based on actual layout
                          const isParallelParent =
                            data.stateType === 'parallel';
                          const maxContainersPerRow = isParallelParent
                            ? Math.min(3, containerChildren.length)
                            : 1;
                          const containerRows = Math.ceil(
                            containerChildren.length / maxContainersPerRow
                          );
                          const containerOffset =
                            containerRows > 0 ? 10 + containerRows * 250 : 10;

                          const columns = Math.min(2, simpleChildren.length);
                          const row = Math.floor(simpleIndex / columns);
                          const col = simpleIndex % columns;

                          // Calculate width based on label to avoid overlap
                          const labelWidth =
                            (descendant.data.label || '').length * 8 + 40;
                          const nodeWidth = Math.max(140, labelWidth);

                          nodeX = 20 + col * (nodeWidth + 25);
                          nodeY = containerOffset + 20 + row * 125;
                        }
                      }

                      // Determine size dynamically based on node type and content
                      let nodeWidth = (descendant.data as any).width || 300;
                      let nodeHeight = (descendant.data as any).height || 60;

                      // For containers, calculate size based on actual children dimensions
                      if (
                        descendant.childIds &&
                        descendant.childIds.length > 0
                      ) {
                        const labelWidth =
                          (descendant.data.label || '').length * 8 + 60;

                        const childIds = descendant.childIds;
                        // Get actual grandchildren to calculate real dimensions needed
                        const grandChildren = descendants.filter((gc) =>
                          childIds.includes(gc.parentId || '')
                        );
                        let childrenWidth = 200;
                        let childrenHeight = 120;

                        if (grandChildren.length > 0) {
                          const grandChildColumns = Math.max(
                            2,
                            grandChildren.length
                          );
                          const grandChildRows = Math.ceil(
                            grandChildren.length / grandChildColumns
                          );

                          // Calculate max width needed per column
                          let maxWidthPerColumn = 0;
                          grandChildren.forEach((grandChild) => {
                            const grandChildLabelWidth =
                              (grandChild.data.label || '').length * 8 + 40;
                            const grandChildWidth = Math.max(
                              120,
                              grandChildLabelWidth
                            );
                            maxWidthPerColumn = Math.max(
                              maxWidthPerColumn,
                              grandChildWidth
                            );
                          });

                          childrenWidth =
                            grandChildColumns * maxWidthPerColumn +
                            (grandChildColumns - 1) * 15 +
                            120;
                          childrenHeight =
                            80 +
                            grandChildRows * 60 +
                            (grandChildRows + 1) * 15 +
                            140;
                        }

                        nodeWidth = Math.max(320, labelWidth, childrenWidth);
                        nodeHeight = Math.max(220, childrenHeight);
                      } else {
                        // Simple states with better sizing
                        const labelWidth =
                          (descendant.data.label || '').length * 8 + 40;
                        nodeWidth = Math.max(140, labelWidth);
                        nodeHeight = 80;
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
                                {/* Render nested children recursively */}
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

                                      // Check if this nested child is also a container
                                      const isNestedChildContainer =
                                        nestedChild.childIds &&
                                        nestedChild.childIds.length > 0;

                                      if (isNestedChildContainer) {
                                        // Recursive rendering for nested containers
                                        const containerLabelWidth =
                                          (nestedChild.data.label || '')
                                            .length *
                                            8 +
                                          60; // Increased multiplier and padding

                                        // Calculate space needed for children
                                        const childrenSpaceNeeded = descendants
                                          .filter(
                                            (gc) =>
                                              gc.parentId === nestedChild.id
                                          )
                                          .reduce((maxWidth, grandChild) => {
                                            const grandChildLabelWidth =
                                              (grandChild.data.label || '')
                                                .length *
                                                8 +
                                              40;
                                            const grandChildWidth = Math.max(
                                              120,
                                              grandChildLabelWidth
                                            );
                                            return Math.max(
                                              maxWidth,
                                              grandChildWidth
                                            );
                                          }, 0);

                                        const nestedContainerWidth = Math.max(
                                          250, // Increased minimum width
                                          containerLabelWidth,
                                          childrenSpaceNeeded * 2 + 60, // Space for 2 columns + padding
                                          180 +
                                            (nestedChild?.childIds?.length ||
                                              1) *
                                              30 // More space per child
                                        );
                                        const nestedContainerHeight = Math.max(
                                          180, // Increased minimum height
                                          120 +
                                            Math.ceil(
                                              (nestedChild?.childIds?.length ||
                                                1) / 2
                                            ) *
                                              70 // Increased spacing between rows
                                        );

                                        const childX =
                                          5 + col * (nestedContainerWidth + 25); // Increased spacing between containers
                                        const childY =
                                          20 +
                                          row * (nestedContainerHeight + 25); // Increased vertical spacing

                                        return (
                                          <div
                                            key={nestedChild.id}
                                            className='absolute border-2 border-dashed border-indigo-300 bg-indigo-50/80 rounded-lg'
                                            style={{
                                              left: childX,
                                              top: childY,
                                              width: nestedContainerWidth,
                                              height: nestedContainerHeight,
                                            }}
                                          >
                                            <div className='p-1.5 bg-white/90 border-b border-indigo-200 rounded-t-lg'>
                                              <div className='flex items-center space-x-1.5'>
                                                <Square className='h-2.5 w-2.5 text-indigo-600' />
                                                <span className='text-xs font-semibold text-gray-900'>
                                                  {nestedChild.data.label}
                                                </span>
                                                <span className='text-xs uppercase tracking-wide font-medium px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700'>
                                                  {nestedChild.data.stateType}
                                                </span>
                                              </div>
                                            </div>
                                            <div className='p-1.5 flex-1 relative'>
                                              <div className='text-xs text-gray-600 mb-1'>
                                                {nestedChild?.childIds?.length}{' '}
                                                states
                                              </div>
                                              {/* Render the children of this nested container */}
                                              <div className='relative'>
                                                {descendants
                                                  .filter(
                                                    (grandChild) =>
                                                      grandChild.parentId ===
                                                      nestedChild.id
                                                  )
                                                  .map(
                                                    (
                                                      grandChild,
                                                      grandIndex
                                                    ) => {
                                                      const grandChildren =
                                                        descendants.filter(
                                                          (gc) =>
                                                            gc.parentId ===
                                                            nestedChild.id
                                                        );
                                                      const grandColumns =
                                                        Math.min(
                                                          2,
                                                          grandChildren.length
                                                        );
                                                      const grandRow =
                                                        Math.floor(
                                                          grandIndex /
                                                            grandColumns
                                                        );
                                                      const grandCol =
                                                        grandIndex %
                                                        grandColumns;

                                                      const grandChildLabelWidth =
                                                        (
                                                          grandChild.data
                                                            .label || ''
                                                        ).length *
                                                          8 +
                                                        40; // Increased multiplier and padding
                                                      const grandChildWidth =
                                                        Math.max(
                                                          120, // Increased minimum width
                                                          grandChildLabelWidth
                                                        );
                                                      const grandChildHeight = 60; // Increased height

                                                      const grandChildX =
                                                        5 + // Increased left margin
                                                        grandCol *
                                                          (grandChildWidth +
                                                            15); // Increased spacing
                                                      const grandChildY =
                                                        20 + // Increased top margin
                                                        grandRow *
                                                          (grandChildHeight +
                                                            15); // Increased spacing

                                                      return (
                                                        <ChildStateNode
                                                          key={grandChild.id}
                                                          node={grandChild}
                                                          position={{
                                                            x: grandChildX,
                                                            y: grandChildY,
                                                          }}
                                                          size={{
                                                            width:
                                                              grandChildWidth,
                                                            height:
                                                              grandChildHeight,
                                                          }}
                                                          isActive={
                                                            grandChild.data
                                                              .isActive
                                                          }
                                                          onClick={(nodeId) =>
                                                            console.log(
                                                              'Grand child clicked:',
                                                              nodeId
                                                            )
                                                          }
                                                          onDoubleClick={(
                                                            nodeId
                                                          ) =>
                                                            console.log(
                                                              'Grand child double-clicked:',
                                                              nodeId
                                                            )
                                                          }
                                                        />
                                                      );
                                                    }
                                                  )}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        // Render simple states with better sizing
                                        const nestedChildLabelWidth =
                                          (nestedChild.data.label || '')
                                            .length *
                                            8 + // Increased multiplier
                                          40; // Increased padding
                                        const nestedChildWidth = Math.max(
                                          140, // Increased minimum width
                                          nestedChildLabelWidth
                                        );
                                        const nestedChildHeight = 80;

                                        const childX =
                                          5 + col * (nestedChildWidth + 15); // Increased spacing
                                        const childY =
                                          20 + row * (nestedChildHeight + 15); // Increased spacing

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
                                      }
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
