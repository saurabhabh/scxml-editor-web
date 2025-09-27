'use client';

import { ChevronDown, ChevronRight, Plus, Square } from 'lucide-react';
import React, { memo, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Handle,
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from 'reactflow';
import {
  getAdditionalClasses,
  visualStylesToCSS,
} from '@/lib/utils/visual-style-utils';

export interface GroupNodeData {
  label: string;
  stateType: 'compound' | 'parallel';
  isInitial?: boolean;
  isActive?: boolean;
  entryActions?: string[];
  exitActions?: string[];
  visualStyles?: any;
  containerMetadata?: {
    isExpanded?: boolean;
    padding?: number;
    minSize?: { width: number; height: number };
  };
  onLabelChange?: (newLabel: string) => void;
  onStateTypeChange?: (newType: string) => void;
  onActionsChange?: (entryActions: string[], exitActions: string[]) => void;
  onChildrenToggle?: (nodeId: string, isExpanded: boolean) => void;
  onChildAdd?: (parentId: string) => void;
  childCount?: number;
  width?: number;
  height?: number;
}

export const GroupNode = memo<NodeProps<GroupNodeData>>(
  ({ data, selected, id }) => {
    const reactFlowInstance = useReactFlow();

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
      containerMetadata,
      onLabelChange,
      onChildrenToggle,
      onChildAdd,
      childCount = 0,
      width,
      height,
    } = data;

    const [editingLabel, setEditingLabel] = React.useState(false);
    const [tempLabel, setTempLabel] = React.useState(label);

    const isExpanded = containerMetadata?.isExpanded ?? true;
    const padding = containerMetadata?.padding ?? 20;
    const minSize = containerMetadata?.minSize ?? { width: 280, height: 200 };

    // Get all nodes from ReactFlow store
    const nodes = reactFlowInstance.getNodes();

    // Get direct children of this group
    const childNodes = useMemo(() => {
      return nodes.filter((node) => node.parentId === id);
    }, [nodes, id]);

    // Build descendant structure for layout calculation
    const descendantsForLayout = useMemo(() => {
      const buildDescendants = (parentId: string): any[] => {
        const children = nodes.filter((n) => n.parentId === parentId);
        return children.map((child) => ({
          id: child.id,
          data: child.data,
          parentId: child.parentId,
          position: child.position,
          style: child.style, // Include style to detect viz:xywh nodes
          childIds: nodes
            .filter((n) => n.parentId === child.id)
            .map((n) => n.id),
        }));
      };
      return buildDescendants(id);
    }, [nodes, id]);

    // Track dimensions to prevent resize during drag
    const cachedDimensionsRef = useRef<{
      width: number;
      height: number;
    } | null>(null);
    const lastContentHashRef = useRef<string>('');

    // Create a hash of content that should trigger resize
    const contentHash = useMemo(() => {
      return `${childNodes.length}-${isExpanded}-${padding}-${JSON.stringify(
        minSize
      )}-${stateType}`;
    }, [childNodes.length, isExpanded, padding, minSize, stateType]);

    // Clear cached dimensions when content changes
    if (contentHash !== lastContentHashRef.current) {
      cachedDimensionsRef.current = null;
      lastContentHashRef.current = contentHash;
    }

    // Helper function to calculate hierarchical layout (adapted from CompoundStateNode)
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

        // Categorize states by complexity and type
        const analyzeState = (node: any) => {
          const label = node.data.label?.toLowerCase() || '';
          const entryActions = node.data.entryActions?.length || 0;
          const exitActions = node.data.exitActions?.length || 0;
          const totalActions = entryActions + exitActions;

          // Determine state type
          let stateType = 'operational';
          if (
            label.includes('idle') ||
            label.includes('initial') ||
            node.data.isInitial
          ) {
            stateType = 'initial';
          } else if (
            label.includes('error') ||
            label.includes('fail') ||
            label.includes('exception')
          ) {
            stateType = 'error';
          } else if (
            label.includes('final') ||
            label.includes('complete') ||
            label.includes('done')
          ) {
            stateType = 'terminal';
          } else if (label.includes('measure') || label.includes('sensor')) {
            stateType = 'sensor';
          }

          return {
            node,
            complexity: totalActions,
            stateType,
            label,
          };
        };
        // Check if a node has viz:xywh positioning
        // A node has viz:xywh if it has explicit position data from viz:xywh attribute
        const hasVizPosition = (node: any) => {
          // Only check for position markers (vizX/vizY), not dimensions
          return node.data?.vizX !== undefined && node.data?.vizY !== undefined;
        };

        // Separate viz:xywh positioned nodes from auto-layout nodes
        const vizPositionedNodes = directChildren.filter(hasVizPosition);
        const autoLayoutNodes = directChildren.filter(
          (n) => !hasVizPosition(n)
        );

        // Separate containers and simple states (only from auto-layout nodes)
        const containers = autoLayoutNodes.filter(
          (c) => c.childIds && c.childIds.length > 0
        );
        const simpleStates = autoLayoutNodes
          .filter((c) => !c.childIds || c.childIds.length === 0)
          .map(analyzeState);

        const childLayouts: Record<string, any> = {};
        let maxWidth = 0;

        // Group states by complexity tiers (Y-axis positioning)
        const tier1States = simpleStates.filter((s) => s.complexity === 0); // Top tier
        const tier2States = simpleStates.filter(
          (s) => s.complexity >= 1 && s.complexity <= 2
        ); // Middle tier
        const tier3States = simpleStates.filter((s) => s.complexity >= 3); // Lower tier
        const errorStates = simpleStates.filter((s) => s.stateType === 'error'); // Bottom tier

        // Sort within tiers by semantic grouping (X-axis positioning)
        const sortBySemanticGroup = (states: any[]) => {
          return states.sort((a, b) => {
            const typeOrder = {
              initial: 0,
              operational: 1,
              sensor: 2,
              terminal: 3,
              error: 4,
            };
            const aOrder =
              typeOrder[a.stateType as keyof typeof typeOrder] || 1;
            const bOrder =
              typeOrder[b.stateType as keyof typeof typeOrder] || 1;
            if (aOrder !== bOrder) return aOrder - bOrder;
            // Group similar operations together
            return a.label.localeCompare(b.label);
          });
        };

        // First, layout all container children compactly
        let currentY = 50; // Start position for first tier
        if (containers.length > 0) {
          const cols = containers.length <= 2 ? containers.length : 2;
          const rows = Math.ceil(containers.length / cols);

          const containerSizes = containers.map((container) => {
            const childLayout = calculateHierarchicalLayout(
              container.id,
              availableNodes,
              depth + 1
            );
            return {
              container,
              childLayout,
              width: Math.max(200, childLayout.width + 60),
              height: Math.max(140, childLayout.height + 80),
            };
          });

          for (let row = 0; row < rows; row++) {
            let rowMaxHeight = 0;
            let currentX = 30; // Increased padding from left

            for (let col = 0; col < cols; col++) {
              const idx = row * cols + col;
              if (idx >= containers.length) break;

              const {
                container,
                childLayout,
                width: containerWidth,
                height: containerHeight,
              } = containerSizes[idx];

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

              currentX += containerWidth + 60; // Increased spacing between containers
              rowMaxHeight = Math.max(rowMaxHeight, containerHeight);
            }

            maxWidth = Math.max(maxWidth, currentX);
            currentY += rowMaxHeight + 50; // Increased vertical spacing
          }
        }

        // Layout states by complexity tiers
        const layoutTier = (
          tierStates: any[],
          tierY: number,
          tierName: string
        ) => {
          if (tierStates.length === 0) return tierY;

          const sortedStates = sortBySemanticGroup(tierStates);
          const cols = Math.min(sortedStates.length, 4); // Max 4 columns per tier
          const rows = Math.ceil(sortedStates.length / cols);

          let tierMaxY = tierY;
          for (let row = 0; row < rows; row++) {
            let currentX = 50; // Left padding
            let rowMaxHeight = 0;

            for (let col = 0; col < cols; col++) {
              const idx = row * cols + col;
              if (idx >= sortedStates.length) break;

              const stateInfo = sortedStates[idx];
              const state = stateInfo.node;

              // Don't use viz:xywh width/height, use consistent sizing for layout
              const stateWidth = Math.max(
                160,
                (state.data.label || '').length * 10 + 40
              );
              const stateHeight = 80;

              // Apply semantic grouping with better spacing
              if (
                col > 0 &&
                sortedStates[idx - 1].stateType !== stateInfo.stateType
              ) {
                currentX += 30; // Extra space between different semantic groups
              }

              childLayouts[state.id] = {
                x: currentX,
                y: tierY,
                width: stateWidth,
                height: stateHeight,
                children: {},
                type: 'simple',
                complexity: stateInfo.complexity,
                stateType: stateInfo.stateType,
              };

              currentX += stateWidth + 60; // Horizontal spacing
              rowMaxHeight = Math.max(rowMaxHeight, stateHeight);
            }

            maxWidth = Math.max(maxWidth, currentX);
            tierY += rowMaxHeight + 60; // Vertical spacing between rows
            tierMaxY = tierY;
          }

          return tierMaxY;
        };

        // Layout each tier
        if (simpleStates.length > 0) {
          // Tier 1: States with 0 actions (top)
          currentY = layoutTier(tier1States, currentY, 'tier1');
          currentY += 30; // Extra space between tiers

          // Tier 2: States with 1-2 actions (middle)
          currentY = layoutTier(tier2States, currentY, 'tier2');
          currentY += 30; // Extra space between tiers

          // Tier 3: States with 3+ actions (lower)
          currentY = layoutTier(tier3States, currentY, 'tier3');
          currentY += 40; // Extra space before error states

          // Tier 4: Error states (bottom)
          currentY = layoutTier(errorStates, currentY, 'error');
        }

        // Add viz:xywh positioned nodes to the layout with their existing positions
        // These positions come directly from the viz:xywh attribute
        vizPositionedNodes.forEach((node) => {
          // Use the position that was parsed from viz:xywh
          // The position is already set correctly by the parser
          const x = node.position.x;
          const y = node.position.y;
          // Don't use viz:xywh width/height, use default sizing for layout calculations
          const width = Math.max(160, (node.data.label || '').length * 10 + 40);
          const height = 80;

          childLayouts[node.id] = {
            x: x,
            y: y,
            width: width,
            height: height,
            children: {},
            type: 'viz-positioned',
            preservePosition: true, // Flag to indicate this should not be repositioned
          };

          // Update max dimensions to include viz:xywh positioned nodes
          const nodeRight = x + width;
          const nodeBottom = y + height;
          maxWidth = Math.max(maxWidth, nodeRight);
          currentY = Math.max(currentY, nodeBottom);
        });

        return {
          width: Math.max(200, maxWidth + 20), // Add padding for right side
          height: Math.max(100, currentY), // currentY already includes bottom padding
          childLayouts,
        };
      },
      []
    );

    // Calculate the full layout for this container
    const layout = useMemo(() => {
      if (!isExpanded || descendantsForLayout.length === 0) {
        return {
          width: minSize.width,
          height: minSize.height,
          childLayouts: {},
        };
      }
      return calculateHierarchicalLayout(id, descendantsForLayout);
    }, [
      id,
      descendantsForLayout,
      isExpanded,
      minSize,
      calculateHierarchicalLayout,
    ]);

    // Calculate container size dynamically based on layout
    const containerSize = useMemo(() => {
      // Use cached dimensions if available (prevents resize during drag)
      if (cachedDimensionsRef.current) {
        return cachedDimensionsRef.current;
      }

      // Don't use viz:xywh width/height for container sizing
      // Let GroupNode calculate its own size based on content

      const headerHeight = 60;
      const statusBarHeight = 30;
      let requiredWidth = minSize.width;
      let requiredHeight = minSize.height;

      if (isExpanded && layout) {
        // Use the pre-calculated layout dimensions
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
        width: Math.max(minSize.width, requiredWidth + 40), // Reduced padding
        height: Math.max(minSize.height, requiredHeight + 20), // Reduced padding
      };

      cachedDimensionsRef.current = finalSize;
      return finalSize;
    }, [width, height, layout, isExpanded, padding, minSize, contentHash]);

    // Update child node positions based on calculated layout
    // ONLY for nodes without explicit viz:xywh positions
    const layoutChildLayoutsStr = JSON.stringify(layout.childLayouts);

    // Track if any drag operations are happening to prevent interference
    const isDraggingRef = useRef(false);

    useEffect(() => {
      // CRITICAL FIX: Skip layout updates during drag operations to prevent infinite loops
      if (isDraggingRef.current) {
        return;
      }

      if (
        !isExpanded ||
        !layout.childLayouts ||
        Object.keys(layout.childLayouts).length === 0
      ) {
        return;
      }

      const { setNodes } = reactFlowInstance;

      // Check if nodes are currently being dragged by examining their dragging state
      const currentNodes = reactFlowInstance.getNodes();
      const anyNodeDragging = currentNodes.some(
        (node) => node.dragging || (node as any).selected
      );

      if (anyNodeDragging) {
        isDraggingRef.current = true;
        // Clear flag after drag should be complete
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 500);
        return;
      }

      // Only update positions for nodes without viz:xywh data
      setNodes((nodes) => {
        let hasChanges = false;
        const updatedNodes = nodes.map((node) => {
          const childLayout = layout.childLayouts[node.id];
          if (childLayout && node.parentId === id) {
            // Check if node has explicit position from viz:xywh
            // Only check for position markers (vizX/vizY), not dimensions
            const hasVizPosition =
              node.data?.vizX !== undefined && node.data?.vizY !== undefined;

            if (!hasVizPosition && !childLayout.preservePosition) {
              // Only apply auto-layout if no viz:xywh position exists
              const newX = childLayout.x;
              const newY = childLayout.y + 60; // Add header offset

              // Check if position actually changed
              if (node.position.x !== newX || node.position.y !== newY) {
                hasChanges = true;
                return {
                  ...node,
                  position: { x: newX, y: newY },
                };
              }
            }
            // For viz:xywh nodes, keep their original positions
          }
          return node;
        });

        // Only return updated nodes if there were actual changes
        return hasChanges ? updatedNodes : nodes;
      });
    }, [layoutChildLayoutsStr, id, isExpanded]); // Use stringified layout to avoid object comparison issues

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
      let baseClasses =
        'rounded-2xl overflow-visible transition-all duration-200 ring-2 ring-opacity-20';

      if (stateType === 'parallel') {
        baseClasses +=
          ' border-2 border-solid border-orange-500 bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 shadow-orange-300/40 ring-orange-400';
      } else {
        baseClasses +=
          ' border-[3px] border-dashed border-purple-500 bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 shadow-purple-300/40 ring-purple-400';
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
          zIndex: 10, // Higher z-index to render above edges
        }}
      >
        {/* Connection handles - only show if node has connections */}
        {hasConnections && (
          <>
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
          </>
        )}

        {/* Group header */}
        <div className='p-4 bg-gradient-to-r from-white to-gray-50/80 border-b-2 border-gray-200/60 rounded-t-2xl backdrop-blur-sm shadow-sm'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3 flex-1'>
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
                  className='font-bold text-gray-800 text-lg cursor-pointer hover:bg-blue-50 px-2 py-1 rounded-md transition-colors'
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
                className={`text-xs uppercase tracking-wider font-bold px-3 py-1.5 rounded-full shadow-sm ${
                  stateType === 'compound'
                    ? 'bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 border border-purple-300'
                    : 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-700 border border-orange-300'
                }`}
              >
                {stateType}
              </span>

              {childCount > 0 && (
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
              )}
            </div>
          </div>
        </div>

        {/* Group content area */}
        {isExpanded && (
          <div
            className='flex-1 relative bg-gradient-to-b from-transparent to-white/20'
            style={{ padding: padding + 10, minHeight: layout.height || 100 }}
          >
            {childNodes.length > 0 ? (
              <>
                <div className='flex items-center justify-between mb-4'>
                  <div className='text-sm text-gray-600 font-semibold px-3 py-1 bg-white/50 rounded-md inline-block'>
                    Child States ({childNodes.length})
                  </div>
                  {/* Add child button - always visible */}
                  {/* <button
                    onClick={handleAddChild}
                    className='flex items-center space-x-1 text-xs cursor-pointer bg-blue-500 text-white hover:bg-blue-600 px-3 py-1.5 rounded-md transition-all hover:shadow-md group'
                    title='Add new child state'
                  >
                    <Plus className='h-3 w-3 group-hover:rotate-90 transition-transform' />
                    <span>Add State</span>
                  </button> */}
                </div>
                {/* ReactFlow renders child nodes here automatically */}
                <div className='relative w-full h-full overflow-visible' />
              </>
            ) : (
              <div className='flex flex-col items-center justify-center h-full'>
                <div className='text-sm mb-4 text-gray-400'>
                  No child states
                </div>
                <button
                  onClick={handleAddChild}
                  className='flex items-center space-x-2 bg-blue-500 text-white hover:bg-blue-600 px-4 py-2 rounded-lg transition-all hover:shadow-lg group'
                >
                  <Plus className='h-4 w-4 group-hover:rotate-90 transition-transform' />
                  <span className='font-medium'>Add First State</span>
                </button>
              </div>
            )}

            {/* Floating add button for better UX when container has many states */}
            {/* {childNodes.length > 3 && (
              <button
                onClick={handleAddChild}
                className='absolute bottom-4 right-4 bg-blue-500 text-white hover:bg-blue-600 p-2 rounded-full shadow-lg hover:shadow-xl transition-all group z-20'
                title='Add new child state'
              >
                <Plus className='h-5 w-5 group-hover:rotate-90 transition-transform' />
              </button>
            )} */}
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

GroupNode.displayName = 'GroupNode';
