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
import { SCXMLTransitionEdge } from './edges/scxml-transition-edge';
import { SimulationControls } from '../simulation';
import { SCXMLParser } from '@/lib/parsers/scxml-parser';
import { SCXMLToXStateConverter } from '@/lib/converters/scxml-to-xstate';
import { VisualMetadataManager } from '@/lib/metadata';
import { computeVisualStyles } from '@/lib/utils/visual-style-utils';
import type { ElementVisualMetadata } from '@/types/visual-metadata';

interface VisualDiagramProps {
  scxmlContent: string;
  onNodeChange?: (nodes: Node[]) => void;
  onEdgeChange?: (edges: Edge[]) => void;
  onSCXMLChange?: (scxmlContent: string) => void;
}

// Custom node types for SCXML elements
const nodeTypes: NodeTypes = {
  scxmlState: SCXMLStateNode,
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
                  visualMetadata.layout.width ??
                  nodeUpdate.style?.width ??
                  120,
                height:
                  visualMetadata.layout.height ??
                  nodeUpdate.style?.height ??
                  60,
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

        console.log(
          'Parsed SCXML - Nodes:',
          enhancedNodes.length,
          'Edges:',
          edgesWithMarkers.length
        );
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
    console.log('Using fallback demo data');
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

  // Sync visual metadata changes back to SCXML
  const syncMetadataToSCXML = React.useCallback(async () => {
    if (!parserRef.current || !metadataManagerRef.current || !onSCXMLChange) {
      return;
    }

    try {
      // Parse current SCXML to get the document structure
      const parseResult = parserRef.current.parse(scxmlContent);
      if (parseResult.success && parseResult.data) {
        // Serialize with updated visual metadata
        const updatedSCXML = parserRef.current.serialize(
          parseResult.data,
          true
        );
        onSCXMLChange(updatedSCXML);
        console.log('Synced visual metadata changes to SCXML');
      }
    } catch (error) {
      console.error('Failed to sync metadata to SCXML:', error);
    }
  }, [scxmlContent, onSCXMLChange]);

  // Update node styles based on simulation state
  const nodesWithSimulationState = useMemo(() => {
    return nodes.map((node) => {
      const isActive = node.id === currentSimulationState;
      
      // Recompute visual styles when simulation state changes
      const visualMetadata = metadataManagerRef.current?.getVisualMetadata(node.id);
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
    },
    [setEdges]
  );

  // Notify parent component of node changes
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      onNodesChange(changes);

      // Extract position updates and sync to SCXML visual metadata
      const positionChanges = changes.filter(
        (change) => change.type === 'position' && change.position
      );

      if (positionChanges.length > 0 && metadataManagerRef.current) {
        // Update visual metadata for moved nodes
        positionChanges.forEach((change) => {
          if (change.id && change.position) {
            metadataManagerRef.current!.updateVisualMetadata(change.id, {
              layout: {
                x: change.position.x,
                y: change.position.y,
              },
            });
          }
        });

        // Debounce SCXML sync to avoid too frequent updates
        const timeoutId = setTimeout(() => {
          syncMetadataToSCXML();
        }, 500);

        return () => clearTimeout(timeoutId);
      }

      if (onNodeChange) {
        onNodeChange(nodes);
      }
    },
    [onNodesChange, onNodeChange, nodes, syncMetadataToSCXML]
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
          fitView
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
