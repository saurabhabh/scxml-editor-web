//visual-diagram.tsx
'use client';

// ==================== IMPORTS ====================
import { useHierarchyNavigation } from '@/hooks/use-hierarchy-navigation';
import { SCXMLToXStateConverter } from '@/lib/converters/scxml-to-xstate';
import { VisualMetadataManager } from '@/lib/metadata';
import { SCXMLParser } from '@/lib/parsers/scxml-parser';
import {
  addStateToDocument,
  createStateElement,
  findStateById,
  removeStateFromDocument,
  removeTransitionByEdgeId,
  updateStateActions,
  updateStateType,
  updateTransitionTargets,
} from '@/lib/utils/scxml-manipulation-utils';
import { computeVisualStyles } from '@/lib/utils/visual-style-utils';
import type { SCXMLDocument, TransitionElement } from '@/types/scxml';
import { VISUAL_METADATA_CONSTANTS } from '@/types/visual-metadata';
import {
  SmartBezierEdge,
  SmartStepEdge,
  SmartStraightEdge,
} from '@tisoap/react-flow-smart-edge';
import { ArrowUp, ChevronRight, Home, Network } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  ConnectionLineType,
  ConnectionMode,
  ControlButton,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { SimulationControls } from '../simulation';
import { SCXMLTransitionEdge } from './edges/scxml-transition-edge';
import { HistoryWrapperNode } from './nodes/history-wrapper-node';
import { SCXMLStateNode } from './nodes/scxml-state-node';

// ==================== TYPES & INTERFACES ====================
interface VisualDiagramProps {
  scxmlContent: string;
  onNodeChange?: (nodes: Node[]) => void;
  onEdgeChange?: (edges: Edge[]) => void;
  onSCXMLChange?: (
    scxmlContent: string,
    changeType?: 'position' | 'structure' | 'property'
  ) => void;
  isUpdatingFromHistory?: boolean;
}

// ==================== CONSTANTS ====================
// Custom node types for SCXML elements
const nodeTypes: NodeTypes = {
  scxmlState: SCXMLStateNode,
  scxmlHistory: HistoryWrapperNode,
};

// Custom edge types for SCXML transitions
const edgeTypes = {
  scxmlTransition: SCXMLTransitionEdge,
  smart: SmartBezierEdge,
  smartStep: SmartStepEdge,
  smartStraight: SmartStraightEdge,
};

// Default demo data
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

// ==================== MAIN COMPONENT ====================
const VisualDiagramInner: React.FC<VisualDiagramProps> = ({
  scxmlContent,
  onNodeChange,
  onEdgeChange,
  onSCXMLChange,
  isUpdatingFromHistory = false,
}) => {
  // ==================== STATE MANAGEMENT ====================
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // UI State
  const [currentSimulationState, setCurrentSimulationState] =
    React.useState<string>('');
  const [transitionDisplayMode, setTransitionDisplayMode] = React.useState<
    'all' | 'active' | 'available'
  >('all');
  const [activeStates, setActiveStates] = React.useState<Set<string>>(
    new Set()
  );
  const [selectedTransitions, setSelectedTransitions] = React.useState<
    Set<string>
  >(new Set());
  const [hoveredEdge, setHoveredEdge] = React.useState<{
    id: string;
    fullLabel: string;
    x: number;
    y: number;
  } | null>(null);
  const [selectedEdgeForEdit, setSelectedEdgeForEdit] = React.useState<{
    id: string;
    event?: string;
    cond?: string;
    rawValue?: string;
    editingField: 'event' | 'cond';
  } | null>(null);

  // ELK Layout State
  const [elkAlgorithm, setElkAlgorithm] = React.useState<
    'layered' | 'force' | 'mrtree' | 'radial'
  >('force');
  const [elkDirection, setElkDirection] = React.useState<
    'DOWN' | 'UP' | 'RIGHT' | 'LEFT'
  >('DOWN');
  const [showLayoutOptions, setShowLayoutOptions] = React.useState(false);

  // ==================== REFS ====================
  // Position update management
  const isUpdatingPositionRef = React.useRef(false);
  const previousScxmlRef = React.useRef<string>('');
  const positionUpdateTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastPositionUpdateRef = React.useRef<
    Map<string, { x: number; y: number }>
  >(new Map());
  const isDraggingRef = React.useRef<Set<string>>(new Set()); // Track nodes being dragged

  // Handler refs for callbacks
  const handleNodeDeleteRef = React.useRef<((nodeId: string) => void) | null>(
    null
  );

  // Hover delay ref
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // SCXML parsing and metadata
  const parserRef = React.useRef<SCXMLParser | null>(null);
  const metadataManagerRef = React.useRef<VisualMetadataManager | null>(null);
  const scxmlDocRef = React.useRef<SCXMLDocument | null>(null);

  // ReactFlow state refs for isolated handler
  const nodesRef = React.useRef(nodes);
  const allNodesRef = React.useRef<Node[]>([]); // Store original nodes with parentId
  const onNodesChangeRef = React.useRef(onNodesChange);
  const handleNodePositionChangeRef = React.useRef<any>(null);

  // Keep refs up to date
  nodesRef.current = nodes;
  onNodesChangeRef.current = onNodesChange;

  // ==================== NODE CONTENT HANDLERS ====================
  const handleNodeLabelChange = React.useCallback(
    (nodeId: string, newLabel: string) => {
      if (!parserRef.current || !onSCXMLChange) return;

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;
          const stateElement = findStateById(scxmlDoc, nodeId);

          if (stateElement) {
            stateElement['@_id'] = newLabel;
            updateTransitionTargets(scxmlDoc, nodeId, newLabel);
            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML, 'property');
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
            updateStateActions(stateElement, 'onentry', entryActions);
            updateStateActions(stateElement, 'onexit', exitActions);
            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML, 'property');
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
            updateStateType(stateElement, newStateType as any);
            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML, 'property');
          }
        }
      } catch (error) {
        console.error('Failed to sync state type change:', error);
      }
    },
    [scxmlContent, onSCXMLChange]
  );

  // ==================== NODE DELETION HANDLERS ====================
  const handleNodeDelete = React.useCallback(
    (nodeIds: string | string[]) => {
      if (!parserRef.current || !onSCXMLChange) return;

      const idsToDelete = Array.isArray(nodeIds) ? nodeIds : [nodeIds];

      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;

          // Delete all specified nodes
          idsToDelete.forEach((nodeId) => {
            removeStateFromDocument(scxmlDoc, nodeId);
          });

          const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
          onSCXMLChange(updatedSCXML, 'structure');
          setActiveStates(new Set());
        }
      } catch (error) {
        console.error('Failed to delete node:', error);
      }
    },
    [scxmlContent, onSCXMLChange]
  );

  // ==================== POSITION UPDATE HANDLERS ====================
  const handleNodePositionChange = React.useCallback(
    (nodeId: string, x: number, y: number) => {
      if (!onSCXMLChange || !scxmlContent) {
        return;
      }

      isUpdatingPositionRef.current = true;

      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(scxmlContent, 'text/xml');
        const element = doc.querySelector(`[id="${nodeId}"]`);

        if (element) {
          const rootElement = doc.documentElement;
          const namespaceURI = 'urn:x-thingm:viz';

          if (
            rootElement.hasAttribute('xmlns:ns1') &&
            rootElement.getAttribute('xmlns:ns1') === namespaceURI
          ) {
            rootElement.removeAttribute('xmlns:ns1');
          }

          if (!rootElement.hasAttribute('xmlns:viz')) {
            rootElement.setAttribute('xmlns:viz', namespaceURI);
          }

          let width = 160;
          let height = 80;

          const existingViz =
            element.getAttribute('viz:xywh') ||
            element.getAttributeNS(namespaceURI, 'xywh');
          if (existingViz) {
            const parts = existingViz.split(',');
            if (parts.length >= 4) {
              width = parseFloat(parts[2]) || width;
              height = parseFloat(parts[3]) || height;
            }
          }

          element.removeAttributeNS(namespaceURI, 'xywh');
          element.removeAttribute('viz:xywh');
          element.removeAttribute('ns1:xywh');

          const newVizValue = `${Math.round(x)},${Math.round(
            y
          )},${width},${height}`;
          element.setAttribute('viz:xywh', newVizValue);

          const serializer = new XMLSerializer();
          const updatedSCXML = serializer.serializeToString(doc);

          previousScxmlRef.current = updatedSCXML;
          onSCXMLChange(updatedSCXML, 'position');

          setTimeout(() => {
            setEdges((edges) => [...edges]);
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

  handleNodePositionChangeRef.current = handleNodePositionChange;

  // ==================== EDGE HANDLERS ====================
  const handleTransitionLabelChange = React.useCallback(
    (
      edgeId: string,
      newLabel: string,
      editingField: 'event' | 'cond' = 'event'
    ) => {
      if (!parserRef.current || !onSCXMLChange) return;
      try {
        const parseResult = parserRef.current.parse(scxmlContent);
        if (parseResult.success && parseResult.data) {
          const scxmlDoc = parseResult.data;

          // Find the transition by edge ID
          const edge = displayFilteredEdges.find((e) => e.id === edgeId);
          if (!edge) return;

          const sourceState = findStateById(scxmlDoc, edge.source);
          if (!sourceState) return;

          // Store the original event/cond to match the exact transition
          const originalEvent = edge.data?.event;
          const originalCond = edge.data?.condition;

          // Find the transition in the source state
          let transitionFound = false;
          const updateTransition = (transition: any) => {
            // Match transition by target AND original event/cond to identify the exact transition
            const transitionTarget = transition['@_target'];
            const transitionEvent = transition['@_event'];
            const transitionCond = transition['@_cond'];

            // Match by target and either event or condition
            const isMatch =
              transitionTarget === edge.target &&
              ((originalEvent && transitionEvent === originalEvent) ||
                (originalCond && transitionCond === originalCond) ||
                (!originalEvent &&
                  !originalCond &&
                  !transitionEvent &&
                  !transitionCond));

            if (isMatch) {
              // Update the appropriate field based on what's being edited
              if (editingField === 'cond') {
                transition['@_cond'] = newLabel;
                delete transition['@_event']; // Remove event if setting condition
              } else {
                transition['@_event'] = newLabel;
                delete transition['@_cond']; // Remove condition if setting event
              }
              transitionFound = true;
            }
          };

          if (sourceState.transition) {
            if (Array.isArray(sourceState.transition)) {
              sourceState.transition.forEach(updateTransition);
            } else {
              updateTransition(sourceState.transition);
            }
          }

          if (transitionFound) {
            const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
            onSCXMLChange(updatedSCXML, 'property');
          }
        }
      } catch (error) {
        console.error('Failed to update transition label:', error);
      }
    },
    [scxmlContent, onSCXMLChange, edges]
  );

  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setActiveStates(new Set());
    setSelectedTransitions((prev) => {
      const newTransitions = new Set(prev);
      if (newTransitions.has(edge.id)) {
        newTransitions.clear();
        setSelectedEdgeForEdit(null);
      } else {
        newTransitions.clear();
        newTransitions.add(edge.id);
        // Set the selected edge for editing
        const hasEvent = !!edge.data?.event;
        const hasCond = !!edge.data?.condition;
        const initialValue =
          (hasEvent ? edge.data.event : hasCond ? edge.data.condition : '') ||
          '';
        setSelectedEdgeForEdit({
          id: edge.id,
          event: edge.data?.event,
          cond: edge.data?.condition,
          rawValue: initialValue,
          editingField: hasEvent ? 'event' : 'cond',
        });
      }
      return newTransitions;
    });
  }, []);

  const handleEdgeMouseEnter = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (edge.data?.fullLabel) {
        // Clear any existing timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
        }

        // Set a delay of 500ms before showing the hover tooltip
        hoverTimeoutRef.current = setTimeout(() => {
          setHoveredEdge({
            id: edge.id,
            fullLabel: edge.data.fullLabel,
            x: event.clientX,
            y: event.clientY,
          });
        }, 500);
      }
    },
    []
  );

  const handleEdgeMouseLeave = useCallback(() => {
    // Clear the timeout if mouse leaves before the delay expires
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredEdge(null);
  }, []);

  const handleEdgesChange = useCallback(
    (changes: any[]) => {
      onEdgesChange(changes);

      const deleteChanges = changes.filter(
        (change) => change.type === 'remove'
      );

      if (deleteChanges.length > 0 && parserRef.current && onSCXMLChange) {
        try {
          const parseResult = parserRef.current.parse(scxmlContent);
          if (parseResult.success && parseResult.data) {
            const scxmlDoc = parseResult.data;
            let anyRemoved = false;

            for (const change of deleteChanges) {
              const removed = removeTransitionByEdgeId(scxmlDoc, change.id);
              if (removed) anyRemoved = true;
            }

            if (anyRemoved) {
              const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
              onSCXMLChange(updatedSCXML, 'structure');
              setSelectedTransitions(new Set());
            }
          }
        } catch (error) {
          console.error('Failed to sync edge deletion to SCXML:', error);
        }
      }

      if (onEdgeChange) {
        onEdgeChange(edges);
      }
    },
    [onEdgesChange, onEdgeChange, edges, scxmlContent, onSCXMLChange]
  );

  const onConnect = useCallback(
    (params: Connection) => {
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

      setEdges((eds) => addEdge(newEdge, eds));

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

              const updatedSCXML = parserRef.current.serialize(scxmlDoc, true);
              previousScxmlRef.current = updatedSCXML;

              if (onSCXMLChange) {
                isUpdatingPositionRef.current = true;
                onSCXMLChange(updatedSCXML, 'structure');
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

  // ==================== STATE CLICK HANDLERS ====================
  const handleStateClick = useCallback((stateId: string) => {
    setSelectedTransitions(new Set());
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

  // ==================== REACTFLOW NODE CHANGE HANDLER ====================
  const handleNodesChange = useCallback(
    (changes: any[]) => {
      const removeChanges = changes.filter(
        (change) => change.type === 'remove'
      );

      if (removeChanges.length > 0) {
        // Delete all selected nodes directly without confirmation
        const nodeIdsToDelete = removeChanges.map((change) => change.id);
        handleNodeDelete(nodeIdsToDelete);

        const nonRemoveChanges = changes.filter(
          (change) => change.type !== 'remove'
        );
        if (nonRemoveChanges.length > 0) {
          onNodesChangeRef.current(nonRemoveChanges);
        }
        return;
      }

      // Track dragging state across change events
      changes.forEach((change) => {
        if (change.type === 'position') {
          if (change.dragging === true) {
            // User is actively dragging this node
            isDraggingRef.current.add(change.id);
          }
        }
      });

      // Pass changes to ReactFlow for visual updates
      onNodesChangeRef.current(changes);

      // Check for position changes where dragging ended
      const dragEndChanges = changes.filter(
        (change) => change.type === 'position' && change.dragging === false
      );

      if (dragEndChanges.length === 0) {
        return;
      }

      // Only process nodes that were actually dragged
      const positionChanges = dragEndChanges.filter((change) =>
        isDraggingRef.current.has(change.id)
      );

      if (positionChanges.length === 0) {
        // This was a click, not a drag - don't update SCXML
        return;
      }

      // Remove nodes from dragging set since drag has ended
      positionChanges.forEach((change) => {
        isDraggingRef.current.delete(change.id);
      });

      if (isUpdatingPositionRef.current) {
        return;
      }

      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
        positionUpdateTimeoutRef.current = null;
      }

      positionUpdateTimeoutRef.current = setTimeout(() => {
        if (isUpdatingPositionRef.current) {
          return;
        }

        isUpdatingPositionRef.current = true;

        try {
          const positionMap = new Map<string, { x: number; y: number }>();
          const currentNodes = [...nodesRef.current];

          changes.forEach((change) => {
            if (change.type === 'position' && change.position) {
              const nodeIndex = currentNodes.findIndex(
                (n) => n.id === change.id
              );
              if (nodeIndex >= 0) {
                currentNodes[nodeIndex] = {
                  ...currentNodes[nodeIndex],
                  position: change.position,
                };
              }
              positionMap.set(change.id, change.position);
            }
          });

          for (const change of positionChanges) {
            const node = currentNodes.find((n) => n.id === change.id);
            if (!node?.position) continue;

            // In hierarchy navigation mode, positions are always absolute
            // because parentId is removed from filtered nodes (see use-hierarchy-navigation.ts:45)
            // The position we get from ReactFlow is already the correct absolute position
            let absoluteX = positionMap.get(change.id)?.x ?? node.position.x;
            let absoluteY = positionMap.get(change.id)?.y ?? node.position.y;

            const lastPos = lastPositionUpdateRef.current.get(change.id);
            if (
              lastPos &&
              Math.abs(lastPos.x - absoluteX) < 2 &&
              Math.abs(lastPos.y - absoluteY) < 2
            ) {
              continue;
            }

            lastPositionUpdateRef.current.set(change.id, {
              x: absoluteX,
              y: absoluteY,
            });

            handleNodePositionChangeRef.current(
              change.id,
              absoluteX,
              absoluteY
            );
          }
        } finally {
          setTimeout(() => {
            isUpdatingPositionRef.current = false;
          }, 200);
        }
      }, 150);
    },
    [nodes, handleNodeDelete]
  );

  // ==================== SCXML PARSING ====================
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

      parserRef.current = parser;
      metadataManagerRef.current = metadataManager;

      const parseResult = parser.parse(scxmlContent);

      if (parseResult.success && parseResult.data) {
        scxmlDocRef.current = parseResult.data;
        const { nodes, edges } = converter.convertToReactFlow(parseResult.data);

        const enhancedNodes = nodes.map((node) => {
          const visualMetadata = metadataManager.getVisualMetadata(node.id);
          const nodeUpdate: any = { ...node };

          if (visualMetadata?.layout) {
            nodeUpdate.position = {
              x: visualMetadata.layout.x ?? node.position.x,
              y: visualMetadata.layout.y ?? node.position.y,
            };

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

          const visualStyles = computeVisualStyles(
            visualMetadata,
            node.data?.stateType || 'simple'
          );

          nodeUpdate.data = {
            ...nodeUpdate.data,
            visualStyles,
            width:
              nodeUpdate.type === 'scxmlHistory' && node.data?.isHistoryWrapper
                ? nodeUpdate.style?.width || (node.data as any).width
                : visualMetadata?.layout?.width,
            height:
              nodeUpdate.type === 'scxmlHistory' && node.data?.isHistoryWrapper
                ? nodeUpdate.style?.height || (node.data as any).height
                : visualMetadata?.layout?.height,
            onLabelChange: (newLabel: string) =>
              handleNodeLabelChange(node.id, newLabel),
            onStateTypeChange: (newStateType: string) =>
              handleNodeStateTypeChange(node.id, newStateType),
            onActionsChange: (entryActions: string[], exitActions: string[]) =>
              handleNodeActionsChange(node.id, entryActions, exitActions),
            onDelete: () => handleNodeDelete(node.id),
          };

          return nodeUpdate;
        });

        const edgeGroups = new Map<string, any[]>();
        edges.forEach((edge) => {
          const key = `${edge.source}-${edge.target}`;
          if (!edgeGroups.has(key)) {
            edgeGroups.set(key, []);
          }
          edgeGroups.get(key)!.push(edge);
        });

        const haveSameParent = (sourceId: string, targetId: string) => {
          const sourceNode = nodes.find((n) => n.id === sourceId);
          const targetNode = nodes.find((n) => n.id === targetId);
          return sourceNode?.parentId === targetNode?.parentId;
        };

        const edgesWithMarkers = edges.map((edge) => {
          const edgeMetadata = metadataManager.getVisualMetadata(edge.id);
          const edgeKey = `${edge.source}-${edge.target}`;
          const parallelEdges = edgeGroups.get(edgeKey) || [];
          const edgeIndex = parallelEdges.findIndex((e) => e.id === edge.id);
          const hasParallelEdges = parallelEdges.length > 1;
          const inSameContainer = haveSameParent(edge.source, edge.target);

          let edgeType = 'smoothstep';

          if (inSameContainer) {
            if (hasParallelEdges) {
              // Use custom edge type for parallel edges to support offset
              edgeType = 'scxmlTransition';
            } else {
              edgeType = 'smoothstep';
            }
          } else {
            if (hasParallelEdges) {
              // Use custom edge type for parallel edges to support offset
              edgeType = 'scxmlTransition';
            } else {
              edgeType = 'smart';
            }
          }

          let pathOptions: any = {};
          if (hasParallelEdges) {
            // Apply symmetrical offset for parallel edges
            // For 2 edges: first curves down (-offset), second curves up (+offset)
            // For 3+ edges: distribute symmetrically around center
            let offset: number;

            if (parallelEdges.length === 2) {
              // Simple case: one up, one down with same magnitude
              offset = edgeIndex === 0 ? -50 : 50;
            } else {
              // For 3+ edges: center the distribution
              offset = (edgeIndex - (parallelEdges.length - 1) / 2) * 60;
            }

            const labelOffsetY =
              (edgeIndex - (parallelEdges.length - 1) / 2) * 25;
            pathOptions = {
              offset,
              borderRadius: 20 + edgeIndex * 10,
              curvature: 0.25 + edgeIndex * 0.1,
              labelOffsetY,
            };
          }

          // Build label content with event and condition
          const getLabelContent = () => {
            const parts: string[] = [];
            if (edge.data?.event) parts.push(`${edge.data.event}`);
            if (edge.data?.condition) parts.push(`${edge.data.condition}`);
            if (edge.data?.actions?.length > 0)
              parts.push(
                `/ ${edge.data.actions.length} action${
                  edge.data.actions.length > 1 ? 's' : ''
                }`
              );
            return parts.join(' ');
          };

          const fullLabel = getLabelContent();
          const truncateLabel = (text: string, maxLength: number = 10) => {
            if (text.length <= maxLength) return text;
            return text.substring(0, maxLength) + '...';
          };

          const edgeUpdate: any = {
            ...edge,
            type: edgeType,
            label: truncateLabel(fullLabel),
            data: {
              ...edge.data,
              fullLabel,
              offset: pathOptions.offset,
              labelOffsetY: pathOptions.labelOffsetY,
            },
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
              cursor: 'pointer',
            },
            labelBgStyle: {
              fill: edge.labelBgStyle?.fill || '#3b82f6',
              fillOpacity: 0.95,
            },
            labelBgPadding: [6, 4] as [number, number],
            labelBgBorderRadius: 4,
            interactionWidth: 30,
          };

          if (edgeMetadata) {
            if (edgeMetadata.style?.stroke) {
              edgeUpdate.style = {
                ...edgeUpdate.style,
                stroke: edgeMetadata.style.stroke,
                zIndex: 9999,
              };
              edgeUpdate.markerEnd.color = edgeMetadata.style.stroke;
            }

            if (edgeMetadata.style?.strokeWidth !== undefined) {
              edgeUpdate.style = {
                ...edgeUpdate.style,
                strokeWidth: edgeMetadata.style.strokeWidth,
                zIndex: 9999,
              };
            }

            if (edgeMetadata.diagram) {
              if (edgeMetadata.diagram.curveType) {
                const curveTypeMap: Record<string, string> = {
                  smooth: 'smart',
                  step: 'smartStep',
                  straight: 'smartStraight',
                  bezier: 'smart',
                };
                edgeUpdate.type =
                  curveTypeMap[edgeMetadata.diagram.curveType] || 'smart';
              }

              if (
                edgeMetadata.diagram.waypoints &&
                edgeMetadata.diagram.waypoints.length > 0
              ) {
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

    return {
      nodes: initialNodes,
      edges: initialEdges,
      parser: null,
      metadataManager: null,
    };
  }, [
    scxmlContent,
    handleNodeLabelChange,
    handleNodeActionsChange,
    handleNodeStateTypeChange,
    handleNodeDelete,
  ]);

  // ==================== HIERARCHY NAVIGATION ====================
  const {
    filteredNodes,
    filteredEdges: hierarchyFilteredEdges,
    breadcrumbPath,
    canNavigateUp,
    navigateUp: originalNavigateUp,
    navigateToRoot: originalNavigateToRoot,
    navigateIntoState: originalNavigateIntoState,
    navigateToBreadcrumb: originalNavigateToBreadcrumb,
    currentParentNode,
    currentParentId,
  } = useHierarchyNavigation({
    allNodes: parsedData.nodes,
    allEdges: parsedData.edges,
  });

  // Update allNodesRef with original nodes (with parentId intact)
  allNodesRef.current = parsedData.nodes;

  const navigateWithFitView = useCallback(
    (navigationFn: () => void) => {
      navigationFn();
      setTimeout(() => {
        fitView({
          padding: 0.3,
          includeHiddenNodes: false,
          minZoom: 0.5,
          maxZoom: 2,
          duration: 800,
        });
      }, 50);
    },
    [fitView]
  );

  const navigateUp = useCallback(
    () => navigateWithFitView(originalNavigateUp),
    [navigateWithFitView, originalNavigateUp]
  );

  const navigateToRoot = useCallback(
    () => navigateWithFitView(originalNavigateToRoot),
    [navigateWithFitView, originalNavigateToRoot]
  );

  const navigateIntoState = useCallback(
    (stateId: string) =>
      navigateWithFitView(() => originalNavigateIntoState(stateId)),
    [navigateWithFitView, originalNavigateIntoState]
  );

  const navigateToBreadcrumb = useCallback(
    (index: number) =>
      navigateWithFitView(() => originalNavigateToBreadcrumb(index)),
    [navigateWithFitView, originalNavigateToBreadcrumb]
  );

  // ==================== ADD ROOT STATE HANDLER ====================
  const handleAddRootState = React.useCallback(() => {
    if (!onSCXMLChange || !scxmlContent) {
      console.error('Cannot add state: SCXML not available');
      return;
    }

    try {
      let newStateId = 'state_1';
      let counter = 1;
      const existingIds = new Set(parsedData.nodes.map((n) => n.id));
      while (existingIds.has(newStateId)) {
        counter++;
        newStateId = `state_${counter}`;
      }

      const parseResult = parserRef.current?.parse(scxmlContent);
      if (parseResult?.success && parseResult.data) {
        const scxmlDoc = parseResult.data;
        let parentId: string | undefined = undefined;

        if (currentParentId) {
          parentId = currentParentId;
        } else {
          const rootStates = nodes.filter((n) => !n.parentId);
          for (const node of rootStates) {
            const hasChildren = nodes.some((n) => n.parentId === node.id);
            if (hasChildren || node.data?.stateType === 'compound') {
              parentId = node.id;
              break;
            }
          }

          if (!parentId) {
            const nonFinalState = rootStates.find(
              (n) => n.data?.stateType !== 'final'
            );
            if (nonFinalState) {
              parentId = nonFinalState.id;
            }
          }
        }

        let x = 100;
        let y = 100;

        if (parentId) {
          const childNodes = nodes.filter((n) => n.parentId === parentId);

          if (childNodes.length > 0) {
            const cols = 4;
            const rowHeight = 120;
            const colWidth = 200;

            const existingPositions = childNodes.map((n) => ({
              col: Math.floor((n.position?.x || 0) / colWidth),
              row: Math.floor(((n.position?.y || 0) - 100) / rowHeight),
            }));

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
          } else {
            x = 50;
            y = 100;
          }
        } else {
          const rootNodes = nodes.filter((n) => !n.parentId);
          if (rootNodes.length > 0) {
            const maxX = Math.max(...rootNodes.map((n) => n.position.x));
            x = maxX + 200;
          }
        }

        const newState = createStateElement(newStateId);
        (newState as any)['@_viz:xywh'] = `${x},${y},160,80`;
        addStateToDocument(scxmlDoc, newState, parentId);

        const updatedSCXML = parserRef.current!.serialize(scxmlDoc, true);
        onSCXMLChange(updatedSCXML, 'structure');

        setTimeout(() => {
          fitView({
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 2,
            duration: 600,
          });
        }, 200);
      }
    } catch (error) {
      console.error('Failed to add new state:', error);
    }
  }, [
    scxmlContent,
    onSCXMLChange,
    parsedData?.nodes,
    currentParentId,
    nodes,
    fitView,
  ]);

  // ==================== ELK LAYOUT HANDLER ====================
  const handleApplyELKLayout = React.useCallback(async () => {
    if (!parserRef.current || !onSCXMLChange || !scxmlContent) {
      console.error('Cannot apply ELK layout: parser or SCXML not available');
      return;
    }

    try {
      const converter = new SCXMLToXStateConverter();
      const parseResult = parserRef.current.parse(scxmlContent);

      if (!parseResult.success || !parseResult.data) {
        console.error('Failed to parse SCXML for ELK layout');
        return;
      }

      // Get current nodes and edges
      const currentNodes = [...nodes];
      const currentEdges = [...edges];

      // Apply ELK layout with selected algorithm and direction
      const layoutedNodes = await converter.applyELKLayout(
        currentNodes,
        currentEdges,
        {
          algorithm: elkAlgorithm,
          direction: elkDirection,
          edgeRouting: 'ORTHOGONAL',
          hierarchical: true,
          spacing: {
            nodeNode: 80,
            edgeNode: 40,
            edgeEdge: 20,
          },
        }
      );

      // Update SCXML with new positions
      const parser = new DOMParser();
      const doc = parser.parseFromString(scxmlContent, 'text/xml');
      const rootElement = doc.documentElement;
      const namespaceURI = 'urn:x-thingm:viz';

      // Ensure viz namespace is set
      if (!rootElement.hasAttribute('xmlns:viz')) {
        rootElement.setAttribute('xmlns:viz', namespaceURI);
      }

      // Update positions in SCXML
      layoutedNodes.forEach((node) => {
        const element = doc.querySelector(`[id="${node.id}"]`);
        if (element) {
          const width = node.style?.width || 160;
          const height = node.style?.height || 80;
          const newVizValue = `${Math.round(node.position.x)},${Math.round(
            node.position.y
          )},${width},${height}`;
          element.setAttribute('viz:xywh', newVizValue);
        }
      });

      const serializer = new XMLSerializer();
      const updatedSCXML = serializer.serializeToString(doc);
      onSCXMLChange(updatedSCXML, 'position');

      // Fit view after layout
      setTimeout(() => {
        fitView({
          padding: 0.3,
          includeHiddenNodes: false,
          minZoom: 0.5,
          maxZoom: 2,
          duration: 800,
        });
      }, 100);
    } catch (error) {
      console.error('Failed to apply ELK layout:', error);
    }
  }, [
    scxmlContent,
    onSCXMLChange,
    nodes,
    edges,
    fitView,
    elkAlgorithm,
    elkDirection,
  ]);

  // ==================== NODE ENHANCEMENTS ====================
  const nodeEnhancements = React.useMemo(() => {
    const enhancements = new Map();

    filteredNodes.forEach((node) => {
      const isActive =
        activeStates.has(node.id) || node.id === currentSimulationState;
      const visualMetadata = metadataManagerRef.current?.getVisualMetadata(
        node.id
      );
      const updatedVisualStyles = computeVisualStyles(
        visualMetadata,
        node.data?.stateType || 'simple',
        isActive,
        false
      );

      enhancements.set(node.id, {
        data: {
          ...node.data,
          isActive,
          visualStyles: updatedVisualStyles,
          onNavigateInto: node.data?.onNavigateInto,
        },
        style: {
          ...node.style,
        },
      });
    });

    return enhancements;
  }, [filteredNodes, activeStates, currentSimulationState]);

  const enhancedNodes = React.useMemo(() => {
    return filteredNodes.map((node) => {
      const enhancement = nodeEnhancements.get(node.id);
      return {
        ...node,
        data: enhancement ? enhancement.data : node.data,
        style: enhancement ? enhancement.style : node.style,
      };
    });
  }, [filteredNodes, nodeEnhancements]);

  // ==================== EDGE FILTERING ====================
  const displayFilteredEdges = React.useMemo(() => {
    const applySelectionStyles = (edge: Edge) => {
      const isSelected = selectedTransitions.has(edge.id);
      if (isSelected) {
        const existingMarker = (edge.markerEnd as any) || {
          type: MarkerType.ArrowClosed,
          color: '#6b7280',
        };
        return {
          ...edge,
          style: {
            ...edge.style,
            strokeWidth: 3,
            filter: 'drop-shadow(0 0 3px rgba(0, 0, 0, 0.3))',
          },
          animated: false,
          markerEnd: {
            ...existingMarker,
            width: 12,
            height: 12,
          },
          selectable: true,
          focusable: true,
        };
      }
      return {
        ...edge,
        selectable: true,
        focusable: true,
      };
    };

    if (transitionDisplayMode === 'all') {
      return hierarchyFilteredEdges.map((edge) => applySelectionStyles(edge));
    }

    if (activeStates.size === 0) {
      return hierarchyFilteredEdges.map((edge) => applySelectionStyles(edge));
    }

    const fromActiveStates = hierarchyFilteredEdges.filter((edge) =>
      activeStates.has(edge.source)
    );

    if (transitionDisplayMode === 'active') {
      return fromActiveStates.map((edge) => applySelectionStyles(edge));
    }

    return fromActiveStates
      .filter((edge) => true)
      .map((edge) => applySelectionStyles(edge));
  }, [
    hierarchyFilteredEdges,
    activeStates,
    transitionDisplayMode,
    selectedTransitions,
  ]);

  // ==================== EFFECTS ====================
  // Set node delete handler ref
  React.useEffect(() => {
    handleNodeDeleteRef.current = handleNodeDelete;
  }, [handleNodeDelete]);

  // Initialize nodes and edges when SCXML content changes
  React.useEffect(() => {
    const contentChanged = scxmlContent !== previousScxmlRef.current;

    if (contentChanged) {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
        positionUpdateTimeoutRef.current = null;
      }
      lastPositionUpdateRef.current.clear();

      previousScxmlRef.current = scxmlContent;

      // Always update when content comes from history (undo/redo)
      // or when not updating from our own position changes
      if (isUpdatingFromHistory || !isUpdatingPositionRef.current) {
        // Use positions from parsed SCXML
        // This ensures undo/redo properly updates the visual diagram
        setNodes(enhancedNodes);

        const selectableEdges = hierarchyFilteredEdges.map((edge) => ({
          ...edge,
          selectable: true,
          focusable: true,
        }));
        setEdges(selectableEdges);
      }
    } else if (nodes.length === 0 && enhancedNodes.length > 0) {
      setNodes(enhancedNodes);
      const selectableEdges = hierarchyFilteredEdges.map((edge) => ({
        ...edge,
        selectable: true,
        focusable: true,
      }));
      setEdges(selectableEdges);
    }
  }, [
    scxmlContent,
    parsedData,
    filteredNodes,
    hierarchyFilteredEdges,
    enhancedNodes,
    setNodes,
    setEdges,
    nodes.length,
    isUpdatingFromHistory,
  ]);

  // Sync nodes with hierarchy navigation changes
  React.useEffect(() => {
    if (enhancedNodes.length > 0) {
      setNodes((currentNodes) => {
        const currentPositions = new Map(
          currentNodes.map((node) => [node.id, node.position])
        );

        return enhancedNodes.map((node) => {
          const currentPosition = currentPositions.get(node.id);
          return {
            ...node,
            position: currentPosition || node.position,
          };
        });
      });
    }
  }, [currentParentId, enhancedNodes, setNodes]);

  // Auto-fit view when hierarchy level changes
  React.useEffect(() => {
    if (filteredNodes.length > 0) {
      const timeoutId = setTimeout(() => {
        if (!isUpdatingPositionRef.current) {
          fitView({
            padding: 0.3,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 2,
            duration: 800,
          });
        } else {
          const retryTimeoutId = setTimeout(() => {
            fitView({
              padding: 0.3,
              includeHiddenNodes: false,
              minZoom: 0.5,
              maxZoom: 2,
              duration: 800,
            });
          }, 300);
          return () => clearTimeout(retryTimeoutId);
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [currentParentId, fitView, filteredNodes.length]);

  // Set initial state
  React.useEffect(() => {
    const initialState = filteredNodes.find((node) => node.data?.isInitial);
    if (initialState && activeStates.size === 0) {
      setActiveStates(new Set([initialState.id]));
    }
  }, [filteredNodes, activeStates.size]);

  // Handle keyboard events for edge deletion
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedTransitions.size > 0) {
        event.preventDefault();
        const edgeId = Array.from(selectedTransitions)[0];
        handleEdgesChange([{ id: edgeId, type: 'remove' }]);
      }
      if (event.key === 'Delete' && activeStates.size > 0) {
        event.preventDefault();
        const stateId = Array.from(activeStates);
        handleNodesChange(stateId.map((id) => ({ id, type: 'remove' })));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTransitions, handleEdgesChange, activeStates, handleNodesChange]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (positionUpdateTimeoutRef.current) {
        clearTimeout(positionUpdateTimeoutRef.current);
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Close layout options on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showLayoutOptions) {
        const target = event.target as HTMLElement;
        if (!target.closest('.layout-options-panel')) {
          setShowLayoutOptions(false);
        }
      }
    };

    if (showLayoutOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLayoutOptions]);

  // ==================== RENDER ====================
  return (
    <div className='h-full w-full bg-gray-50 flex flex-col relative'>
      {/* Edge hover tooltip */}
      {hoveredEdge && (
        <div
          className='fixed z-[10000] pointer-events-none'
          style={{
            left: hoveredEdge.x + 10,
            top: hoveredEdge.y + 10,
          }}
        >
          <div className='bg-gray-900 text-white text-xs px-3 py-2 rounded-md shadow-lg max-w-xs break-words'>
            {hoveredEdge.fullLabel}
          </div>
        </div>
      )}

      {/* <SimulationControls
        scxmlContent={scxmlContent}
        onStateChange={setCurrentSimulationState}
      /> */}

      {/* Hierarchy Navigation Controls */}
      <div className='flex items-center gap-2 px-4 py-2 bg-white border-b shadow-sm'>
        {canNavigateUp && (
          <button
            onClick={navigateUp}
            className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
            title='Navigate up one level'
          >
            <ArrowUp className='h-4 w-4 text-gray-700' />
          </button>
        )}

        <button
          onClick={navigateToRoot}
          className='p-2 hover:bg-gray-100 rounded-lg transition-colors'
          title='Navigate to root'
          disabled={!canNavigateUp}
        >
          <Home className='h-4 w-4 text-gray-700' />
        </button>

        <div className='h-6 w-px bg-gray-300 mx-1' />

        {/* ELK Layout Controls */}
        <div className='relative layout-options-panel'>
          <button
            onClick={() => setShowLayoutOptions(!showLayoutOptions)}
            className='p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1'
            title='Layout Options'
          >
            <Network className='h-4 w-4 text-gray-700' />
          </button>

          {showLayoutOptions && (
            <div className='absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-50 min-w-[250px]'>
              <div className='text-xs font-semibold text-gray-700 mb-2'>
                Layout Algorithm
              </div>
              <select
                value={elkAlgorithm}
                onChange={(e) => setElkAlgorithm(e.target.value as any)}
                className='w-full px-2 py-1.5 text-sm border text-gray-800 border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='layered'>Layered (Hierarchical)</option>
                <option value='force'>Force-Directed</option>
                <option value='mrtree'>Tree</option>
                <option value='radial'>Radial</option>
              </select>

              {/* Only show direction for algorithms that support it */}
              {(elkAlgorithm === 'layered' || elkAlgorithm === 'mrtree') && (
                <>
                  <div className='text-xs font-semibold text-gray-700 mb-2'>
                    Direction
                  </div>
                  <select
                    value={elkDirection}
                    onChange={(e) => setElkDirection(e.target.value as any)}
                    className='w-full px-2 py-1.5 text-sm border text-gray-800 border-gray-300 rounded-md mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value='DOWN'>Top to Bottom</option>
                    <option value='UP'>Bottom to Top</option>
                    <option value='RIGHT'>Left to Right</option>
                    <option value='LEFT'>Right to Left</option>
                  </select>
                </>
              )}

              <button
                onClick={() => {
                  handleApplyELKLayout();
                  setShowLayoutOptions(false);
                }}
                className='w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors'
              >
                Apply Layout
              </button>
            </div>
          )}
        </div>

        <div className='h-6 w-px bg-gray-300 mx-1' />

        <div className='flex items-center gap-1 flex-1'>
          {breadcrumbPath.map((path, index) => (
            <React.Fragment key={index}>
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={`px-2 py-1 text-sm hover:bg-gray-100 rounded transition-colors ${
                  index === breadcrumbPath.length - 1
                    ? 'font-semibold text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {path}
              </button>
              {index < breadcrumbPath.length - 1 && (
                <ChevronRight className='h-3 w-3 text-gray-400' />
              )}
            </React.Fragment>
          ))}
        </div>

        {currentParentNode && (
          <div className='text-sm text-gray-600 ml-auto'>
            Level: {breadcrumbPath.length - 1}
          </div>
        )}
      </div>

      {/* Transition Label Editor */}
      {selectedEdgeForEdit && (
        <div className='flex items-center gap-3 px-4 py-2 bg-blue-50 border-b'>
          <span className='text-sm font-medium text-gray-700'>
            Edit Transition:
          </span>
          <input
            type='text'
            value={selectedEdgeForEdit.rawValue || ''}
            onChange={(e) => {
              const newValue = e.target.value;
              setSelectedEdgeForEdit({
                ...selectedEdgeForEdit,
                rawValue: newValue,
              });
            }}
            onBlur={() => {
              const newLabel = selectedEdgeForEdit.rawValue || '';
              if (newLabel) {
                handleTransitionLabelChange(
                  selectedEdgeForEdit.id,
                  newLabel,
                  selectedEdgeForEdit.editingField
                );
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const newLabel = selectedEdgeForEdit.rawValue || '';
                if (newLabel) {
                  handleTransitionLabelChange(
                    selectedEdgeForEdit.id,
                    newLabel,
                    selectedEdgeForEdit.editingField
                  );
                }
                setSelectedEdgeForEdit(null);
                setSelectedTransitions(new Set());
              } else if (e.key === 'Escape') {
                setSelectedEdgeForEdit(null);
                setSelectedTransitions(new Set());
              }
            }}
            className='flex-1 px-3 py-1.5 text-sm text-gray-800 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
            placeholder={
              selectedEdgeForEdit.editingField === 'cond'
                ? 'Enter condition'
                : 'Enter event'
            }
            autoFocus
          />
          <button
            onClick={() => {
              setSelectedEdgeForEdit(null);
              setSelectedTransitions(new Set());
            }}
            className='text-sm text-gray-600 hover:text-gray-900 px-2'
          >
            Cancel
          </button>
        </div>
      )}

      <div className='flex-1'>
        <ReactFlow
          nodes={nodes}
          edges={displayFilteredEdges}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onConnect={onConnect}
          onNodeClick={(event, node) => handleStateClick(node.id)}
          onEdgeClick={handleEdgeClick}
          onEdgeMouseEnter={handleEdgeMouseEnter}
          onEdgeMouseLeave={handleEdgeMouseLeave}
          onPaneClick={() => {
            setSelectedEdgeForEdit(null);
            setSelectedTransitions(new Set());
          }}
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
          deleteKeyCode={['Delete']}
          connectionLineType={ConnectionLineType.SmoothStep}
          connectionMode={ConnectionMode.Loose}
          connectionRadius={2}
          edgesUpdatable={true}
          edgesFocusable={true}
          elevateEdgesOnSelect={true}
          elevateNodesOnSelect={false}
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
          >
            <ControlButton
              onClick={handleAddRootState}
              title='Add State'
              aria-label='Add State'
              className='text-gray-600 hover:text-gray-900'
            >
              S
            </ControlButton>
            <ControlButton
              onClick={navigateUp}
              title='One Level Up'
              aria-label='One Level Up'
              className='text-gray-600 hover:text-gray-900'
              disabled={!canNavigateUp}
            >
              <ArrowUp />
            </ControlButton>
          </Controls>
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

// ==================== EXPORT WRAPPER ====================
export const VisualDiagram: React.FC<VisualDiagramProps> = (props) => {
  return (
    <ReactFlowProvider>
      <VisualDiagramInner {...props} />
    </ReactFlowProvider>
  );
};
