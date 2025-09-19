//visual-diagram.tsx
'use client';

import React, { useCallback, useMemo } from 'react';
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
import { SCXMLStateNode } from './nodes/scxml-state-node';
import { CompoundStateNode } from './nodes/compound-state-node';
import { HistoryWrapperNode } from './nodes/history-wrapper-node';
import { SCXMLTransitionEdge } from './edges/scxml-transition-edge';
import { SimulationControls } from '../simulation';
import { SCXMLParser } from '@/lib/parsers/scxml-parser';
import { SCXMLToXStateConverter } from '@/lib/converters/scxml-to-xstate';
import { VisualMetadataManager } from '@/lib/metadata';
import { computeVisualStyles } from '@/lib/utils/visual-style-utils';
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

interface VisualDiagramProps {
  scxmlContent: string;
  onNodeChange?: (nodes: Node[]) => void;
  onEdgeChange?: (edges: Edge[]) => void;
  onSCXMLChange?: (scxmlContent: string) => void;
}

// Custom node types for SCXML elements
const nodeTypes: NodeTypes = {
  scxmlState: SCXMLStateNode,
  scxmlCompound: CompoundStateNode,
  scxmlHistory: HistoryWrapperNode,
};

// Custom edge types for SCXML transitions
const edgeTypes = {
  scxmlTransition: SCXMLTransitionEdge,
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
    type: 'scxmlTransition',
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
    type: 'scxmlTransition',
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

  // Handle adding new child to a container
  const handleChildAdd = React.useCallback((parentId: string) => {
    // TODO: Implement child state creation
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
        const { nodes, edges } = converter.convertToReactFlow(parseResult.data);

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
            // Add container-specific callbacks for compound nodes
            onChildrenToggle:
              nodeUpdate.type === 'scxmlCompound'
                ? handleChildrenToggle
                : undefined,
            onChildAdd:
              nodeUpdate.type === 'scxmlCompound' ? handleChildAdd : undefined,
          };

          return nodeUpdate;
        });

        // Enhance edges with visual metadata and ensure proper arrow markers
        const edgesWithMarkers = edges.map((edge) => {
          // Try to get visual metadata for this edge (transitions)
          const edgeMetadata = metadataManager.getVisualMetadata(edge.id);

          const edgeUpdate: any = {
            ...edge,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color:
                edge.data?.event && edge.data?.condition
                  ? '#2563eb'
                  : edge.data?.condition
                  ? '#7c3aed'
                  : edge.data?.event
                  ? '#6b7280'
                  : '#374151',
            },
          };

          // Apply visual metadata if available
          if (edgeMetadata) {
            // Apply style metadata to edge
            if (edgeMetadata.style?.stroke) {
              edgeUpdate.style = {
                ...edgeUpdate.style,
                stroke: edgeMetadata.style.stroke,
              };
              // Also update marker color to match stroke
              edgeUpdate.markerEnd.color = edgeMetadata.style.stroke;
            }

            if (edgeMetadata.style?.strokeWidth !== undefined) {
              edgeUpdate.style = {
                ...edgeUpdate.style,
                strokeWidth: edgeMetadata.style.strokeWidth,
              };
            }

            // Apply diagram metadata (curve type, waypoints, etc.)
            if (edgeMetadata.diagram) {
              if (edgeMetadata.diagram.curveType) {
                // Map visual curve types to ReactFlow types
                const curveTypeMap: Record<string, string> = {
                  smooth: 'default',
                  step: 'step',
                  straight: 'straight',
                  bezier: 'default',
                };
                edgeUpdate.type =
                  curveTypeMap[edgeMetadata.diagram.curveType] || 'default';
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
    };
  }, [scxmlContent]);

  const [nodes, setNodes, onNodesChange] = useNodesState(parsedData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(parsedData.edges);

  // Update nodes when parsed data changes
  React.useEffect(() => {
    setNodes(parsedData.nodes);
    setEdges(parsedData.edges);
  }, [parsedData.nodes, parsedData.edges, setNodes, setEdges]);

  const handleNodePositionChange = React.useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!parserRef.current || !metadataManagerRef.current || !onSCXMLChange) {
        return;
      }

      try {
        // Get existing metadata to preserve width and height
        const existingMetadata =
          metadataManagerRef.current.getVisualMetadata(nodeId);
        const existingWidth = existingMetadata?.layout?.width || 120; // Default width
        const existingHeight = existingMetadata?.layout?.height || 60; // Default height

        // Update the metadata manager's internal store
        metadataManagerRef.current.updateVisualMetadata(nodeId, {
          layout: {
            x,
            y,
            width: existingWidth,
            height: existingHeight,
          },
        });

        // Get the current metadata to verify it was stored
        const metadata = metadataManagerRef.current.getVisualMetadata(nodeId);

        // Get the existing parsed data from the ref
        if (scxmlDocRef.current) {
          const updatedSCXML = parserRef.current.serialize(
            scxmlDocRef.current,
            true
          );

          // Check if the viz:xywh attribute is in the serialized XML
          const hasVizXywh = updatedSCXML.includes('viz:xywh');

          if (hasVizXywh) {
            const xywh = updatedSCXML.match(/viz:xywh="[^"]*"/g);
          }

          onSCXMLChange(updatedSCXML);

          // Force edge update after node position change to fix connection points
          setTimeout(() => {
            setEdges((edges) => [...edges]);
          }, 10); // Small delay to ensure node update is complete
        } else {
          console.error('No parsed SCXML data available in ref');
        }
      } catch (error) {
        console.error('Failed to sync position change:', error);
        console.error('Error details:', error);
      }
    },
    [scxmlContent, onSCXMLChange, setEdges]
  );

  // Update node styles based on simulation state
  const nodesWithSimulationState = useMemo(() => {
    return nodes.map((node) => {
      const isActive = node.id === currentSimulationState;

      // Recompute visual styles when simulation state changes
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
      };
    });
  }, [nodes, currentSimulationState]);

  // Handle adding new transitions
  const handleTransitionAdd = React.useCallback(
    (sourceId: string, targetId: string, event: string) => {
      if (!parserRef.current || !onSCXMLChange) return;

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;
          const sourceState = findStateById(scxmlDoc, sourceId);

          if (sourceState) {
            // Create new transition
            const newTransition: TransitionElement = {
              '@_event': event,
              '@_target': targetId,
            };

            // Add to source state
            if (!sourceState.transition) {
              sourceState.transition = newTransition;
            } else if (Array.isArray(sourceState.transition)) {
              sourceState.transition.push(newTransition);
            } else {
              sourceState.transition = [sourceState.transition, newTransition];
            }

            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML);
          }
        }
      } catch (error) {
        console.error('Failed to add transition to SCXML:', error);
      }
    },
    [scxmlContent, onSCXMLChange]
  );

  // Handle new connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'scxmlTransition',
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#6b7280',
        },
        style: {
          strokeWidth: 1,
        },
        data: {
          event: 'event',
          condition: null,
          actions: [],
        },
      };
      setEdges((eds) => addEdge(newEdge, eds));

      // Sync new transition to SCXML
      handleTransitionAdd(params.source!, params.target!, 'event');
    },
    [setEdges, handleTransitionAdd]
  );

  // Notify parent component of node changes
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      // Apply changes to ReactFlow nodes first
      const updatedNodes = applyNodeChanges(changes, nodes);
      setNodes(updatedNodes);

      // Extract position updates when dragging ends
      const positionChanges = changes.filter(
        (change) => change.type === 'position' && !change.dragging
      );

      if (positionChanges.length > 0) {
        // Update visual metadata for moved nodes using the updated node positions
        positionChanges.forEach((change) => {
          const updatedNode = updatedNodes.find(
            (node) => node.id === change.id
          );

          if (updatedNode && updatedNode.position) {
            // Update SCXML with new position immediately

            handleNodePositionChange(
              change.id,
              updatedNode.position.x,
              updatedNode.position.y
            );
          } else {
            console.log('No updated node or position found for:', change.id);
          }
        });
      } else {
        console.log('No position changes to process');
      }

      if (onNodeChange) {
        onNodeChange(updatedNodes);
      }
    },
    [setNodes, onNodeChange, nodes, handleNodePositionChange]
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

  return (
    <div className='h-full w-full bg-gray-50 flex flex-col'>
      <SimulationControls
        scxmlContent={scxmlContent}
        onStateChange={setCurrentSimulationState}
      />
      <div className='flex-1'>
        <ReactFlow
          nodes={nodesWithSimulationState}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
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
        >
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
    </div>
  );
};
