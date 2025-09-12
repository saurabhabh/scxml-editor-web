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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SCXMLStateNode } from './nodes/scxml-state-node';
import { SCXMLTransitionEdge } from './edges/scxml-transition-edge';
import { SimulationControls } from '../simulation';
import { SCXMLParser } from '@/lib/parsers/scxml-parser';
import { SCXMLToXStateConverter } from '@/lib/converters/scxml-to-xstate';

interface VisualDiagramProps {
  scxmlContent: string;
  onNodeChange?: (nodes: Node[]) => void;
  onEdgeChange?: (edges: Edge[]) => void;
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

// Default edges for demo purposes
const initialEdges: Edge[] = [
  {
    id: 'idle-to-active',
    type: 'scxmlTransition',
    source: 'idle',
    target: 'active',
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
}) => {
  const [currentSimulationState, setCurrentSimulationState] =
    React.useState<string>('');
  // Parse SCXML first to get initial data
  const parsedData = useMemo(() => {
    if (!scxmlContent.trim()) {
      return {
        nodes: [],
        edges: [],
      };
    }

    try {
      const parser = new SCXMLParser();
      const converter = new SCXMLToXStateConverter();

      // Parse the SCXML content
      const parseResult = parser.parse(scxmlContent);

      if (parseResult.success && parseResult.data) {
        // Convert to React Flow nodes and edges
        const { nodes, edges } = converter.convertToReactFlow(parseResult.data);
        console.log(
          'Parsed SCXML - Nodes:',
          nodes.length,
          'Edges:',
          edges.length
        );
        return { nodes, edges };
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
    };
  }, [scxmlContent]);

  const [nodes, setNodes, onNodesChange] = useNodesState(parsedData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(parsedData.edges);

  // Update nodes when parsed data changes
  React.useEffect(() => {
    setNodes(parsedData.nodes);
    setEdges(parsedData.edges);
  }, [parsedData.nodes, parsedData.edges, setNodes, setEdges]);

  // Update node styles based on simulation state
  const nodesWithSimulationState = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isActive: node.id === currentSimulationState,
      },
    }));
  }, [nodes, currentSimulationState]);

  // Handle new connections between nodes
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        type: 'scxmlTransition',
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
      // TODO: Extract position updates and sync to SCXML visual metadata
      if (onNodeChange) {
        onNodeChange(nodes);
      }
    },
    [onNodesChange, onNodeChange, nodes]
  );

  // Notify parent component of edge changes
  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      onEdgesChange(changes);
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
