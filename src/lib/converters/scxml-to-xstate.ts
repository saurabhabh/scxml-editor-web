import { setup, createMachine, type StateNode } from 'xstate';
import type { SCXMLElement, SCXMLDocument } from '@/types/scxml';
import type { Node, Edge } from 'reactflow';
import { MarkerType } from 'reactflow';
import type {
  SCXMLStateNodeData,
  SCXMLTransitionEdgeData,
} from '@/components/diagram';
import type {
  HierarchicalNode,
  HierarchicalLayout,
  LayoutStrategy,
  Rectangle,
} from '@/types/hierarchical-node';
import { ContainerLayoutManager } from '@/lib/layout/container-layout-manager';
import {
  ConditionEvaluator,
  type ParsedCondition,
  type ConditionContext,
} from '@/lib/scxml/condition-evaluator';
import {
  elkLayoutService,
  type ELKLayoutOptions,
} from '@/lib/layout/elk-layout-service';
import { nodeDimensionCalculator } from '@/lib/layout/node-dimension-calculator';
import { VISUAL_METADATA_CONSTANTS } from '@/types/visual-metadata';

export interface XStateMachineConfig {
  id?: string;
  initial?: string;
  states: Record<string, any>;
  context?: Record<string, any>;
}

export interface VisualMetadata {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
}

/**
 * Converts SCXML documents to XState v5 machine configurations and React Flow diagram data
 */
export interface StateRegistryEntry {
  state: any;
  parentPath: string;
  children: string[];
  isContainer: boolean;
  depth: number;
  elementType: 'state' | 'parallel' | 'final' | 'history';
}

export class SCXMLToXStateConverter {
  private stateRegistry: Map<string, StateRegistryEntry> = new Map();
  private hierarchyMap: Map<string, string[]> = new Map(); // parent -> children mapping
  private parentMap: Map<string, string> = new Map(); // child -> parent mapping
  private rootScxml: any = null;
  private claimedStates: Set<string> = new Set(); // Track states already claimed by their parent
  private edgePairCounts: Map<string, number> = new Map(); // Track edge pairs for handle assignment

  // Map original IDs to safe IDs (without dots) and vice versa
  private idToSafeId: Map<string, string> = new Map();
  private safeIdToId: Map<string, string> = new Map();

  // Store original SCXML content for write-back
  private originalScxmlContent: string = '';

  // Store initialized SCXML content (with viz:xywh added)
  private initializedSCXML: string | null = null;

  /**
   * Convert state ID to a safe ID for XState (replace dots with underscores)
   * This is necessary because XState interprets dots as path separators
   */
  private toSafeId(id: string | null | undefined): string | null | undefined {
    // Handle null/undefined cases
    if (id === null || id === undefined) {
      return id;
    }

    // Ensure it's a string
    if (typeof id !== 'string') {
      return String(id);
    }

    // Handle empty string
    if (id === '') {
      return id;
    }

    // Check if we already have a safe ID for this
    const existing = this.idToSafeId.get(id);
    if (existing) return existing;

    // Replace dots with double underscores to avoid conflicts
    const safeId = id.replace(/\./g, '__');

    // Store the mapping
    this.idToSafeId.set(id, safeId);
    this.safeIdToId.set(safeId, id);

    return safeId;
  }

  /**
   * Convert safe ID back to original ID
   */
  private fromSafeId(
    safeId: string | null | undefined
  ): string | null | undefined {
    if (safeId === null || safeId === undefined) {
      return safeId;
    }

    if (typeof safeId !== 'string') {
      return String(safeId);
    }

    if (safeId === '') {
      return safeId;
    }

    return this.safeIdToId.get(safeId) || safeId;
  }

  /**
   * Validate all state references and transitions before conversion
   */
  private validateAllStateReferences(scxml: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Collect all transitions and validate their targets
    const allTransitions: {
      sourceId: string;
      targetId: string;
      sourcePath: string;
    }[] = [];
    this.collectAllTransitionsForValidation(scxml, '', allTransitions);

    for (const transition of allTransitions) {
      const { sourceId, targetId, sourcePath } = transition;

      // Check if target state exists
      if (!this.stateRegistry.has(targetId)) {
        const availableStates = Array.from(this.stateRegistry.keys());
        const suggestion = this.findClosestStateMatch(
          targetId,
          availableStates
        );

        errors.push(
          `Transition from '${sourceId}' targets non-existent state '${targetId}'.` +
            (suggestion ? ` Did you mean '${suggestion}'?` : '') +
            ` Available states: ${availableStates.slice(0, 5).join(', ')}${
              availableStates.length > 5 ? '...' : ''
            }`
        );
      }
    }

    // Check for unreachable states (states with no incoming transitions)
    const statesWithIncomingTransitions = new Set<string>();
    const rootInitial = this.getAttribute(scxml, 'initial');
    if (rootInitial) {
      statesWithIncomingTransitions.add(rootInitial);
    }

    for (const transition of allTransitions) {
      statesWithIncomingTransitions.add(transition.targetId);
    }

    // Add states that are initial states in their parent context
    for (const [stateId, entry] of this.stateRegistry) {
      if (entry.parentPath) {
        const parentId = entry.parentPath.split('#').pop();
        if (parentId) {
          const parentEntry = this.stateRegistry.get(parentId);
          if (parentEntry) {
            const parentInitial = this.getAttribute(
              parentEntry.state,
              'initial'
            );
            if (parentInitial === stateId) {
              statesWithIncomingTransitions.add(stateId);
            }
          }
        }
      }
    }

    const unreachableStates = Array.from(this.stateRegistry.keys()).filter(
      (stateId) => !statesWithIncomingTransitions.has(stateId)
    );

    if (unreachableStates.length > 0) {
      console.warn(
        `⚠️ Found ${unreachableStates.length} potentially unreachable states:`,
        unreachableStates
      );
    }

    const isValid = errors.length === 0;

    return { isValid, errors };
  }

  /**
   * Collect all transitions for validation purposes
   */
  private collectAllTransitionsForValidation(
    parent: any,
    parentPath: string,
    transitions: { sourceId: string; targetId: string; sourcePath: string }[]
  ): void {
    const currentStateId = this.getAttribute(parent, 'id');

    // Process transitions in current element
    const elementTransitions = this.getElements(parent, 'transition');
    if (elementTransitions && currentStateId) {
      const transitionsArray = Array.isArray(elementTransitions)
        ? elementTransitions
        : [elementTransitions];

      for (const transition of transitionsArray) {
        const target = this.getAttribute(transition, 'target');
        if (target) {
          const currentPath = parentPath
            ? `${parentPath}#${currentStateId}`
            : currentStateId;
          transitions.push({
            sourceId: currentStateId,
            targetId: target,
            sourcePath: currentPath,
          });
        }
      }
    }

    // Recursively process child states
    const states = this.getElements(parent, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        const stateId = this.getAttribute(state, 'id');
        if (stateId) {
          const currentPath = parentPath ? `${parentPath}#${stateId}` : stateId;
          this.collectAllTransitionsForValidation(
            state,
            currentPath,
            transitions
          );
        }
      }
    }

    // Process parallel states
    const parallels = this.getElements(parent, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        const parallelId = this.getAttribute(parallel, 'id');
        if (parallelId) {
          const currentPath = parentPath
            ? `${parentPath}#${parallelId}`
            : parallelId;
          this.collectAllTransitionsForValidation(
            parallel,
            currentPath,
            transitions
          );
        }
      }
    }
  }

  /**
   * Find the closest matching state name for suggestions
   */
  private findClosestStateMatch(
    targetId: string,
    availableStates: string[]
  ): string | null {
    // Simple fuzzy matching - find states that contain the target or vice versa
    for (const state of availableStates) {
      if (
        state.toLowerCase().includes(targetId.toLowerCase()) ||
        targetId.toLowerCase().includes(state.toLowerCase())
      ) {
        return state;
      }
    }
    return null;
  }

  /**
   * Convert SCXML document to XState machine configuration
   */
  convertToXState(scxmlDoc: SCXMLDocument): XStateMachineConfig {
    const scxml = scxmlDoc.scxml;
    this.rootScxml = scxml;
    this.stateRegistry.clear();
    this.hierarchyMap.clear();
    this.parentMap.clear();
    this.claimedStates.clear();
    this.idToSafeId.clear();
    this.safeIdToId.clear();

    // First pass: register all states with their parent paths
    this.registerAllStates(scxml, '');

    // Validate all state references before conversion
    const stateValidation = this.validateAllStateReferences(scxml);
    if (!stateValidation.isValid) {
      console.error(
        '❌ State validation failed with errors:',
        stateValidation.errors
      );
      stateValidation.errors.forEach((error) => console.error('   -', error));

      // Continue conversion but log the issues - the calling code can decide what to do
    }

    const initialState = this.getAttribute(scxml, 'initial');
    const safeInitialState = initialState
      ? this.toSafeId(initialState)
      : undefined;
    const config: XStateMachineConfig = {
      id: this.getAttribute(scxml, 'name') || 'scxmlMachine',
      initial: safeInitialState || undefined,
      states: {},
      context: {},
    };

    // Process all top-level states and parallel states
    const states = this.getElements(scxml, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        const stateConfig = this.convertState(state);
        const stateId = this.getAttribute(state, 'id');
        if (stateId && stateConfig) {
          const safeId = this.toSafeId(stateId);
          if (safeId) {
            config.states[safeId] = stateConfig;
          }
        }
      }
    }

    // Process parallel states at root level
    const parallels = this.getElements(scxml, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        const parallelConfig = this.convertParallelState(parallel);
        const parallelId = this.getAttribute(parallel, 'id');
        if (parallelId && parallelConfig) {
          const safeId = this.toSafeId(parallelId);
          if (safeId) {
            config.states[safeId] = parallelConfig;
          }
        }
      }
    }

    // Process data model for context
    const dataModel = this.getElements(scxml, 'datamodel');
    if (dataModel) {
      config.context = this.convertDataModel(dataModel);
    }

    // Auto-set initial state if not specified but has states
    if (!config.initial && Object.keys(config.states).length > 0) {
      const firstStateId = Object.keys(config.states)[0];
      config.initial = firstStateId;
    }

    // Validate transitions
    const transitionValidation = this.validateTransitions(config);
    if (!transitionValidation.isValid) {
      console.warn(
        'Transition validation errors:',
        transitionValidation.errors
      );
      // Continue anyway but log the issues
    }

    return config;
  }

  /**
   * Convert SCXML document to React Flow nodes and edges with ELK force-directed layout
   * @async This method is async because it uses ELK layout computation
   */
  async convertToReactFlow(
    scxmlDoc: SCXMLDocument,
    originalXmlContent?: string
  ): Promise<{
    nodes: Node[];
    edges: Edge[];
    initializedSCXML?: string | null;
  }> {
    const scxml = scxmlDoc.scxml;
    this.rootScxml = scxml;

    // Store original content for potential write-back
    if (originalXmlContent) {
      this.originalScxmlContent = originalXmlContent;
    }

    // Reset initialized SCXML
    this.initializedSCXML = null;

    // Parse datamodel to get context
    const dataModel = this.getElements(scxml, 'datamodel');
    if (dataModel) {
      this.convertDataModel(dataModel);
    }

    // First, ensure state registry is populated
    if (this.stateRegistry.size === 0) {
      this.stateRegistry.clear();
      this.hierarchyMap.clear();
      this.parentMap.clear();
      this.claimedStates.clear();
      this.idToSafeId.clear();
      this.safeIdToId.clear();
      this.registerAllStates(scxml, '');
    }

    const layoutManager = new ContainerLayoutManager();
    const hierarchicalLayout = await this.createHierarchicalLayout(
      layoutManager
    );

    return {
      nodes: hierarchicalLayout.nodes,
      edges: hierarchicalLayout.edges,
      initializedSCXML: this.initializedSCXML,
    };
  }

  /**
   * Create hierarchical layout with ELK force-directed positioning
   * Preserves viz:xywh positions with absolute priority
   */
  private async createHierarchicalLayout(
    layoutManager: ContainerLayoutManager
  ): Promise<HierarchicalLayout> {
    const allNodes: HierarchicalNode[] = [];
    const edges: Edge[] = [];

    // First pass: Create all nodes with basic information
    const stateEntries = Array.from(this.stateRegistry.entries());

    for (const [stateId, stateInfo] of stateEntries) {
      const node = this.createHierarchicalNode(stateId, stateInfo);
      if (node) {
        allNodes.push(node);
      }
    }

    // Filter to only include root-level nodes (nodes without parents) for ReactFlow
    // Also exclude history states from root nodes since they wrap containers
    const rootNodes = allNodes.filter(
      (node) =>
        !node.parentId &&
        this.stateRegistry.get(node.id)?.elementType !== 'history'
    );

    // No longer need to attach descendants - using native parent-child relationships

    // Reset edge pair counts for handle assignment
    this.edgePairCounts.clear();

    // Collect all transitions/edges BEFORE layout
    // ELK needs edges to calculate optimal node positions
    this.collectAllTransitions(this.rootScxml, edges);

    // Apply ELK force-directed layout with viz:xywh priority
    await this.applyDefaultELKLayout(allNodes, edges);

    // Calculate dimensions for nodes without viz:xywh width/height
    // Track whether any nodes needed initialization
    let needsInitialization = false;

    allNodes.forEach((node) => {
      const nodeData = node.data as any;
      const hasVizDimensions = nodeData.width !== undefined && nodeData.height !== undefined;

      if (!hasVizDimensions) {
        // Calculate dimensions using the new simple logic
        const dims = nodeDimensionCalculator.calculateDimensionsFromNode(node);

        // Store calculated dimensions
        nodeData.width = dims.width;
        nodeData.height = dims.height;

        // Mark that this node needs initialization
        needsInitialization = true;
      }
    });

    // If any nodes needed initialization, write back to SCXML
    if (needsInitialization && this.originalScxmlContent) {
      this.initializedSCXML = this.writeLayoutToSCXML(allNodes);
    }

    // Update container bounds after layout is complete
    allNodes.forEach((node) => {
      if (
        node.childIds &&
        node.childIds.length > 0 &&
        this.stateRegistry.get(node.id)?.elementType !== 'history'
      ) {
        const nodeData = node.data as any;
        // Use the largest available dimensions
        const finalWidth = Math.max(
          nodeData.width || 0,
          node.containerBounds?.width || 0,
          300 // minimum fallback
        );
        const finalHeight = Math.max(
          nodeData.height || 0,
          node.containerBounds?.height || 0,
          200 // minimum fallback
        );

        node.containerBounds = {
          x: node.position.x,
          y: node.position.y,
          width: finalWidth,
          height: finalHeight,
        };
      }
    });

    // Position history states (but allow them to also participate in sibling layout)
    this.positionHistoryStates(allNodes);

    // DON'T convert absolute positions to relative positions
    // We're using hierarchy navigation which removes parentId for flat rendering
    // All positions should remain absolute for correct display
    //
    // Convert absolute positions to relative positions for nested nodes
    allNodes.forEach((node) => {
      if (node.parentId) {
        const parent = allNodes.find((p) => p.id === node.parentId);
        if (parent) {
          const hasVizPosition = (node.data as any).hasVizPosition === true;

          // For nodes with viz positions, keep them absolute (don't convert to relative)
          // because hierarchy navigation removes parentId and treats all nodes as root-level
          if (hasVizPosition) {
            // SKIP conversion - keep absolute position
          } else {
            // For auto-laid out nodes, they're already relative - keep as is
          }

          // Add extent to constrain child within parent bounds
          (node as any).extent = 'parent';
          // Make parent expand to fit children automatically
          (node as any).expandParent = true;
        }
      }
    });

    // Include history wrapper nodes that should be rendered at the top level
    const historyWrapperNodes = allNodes.filter(
      (node) =>
        this.stateRegistry.get(node.id)?.elementType === 'history' &&
        (node.data as any).isHistoryWrapper
    );

    // Use all nodes with native parent-child relationships
    const finalNodes = allNodes;

    // All nodes now use scxmlState type
    // State classification is handled via data.stateType property

    // Remove proxy node creation helpers - no longer needed

    // No proxy nodes needed

    // Remove descendant processing - no longer needed

    // Layout processing function removed - no longer needed

    // Layout calculation function removed - no longer needed

    // No longer need to process descendants for proxy nodes

    // Edges now connect directly to the actual nodes

    return {
      nodes: finalNodes, // All nodes with proper parent-child relationships
      edges: edges, // Direct edges without proxy mapping
      hierarchy: this.hierarchyMap,
      parentMap: this.parentMap,
    };
  }

  /**
   * Get direct children of a given parent (no longer need recursive descendants)
   */
  private getDirectChildren(
    parentId: string,
    allNodes: HierarchicalNode[]
  ): HierarchicalNode[] {
    return allNodes.filter((node) => node.parentId === parentId);
  }

  /**
   * Create a hierarchical node from state registry entry
   */
  private createHierarchicalNode(
    stateId: string,
    stateInfo: StateRegistryEntry
  ): HierarchicalNode | null {
    const state = stateInfo.state;
    const isContainer = stateInfo.isContainer;

    // Extract visual metadata FIRST
    const visualMetadata = this.extractVisualMetadata(state);

    // Extract actions
    const onentry = this.getElements(state, 'onentry');
    const onexit = this.getElements(state, 'onexit');
    const entryActions = onentry ? this.extractActionsText(onentry) : [];
    const exitActions = onexit ? this.extractActionsText(onexit) : [];

    // Determine node type
    // Most states use 'scxmlState' type, history states use 'scxmlHistory'
    // State classification is handled via data.stateType
    let nodeType: 'scxmlState' | 'scxmlHistory' = 'scxmlState';
    let stateType: SCXMLStateNodeData['stateType'] = 'simple';

    if (stateInfo.elementType === 'parallel') {
      stateType = 'parallel';
    } else if (stateInfo.elementType === 'history') {
      nodeType = 'scxmlHistory'; // Keep history wrapper as special type
      stateType = 'simple';
    } else if (isContainer) {
      stateType = 'compound';
    } else if (state['@_type'] === 'final') {
      stateType = 'final';
    }

    // Check if this is an initial state
    const isInitial = this.isInitialState(stateId, stateInfo.parentPath);

    // Initial position placeholder - will be set by applyDefaultELKLayout()
    // This placeholder is necessary for node creation but will be overwritten
    const position: { x: number; y: number } = { x: 0, y: 0 };

    // Create base node data
    const baseNodeData: SCXMLStateNodeData = {
      label: stateId,
      stateType,
      isInitial,
      entryActions,
      exitActions,
    };

    // Create hierarchical node
    const node: HierarchicalNode = {
      id: stateId,
      type: nodeType,
      position,
      data: baseNodeData,
      parentId: stateInfo.parentPath ? this.parentMap.get(stateId) : undefined,
      childIds: stateInfo.children,
      depth: stateInfo.depth,
    };

    // If this is a container, store children array for reference
    if (isContainer) {
      (node.data as any).children = stateInfo.children;
    }

    // Store viz metadata for position tracking in auto-layout
    if (visualMetadata.x !== undefined && visualMetadata.y !== undefined) {
      // Store absolute viz:xywh position for tracking
      (node.data as any).vizX = visualMetadata.x;
      (node.data as any).vizY = visualMetadata.y;
      (node.data as any).hasVizPosition = true; // Flag to indicate viz position exists
    }

    // Apply viz:xywh width/height at all levels for NodeResizer compatibility
    if (
      visualMetadata.width !== undefined &&
      visualMetadata.height !== undefined
    ) {
      // Top-level dimensions (required by NodeResizer)
      (node as any).width = visualMetadata.width;
      (node as any).height = visualMetadata.height;

      // Style-level dimensions
      (node as any).style = {
        width: visualMetadata.width,
        height: visualMetadata.height,
      };

      // Data-level dimensions (for component access)
      (node.data as any).width = visualMetadata.width;
      (node.data as any).height = visualMetadata.height;
    }

    return node;
  }


  /**
   * Position history states to wrap around their parent containers
   * @deprecated Legacy manual positioning - kept for fallback only
   * Use applyDefaultELKLayout() instead for ELK force-directed layout
   */
  private positionHistoryStates(allNodes: HierarchicalNode[]): void {
    const historyNodes = allNodes.filter(
      (node) => this.stateRegistry.get(node.id)?.elementType === 'history'
    );

    historyNodes.forEach((historyNode) => {
      const parentId = historyNode.parentId;
      if (!parentId) return;

      const parentNode = allNodes.find((node) => node.id === parentId);
      if (!parentNode) return;

      // Use a generous multiplier approach for history wrapper size
      // This ensures it wraps around the entire container and its content
      const containerData = parentNode.data as any;
      const baseWidth =
        containerData.width || parentNode.containerBounds?.width || 300;
      const baseHeight =
        containerData.height || parentNode.containerBounds?.height || 200;

      // Use a generous fixed margin approach - simpler and more predictable
      const wrapMargin = 150; // Large margin to ensure coverage

      // Calculate wrapper size with generous margins
      const wrapperWidth = baseWidth + wrapMargin * 3.5;
      const wrapperHeight = baseHeight + wrapMargin * 2;

      // Position wrapper so container is centered within it
      historyNode.position = {
        x: parentNode.position.x - 160,
        y: parentNode.position.y + 48,
      };

      // Set history state size to wrap the entire visual area
      (historyNode.data as any).width = wrapperWidth;
      (historyNode.data as any).height = wrapperHeight;

      // IMPORTANT: Also set the style property for ReactFlow
      historyNode.style = {
        ...historyNode.style,
        width: wrapperWidth,
        height: wrapperHeight,
      };

      // Mark this as a history wrapper for special rendering
      (historyNode.data as any).isHistoryWrapper = true;
      (historyNode.data as any).wrappedContainerId = parentId;

      // Store bounds for the history wrapper
      historyNode.containerBounds = {
        x: historyNode.position.x,
        y: historyNode.position.y,
        width: wrapperWidth,
        height: wrapperHeight,
      };
    });
  }


  /**
   * Apply ELK force-directed layout to all nodes
   * Preserves viz:xywh positions (x,y only) with absolute priority
   * Ignores width/height from viz:xywh
   */
  private async applyDefaultELKLayout(
    nodes: HierarchicalNode[],
    edges: Edge[]
  ): Promise<void> {
    // Step 1: Collect nodes with viz:xywh positions
    const nodesWithVizPositions = new Map<string, { x: number; y: number }>();

    nodes.forEach((node) => {
      const vizX = (node.data as any).vizX;
      const vizY = (node.data as any).vizY;
      if (vizX !== undefined && vizY !== undefined) {
        nodesWithVizPositions.set(node.id, { x: vizX, y: vizY });
      }
    });

    // Step 2: Run ELK force-directed layout on ALL nodes
    // ELK will calculate good positions considering the graph structure
    const positions = await elkLayoutService.computeLayout(nodes, edges, {
      algorithm: 'layered', // Force-directed by default for organic layouts
      direction: 'DOWN',
      edgeRouting: 'ORTHOGONAL',
      spacing: {
        nodeNode: 40, // Reduced: Space between nodes
        edgeNode: 20, // Reduced: Space between edges and nodes
        edgeEdge: 10, // Reduced: Space between edges
      },
      padding: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20,
      },
      hierarchical: true, // Respect parent-child relationships
      aspectRatio: 3, // Prefer wider layouts (16:10 ratio) for more compact vertical spacing
    });

    // Step 3: Apply positions - viz:xywh takes ABSOLUTE priority over ELK
    nodes.forEach((node) => {
      const vizPosition = nodesWithVizPositions.get(node.id);

      if (vizPosition) {
        // Use viz:xywh position (highest priority)
        // This preserves user-defined positions from SCXML
        node.position = { x: vizPosition.x, y: vizPosition.y };
      } else {
        // Use ELK calculated position for nodes without explicit positions
        const elkPos = positions.get(node.id);
        if (elkPos) {
          node.position = { x: elkPos.x, y: elkPos.y };
        }
        // If no ELK position (shouldn't happen), keep existing position
      }

      // Note: Width/height are now properly handled from viz:xywh
      // They are applied in createStateNode() and createParallelNode()
    });
  }

  /**
   * Write calculated layout (position + dimensions) back to SCXML as viz:xywh attributes
   * This initializes SCXML files that arrive without viz:xywh
   */
  private writeLayoutToSCXML(nodes: HierarchicalNode[]): string {
    if (!this.originalScxmlContent) {
      console.warn('No original SCXML content available for write-back');
      return '';
    }

    try {
      // Normalize namespace URI in the raw XML before parsing
      // This handles migration from old namespace URIs
      let normalizedXml = this.originalScxmlContent;

      // Replace any old namespace URIs with the canonical one
      const oldNamespacePatterns = [
        /xmlns:viz\s*=\s*["']http:\/\/scxml-viz\.github\.io\/ns["']/g,
        /xmlns:viz\s*=\s*["']urn:x-thingm:viz["']/g,
        /xmlns:ns1\s*=\s*["']http:\/\/scxml-viz\.github\.io\/ns["']/g,
        /xmlns:ns1\s*=\s*["']urn:x-thingm:viz["']/g,
      ];

      for (const pattern of oldNamespacePatterns) {
        normalizedXml = normalizedXml.replace(
          pattern,
          `xmlns:viz="${VISUAL_METADATA_CONSTANTS.NAMESPACE_URI}"`
        );
      }

      // Also replace ns1: prefixed attributes with viz: prefix
      normalizedXml = normalizedXml.replace(/\bns1:/g, 'viz:');

      const parser = new DOMParser();
      const doc = parser.parseFromString(normalizedXml, 'text/xml');

      // Check for XML parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parsing error in writeLayoutToSCXML:', parseError.textContent);
        return '';
      }

      // Ensure viz namespace is declared on root element with correct URI
      const root = doc.documentElement;
      if (root) {
        // Always set/update the namespace to the canonical URI
        // This migrates old namespace URIs to the new standard
        root.setAttribute('xmlns:viz', VISUAL_METADATA_CONSTANTS.NAMESPACE_URI);
      }

      // Update viz:xywh for each node
      nodes.forEach((node) => {
        // Find the state element by ID (could be <state>, <parallel>, or <final>)
        const stateElement = doc.querySelector(
          `state[id="${node.id}"], parallel[id="${node.id}"], final[id="${node.id}"]`
        );

        if (!stateElement) {
          console.warn(`State element not found for node: ${node.id}`);
          return;
        }

        // Get position and dimensions
        const x = Math.round(node.position.x);
        const y = Math.round(node.position.y);
        const width = Math.round((node.data as any).width || 160);
        const height = Math.round((node.data as any).height || 80);

        // Set viz:xywh attribute in format "x,y,width,height"
        const vizXywh = `${x},${y},${width},${height}`;
        stateElement.setAttribute('viz:xywh', vizXywh);
      });

      // Serialize back to string
      const serializer = new XMLSerializer();
      const newContent = serializer.serializeToString(doc);

      return newContent;
    } catch (error) {
      console.error('Error in writeLayoutToSCXML:', error);
      return '';
    }
  }


  /**
   * Create XState machine from SCXML document with error handling
   */
  createXStateMachine(scxmlDoc: SCXMLDocument) {
    try {
      const config = this.convertToXState(scxmlDoc);

      const machine = setup({
        // Define actions, guards, etc. here as needed
        actions: {
          // Default SCXML actions
          log: ({ context, event }, params: any) => {
            // SCXML log action
          },
          assign: ({ context }, params: any) => {
            return { ...context, ...params };
          },
        },
      }).createMachine(config);

      return machine;
    } catch (error) {
      console.error('❌ Error creating XState machine:', error);

      // Provide helpful error information
      if (error instanceof Error) {
        const errorMessage = error.message;

        // Parse common XState errors and provide suggestions
        if (
          errorMessage.includes('Child state') &&
          errorMessage.includes('does not exist')
        ) {
          const match = errorMessage.match(
            /Child state '([^']+)' does not exist on '([^']+)'/
          );
          if (match) {
            const [, childState, parentState] = match;
            console.error(`\n🔍 Debugging Info:`);
            console.error(
              `   Problem: State '${childState}' cannot be found in parent '${parentState}'`
            );
            console.error(
              `   Registered states:`,
              Array.from(this.stateRegistry.keys())
            );

            const childInfo = this.stateRegistry.get(childState);
            if (childInfo) {
              console.error(
                `   Found '${childState}' under parent: '${
                  childInfo.parentPath || 'root'
                }'`
              );
              console.error(
                `   Suggestion: Check if the transition target should be '${
                  childInfo.parentPath &&
                  typeof childInfo.parentPath === 'string'
                    ? childInfo.parentPath.replace(/#/g, '.') + '.' + childState
                    : childState
                }'`
              );
            }
          }
        }
      }

      // Return a minimal fallback machine to prevent complete failure
      console.warn('🔄 Creating fallback machine with basic structure...');
      return this.createFallbackMachine(scxmlDoc);
    }
  }

  private convertState(state: any): any {
    const stateId = this.getAttribute(state, 'id');
    if (!stateId) return null;

    const stateConfig: any = {};

    // Handle entry actions
    const onentry = this.getElements(state, 'onentry');
    if (onentry) {
      stateConfig.entry = this.convertActions(onentry);
    }

    // Handle exit actions
    const onexit = this.getElements(state, 'onexit');
    if (onexit) {
      stateConfig.exit = this.convertActions(onexit);
    }

    // Handle nested states (compound states)
    const childStates = this.getElements(state, 'state');
    const childParallels = this.getElements(state, 'parallel');
    const childHistories = this.getElements(state, 'history');

    if (childStates || childParallels || childHistories) {
      stateConfig.states = {};

      // Process child states
      if (childStates) {
        const childStatesArray = Array.isArray(childStates)
          ? childStates
          : [childStates];
        for (const childState of childStatesArray) {
          const childConfig = this.convertState(childState);
          const childId = this.getAttribute(childState, 'id');
          if (childId && childConfig) {
            const safeChildId = this.toSafeId(childId);
            if (safeChildId) {
              stateConfig.states[safeChildId] = childConfig;
            }
          }
        }
      }

      // Process child parallel states
      if (childParallels) {
        const childParallelsArray = Array.isArray(childParallels)
          ? childParallels
          : [childParallels];
        for (const childParallel of childParallelsArray) {
          const childConfig = this.convertParallelState(childParallel);
          const childId = this.getAttribute(childParallel, 'id');
          if (childId && childConfig) {
            const safeChildId = this.toSafeId(childId);
            if (safeChildId) {
              stateConfig.states[safeChildId] = childConfig;
            }
          }
        }
      }

      // Process history states - XState v5 compatible
      if (childHistories) {
        const childHistoriesArray = Array.isArray(childHistories)
          ? childHistories
          : [childHistories];
        for (const childHistory of childHistoriesArray) {
          const historyId = this.getAttribute(childHistory, 'id');
          const historyType =
            this.getAttribute(childHistory, 'type') || 'shallow';

          if (historyId) {
            // For XState v5, history states are handled with special configuration
            const historyConfig: any = {
              type: 'history',
              history: historyType === 'deep' ? 'deep' : 'shallow',
            };

            // Handle default transition for history (what to do if no history exists)
            const transitions = this.getElements(childHistory, 'transition');
            if (transitions) {
              const transitionsArray = Array.isArray(transitions)
                ? transitions
                : [transitions];
              for (const transition of transitionsArray) {
                const target = this.getAttribute(transition, 'target');
                if (target) {
                  const historyPath = this.buildStatePath(historyId);
                  const resolvedTarget = this.resolveTarget(
                    target,
                    historyPath
                  );
                  historyConfig.target = resolvedTarget;

                  break; // Only use the first default transition
                }
              }
            }

            const safeHistoryId = this.toSafeId(historyId);
            if (safeHistoryId) {
              stateConfig.states[safeHistoryId] = historyConfig;
            }
          }
        }
      }

      // Set initial child state
      const initial = this.getAttribute(state, 'initial');
      if (initial) {
        stateConfig.initial = this.toSafeId(initial);
      } else if (childStates.length > 0) {
        // If no initial state specified but has child states, use the first child as initial
        const firstChildId = this.getAttribute(childStates[0], 'id');
        if (firstChildId) {
          stateConfig.initial = this.toSafeId(firstChildId);
        }
      }
    }

    // Handle transitions
    const transitions = this.getElements(state, 'transition');
    if (transitions) {
      stateConfig.on = {};
      const transitionsArray = Array.isArray(transitions)
        ? transitions
        : [transitions];

      for (const transition of transitionsArray) {
        const event = this.getAttribute(transition, 'event');
        const target = this.getAttribute(transition, 'target');
        const cond = this.getAttribute(transition, 'cond');

        if (target) {
          // Build current state path for proper resolution
          const currentStatePath = this.buildStatePath(stateId);
          const resolvedTarget = this.resolveTarget(target, currentStatePath);
          const transitionConfig: any = { target: resolvedTarget };

          if (cond) {
            transitionConfig.guard = cond;
          }

          // Handle transition actions
          const actions = this.convertTransitionActions(transition);
          if (actions.length > 0) {
            transitionConfig.actions = actions;
          }

          if (event) {
            // Event-based transition
            if (!stateConfig.on) stateConfig.on = {};
            stateConfig.on[event] = transitionConfig;
          } else {
            // Always transition (no event)
            if (!stateConfig.always) stateConfig.always = [];
            stateConfig.always.push(transitionConfig);
          }
        }
      }
    }

    // Check if this is a final state
    const isFinal = state['@_type'] === 'final' || state.final !== undefined;
    if (isFinal) {
      stateConfig.type = 'final';
    }

    return stateConfig;
  }

  private convertStateToNode(
    state: any,
    initialStateId?: string,
    nodeIndex: number = 0,
    totalNodes: number = 1
  ): Node<SCXMLStateNodeData> | null {
    const stateId = this.getAttribute(state, 'id');
    if (!stateId) return null;

    // Extract visual metadata
    const visualMetadata = this.extractVisualMetadata(state);

    // Determine state type
    const childStates = this.getElements(state, 'state');
    const parallel = this.getElements(state, 'parallel');
    const isFinal = state['@_type'] === 'final';

    let stateType: SCXMLStateNodeData['stateType'] = 'simple';
    if (isFinal) {
      stateType = 'final';
    } else if (parallel) {
      stateType = 'parallel';
    } else if (childStates) {
      stateType = 'compound';
    }

    // Extract actions
    const onentry = this.getElements(state, 'onentry');
    const onexit = this.getElements(state, 'onexit');

    const entryActions = onentry ? this.extractActionsText(onentry) : [];
    const exitActions = onexit ? this.extractActionsText(onexit) : [];

    // Calculate better positioning
    let x: number, y: number;

    if (visualMetadata.x !== undefined && visualMetadata.y !== undefined) {
      // Use explicit visual metadata if available
      x = visualMetadata.x;
      y = visualMetadata.y;
    } else {
      // Calculate positions in a circle for better layout
      const centerX = 400;
      const centerY = 300;
      const radius = 150;

      if (totalNodes <= 1) {
        x = centerX;
        y = centerY;
      } else {
        const angle = (nodeIndex * 2 * Math.PI) / totalNodes - Math.PI / 2; // Start from top
        x = centerX + radius * Math.cos(angle);
        y = centerY + radius * Math.sin(angle);
      }
    }

    // Create the node with position and optional size from viz:xywh
    const node: any = {
      id: stateId,
      type: 'scxmlState',
      position: { x, y },
      data: {
        label: stateId,
        stateType,
        isInitial: stateId === initialStateId,
        entryActions,
        exitActions,
      },
    };

    // Add vizX/vizY if available from viz:xywh for position tracking
    if (visualMetadata.x !== undefined && visualMetadata.y !== undefined) {
      node.data.vizX = visualMetadata.x;
      node.data.vizY = visualMetadata.y;
      node.data.hasVizPosition = true; // Flag to indicate viz position exists
    }

    // Apply viz:xywh width/height at all levels for NodeResizer compatibility
    if (
      visualMetadata.width !== undefined &&
      visualMetadata.height !== undefined
    ) {
      // Top-level dimensions (required by NodeResizer)
      node.width = visualMetadata.width;
      node.height = visualMetadata.height;

      // Style-level dimensions
      node.style = {
        width: visualMetadata.width,
        height: visualMetadata.height,
      };

      // Data-level dimensions (for component access)
      node.data.width = visualMetadata.width;
      node.data.height = visualMetadata.height;
    }

    return node;
  }

  private convertTransitionToEdge(
    transition: any,
    sourceStateId: string
  ): Edge<SCXMLTransitionEdgeData> | null {
    const target = this.getAttribute(transition, 'target');
    if (!target) return null;

    const event = this.getAttribute(transition, 'event');
    const condition = this.getAttribute(transition, 'cond');
    const actions = this.convertTransitionActions(transition);

    // Track edge pairs for parallel transitions
    const edgePairKey = `${sourceStateId}->${target}`;
    const edgeCount = this.edgePairCounts.get(edgePairKey) || 0;
    this.edgePairCounts.set(edgePairKey, edgeCount + 1);

    // Parse the condition if present
    let conditionParsed = undefined;
    if (condition) {
      const parsed = ConditionEvaluator.parseCondition(condition);
      conditionParsed = {
        decoded: parsed.decoded,
        variables: parsed.variables,
        isComplex: parsed.isComplex,
      };
    }

    // Resolve the target - it should be the exact state ID
    // Don't split by dots as the ID itself might contain dots
    const finalTargetId = target;

    // Verify both source and target exist in our registry
    if (!this.stateRegistry.has(sourceStateId)) {
      console.warn(`Source state '${sourceStateId}' not found in registry`);
      return null;
    }

    if (!this.stateRegistry.has(finalTargetId!)) {
      console.warn(`Target state '${finalTargetId}' not found in registry`);
      return null;
    }

    // Generic solution: Skip transitions from a parent to its own children
    // This prevents container nodes from having edges to their child states
    const sourceState = this.stateRegistry.get(sourceStateId);
    if (
      sourceState &&
      sourceState.children &&
      sourceState.children.length > 0
    ) {
      // Check if the target is a child of this source
      if (sourceState.children.includes(finalTargetId!)) {
        return null;
      }
    }

    // Cross-hierarchy transition validation (Milestone 5 - 1C)
    // Skip transitions between states at different hierarchy levels
    const sourceParent = this.parentMap.get(sourceStateId);
    const targetParent = this.parentMap.get(finalTargetId!);

    // If both states have defined parents, check if they match
    if (sourceParent !== undefined && targetParent !== undefined) {
      if (sourceParent !== targetParent) {
        // Cross-hierarchy transition detected - skip this edge
        console.warn(
          `[Cross-Hierarchy Filter] Skipping transition from '${sourceStateId}' to '${finalTargetId}' - different hierarchy levels (source parent: '${sourceParent || 'root'}', target parent: '${targetParent || 'root'}')`
        );
        return null;
      }
    }

    // Generate unique edge ID - include condition hash for uniqueness
    const conditionHash =
      condition && typeof condition === 'string'
        ? `-${condition.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`
        : '';
    const randomSuffix = Math.random().toString(36).substring(7);
    const edgeId = `${sourceStateId}-to-${finalTargetId}-${
      event || 'always'
    }${conditionHash}-${randomSuffix}`;

    // Determine edge type based on transition characteristics
    let edgeType = 'smoothstep'; // Use ReactFlow's built-in smoothstep edge

    // Use step edge for conditional transitions for better visibility
    if (condition) {
      edgeType = 'step';
    }
    // Use straight edge for self-transitions
    else if (sourceStateId === finalTargetId) {
      edgeType = 'straight';
    }

    // Extract waypoints from viz:waypoints attribute
    const waypointsAttr = this.getAttribute(transition, 'viz:waypoints');
    let waypoints: Array<{ x: number; y: number }> | undefined;
    if (waypointsAttr) {
      waypoints = waypointsAttr
        .split(';')
        .map((point: string) => {
          const [x, y] = point
            .split(',')
            .map((s: string) => parseFloat(s.trim()));
          return !isNaN(x) && !isNaN(y) ? { x, y } : null;
        })
        .filter((wp: any): wp is { x: number; y: number } => wp !== null);

      console.log(
        `[Waypoints] Extracted from ${sourceStateId}→${target}:`,
        waypoints
      );
    }

    // Extract handle information from viz:sourceHandle and viz:targetHandle attributes
    const sourceHandleAttr = this.getAttribute(transition, 'viz:sourceHandle');
    const targetHandleAttr = this.getAttribute(transition, 'viz:targetHandle');

    // Set intelligent defaults: outgoing from bottom, incoming to top
    const sourceHandle = sourceHandleAttr || 'bottom';
    const targetHandle = targetHandleAttr || 'top';

    // For parallel transitions, use standard handles
    // The visual separation will be handled by edge routing/offset
    const edge: any = {
      id: edgeId,
      type: edgeType,
      source: sourceStateId,
      target: finalTargetId!,
      sourceHandle: sourceHandle,
      targetHandle: targetHandle,
      data: {
        event,
        condition,
        conditionParsed,
        actions,
        waypoints, // Add waypoints to edge data
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
      },
      // Add styling for better visibility
      animated: condition ? false : true, // Animate non-conditional transitions
      style: {
        strokeWidth: 2,
        stroke: condition ? '#ef4444' : '#3b82f6', // Red for conditional, blue for normal
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: condition ? '#ef4444' : '#3b82f6',
        width: 20,
        height: 20,
      },
      pathOptions: {
        offset: 20, // Offset from nodes
        curvature: 0.5, // How curved the edge is
      },
      zIndex: -1, // Put edges behind nodes
      label: event || '',
      labelStyle: {
        fill: 'white',
        fontWeight: 700,
        fontSize: 12,
      },
      labelBgPadding: [8, 4],
      labelBgBorderRadius: 4,
      labelBgStyle: {
        fill: condition ? '#ef4444' : '#3b82f6',
        fillOpacity: 0.9,
      },
    };

    // Optionally add handle IDs for better connection points
    // This helps ensure edges connect to the right handle positions
    // Can be enhanced to calculate optimal handles based on node positions

    return edge;
  }

  private convertActions(actionsElement: any): string[] {
    const actions: string[] = [];

    if (!actionsElement) return actions;

    // Handle different types of actions
    const logs = this.getElements(actionsElement, 'log');
    if (logs) {
      const logsArray = Array.isArray(logs) ? logs : [logs];
      for (const log of logsArray) {
        const label = this.getAttribute(log, 'label') || '';
        const expr = this.getAttribute(log, 'expr') || '';
        actions.push('log');
      }
    }

    const assigns = this.getElements(actionsElement, 'assign');
    if (assigns) {
      const assignsArray = Array.isArray(assigns) ? assigns : [assigns];
      for (const assign of assignsArray) {
        const location = this.getAttribute(assign, 'location') || '';
        const expr = this.getAttribute(assign, 'expr') || '';
        actions.push('assign');
      }
    }

    // Handle send elements (for now, we'll ignore delays and just note them)
    const sends = this.getElements(actionsElement, 'send');
    if (sends) {
      const sendsArray = Array.isArray(sends) ? sends : [sends];
      for (const send of sendsArray) {
        const event = this.getAttribute(send, 'event') || '';
        const delay = this.getAttribute(send, 'delay') || '';
        // For now, we'll just add a simple send action
        // In a full implementation, this would handle delays properly
        actions.push('send');
      }
    }

    return actions;
  }

  private convertTransitionActions(transition: any): string[] {
    const actions: string[] = [];

    // Inline actions on the transition element
    const logs = this.getElements(transition, 'log');
    if (logs) {
      const logsArray = Array.isArray(logs) ? logs : [logs];
      for (const log of logsArray) {
        const label = this.getAttribute(log, 'label') || '';
        const expr = this.getAttribute(log, 'expr') || '';
        actions.push(`log("${label}: ${expr}")`);
      }
    }

    return actions;
  }

  private convertDataModel(dataModel: any): Record<string, any> {
    const context: Record<string, any> = {};

    const dataElements = this.getElements(dataModel, 'data');
    if (dataElements) {
      const dataArray = Array.isArray(dataElements)
        ? dataElements
        : [dataElements];
      for (const data of dataArray) {
        const id = this.getAttribute(data, 'id');
        const expr = this.getAttribute(data, 'expr');
        const src = this.getAttribute(data, 'src');

        if (id) {
          if (expr) {
            // Try to parse as JSON or use as string
            try {
              context[id] = JSON.parse(expr);
            } catch {
              context[id] = expr;
            }
          } else if (src) {
            context[id] = `/* external: ${src} */`;
          } else if (data['#text']) {
            context[id] = data['#text'];
          }
        }
      }
    }

    return context;
  }

  private extractVisualMetadata(element: any): VisualMetadata {
    const metadata: VisualMetadata = {};
    const elementId = element['@_id'] || 'unknown';

    // Extract visual metadata from the viz namespace
    const vizXywh = this.getAttribute(element, 'viz:xywh');
    const vizRgb = this.getAttribute(element, 'viz:rgb');

    // Parse viz:xywh format: "x,y,width,height" (comma-separated)
    if (vizXywh && typeof vizXywh === 'string') {
      const parts = vizXywh
        .trim()
        .split(',')
        .map((p) => p.trim());
      if (parts.length >= 4) {
        metadata.x = parseFloat(parts[0]);
        metadata.y = parseFloat(parts[1]);
        metadata.width = parseFloat(parts[2]);
        metadata.height = parseFloat(parts[3]);
      }
    }

    // Parse viz:rgb for fill color - store as style for now
    if (vizRgb) {
      (metadata as any).fill = vizRgb;
    }

    return metadata;
  }

  private extractActionsText(actionsElement: any): string[] {
    const actions: string[] = [];

    if (Array.isArray(actionsElement)) {
      for (const element of actionsElement) {
        actions.push(...this.convertActions(element));
      }
    } else {
      actions.push(...this.convertActions(actionsElement));
    }

    return actions;
  }

  private getAttribute(element: any, attrName: string): string | undefined {
    return element?.[`@_${attrName}`] || element?.[attrName];
  }

  private getElements(parent: any, elementName: string): any {
    return parent?.[elementName];
  }

  /**
   * Recursively collect all state elements from the SCXML document
   */
  private collectAllStates(parent: any): any[] {
    const allStates: any[] = [];

    // Get direct state children
    const states = this.getElements(parent, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        allStates.push(state);
        // Recursively collect nested states
        allStates.push(...this.collectAllStates(state));
      }
    }

    // Also check parallel states for nested states
    const parallels = this.getElements(parent, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        allStates.push(...this.collectAllStates(parallel));
      }
    }

    return allStates;
  }

  /**
   * Recursively collect all parallel elements from the SCXML document
   */
  private collectAllParallelStates(parent: any): any[] {
    const allParallels: any[] = [];

    // Get direct parallel children
    const parallels = this.getElements(parent, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        allParallels.push(parallel);
        // Recursively collect nested parallels
        allParallels.push(...this.collectAllParallelStates(parallel));
      }
    }

    // Also check regular states for nested parallels
    const states = this.getElements(parent, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        allParallels.push(...this.collectAllParallelStates(state));
      }
    }

    return allParallels;
  }

  /**
   * Convert parallel state to React Flow node
   */
  private convertParallelToNode(
    parallel: any,
    initialStateId?: string,
    nodeIndex: number = 0,
    totalNodes: number = 1
  ): Node<SCXMLStateNodeData> | null {
    const parallelId = this.getAttribute(parallel, 'id');
    if (!parallelId) return null;

    // Extract visual metadata
    const visualMetadata = this.extractVisualMetadata(parallel);

    // Extract actions
    const onentry = this.getElements(parallel, 'onentry');
    const onexit = this.getElements(parallel, 'onexit');

    const entryActions = onentry ? this.extractActionsText(onentry) : [];
    const exitActions = onexit ? this.extractActionsText(onexit) : [];

    // Calculate positioning
    let x: number, y: number;

    if (visualMetadata.x !== undefined && visualMetadata.y !== undefined) {
      x = visualMetadata.x;
      y = visualMetadata.y;
    } else {
      // Position parallel states differently
      const centerX = 600;
      const centerY = 300;
      const radius = 200;

      if (totalNodes <= 1) {
        x = centerX;
        y = centerY;
      } else {
        const angle = (nodeIndex * 2 * Math.PI) / totalNodes;
        x = centerX + radius * Math.cos(angle);
        y = centerY + radius * Math.sin(angle);
      }
    }

    // Create the node with position and optional size from viz:xywh
    const node: any = {
      id: parallelId,
      type: 'scxmlState',
      position: { x, y },
      data: {
        label: parallelId,
        stateType: 'parallel',
        isInitial: parallelId === initialStateId,
        entryActions,
        exitActions,
      },
    };

    // Apply viz:xywh width/height at all levels for NodeResizer compatibility
    if (
      visualMetadata.width !== undefined &&
      visualMetadata.height !== undefined
    ) {
      // Top-level dimensions (required by NodeResizer)
      node.width = visualMetadata.width;
      node.height = visualMetadata.height;

      // Style-level dimensions
      node.style = {
        width: visualMetadata.width,
        height: visualMetadata.height,
      };

      // Data-level dimensions (for component access)
      node.data.width = visualMetadata.width;
      node.data.height = visualMetadata.height;
    }

    return node;
  }

  /**
   * Convert parallel state to XState configuration
   */
  private convertParallelState(parallel: any): any {
    const parallelId = this.getAttribute(parallel, 'id');
    if (!parallelId) return null;

    const parallelConfig: any = {
      type: 'parallel',
      states: {},
    };

    // Handle entry actions
    const onentry = this.getElements(parallel, 'onentry');
    if (onentry) {
      parallelConfig.entry = this.convertActions(onentry);
    }

    // Handle exit actions
    const onexit = this.getElements(parallel, 'onexit');
    if (onexit) {
      parallelConfig.exit = this.convertActions(onexit);
    }

    // Handle transitions at parallel level
    const transitions = this.getElements(parallel, 'transition');
    if (transitions) {
      parallelConfig.on = {};
      const transitionsArray = Array.isArray(transitions)
        ? transitions
        : [transitions];

      for (const transition of transitionsArray) {
        const event = this.getAttribute(transition, 'event');
        const target = this.getAttribute(transition, 'target');
        const cond = this.getAttribute(transition, 'cond');

        if (target) {
          // Build current state path for proper resolution
          const currentStatePath = this.buildStatePath(parallelId);
          const resolvedTarget = this.resolveTarget(target, currentStatePath);
          const transitionConfig: any = { target: resolvedTarget };

          if (cond) {
            transitionConfig.guard = cond;
          }

          // Handle transition actions
          const actions = this.convertTransitionActions(transition);
          if (actions.length > 0) {
            transitionConfig.actions = actions;
          }

          if (event) {
            parallelConfig.on[event] = transitionConfig;
          } else {
            // Always transition
            if (!parallelConfig.always) parallelConfig.always = [];
            parallelConfig.always.push(transitionConfig);
          }
        }
      }
    }

    // Process child states within the parallel region
    const childStates = this.getElements(parallel, 'state');
    if (childStates) {
      const childStatesArray = Array.isArray(childStates)
        ? childStates
        : [childStates];
      for (const childState of childStatesArray) {
        const childConfig = this.convertState(childState);
        const childId = this.getAttribute(childState, 'id');
        if (childId && childConfig) {
          const safeChildId = this.toSafeId(childId);
          if (safeChildId) {
            parallelConfig.states[safeChildId] = childConfig;
          }
        }
      }
    }

    return parallelConfig;
  }

  /**
   * Register all states in the SCXML document with their parent paths and hierarchy
   * Uses '#' as path separator to avoid conflicts with dots in state IDs
   */
  private registerAllStates(parent: any, parentPath: string): void {
    const parentId =
      parentPath && typeof parentPath === 'string'
        ? parentPath.split('#').pop()
        : null;
    const depth =
      parentPath && typeof parentPath === 'string'
        ? parentPath.split('#').length
        : 0;

    // Initialize parent's children array if not exists
    if (parentId && !this.hierarchyMap.has(parentId)) {
      this.hierarchyMap.set(parentId, []);
    }

    // Register regular states
    const states = this.getElements(parent, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        const stateId = this.getAttribute(state, 'id');
        if (stateId) {
          const fullPath = parentPath ? `${parentPath}#${stateId}` : stateId;

          // Check if this state has children (compound state)
          const hasChildren = this.hasChildStates(state);

          const registryEntry: StateRegistryEntry = {
            state,
            parentPath,
            children: [],
            isContainer: hasChildren,
            depth,
            elementType: 'state',
          };

          this.stateRegistry.set(stateId, registryEntry);

          // Update hierarchy maps
          if (parentId) {
            this.hierarchyMap.get(parentId)?.push(stateId);
            this.parentMap.set(stateId, parentId);
          }

          // Recursively register nested states FIRST (depth-first)
          // This ensures nested states are claimed before we collect children
          this.registerAllStates(state, fullPath);

          // After recursive call, collect children for this state
          // Only unclaimed states will be considered direct children
          if (hasChildren) {
            const childStates = this.collectDirectChildIds(state);
            registryEntry.children = childStates;
            this.hierarchyMap.set(stateId, childStates);

            // Mark these children as claimed so parent states won't claim them
            childStates.forEach((childId) => this.claimedStates.add(childId));
          }
        }
      }
    }

    // Register parallel states
    const parallels = this.getElements(parent, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        const parallelId = this.getAttribute(parallel, 'id');
        if (parallelId) {
          const fullPath = parentPath
            ? `${parentPath}#${parallelId}`
            : parallelId;

          const hasChildren = this.hasChildStates(parallel);

          const registryEntry: StateRegistryEntry = {
            state: parallel,
            parentPath,
            children: [],
            isContainer: true, // Parallel states are always containers
            depth,
            elementType: 'parallel',
          };

          this.stateRegistry.set(parallelId, registryEntry);

          // Update hierarchy maps
          if (parentId) {
            this.hierarchyMap.get(parentId)?.push(parallelId);
            this.parentMap.set(parallelId, parentId);
          }

          // Recursively register nested states within parallel FIRST
          this.registerAllStates(parallel, fullPath);

          // After recursive call, collect children for this parallel state
          // Only unclaimed states will be considered direct children
          const childStates = this.collectDirectChildIds(parallel);
          registryEntry.children = childStates;
          this.hierarchyMap.set(parallelId, childStates);

          // Mark these children as claimed
          childStates.forEach((childId) => this.claimedStates.add(childId));
        }
      }
    }

    // Register history states
    const histories = this.getElements(parent, 'history');
    if (histories) {
      const historiesArray = Array.isArray(histories) ? histories : [histories];
      for (const history of historiesArray) {
        const historyId = this.getAttribute(history, 'id');
        if (historyId) {
          const fullPath = parentPath
            ? `${parentPath}#${historyId}`
            : historyId;

          const registryEntry: StateRegistryEntry = {
            state: history,
            parentPath,
            children: [],
            isContainer: false,
            depth,
            elementType: 'history',
          };

          this.stateRegistry.set(historyId, registryEntry);

          // Update hierarchy maps
          if (parentId) {
            this.hierarchyMap.get(parentId)?.push(historyId);
            this.parentMap.set(historyId, parentId);
          }
        }
      }
    }
  }

  /**
   * Check if a state element has child states
   */
  private hasChildStates(element: any): boolean {
    const childStates = this.getElements(element, 'state');
    const childParallels = this.getElements(element, 'parallel');
    const childHistories = this.getElements(element, 'history');

    return !!(childStates || childParallels || childHistories);
  }

  /**
   * Collect direct child state IDs from an element
   * Only returns states that haven't been claimed by other parents
   */
  private collectDirectChildIds(element: any): string[] {
    const childIds: string[] = [];
    const elementId = this.getAttribute(element, 'id') || 'unknown';

    // Collect child states - only those not already claimed
    const states = this.getElements(element, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];

      for (const state of statesArray) {
        const stateId = this.getAttribute(state, 'id');
        if (!stateId) continue;

        // Only add if not already claimed by another parent
        if (!this.claimedStates.has(stateId)) {
          childIds.push(stateId);
        }
      }
    }

    // Collect child parallel states - only those not already claimed
    const parallels = this.getElements(element, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];

      for (const parallel of parallelsArray) {
        const parallelId = this.getAttribute(parallel, 'id');
        if (!parallelId) continue;

        // Only add if not already claimed by another parent
        if (!this.claimedStates.has(parallelId)) {
          childIds.push(parallelId);
        }
      }
    }

    // Collect child history states - only those not already claimed
    const histories = this.getElements(element, 'history');
    if (histories) {
      const historiesArray = Array.isArray(histories) ? histories : [histories];

      for (const history of historiesArray) {
        const historyId = this.getAttribute(history, 'id');
        if (!historyId) continue;

        // Only add if not already claimed by another parent
        if (!this.claimedStates.has(historyId)) {
          childIds.push(historyId);
        }
      }
    }

    return childIds;
  }

  /**
   * Get hierarchy information
   */
  getHierarchyMap(): Map<string, string[]> {
    return this.hierarchyMap;
  }

  /**
   * Get parent mapping
   */
  getParentMap(): Map<string, string> {
    return this.parentMap;
  }

  /**
   * Get children of a specific state
   */
  getChildren(stateId: string): string[] {
    return this.hierarchyMap.get(stateId) || [];
  }

  /**
   * Get parent of a specific state
   */
  getParent(stateId: string): string | undefined {
    return this.parentMap.get(stateId);
  }

  /**
   * Find a state by ID anywhere in the hierarchy
   */
  findStateById(stateId: string): StateRegistryEntry | undefined {
    return this.stateRegistry.get(stateId);
  }

  /**
   * Find all states that match a given ID (for duplicate detection)
   */
  findAllStatesByIdPattern(pattern: string): StateRegistryEntry[] {
    const matches: StateRegistryEntry[] = [];
    for (const [id, entry] of this.stateRegistry) {
      if (id === pattern || id.includes(pattern)) {
        matches.push(entry);
      }
    }
    return matches;
  }

  /**
   * Get the common ancestor of two states
   */
  findCommonAncestor(stateId1: string, stateId2: string): string | null {
    const ancestors1 = this.getAncestorChain(stateId1);
    const ancestors2 = this.getAncestorChain(stateId2);

    // Find the deepest common ancestor
    let commonAncestor: string | null = null;
    const minLength = Math.min(ancestors1.length, ancestors2.length);

    for (let i = 0; i < minLength; i++) {
      if (ancestors1[i] === ancestors2[i]) {
        commonAncestor = ancestors1[i];
      } else {
        break;
      }
    }

    return commonAncestor;
  }

  /**
   * Get the chain of ancestors from root to the given state
   */
  getAncestorChain(stateId: string): string[] {
    const chain: string[] = [];
    const entry = this.stateRegistry.get(stateId);
    if (!entry) return chain;

    // Build chain from parent path
    if (entry.parentPath && typeof entry.parentPath === 'string') {
      const pathParts = entry.parentPath.split('#');
      chain.push(...pathParts);
    }

    return chain;
  }

  /**
   * Check if state1 is an ancestor of state2
   */
  isAncestor(ancestorId: string, descendantId: string): boolean {
    const descendantEntry = this.stateRegistry.get(descendantId);
    if (!descendantEntry || !descendantEntry.parentPath) return false;

    const ancestorChain = this.getAncestorChain(descendantId);
    return ancestorChain.includes(ancestorId);
  }

  /**
   * Check if two states are siblings (have the same parent)
   */
  areSiblings(stateId1: string, stateId2: string): boolean {
    const parent1 = this.parentMap.get(stateId1);
    const parent2 = this.parentMap.get(stateId2);

    // Both are root level (no parents) or have the same parent
    return parent1 === parent2;
  }

  /**
   * Get all sibling states of a given state
   */
  getSiblings(stateId: string): string[] {
    const parent = this.parentMap.get(stateId);
    if (!parent) {
      // Root level siblings - all states with no parent
      return Array.from(this.stateRegistry.keys()).filter(
        (id) => id !== stateId && !this.parentMap.has(id)
      );
    } else {
      // Get all children of the same parent, excluding the state itself
      const siblings = this.hierarchyMap.get(parent) || [];
      return siblings.filter((id) => id !== stateId);
    }
  }

  /**
   * Check if a state is a container (compound or parallel)
   */
  isContainer(stateId: string): boolean {
    const entry = this.stateRegistry.get(stateId);
    return entry?.isContainer || false;
  }

  /**
   * Resolve a target state ID to the proper XState path
   * Comprehensive solution handling all transition scenarios
   */
  private resolveTarget(
    targetId: string,
    currentStatePath: string = ''
  ): string {
    if (!targetId) return targetId;

    // Verify target exists in registry
    const targetInfo = this.stateRegistry.get(targetId);
    if (!targetInfo) {
      console.warn(`⚠️ Target '${targetId}' not in registry, using as-is`);
      return this.toSafeId(targetId) || targetId;
    }

    // Get current state information
    const currentStateId = currentStatePath
      ? currentStatePath.split('#').pop()
      : '';
    if (!currentStateId) {
      const safeTarget = this.toSafeId(targetId) || targetId;
      return safeTarget;
    }

    // Build the relative path from current state to target
    const relativePath = this.buildRelativePath(currentStateId, targetId);
    return relativePath;
  }

  /**
   * Build the correct relative path from source to target state
   * Handles all nesting levels and compound state scenarios
   */
  private buildRelativePath(sourceId: string, targetId: string): string {
    // Case 1: Target is child of source
    const sourceChildren = this.getChildren(sourceId);

    if (sourceChildren.includes(targetId)) {
      const safeTarget = this.toSafeId(targetId) || targetId;
      return safeTarget;
    }

    // Case 2: Same parent (direct siblings)
    const sourceParent = this.getParent(sourceId);
    const targetParent = this.getParent(targetId);

    if (sourceParent && sourceParent === targetParent) {
      const safeTarget = this.toSafeId(targetId) || targetId;

      // IMPORTANT: For transitions defined at compound state level to siblings,
      // XState needs '../target' syntax
      // Check if source is a compound state with children
      const sourceIsCompound = this.getChildren(sourceId).length > 0;
      if (sourceIsCompound) {
        return '../' + safeTarget;
      }

      return safeTarget;
    }

    // Case 3: Complex navigation - find lowest common ancestor
    const commonAncestor = this.findLowestCommonAncestor(sourceId, targetId);

    if (!commonAncestor) {
      // No common ancestor, try simple reference
      const safeTarget = this.toSafeId(targetId) || targetId;
      return safeTarget;
    }

    // Calculate how many levels up from source to common ancestor
    const levelsUp = this.calculateLevelsUp(sourceId, commonAncestor);

    // Build the path down from common ancestor to target
    const pathDown = this.buildPathDown(commonAncestor, targetId);

    // Special handling: if source and target are siblings (same parent)
    // but we ended up here, it means we need to use ../target
    if (levelsUp === 1 && pathDown === this.toSafeId(targetId)) {
      // Direct sibling relationship through parent navigation
      return '../' + pathDown;
    }

    // Combine the navigation
    if (levelsUp > 0) {
      // Need to go up levels first
      const upNavigation = '../'.repeat(levelsUp);

      if (pathDown) {
        // Go up then down to target
        return upNavigation + pathDown;
      } else {
        // Target is the common ancestor or direct child of it
        const safeTarget = this.toSafeId(targetId) || targetId;
        const fullPath = upNavigation.slice(0, -1); // Remove trailing /
        return fullPath || safeTarget;
      }
    } else {
      // Target is descendant of current state's ancestor
      return pathDown;
    }
  }

  /**
   * Find the lowest common ancestor of two states
   */
  private findLowestCommonAncestor(
    state1Id: string,
    state2Id: string
  ): string | null {
    const ancestors1 = this.getAncestorChain(state1Id);
    const ancestors2 = this.getAncestorChain(state2Id);

    // Find the deepest common ancestor
    let commonAncestor: string | null = null;
    const minLength = Math.min(ancestors1.length, ancestors2.length);

    for (let i = 0; i < minLength; i++) {
      if (ancestors1[i] === ancestors2[i]) {
        commonAncestor = ancestors1[i];
      } else {
        break;
      }
    }

    return commonAncestor;
  }

  /**
   * Calculate how many levels to go up from source to reach ancestor
   */
  private calculateLevelsUp(
    sourceId: string,
    ancestorId: string | null
  ): number {
    if (!ancestorId) return 0;

    let levels = 0;
    let currentId = sourceId;

    while (currentId && currentId !== ancestorId) {
      const parent = this.getParent(currentId);
      if (!parent) break;

      levels++;
      currentId = parent;

      // Safety check to prevent infinite loops
      if (levels > 20) {
        console.warn(`   ⚠️ Excessive nesting depth detected`);
        break;
      }
    }

    return levels;
  }

  /**
   * Build the path down from ancestor to target
   */
  private buildPathDown(ancestorId: string, targetId: string): string {
    if (ancestorId === targetId) {
      return '';
    }

    // Get the chain from target up to (but not including) ancestor
    const pathParts: string[] = [];
    let currentId = targetId;

    while (currentId && currentId !== ancestorId) {
      const safeId = this.toSafeId(currentId) || currentId;
      pathParts.unshift(safeId);

      const parent = this.getParent(currentId);
      if (!parent || parent === ancestorId) {
        break;
      }
      currentId = parent;
    }

    return pathParts.join('.');
  }

  /**
   * Get only direct transitions of a state (not nested in child states)
   */
  private getDirectTransitions(state: any): any[] {
    const transitions: any[] = [];

    if (!state) return transitions;

    // For XML structure, we need to get only direct children transitions
    // Not transitions nested within child states
    const allChildren = Array.isArray(state) ? state : [state];

    for (const child of allChildren) {
      if (typeof child === 'object' && child !== null) {
        // Look for transitions at this level
        if (child.transition) {
          const trans = Array.isArray(child.transition)
            ? child.transition
            : [child.transition];
          transitions.push(...trans);
        }

        // In XML, direct transitions might be immediate properties
        const keys = Object.keys(child);
        for (const key of keys) {
          if (key === 'transition') {
            continue; // Already handled
          }
          // Skip nested states - we don't want their transitions
          if (key === 'state' || key === 'parallel' || key === 'history') {
            continue;
          }
        }
      }
    }

    return transitions;
  }

  /**
   * Check if a state is a descendant of another state
   */
  private isDescendantOf(descendantId: string, ancestorId: string): boolean {
    let currentId = descendantId;

    while (currentId) {
      const parent = this.getParent(currentId);
      if (parent === ancestorId) {
        return true;
      }
      currentId = parent || '';
    }

    return false;
  }

  /**
   * Find the compound parent state that contains the given state
   */
  private findCompoundParent(stateId: string): string | null {
    // Get the parent of the current state
    let currentId = stateId;

    while (currentId) {
      const parentId = this.getParent(currentId);
      if (!parentId) {
        // Reached root
        return null;
      }

      // Check if parent is a compound state (has children)
      const parentInfo = this.stateRegistry.get(parentId);
      if (parentInfo && parentInfo.isContainer) {
        return parentId;
      }

      currentId = parentId;
    }

    return null;
  }

  /**
   * Check if a target state is within a specific compound state
   */
  private isWithinCompound(
    targetId: string,
    compoundId: string | null
  ): boolean {
    if (!compoundId) {
      // No compound parent means we're at root level
      return true; // All root-level transitions are "within" the root
    }

    // Check if target is a descendant of the compound
    let currentId = targetId;

    while (currentId) {
      const parentId = this.getParent(currentId);

      if (parentId === compoundId) {
        // Found the compound as an ancestor
        return true;
      }

      if (!parentId) {
        // Reached root without finding the compound
        return false;
      }

      currentId = parentId;
    }

    return false;
  }

  /**
   * Get full ancestor chain including the state itself
   */
  private getFullAncestorChain(stateId: string): string[] {
    const chain: string[] = [];
    const stateInfo = this.stateRegistry.get(stateId);

    if (stateInfo?.parentPath) {
      const pathParts = stateInfo.parentPath.split('#');
      chain.push(...pathParts);
    }

    return chain;
  }

  /**
   * Find the length of the common ancestor path between two state paths
   */
  private findCommonAncestorLength(path1: string[], path2: string[]): number {
    let commonLength = 0;
    const minLength = Math.min(path1.length, path2.length);

    for (let i = 0; i < minLength; i++) {
      if (path1[i] === path2[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    return commonLength;
  }

  /**
   * Get parent path from a full state path
   */
  private getParentPath(statePath: string): string {
    if (typeof statePath !== 'string') {
      console.warn('statePath is not a string:', statePath);
      return '';
    }
    const parts = statePath.split('#');
    return parts.length > 1 ? parts.slice(0, -1).join('#') : '';
  }

  /**
   * Build the full state path for a given state ID
   * Uses '#' as separator to avoid conflicts with dots in state IDs
   */
  private buildStatePath(stateId: string): string {
    const stateInfo = this.stateRegistry.get(stateId);
    if (!stateInfo) {
      return stateId;
    }

    return stateInfo.parentPath
      ? `${stateInfo.parentPath}#${stateId}`
      : stateId;
  }

  /**
   * Convert a registered state to a React Flow node with hierarchical positioning
   */
  private convertStateToNodeHierarchical(
    stateId: string,
    stateInfo: { state: any; parentPath: string }
  ): Node<SCXMLStateNodeData> | null {
    const state = stateInfo.state;
    const parentPath = stateInfo.parentPath;

    // Determine state type
    const tagName =
      state['#name'] ||
      Object.keys(state).find(
        (key) => !key.startsWith('@_') && !key.startsWith('#')
      );
    let stateType: SCXMLStateNodeData['stateType'] = 'simple';

    if (tagName === 'parallel' || state['@_type'] === 'parallel') {
      stateType = 'parallel';
    } else if (tagName === 'history') {
      stateType = 'simple'; // History states shown as simple nodes with special styling
    } else if (
      this.getElements(state, 'state') ||
      this.getElements(state, 'parallel')
    ) {
      stateType = 'compound';
    } else if (state['@_type'] === 'final' || tagName === 'final') {
      stateType = 'final';
    }

    // Extract actions
    const onentry = this.getElements(state, 'onentry');
    const onexit = this.getElements(state, 'onexit');
    const entryActions = onentry ? this.extractActionsText(onentry) : [];
    const exitActions = onexit ? this.extractActionsText(onexit) : [];

    // Calculate hierarchical position
    const position = this.calculateHierarchicalPosition(stateId, parentPath);

    // Check if this is an initial state
    const isInitial = this.isInitialState(stateId, parentPath);

    return {
      id: stateId,
      type: 'scxmlState',
      position,
      data: {
        label: stateId,
        stateType,
        isInitial,
        entryActions,
        exitActions,
      },
    };
  }

  /**
   * Calculate hierarchical position for a state based on its parent path
   */
  private calculateHierarchicalPosition(
    stateId: string,
    parentPath: string
  ): { x: number; y: number } {
    const baseX = 100;
    const baseY = 100;

    if (!parentPath) {
      // Root level states - arrange horizontally
      const rootStates = Array.from(this.stateRegistry.entries())
        .filter(([_, info]) => !info.parentPath)
        .map(([id]) => id);
      const index = rootStates.indexOf(stateId);

      return {
        x: baseX + index * 400, // More spacing for root states
        y: baseY,
      };
    }

    // Get parent information for relative positioning
    const parentParts =
      typeof parentPath === 'string' ? parentPath.split('#') : [];
    const immediateParent = parentParts[parentParts.length - 1];
    const depth = parentParts.length;

    // Get siblings at the same level
    const siblingsInParent = Array.from(this.stateRegistry.entries())
      .filter(([_, info]) => info.parentPath === parentPath)
      .map(([id]) => id)
      .sort(); // Sort for consistent ordering

    const siblingIndex = siblingsInParent.indexOf(stateId);
    const totalSiblings = siblingsInParent.length;

    // Special positioning for known patterns
    if (immediateParent === 'Airplane') {
      // Children of Airplane state
      switch (stateId) {
        case 'Refuel':
          return { x: 200, y: 300 };
        case 'Engines':
          return { x: 600, y: 300 };
        case 'AirplaneHistory':
          return { x: 400, y: 450 };
        default:
          return { x: 300 + siblingIndex * 200, y: 300 };
      }
    }

    if (immediateParent === 'Engines') {
      // Parallel engine states - side by side
      switch (stateId) {
        case 'Left':
          return { x: 500, y: 500 };
        case 'Right':
          return { x: 700, y: 500 };
        default:
          return { x: 500 + siblingIndex * 200, y: 500 };
      }
    }

    if (immediateParent === 'Left' || immediateParent === 'Right') {
      // Engine sub-states - vertical arrangement
      const baseXForEngine = immediateParent === 'Left' ? 450 : 650;
      return {
        x: baseXForEngine,
        y: 600 + siblingIndex * 120,
      };
    }

    // Default hierarchical positioning
    const parentBaseX = baseX + (depth - 1) * 250;
    const parentBaseY = baseY + (depth - 1) * 150;

    // Arrange siblings in a grid pattern
    const columns = Math.min(3, totalSiblings);
    const row = Math.floor(siblingIndex / columns);
    const col = siblingIndex % columns;

    return {
      x: parentBaseX + col * 180,
      y: parentBaseY + row * 120,
    };
  }

  /**
   * Check if a state is an initial state in its parent context
   */
  private isInitialState(stateId: string, parentPath: string): boolean {
    if (!parentPath) {
      // Check if it's the root initial state
      const rootInitial = this.getAttribute(this.rootScxml, 'initial');
      if (stateId === rootInitial) return true;

      // Also check for <initial> element at root
      const initialElement = this.getElements(this.rootScxml, 'initial');
      if (initialElement) {
        const transition = this.getElements(initialElement, 'transition');
        if (transition) {
          const target = this.getAttribute(transition, 'target');
          if (stateId === target) return true;
        }
      }

      return false;
    }

    // Find parent state and check its initial attribute
    const parentId =
      typeof parentPath === 'string' ? parentPath.split('#').pop() : null;
    if (parentId) {
      const parentInfo = this.stateRegistry.get(parentId);
      if (parentInfo) {
        const parentInitial = this.getAttribute(parentInfo.state, 'initial');
        if (stateId === parentInitial) return true;

        // Also check for <initial> element in parent
        const initialElement = this.getElements(parentInfo.state, 'initial');
        if (initialElement) {
          const transition = this.getElements(initialElement, 'transition');
          if (transition) {
            const target = this.getAttribute(transition, 'target');
            if (stateId === target) return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Recursively collect all transitions from the SCXML document
   */
  private collectAllTransitions(
    parent: any,
    edges: Edge[],
    parentStateId?: string
  ): void {
    // Get the current element's state ID
    const currentStateId = this.getAttribute(parent, 'id') || parentStateId;

    // Process transitions in current element
    const transitions = this.getElements(parent, 'transition');
    if (transitions && currentStateId) {
      const transitionsArray = Array.isArray(transitions)
        ? transitions
        : [transitions];
      for (const transition of transitionsArray) {
        const edge = this.convertTransitionToEdge(transition, currentStateId);
        if (edge) {
          edges.push(edge);
        }
      }
    }

    // Recursively process child states
    const states = this.getElements(parent, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        this.collectAllTransitions(state, edges);
      }
    }

    // Recursively process parallel states
    const parallels = this.getElements(parent, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        this.collectAllTransitions(parallel, edges);
      }
    }

    // Process history states
    const histories = this.getElements(parent, 'history');
    if (histories) {
      const historiesArray = Array.isArray(histories) ? histories : [histories];
      for (const history of historiesArray) {
        this.collectAllTransitions(history, edges);
      }
    }

    // Process initial elements (they can contain transitions)
    const initials = this.getElements(parent, 'initial');
    if (initials) {
      const initialsArray = Array.isArray(initials) ? initials : [initials];
      for (const initial of initialsArray) {
        // Initial transitions should come from the parent state
        this.collectAllTransitions(initial, edges, currentStateId);
      }
    }
  }

  /**
   * Remove old methods that are no longer needed
   */

  /**
   * Validate all transitions in the converted config
   */
  private validateTransitions(config: XStateMachineConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Helper to check if a target is valid
    const isValidTarget = (target: string): boolean => {
      // For validation, we need to check against the original state IDs
      // Target might be a safe ID or a path with safe IDs

      // First try to find it directly in the registry
      for (const originalId of this.stateRegistry.keys()) {
        const safeId = this.toSafeId(originalId);
        if (safeId === target) {
          return true;
        }
      }

      // If target contains dots, it might be a path
      if (typeof target === 'string' && target.includes('.')) {
        // Check if the last segment matches a safe ID
        const lastSegment = target.split('.').pop();
        if (lastSegment) {
          for (const originalId of this.stateRegistry.keys()) {
            const safeId = this.toSafeId(originalId);
            if (safeId === lastSegment) {
              return true;
            }
          }
        }
      }

      return false;
    };

    const validateStateTransitions = (stateConfig: any, statePath: string) => {
      if (stateConfig.on) {
        for (const [event, transition] of Object.entries(stateConfig.on)) {
          const trans = transition as any;
          if (trans.target && !isValidTarget(trans.target)) {
            errors.push(
              `Invalid transition target '${trans.target}' in state '${statePath}' for event '${event}'`
            );
          }
        }
      }

      if (stateConfig.always) {
        const alwaysArray = Array.isArray(stateConfig.always)
          ? stateConfig.always
          : [stateConfig.always];
        for (const trans of alwaysArray) {
          if (trans.target && !isValidTarget(trans.target)) {
            errors.push(
              `Invalid always transition target '${trans.target}' in state '${statePath}'`
            );
          }
        }
      }

      // Recursively validate nested states
      if (stateConfig.states) {
        for (const [childId, childConfig] of Object.entries(
          stateConfig.states
        )) {
          validateStateTransitions(childConfig, `${statePath}.${childId}`);
        }
      }
    };

    for (const [stateId, stateConfig] of Object.entries(config.states)) {
      validateStateTransitions(stateConfig, stateId);
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Create a fallback machine when the main conversion fails
   */
  private createFallbackMachine(scxmlDoc: SCXMLDocument) {
    const scxml = scxmlDoc.scxml;
    const machineName = this.getAttribute(scxml, 'name') || 'fallbackMachine';

    // Create a simple machine with just the states we can identify
    const fallbackConfig = {
      id: machineName,
      initial: 'error',
      states: {
        error: {
          on: {
            RETRY: 'error',
          },
        },
      },
    };

    // Add any top-level states we can safely identify
    const states = this.getElements(scxml, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      const firstState = statesArray[0];
      const firstStateId = this.getAttribute(firstState, 'id');

      if (firstStateId) {
        fallbackConfig.initial = firstStateId;
        fallbackConfig.states = {
          [firstStateId]: {
            on: {
              '*': firstStateId, // Self-loop to prevent crashes
            },
          },
          error: {
            on: {
              RETRY: firstStateId,
            },
          },
        };
      }
    }

    return setup({}).createMachine(fallbackConfig);
  }

  /**
   * Apply ELK layout to a graph of nodes and edges
   * This is an async post-processing step that can be called after convertToReactFlow
   */
  async applyELKLayout(
    nodes: Node[],
    edges: Edge[],
    options: ELKLayoutOptions = {}
  ): Promise<Node[]> {
    // Convert to HierarchicalNode format
    const hierarchicalNodes: HierarchicalNode[] = nodes.map((node) => ({
      ...node,
      depth: node.parentId ? 1 : 0,
      childIds: nodes.filter((n) => n.parentId === node.id).map((n) => n.id),
    })) as HierarchicalNode[];

    // Apply ELK layout
    const positions = await elkLayoutService.computeLayout(
      hierarchicalNodes,
      edges,
      {
        algorithm: options.algorithm || 'layered',
        direction: options.direction || 'DOWN',
        edgeRouting: options.edgeRouting || 'ORTHOGONAL',
        spacing: options.spacing || {
          nodeNode: 80,
          edgeNode: 40,
          edgeEdge: 20,
        },
        padding: options.padding || {
          top: 50,
          right: 50,
          bottom: 50,
          left: 50,
        },
        hierarchical: options.hierarchical ?? true,
      }
    );

    // Apply positions to nodes
    return nodes.map((node) => {
      const pos = positions.get(node.id);
      if (pos) {
        return {
          ...node,
          position: { x: pos.x, y: pos.y },
          style: {
            ...node.style,
            width: pos.width,
            height: pos.height,
          },
        };
      }
      return node;
    });
  }
}
