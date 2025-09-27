//visual-diagram.tsx
'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  applyNodeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  BackgroundVariant,
  MarkerType,
  ConnectionLineType,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  SmartBezierEdge,
  SmartStepEdge,
  SmartStraightEdge,
  getSmartEdge,
} from '@tisoap/react-flow-smart-edge';
import { SCXMLStateNode } from './nodes/scxml-state-node';
import { GroupNode } from './nodes/group-node';
import { HistoryWrapperNode } from './nodes/history-wrapper-node';
import { SCXMLTransitionEdge } from './edges/scxml-transition-edge';
import { SimulationControls } from '../simulation';
import { SCXMLParser } from '@/lib/parsers/scxml-parser';
import { SCXMLToXStateConverter } from '@/lib/converters/scxml-to-xstate';
import { VisualMetadataManager } from '@/lib/metadata';
import { computeVisualStyles } from '@/lib/utils/visual-style-utils';
import { ConditionEvaluator } from '@/lib/scxml/condition-evaluator';
import {
  findStateById,
  updateTransitionTargets,
  updateStateActions,
  updateStateType,
  createStateElement,
  createTransitionElement,
  addStateToDocument,
  removeStateFromDocument,
  addTransitionToState,
  updateStatePosition,
} from '@/lib/utils/scxml-manipulation-utils';
import type { ElementVisualMetadata } from '@/types/visual-metadata';
import type { SCXMLDocument, TransitionElement } from '@/types/scxml';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface VisualDiagramProps {
  scxmlContent: string;
  onNodeChange?: (nodes: Node[]) => void;
  onEdgeChange?: (edges: Edge[]) => void;
  onSCXMLChange?: (scxmlContent: string) => void;
}

// Custom node types for SCXML elements
const nodeTypes: NodeTypes = {
  scxmlState: SCXMLStateNode,
  group: GroupNode,
  scxmlHistory: HistoryWrapperNode,
};

// Custom edge types for SCXML transitions
const edgeTypes = {
  scxmlTransition: SCXMLTransitionEdge,
  smart: SmartBezierEdge,
  smartStep: SmartStepEdge,
  smartStraight: SmartStraightEdge,
  // Using ReactFlow's built-in edge types: smoothstep, step, straight
  // These are automatically available without explicit registration
};

// Default nodes for demo purposes
const initialNodes: Node[] = [
  {
    id: 'idle',
    type: 'scxmlState',
    position: { x: 100, y: 100 },
    data: {
      label: 'idle',
      stateType: 'simple',
      isInitial: true,
      entryActions: [],
      exitActions: [],
    },
  },
  {
    id: 'active',
    type: 'scxmlState',
    position: { x: 300, y: 100 },
    data: {
      label: 'active',
      stateType: 'simple',
      isInitial: false,
      entryActions: ['log("Entering active state")'],
      exitActions: ['log("Exiting active state")'],
    },
  },
];

// Default edges for demo purposes - with proper arrow markers
const initialEdges: Edge[] = [
  {
    id: 'idle-to-active',
    type: 'aligned',
    source: 'idle',
    target: 'active',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#6b7280',
    },
    data: {
      event: 'start',
      condition: null,
      actions: [],
    },
  },
  {
    id: 'active-to-idle',
    type: 'aligned',
    source: 'active',
    target: 'idle',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#6b7280',
    },
    data: {
      event: 'stop',
      condition: null,
      actions: [],
    },
  },
];

export const VisualDiagram: React.FC<VisualDiagramProps> = ({
  scxmlContent,
  onNodeChange,
  onEdgeChange,
  onSCXMLChange,
}) => {
  const [currentSimulationState, setCurrentSimulationState] =
    React.useState<string>('');
  const [transitionDisplayMode, setTransitionDisplayMode] = React.useState<
    'all' | 'active' | 'available'
  >('all');
  const [activeStates, setActiveStates] = React.useState<Set<string>>(
    new Set()
  );
  const [datamodelContext, setDatamodelContext] = React.useState<
    Record<string, any>
  >({});
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    isOpen: boolean;
    nodeId: string;
    nodeLabel: string;
  }>({
    isOpen: false,
    nodeId: '',
    nodeLabel: '',
  });

  // Flag to prevent re-parsing when updating positions
  const isUpdatingPositionRef = React.useRef(false);
  // Track previous SCXML content to detect real changes
  const previousScxmlRef = React.useRef<string>('');
  // Store the child add handler
  const handleChildAddRef = React.useRef<((parentId: string) => void) | null>(
    null
  );
  // Store the node delete handler
  const handleNodeDeleteRef = React.useRef<((nodeId: string) => void) | null>(
    null
  );

  // Visual metadata management
  const parserRef = React.useRef<SCXMLParser | null>(null);
  const metadataManagerRef = React.useRef<VisualMetadataManager | null>(null);
  const scxmlDocRef = React.useRef<SCXMLDocument | null>(null);

  // Define handlers first, before they're used in parsedData
  // Node content change handlers
  const handleNodeLabelChange = React.useCallback(
    (nodeId: string, newLabel: string) => {
      if (!parserRef.current || !onSCXMLChange) return;

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          // Find and update the state element
          const scxmlDoc = parseResult.data;
          const stateElement = findStateById(scxmlDoc, nodeId);

          if (stateElement) {
            stateElement['@_id'] = newLabel;

            // Update transitions that target this state
            updateTransitionTargets(scxmlDoc, nodeId, newLabel);

            // Serialize updated SCXML
            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML);
          }
        }
      } catch (error) {
        console.error('Failed to sync label change:', error);
      }
    },
    [scxmlContent, onSCXMLChange]
  );

  const handleNodeActionsChange = React.useCallback(
    (nodeId: string, entryActions: string[], exitActions: string[]) => {
      if (!parserRef.current || !onSCXMLChange) return;

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;
          const stateElement = findStateById(scxmlDoc, nodeId);

          if (stateElement) {
            // Update onentry actions
            updateStateActions(stateElement, 'onentry', entryActions);
            // Update onexit actions
            updateStateActions(stateElement, 'onexit', exitActions);

            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML);
          }
        }
      } catch (error) {
        console.error('Failed to sync actions change:', error);
      }
    },
    [scxmlContent, onSCXMLChange]
  );

  const handleNodeStateTypeChange = React.useCallback(
    (nodeId: string, newStateType: string) => {
      if (!parserRef.current || !onSCXMLChange) return;

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;
          const stateElement = findStateById(scxmlDoc, nodeId);

          if (stateElement) {
            // Update state type (this might require changing the element type)
            updateStateType(stateElement, newStateType as any);

            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML);
          }
        }
      } catch (error) {
        console.error('Failed to sync state type change:', error);
      }
    },
    [scxmlContent, onSCXMLChange]
  );

  // Handle container expand/collapse
  const handleChildrenToggle = React.useCallback(
    (nodeId: string, isExpanded: boolean) => {
      // TODO: Optionally sync this state to visual metadata/SCXML
    },
    []
  );

  // Wrapper for handleChildAdd that uses the ref
  const handleChildAdd = React.useCallback((parentId: string) => {
    if (handleChildAddRef.current) {
      handleChildAddRef.current(parentId);
    } else {
      console.log('Child add handler not yet initialized');
    }
  }, []);

  // Wrapper for handleNodeDelete that uses the ref
  const handleNodeDeleteWrapper = React.useCallback((nodeId: string, nodeLabel: string) => {
    setDeleteConfirm({
      isOpen: true,
      nodeId,
      nodeLabel,
    });
  }, []);

  // Parse SCXML first to get initial data
  const parsedData = useMemo(() => {
    if (!scxmlContent.trim()) {
      return {
        nodes: [],
        edges: [],
        parser: null,
        metadataManager: null,
      };
    }

    try {
      const parser = new SCXMLParser();
      const converter = new SCXMLToXStateConverter();
      const metadataManager = parser.getVisualMetadataManager();

      // Store references for later use
      parserRef.current = parser;
      metadataManagerRef.current = metadataManager;

      // Parse the SCXML content
      const parseResult = parser.parse(scxmlContent);

      if (parseResult.success && parseResult.data) {
        // Store the parsed SCXML document for later use
        scxmlDocRef.current = parseResult.data;
        // Convert to React Flow nodes and edges
        const { nodes, edges, datamodelContext } = converter.convertToReactFlow(
          parseResult.data
        );

        // Enhance nodes with visual metadata if available
        const enhancedNodes = nodes.map((node) => {
          const visualMetadata = metadataManager.getVisualMetadata(node.id);
          const nodeUpdate: any = { ...node };

          // Apply layout metadata (position and size)
          if (visualMetadata?.layout) {
            nodeUpdate.position = {
              x: visualMetadata.layout.x ?? node.position.x,
              y: visualMetadata.layout.y ?? node.position.y,
            };

            // Apply size if available
            if (
              visualMetadata.layout.width !== undefined ||
              visualMetadata.layout.height !== undefined
            ) {
              nodeUpdate.style = {
                ...nodeUpdate.style,
                width:
                  visualMetadata.layout.width ?? nodeUpdate.style?.width ?? 120,
                height:
                  visualMetadata.layout.height ??
                  nodeUpdate.style?.height ??
                  60,
              };
            }
          }
          // Special handling for history wrapper nodes - preserve their calculated size
          if (
            nodeUpdate.type === 'scxmlHistory' &&
            node.data?.isHistoryWrapper
          ) {
            const calculatedWidth =
              (node.data as any).width || node.style?.width;
            const calculatedHeight =
              (node.data as any).height || node.style?.height;

            if (calculatedWidth && calculatedHeight) {
              nodeUpdate.style = {
                ...nodeUpdate.style,
                width: calculatedWidth,
                height: calculatedHeight,
              };
            }
          }

          // Compute visual styles and pass to node data
          const visualStyles = computeVisualStyles(
            visualMetadata,
            node.data?.stateType || 'simple'
          );

          nodeUpdate.data = {
            ...nodeUpdate.data,
            visualStyles,
            // Add dimensions from visual metadata OR preserve calculated dimensions for history wrappers
            width:
              nodeUpdate.type === 'scxmlHistory' && node.data?.isHistoryWrapper
                ? (function () {
                    const w =
                      nodeUpdate.style?.width || (node.data as any).width;
                    return w;
                  })()
                : visualMetadata?.layout?.width,
            height:
              nodeUpdate.type === 'scxmlHistory' && node.data?.isHistoryWrapper
                ? (function () {
                    const h =
                      nodeUpdate.style?.height || (node.data as any).height;
                    return h;
                  })()
                : visualMetadata?.layout?.height,
            // Add editing callbacks
            onLabelChange: (newLabel: string) =>
              handleNodeLabelChange(node.id, newLabel),
            onStateTypeChange: (newStateType: string) =>
              handleNodeStateTypeChange(node.id, newStateType),
            onActionsChange: (entryActions: string[], exitActions: string[]) =>
              handleNodeActionsChange(node.id, entryActions, exitActions),
            onDelete: () => handleNodeDeleteWrapper(node.id, node.data?.label || node.id),
            // Add container-specific callbacks for group nodes
            onChildrenToggle:
              nodeUpdate.type === 'group' ? handleChildrenToggle : undefined,
            onChildAdd:
              nodeUpdate.type === 'group' ? handleChildAdd : undefined,
          };

          return nodeUpdate;
        });

        // Detect overlapping edges between same source and target
        const edgeGroups = new Map<string, any[]>();
        edges.forEach((edge) => {
          const key = `${edge.source}-${edge.target}`;
          if (!edgeGroups.has(key)) {
            edgeGroups.set(key, []);
          }
          edgeGroups.get(key)!.push(edge);
        });

        // Helper to check if two nodes share the same parent
        const haveSameParent = (sourceId: string, targetId: string) => {
          const sourceNode = nodes.find((n) => n.id === sourceId);
          const targetNode = nodes.find((n) => n.id === targetId);
          return sourceNode?.parentId === targetNode?.parentId;
        };

        // Enhance edges with visual metadata and ensure proper arrow markers
        const edgesWithMarkers = edges.map((edge, index) => {
          // Try to get visual metadata for this edge (transitions)
          const edgeMetadata = metadataManager.getVisualMetadata(edge.id);

          // Check for parallel edges
          const edgeKey = `${edge.source}-${edge.target}`;
          const parallelEdges = edgeGroups.get(edgeKey) || [];
          const edgeIndex = parallelEdges.findIndex((e) => e.id === edge.id);
          const hasParallelEdges = parallelEdges.length > 1;

          // Check if source and target are in the same parent container
          const inSameContainer = haveSameParent(edge.source, edge.target);

          // Use appropriate edge type based on context
          let edgeType = 'smoothstep'; // Default to smoothstep for contained edges

          if (inSameContainer) {
            // For edges within the same container, use simpler edge types
            if (hasParallelEdges) {
              // Use different simple edge types for parallel transitions
              if (edgeIndex === 0) {
                edgeType = 'smoothstep';
              } else if (edgeIndex === 1) {
                edgeType = 'step';
              } else {
                edgeType = 'straight';
              }
            } else {
              // Single edge within container
              edgeType = 'smoothstep';
            }
          } else {
            // For cross-container edges, use smart edges for obstacle avoidance
            if (hasParallelEdges) {
              // Alternate between smart edge types for parallel transitions
              if (edgeIndex === 0) {
                edgeType = 'smart';
              } else if (edgeIndex === 1) {
                edgeType = 'smartStep';
              } else {
                edgeType = 'smartStraight';
              }
            } else {
              edgeType = 'smart';
            }
          }

          // Calculate offset for parallel edges to separate them visually
          let pathOptions: any = {};
          if (hasParallelEdges && inSameContainer) {
            // Add offset to separate parallel edges
            const offset = edgeIndex * 30 - (parallelEdges.length - 1) * 15;
            pathOptions = {
              offset,
              borderRadius: 20 + edgeIndex * 10,
              // For smoothstep, add curvature control
              curvature: 0.25 + edgeIndex * 0.1,
            };
          }

          const edgeUpdate: any = {
            ...edge,
            type: edgeType,
            pathOptions,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color:
                edge.data?.event && edge.data?.condition
                  ? '#2563eb'
                  : edge.data?.condition
                  ? '#7c3aed'
                  : edge.data?.event
                  ? '#6b7280'
                  : '#374151',
            },
            style: {
              ...edge.style,
              strokeWidth: 2,
              zIndex: 1,
            },
            zIndex: 1,
            labelStyle: {
              fill: '#fff',
              fontWeight: 600,
              fontSize: 12,
            },
            labelBgStyle: {
              fill: '#6b7280',
              fillOpacity: 0.95,
            },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 4,
          };

          // Apply visual metadata if available
          if (edgeMetadata) {
            // Apply style metadata to edge
            if (edgeMetadata.style?.stroke) {
              edgeUpdate.style = {
                ...edgeUpdate.style,
                stroke: edgeMetadata.style.stroke,
                zIndex: 9999,
              };
              // Also update marker color to match stroke
              edgeUpdate.markerEnd.color = edgeMetadata.style.stroke;
            }

            if (edgeMetadata.style?.strokeWidth !== undefined) {
              edgeUpdate.style = {
                ...edgeUpdate.style,
                strokeWidth: edgeMetadata.style.strokeWidth,
                zIndex: 9999,
              };
            }

            // Apply diagram metadata (curve type, waypoints, etc.)
            if (edgeMetadata.diagram) {
              if (edgeMetadata.diagram.curveType) {
                // Map visual curve types to smart edge types
                const curveTypeMap: Record<string, string> = {
                  smooth: 'smart',
                  step: 'smartStep',
                  straight: 'smartStraight',
                  bezier: 'smart',
                };
                edgeUpdate.type =
                  curveTypeMap[edgeMetadata.diagram.curveType] || 'smart';
              }

              // Apply waypoints if available (for future enhancement)
              if (
                edgeMetadata.diagram.waypoints &&
                edgeMetadata.diagram.waypoints.length > 0
              ) {
                // Note: ReactFlow doesn't directly support waypoints, but we could implement custom edge types
                edgeUpdate.data = {
                  ...edgeUpdate.data,
                  waypoints: edgeMetadata.diagram.waypoints,
                };
              }
            }
          }

          return edgeUpdate;
        });

        return {
          nodes: enhancedNodes,
          edges: edgesWithMarkers,
          parser,
          metadataManager,
          datamodelContext,
        };
      } else {
        console.warn('SCXML parsing failed:', parseResult.errors);
      }
    } catch (error) {
      console.error('Error parsing SCXML for visual diagram:', error);
    }

    // Fallback to demo data if parsing fails
    return {
      nodes: initialNodes,
      edges: initialEdges,
      parser: null,
      metadataManager: null,
      datamodelContext: {},
    };
  }, [scxmlContent]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Handle node deletion - moved here after state hooks are defined
  const handleNodeDelete = React.useCallback(
    (nodeId: string) => {
      if (!parserRef.current || !onSCXMLChange) return;

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;

          // Remove state from SCXML document
          removeStateFromDocument(scxmlDoc, nodeId);

          // Serialize updated SCXML
          const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);

          // Set flag to prevent re-parsing cycle
          isUpdatingPositionRef.current = true;
          previousScxmlRef.current = updatedSCXML;

          // Update SCXML content
          onSCXMLChange(updatedSCXML);

          // Also remove from ReactFlow nodes immediately for visual feedback
          setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));

          // Remove edges connected to this node
          setEdges((edges) =>
            edges.filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId
            )
          );

          // Reset flag after a short delay
          setTimeout(() => {
            isUpdatingPositionRef.current = false;
          }, 100);
        }
      } catch (error) {
        console.error('Failed to delete node:', error);
      }
    },
    [scxmlContent, onSCXMLChange, setNodes, setEdges]
  );

  // Set the node delete handler ref
  React.useEffect(() => {
    handleNodeDeleteRef.current = handleNodeDelete;
  }, [handleNodeDelete]);

  // Define the actual handleChildAdd implementation
  React.useEffect(() => {
    handleChildAddRef.current = (parentId: string) => {
      if (!onSCXMLChange) {
        console.error('onSCXMLChange not available');
        return;
      }

      try {
        // Generate a unique ID for the new state
        let newStateId = 'state_1';
        let counter = 1;
        const existingIds = new Set(nodes.map((n) => n.id));
        while (existingIds.has(newStateId)) {
          counter++;
          newStateId = `state_${counter}`;
        }

        // Get child nodes for positioning
        const childNodes = nodes.filter((node) => node.parentId === parentId);

        // Calculate position using grid layout
        let x = 50;
        let y = 100;

        if (childNodes.length > 0) {
          // Use a grid layout for positioning new states
          const cols = 4; // Maximum 4 columns
          const rowHeight = 120; // Height + spacing
          const colWidth = 200; // Width + spacing

          // Find the next available position in the grid
          const existingPositions = childNodes.map((n) => ({
            col: Math.floor((n.position?.x || 0) / colWidth),
            row: Math.floor(((n.position?.y || 0) - 100) / rowHeight),
          }));

          // Find the next empty slot
          let found = false;
          for (let row = 0; row < 10 && !found; row++) {
            for (let col = 0; col < cols && !found; col++) {
              const occupied = existingPositions.some(
                (p) => p.col === col && p.row === row
              );
              if (!occupied) {
                x = 50 + col * colWidth;
                y = 100 + row * rowHeight;
                found = true;
              }
            }
          }
        }

        // Add a new node to ReactFlow immediately
        const newNode = {
          id: newStateId,
          type: 'scxmlState',
          position: { x, y },
          parentId: parentId,
          data: {
            label: newStateId,
            stateType: 'simple' as const,
            onLabelChange: handleNodeLabelChange,
            onDelete: () => handleNodeDeleteWrapper(newStateId, newStateId),
          },
          style: {
            width: 160,
            height: 80,
          },
        };

        setNodes((nodes) => [...nodes, newNode]);

        // Update SCXML content by adding the new state element
        if (onSCXMLChange && scxmlContent) {
          try {
            // Parse the current SCXML to manipulate it
            const parser = new DOMParser();
            const doc = parser.parseFromString(scxmlContent, 'text/xml');

            // Find the parent element
            const parentElement = doc.querySelector(`[id="${parentId}"]`);
            if (parentElement) {
              // Ensure viz namespace is declared on the root element
              const rootElement = doc.documentElement;
              if (!rootElement.hasAttribute('xmlns:viz')) {
                rootElement.setAttribute('xmlns:viz', 'urn:x-thingm:viz');
              }

              // Create the new state element in the same namespace as the parent
              // This prevents xmlns="" from being added
              const parentNamespace = parentElement.namespaceURI;
              const newStateElement = doc.createElementNS(
                parentNamespace,
                'state'
              );

              // Set the attributes
              newStateElement.setAttribute('id', newStateId);
              newStateElement.setAttributeNS(
                'urn:x-thingm:viz',
                'viz:xywh',
                `${x},${y},160,80`
              );

              // Add to parent
              parentElement.appendChild(newStateElement);

              // Serialize back to string
              const serializer = new XMLSerializer();
              const updatedSCXML = serializer.serializeToString(doc);

              // Update SCXML content
              // Set flag to prevent re-parsing cycle
              isUpdatingPositionRef.current = true;
              previousScxmlRef.current = updatedSCXML;

              onSCXMLChange(updatedSCXML);

              // Reset flag after a short delay
              setTimeout(() => {
                isUpdatingPositionRef.current = false;
              }, 100);

              console.log('Successfully added new child state:', newStateId);
            } else {
              console.error('Parent element not found in SCXML:', parentId);
            }
          } catch (xmlError) {
            console.error('Failed to update SCXML:', xmlError);
          }
        }
      } catch (error) {
        console.error('Failed to add child state:', error);
      }
    };
  }, [nodes, onSCXMLChange, handleNodeLabelChange, handleNodeDeleteWrapper, setNodes, scxmlContent]);

  // Update datamodel context when parsed data changes
  React.useEffect(() => {
    if (parsedData.datamodelContext) {
      setDatamodelContext(parsedData.datamodelContext);
    }
  }, [parsedData.datamodelContext]);

  // Filter and evaluate edges based on display mode
  const filteredEdges = React.useMemo(() => {
    if (transitionDisplayMode === 'all') {
      // Show all transitions with evaluation status
      return edges.map((edge) => {
        if (edge.data?.condition && datamodelContext) {
          const evaluationResult = ConditionEvaluator.evaluateCondition(
            edge.data.condition,
            datamodelContext
          );
          return {
            ...edge,
            data: {
              ...edge.data,
              conditionEvaluated: evaluationResult,
            },
          };
        }
        return edge;
      });
    }

    if (activeStates.size === 0) {
      return [];
    }

    // Filter by active states
    const fromActiveStates = edges.filter((edge) =>
      activeStates.has(edge.source)
    );

    if (transitionDisplayMode === 'active') {
      // Show all transitions from active states
      return fromActiveStates.map((edge) => {
        if (edge.data?.condition && datamodelContext) {
          const evaluationResult = ConditionEvaluator.evaluateCondition(
            edge.data.condition,
            datamodelContext
          );
          return {
            ...edge,
            data: {
              ...edge.data,
              conditionEvaluated: evaluationResult,
            },
          };
        }
        return edge;
      });
    }

    // 'available' mode - only show transitions with true or no conditions
    return fromActiveStates.filter((edge) => {
      if (!edge.data?.condition) {
        return true; // No condition means always available
      }

      const evaluationResult = ConditionEvaluator.evaluateCondition(
        edge.data.condition,
        datamodelContext
      );

      // Include edge with evaluation result
      if (evaluationResult !== false) {
        return {
          ...edge,
          data: {
            ...edge.data,
            conditionEvaluated: evaluationResult,
          },
        };
      }

      return evaluationResult !== false; // Show if true or null (can't evaluate)
    });
  }, [edges, activeStates, transitionDisplayMode, datamodelContext]);

  // Enhance nodes to highlight active states
  const enhancedNodes = React.useMemo(() => {
    return nodes.map((node) => {
      const isActive =
        activeStates.has(node.id) || node.id === currentSimulationState;

      // Recompute visual styles when active state changes
      const visualMetadata = metadataManagerRef.current?.getVisualMetadata(
        node.id
      );
      const updatedVisualStyles = computeVisualStyles(
        visualMetadata,
        node.data?.stateType || 'simple',
        isActive,
        false // selected state handled by ReactFlow
      );

      return {
        ...node,
        data: {
          ...node.data,
          isActive,
          visualStyles: updatedVisualStyles,
        },
        style: {
          ...node.style,
          ...(isActive
            ? {
                border: '3px solid #3b82f6',
                boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.3)',
              }
            : {}),
        },
      };
    });
  }, [nodes, activeStates, currentSimulationState]);
  console.log('Enhanced Nodes:', enhancedNodes);
  // Initialize nodes and edges when SCXML content actually changes
  React.useEffect(() => {
    // Check if content actually changed
    const contentChanged = scxmlContent !== previousScxmlRef.current;

    if (contentChanged) {
      // CRITICAL: Clear all position tracking state when SCXML content changes
      // This prevents infinite loops after tab switches
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
        positionUpdateTimeoutRef.current = null;
      }
      lastPositionUpdateRef.current.clear();

      // Don't clear the updating flag if we're in the middle of a transition add
      if (!isUpdatingPositionRef.current) {
        isUpdatingPositionRef.current = false;
      }

      previousScxmlRef.current = scxmlContent;

      // When content changes, use the new positions from parsedData
      setNodes(parsedData.nodes);
      setEdges(parsedData.edges);
    } else if (nodes.length === 0 && parsedData.nodes.length > 0) {
      // Initial load case - just set the nodes
      setNodes(parsedData.nodes);
      setEdges(parsedData.edges);
    }
  }, [scxmlContent, parsedData]);

  const handleNodePositionChange = React.useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!onSCXMLChange || !scxmlContent) {
        return;
      }

      // Set flag to prevent re-parsing cycle
      isUpdatingPositionRef.current = true;

      try {
        // Parse the current SCXML content
        const parser = new DOMParser();
        const doc = parser.parseFromString(scxmlContent, 'text/xml');

        // Find the element with the matching ID
        const element = doc.querySelector(`[id="${nodeId}"]`);

        if (element) {
          // Get existing width and height from viz:xywh or use defaults
          const existingViz = element.getAttribute('viz:xywh');
          let width = 160;
          let height = 80;

          if (existingViz) {
            const parts = existingViz.split(',');
            if (parts.length >= 4) {
              width = parseFloat(parts[2]) || width;
              height = parseFloat(parts[3]) || height;
            }
          }

          // Ensure viz namespace is declared on the root element
          const rootElement = doc.documentElement;
          if (!rootElement.hasAttribute('xmlns:viz')) {
            rootElement.setAttribute('xmlns:viz', 'urn:x-thingm:viz');
          }

          // Update the viz:xywh attribute with new position using setAttributeNS
          const newVizValue = `${Math.round(x)},${Math.round(
            y
          )},${width},${height}`;
          element.setAttributeNS('urn:x-thingm:viz', 'viz:xywh', newVizValue);

          // Serialize back to string
          const serializer = new XMLSerializer();
          const updatedSCXML = serializer.serializeToString(doc);

          // Update the previous SCXML ref to prevent re-parsing
          previousScxmlRef.current = updatedSCXML;

          // Update SCXML content
          onSCXMLChange(updatedSCXML);

          // Force edge update after node position change to fix connection points
          setTimeout(() => {
            setEdges((edges) => [...edges]);
            // Reset flag after updates are complete
            isUpdatingPositionRef.current = false;
          }, 10);
        } else {
          console.error('Element not found in SCXML:', nodeId);
          isUpdatingPositionRef.current = false;
        }
      } catch (error) {
        isUpdatingPositionRef.current = false;
        console.error('Failed to sync position change:', error);
      }
    },
    [scxmlContent, onSCXMLChange, setEdges]
  );

  // Handle new connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      // Add edge directly to ReactFlow without triggering full re-parse
      const newEdge: Edge = {
        id: `${params.source}-${params.target}-${Date.now()}`,
        type: 'smoothstep',
        source: params.source!,
        target: params.target!,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#6b7280',
        },
        data: {
          event: 'event',
          condition: undefined,
          actions: [],
        },
        style: {
          strokeWidth: 2,
          zIndex: 1,
          stroke: '#3b82f6',
        },
        zIndex: 1,
        animated: true,
      };

      // Add to ReactFlow edges immediately
      setEdges((eds) => addEdge(newEdge, eds));

      // Update SCXML in background without triggering content change detection
      if (parserRef.current && scxmlContent) {
        try {
          const parseResult = parserRef.current.parse(scxmlContent);
          if (parseResult.success && parseResult.data) {
            const scxmlDoc = parseResult.data;
            const sourceState = findStateById(scxmlDoc, params.source!);

            if (sourceState) {
              const newTransition: TransitionElement = {
                '@_event': 'event',
                '@_target': params.target!,
              };

              // Add to source state
              if (!sourceState.transition) {
                sourceState.transition = newTransition;
              } else if (Array.isArray(sourceState.transition)) {
                sourceState.transition.push(newTransition);
              } else {
                sourceState.transition = [
                  sourceState.transition,
                  newTransition,
                ];
              }

              // Update SCXML silently (no onSCXMLChange call)
              const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
              previousScxmlRef.current = updatedSCXML; // Update reference to prevent re-parse

              // Only call onSCXMLChange if we want to notify parent, but prevent re-parse
              if (onSCXMLChange) {
                isUpdatingPositionRef.current = true; // Prevent re-parse
                onSCXMLChange(updatedSCXML);
                setTimeout(() => {
                  isUpdatingPositionRef.current = false;
                }, 100);
              }
            }
          }
        } catch (error) {
          console.error('Failed to update SCXML in background:', error);
        }
      }
    },
    [setEdges, scxmlContent, onSCXMLChange]
  );

  // Use refs to avoid all dependencies and prevent infinite loops
  const nodesRef = React.useRef(nodes);
  const onNodesChangeRef = React.useRef(onNodesChange);
  const handleNodePositionChangeRef = React.useRef(handleNodePositionChange);

  // Keep refs up to date
  nodesRef.current = nodes;
  onNodesChangeRef.current = onNodesChange;
  handleNodePositionChangeRef.current = handleNodePositionChange;

  // Debounce position updates to prevent rapid fire updates
  const positionUpdateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastPositionUpdateRef = React.useRef<
    Map<string, { x: number; y: number }>
  >(new Map());

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
    };
  }, []);

  // Completely isolated drag handler to prevent infinite loops
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      // Apply changes using the built-in handler first
      onNodesChangeRef.current(changes);

      // Early exit for any non-position changes
      const positionChanges = changes.filter(
        (change) => change.type === 'position' && change.dragging === false
      );

      if (positionChanges.length === 0) {
        return; // No position changes to handle
      }

      // Multiple guards to prevent infinite loops
      if (isUpdatingPositionRef.current) {
        return; // Already updating, skip
      }

      // Clear any existing timeout
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
        positionUpdateTimeoutRef.current = null;
      }

      // Process position updates with isolation
      positionUpdateTimeoutRef.current = setTimeout(() => {
        // Final guard check
        if (isUpdatingPositionRef.current) {
          return;
        }

        // Set updating flag immediately
        isUpdatingPositionRef.current = true;

        try {
          // Build position map from ALL changes to ensure fresh data
          const positionMap = new Map<string, { x: number; y: number }>();

          // First, apply all position changes to get current positions
          const currentNodes = [...nodesRef.current];
          changes.forEach((change) => {
            if (change.type === 'position' && change.position) {
              const nodeIndex = currentNodes.findIndex(n => n.id === change.id);
              if (nodeIndex >= 0) {
                currentNodes[nodeIndex] = {
                  ...currentNodes[nodeIndex],
                  position: change.position
                };
              }
              positionMap.set(change.id, change.position);
            }
          });

          for (const change of positionChanges) {
            const node = currentNodes.find((n) => n.id === change.id);
            if (!node?.position) continue;

            // Use the fresh position from changes or current node
            let absoluteX = positionMap.get(change.id)?.x ?? node.position.x;
            let absoluteY = positionMap.get(change.id)?.y ?? node.position.y;

            // For child nodes, add parent position to get absolute coordinates
            if (node.parentId) {
              // Use fresh parent position from the current changes if available
              const parentNode = currentNodes.find(
                (n) => n.id === node.parentId
              );
              if (parentNode) {
                const parentX = positionMap.get(node.parentId)?.x ?? parentNode.position.x;
                const parentY = positionMap.get(node.parentId)?.y ?? parentNode.position.y;
                absoluteX += parentX;
                absoluteY += parentY;
              }
            }

            // Significant change check using absolute positions
            const lastPos = lastPositionUpdateRef.current.get(change.id);
            if (
              lastPos &&
              Math.abs(lastPos.x - absoluteX) < 2 &&
              Math.abs(lastPos.y - absoluteY) < 2
            ) {
              continue; // Skip insignificant changes
            }

            // Update position tracking with absolute positions
            lastPositionUpdateRef.current.set(change.id, {
              x: absoluteX,
              y: absoluteY,
            });

            // Update SCXML with absolute positions
            handleNodePositionChangeRef.current(
              change.id,
              absoluteX,
              absoluteY
            );
          }
        } finally {
          // Reset flag after a delay to ensure SCXML update completes
          setTimeout(() => {
            isUpdatingPositionRef.current = false;
          }, 200);
        }
      }, 150); // Longer debounce
    },
    [] // Absolutely no dependencies
  );

  // Notify parent component of edge changes
  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      onEdgesChange(changes);

      // Handle edge updates - for now just notify parent
      // In future, we could sync edge waypoints and styling
      if (onEdgeChange) {
        onEdgeChange(edges);
      }
    },
    [onEdgesChange, onEdgeChange, edges]
  );
  // Handle state click to set active state
  const handleStateClick = useCallback((stateId: string) => {
    setActiveStates((prev) => {
      const newStates = new Set(prev);
      if (newStates.has(stateId)) {
        newStates.delete(stateId);
      } else {
        newStates.add(stateId);
      }
      return newStates;
    });
  }, []);

  // Handle initial state setting
  React.useEffect(() => {
    // Find initial state from nodes
    const initialState = nodes.find((node) => node.data?.isInitial);
    if (initialState && activeStates.size === 0) {
      setActiveStates(new Set([initialState.id]));
    }
  }, [nodes]);

  console.log('filteredEdges', filteredEdges);

  return (
    <div className='h-full w-full bg-gray-50 flex flex-col'>
      <SimulationControls
        scxmlContent={scxmlContent}
        onStateChange={setCurrentSimulationState}
      />
      {/* <div className='flex items-center gap-4 px-4 py-2 bg-white border-b'>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>
            Show Transitions:
          </label>
          <div className='flex gap-1'>
            <button
              onClick={() => setTransitionDisplayMode('all')}
              className={`px-3 py-1 rounded-l text-sm font-medium transition-colors ${
                transitionDisplayMode === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTransitionDisplayMode('active')}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
                transitionDisplayMode === 'active'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              From Active
            </button>
            <button
              onClick={() => setTransitionDisplayMode('available')}
              className={`px-3 py-1 rounded-r text-sm font-medium transition-colors ${
                transitionDisplayMode === 'available'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              title='Only show transitions with true conditions'
            >
              Available Only
            </button>
          </div>
        </div>

        {activeStates.size > 0 && (
          <div className='flex items-center gap-2'>
            <span className='text-sm text-gray-600'>Active States:</span>
            <div className='flex gap-1'>
              {Array.from(activeStates).map(stateId => (
                <span
                  key={stateId}
                  className='px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium'
                >
                  {stateId}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setActiveStates(new Set())}
          className='ml-auto px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300'
        >
          Clear Selection
        </button>
      </div> */}

      {/* Datamodel Display */}
      {Object.keys(datamodelContext).length > 0 && (
        <div className='px-4 py-2 bg-gray-50 border-b'>
          <details className='cursor-pointer'>
            <summary className='text-sm font-medium text-gray-700 hover:text-gray-900'>
              Datamodel Context ({Object.keys(datamodelContext).length}{' '}
              variables)
            </summary>
            <div className='mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-32 overflow-y-auto'>
              {Object.entries(datamodelContext).map(([key, value]) => (
                <div key={key} className='text-xs bg-white p-1 rounded border'>
                  <span className='font-mono text-gray-600'>{key}:</span>{' '}
                  <span className='font-mono text-gray-900'>
                    {typeof value === 'boolean'
                      ? value.toString()
                      : typeof value === 'object'
                      ? JSON.stringify(value)
                      : value}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      <div className='flex-1'>
        <ReactFlow
          nodes={enhancedNodes}
          edges={filteredEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={(event, node) => handleStateClick(node.id)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={true}
          fitViewOptions={{
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 2,
          }}
          attributionPosition='bottom-left'
          className='bg-gradient-to-br from-slate-50 to-slate-100'
          minZoom={0.2}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          connectionLineType={ConnectionLineType.SmoothStep} // Makes connection preview smooth
          connectionMode={ConnectionMode.Loose} // Allows connections from anywhere on the node
          connectionRadius={2}
          edgesUpdatable={true}
          edgesFocusable={true}
          elevateEdgesOnSelect={true} // Ensures edges appear above nodes when selected
          elevateNodesOnSelect={false} // Keep nodes below edges
          zoomOnScroll={true}
          zoomOnPinch={true}
          panOnScroll={false}
          panOnDrag={true}
        >
          {/* Global SVG definitions for arrows */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <marker
                id='arrow-marker'
                viewBox='0 0 20 20'
                refX='20'
                refY='10'
                markerWidth='10'
                markerHeight='10'
                orient='auto'
              >
                <path d='M 2 2 L 18 10 L 2 18 L 7 10 Z' fill='currentColor' />
              </marker>
              <marker
                id='arrow-marker-selected'
                viewBox='0 0 20 20'
                refX='20'
                refY='10'
                markerWidth='12'
                markerHeight='12'
                orient='auto'
              >
                <path d='M 2 2 L 18 10 L 2 18 L 7 10 Z' fill='#3b82f6' />
              </marker>
            </defs>
          </svg>
          <Background
            color='#cbd5e1'
            gap={20}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <Controls
            position='top-left'
            showZoom={true}
            showFitView={true}
            showInteractive={true}
            className='bg-white/90 border border-slate-200 rounded-lg shadow-sm'
          />
          <MiniMap
            position='bottom-right'
            nodeStrokeColor='#64748b'
            nodeColor='#f8fafc'
            nodeBorderRadius={12}
            maskColor='rgba(0, 0, 0, 0.05)'
            className='bg-white/90 border border-slate-200 rounded-lg shadow-sm'
          />
        </ReactFlow>
      </div>

      {/* Global Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, nodeId: '', nodeLabel: '' })}
        onConfirm={() => {
          if (deleteConfirm.nodeId && handleNodeDeleteRef.current) {
            handleNodeDeleteRef.current(deleteConfirm.nodeId);
          }
          setDeleteConfirm({ isOpen: false, nodeId: '', nodeLabel: '' });
        }}
        title="Delete State"
        message={`Are you sure you want to delete the state "${deleteConfirm.nodeLabel}"? This will also remove all transitions connected to this state.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
