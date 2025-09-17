import { setup, createMachine, type StateNode } from 'xstate';
import type { SCXMLElement, SCXMLDocument } from '@/types/scxml';
import type { Node, Edge } from 'reactflow';
import type {
  SCXMLStateNodeData,
  SCXMLTransitionEdgeData,
} from '@/components/diagram';
import type {
  HierarchicalNode,
  CompoundStateNodeData,
  HierarchicalLayout,
  LayoutStrategy,
  Rectangle,
} from '@/types/hierarchical-node';
import { ContainerLayoutManager } from '@/lib/layout/container-layout-manager';

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
  /**
   * Convert SCXML document to XState machine configuration
   */
  convertToXState(scxmlDoc: SCXMLDocument): XStateMachineConfig {
    const scxml = scxmlDoc.scxml;
    this.rootScxml = scxml;
    this.stateRegistry.clear();

    // First pass: register all states with their parent paths
    this.registerAllStates(scxml, '');

    const config: XStateMachineConfig = {
      id: this.getAttribute(scxml, 'name') || 'scxmlMachine',
      initial: this.getAttribute(scxml, 'initial'),
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
          config.states[stateId] = stateConfig;
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
          config.states[parallelId] = parallelConfig;
        }
      }
    }

    // Process data model for context
    const dataModel = this.getElements(scxml, 'datamodel');
    if (dataModel) {
      config.context = this.convertDataModel(dataModel);
    }

    // Validate transitions
    const validation = this.validateTransitions(config);
    if (!validation.isValid) {
      console.warn('Transition validation errors:', validation.errors);
      // Continue anyway but log the issues
    }

    console.log('Generated XState config:', JSON.stringify(config, null, 2));
    return config;
  }

  /**
   * Convert SCXML document to React Flow nodes and edges with hierarchical layout
   */
  convertToReactFlow(scxmlDoc: SCXMLDocument): {
    nodes: Node[];
    edges: Edge[];
  } {
    const scxml = scxmlDoc.scxml;
    this.rootScxml = scxml;

    console.log('🎆 Starting hierarchical React Flow conversion...');

    // First, ensure state registry is populated
    if (this.stateRegistry.size === 0) {
      console.log('State registry empty, populating...');
      this.stateRegistry.clear();
      this.hierarchyMap.clear();
      this.parentMap.clear();
      this.registerAllStates(scxml, '');
    }

    const layoutManager = new ContainerLayoutManager();
    const hierarchicalLayout = this.createHierarchicalLayout(layoutManager);

    console.log(
      `🎉 Hierarchical conversion complete: ${hierarchicalLayout.nodes.length} nodes, ${hierarchicalLayout.edges.length} edges`
    );

    // Debug output
    console.log('Generated hierarchical nodes:');
    hierarchicalLayout.nodes.forEach((node) => {
      console.log(
        `  ${node.id}: type=${node.data.stateType}, container=${
          (node.data as any).children?.length || 0
        } children, depth=${node.depth}`
      );
    });

    return {
      nodes: hierarchicalLayout.nodes,
      edges: hierarchicalLayout.edges,
    };
  }

  /**
   * Create hierarchical layout with proper visual containment
   */
  private createHierarchicalLayout(
    layoutManager: ContainerLayoutManager
  ): HierarchicalLayout {
    const allNodes: HierarchicalNode[] = [];
    const edges: Edge[] = [];

    // First pass: Create all nodes with basic information
    const stateEntries = Array.from(this.stateRegistry.entries());
    console.log('Creating', stateEntries.length, 'hierarchical nodes...');

    for (const [stateId, stateInfo] of stateEntries) {
      const node = this.createHierarchicalNode(stateId, stateInfo);
      if (node) {
        allNodes.push(node);
      }
    }

    // Filter to only include root-level nodes (nodes without parents) for ReactFlow
    const rootNodes = allNodes.filter((node) => !node.parentId);
    console.log(
      `Filtered to ${rootNodes.length} root nodes from ${allNodes.length} total nodes`
    );

    // For each container node, attach all its descendant nodes
    rootNodes.forEach((rootNode) => {
      if (rootNode.childIds && rootNode.childIds.length > 0) {
        const descendants = this.getAllDescendants(rootNode.id, allNodes);
        (rootNode.data as any).descendants = descendants;
        console.log(
          `🔍 Container ${rootNode.id} has ${descendants.length} descendants:`
        );
        descendants.forEach((desc) => {
          console.log(
            `  - ${desc.id} (parent: ${desc.parentId}, position: ${
              desc.position?.x || 0
            }, ${desc.position?.y || 0})`
          );
        });
      } else {
        console.log(
          `🔍 Node ${rootNode.id} has no children, skipping descendant attachment`
        );
      }
    });

    // Position container nodes and their children
    this.positionHierarchicalNodes(allNodes, layoutManager);

    // Update descendant data with the new positions after layout
    rootNodes.forEach((rootNode) => {
      if (rootNode.childIds && rootNode.childIds.length > 0) {
        const updatedDescendants = this.getAllDescendants(
          rootNode.id,
          allNodes
        );
        (rootNode.data as any).descendants = updatedDescendants;
        console.log(`📐 Updated positions for container ${rootNode.id}:`);
        updatedDescendants.forEach((desc) => {
          console.log(
            `  - ${desc.id} positioned at (${desc.position?.x || 0}, ${
              desc.position?.y || 0
            })`
          );
        });
      }
    });

    // Convert transitions to edges
    console.log('Converting transitions to edges...');
    this.collectAllTransitions(this.rootScxml, edges);

    return {
      nodes: rootNodes, // Only return root nodes for ReactFlow
      edges,
      hierarchy: this.hierarchyMap,
      parentMap: this.parentMap,
    };
  }

  /**
   * Get all descendant nodes of a given parent
   */
  private getAllDescendants(
    parentId: string,
    allNodes: HierarchicalNode[]
  ): HierarchicalNode[] {
    const descendants: HierarchicalNode[] = [];
    const directChildren = allNodes.filter(
      (node) => node.parentId === parentId
    );

    for (const child of directChildren) {
      descendants.push(child);
      // Recursively get descendants of this child
      const childDescendants = this.getAllDescendants(child.id, allNodes);
      descendants.push(...childDescendants);
    }

    return descendants;
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

    // Extract visual metadata
    const visualMetadata = this.extractVisualMetadata(state);

    // Extract actions
    const onentry = this.getElements(state, 'onentry');
    const onexit = this.getElements(state, 'onexit');
    const entryActions = onentry ? this.extractActionsText(onentry) : [];
    const exitActions = onexit ? this.extractActionsText(onexit) : [];

    // Determine node type
    let nodeType = 'scxmlState';
    let stateType: SCXMLStateNodeData['stateType'] = 'simple';

    if (stateInfo.elementType === 'parallel') {
      nodeType = 'scxmlCompound'; // We'll use the same component for parallel
      stateType = 'parallel';
    } else if (stateInfo.elementType === 'history') {
      stateType = 'simple'; // History states shown as simple nodes
    } else if (isContainer) {
      nodeType = 'scxmlCompound';
      stateType = 'compound';
    } else if (state['@_type'] === 'final') {
      stateType = 'final';
    }

    // Check if this is an initial state
    const isInitial = this.isInitialState(stateId, stateInfo.parentPath);

    // Calculate initial position (will be refined later)
    const position = this.calculateInitialPosition(stateId, stateInfo);

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

    // If this is a container, add container-specific data
    if (isContainer) {
      const containerData: CompoundStateNodeData = {
        ...baseNodeData,
        children: stateInfo.children,
        containerMetadata: {
          childLayout: 'auto',
          padding: 20,
          minSize: { width: 200, height: 150 },
          isCollapsible: true,
          isExpanded: true,
        },
      };
      node.data = containerData;
    }

    // Apply visual metadata if available
    if (visualMetadata.x !== undefined && visualMetadata.y !== undefined) {
      node.position = { x: visualMetadata.x, y: visualMetadata.y };
    }

    if (
      visualMetadata.width !== undefined ||
      visualMetadata.height !== undefined
    ) {
      (node.data as any).width = visualMetadata.width;
      (node.data as any).height = visualMetadata.height;
    }

    return node;
  }

  /**
   * Position hierarchical nodes using container layout algorithms
   */
  private positionHierarchicalNodes(
    nodes: HierarchicalNode[],
    layoutManager: ContainerLayoutManager
  ): void {
    // Group nodes by depth level
    const nodesByDepth = new Map<number, HierarchicalNode[]>();
    nodes.forEach((node) => {
      if (!nodesByDepth.has(node.depth)) {
        nodesByDepth.set(node.depth, []);
      }
      nodesByDepth.get(node.depth)!.push(node);
    });

    // Position nodes level by level, starting from the deepest
    const maxDepth = Math.max(...Array.from(nodesByDepth.keys()));

    for (let depth = maxDepth; depth >= 0; depth--) {
      const nodesAtDepth = nodesByDepth.get(depth) || [];

      for (const node of nodesAtDepth) {
        if (node.childIds && node.childIds.length > 0) {
          // This is a container - position its children
          this.positionContainerChildren(node, nodes, layoutManager);
        }
      }
    }

    // Position root level nodes
    this.positionRootNodes(nodesByDepth.get(0) || [], layoutManager);
  }

  /**
   * Position children within a container node with relative coordinates
   */
  private positionContainerChildren(
    containerNode: HierarchicalNode,
    allNodes: HierarchicalNode[],
    layoutManager: ContainerLayoutManager
  ): void {
    const childNodes = allNodes.filter((node) =>
      containerNode.childIds?.includes(node.id)
    );

    if (childNodes.length === 0) return;

    // Calculate container bounds
    const containerData = containerNode.data as CompoundStateNodeData;
    const padding = containerData.containerMetadata?.padding || 20;
    const headerHeight = 60; // Height reserved for container header

    // Define the available space for children (relative to container)
    const childAreaBounds: Rectangle = {
      x: 0, // Relative to container
      y: 0, // Relative to container
      width: ((containerData as any).width || 250) - padding * 2,
      height:
        ((containerData as any).height || 200) - headerHeight - padding * 2,
    };

    // Use layout strategy from container metadata
    const layoutStrategy: LayoutStrategy = {
      type: containerData.containerMetadata?.childLayout || 'auto',
    };

    // Position children using layout manager (this returns relative positions)
    const childPositions = layoutManager.arrangeChildren(
      childAreaBounds,
      childNodes,
      layoutStrategy,
      {
        padding: 10,
        spacing: { x: 20, y: 20 },
        alignment: 'center',
      }
    );

    // Apply RELATIVE positions to child nodes (relative to parent container)
    childPositions.forEach((pos) => {
      const childNode = childNodes.find((n) => n.id === pos.id);
      if (childNode) {
        // Store position relative to container (not absolute)
        childNode.position = {
          x: pos.x, // Already relative from arrangeChildren
          y: pos.y, // Already relative from arrangeChildren
        };

        // Update node data with size if specified
        if (pos.width && pos.height) {
          (childNode.data as any).width = pos.width;
          (childNode.data as any).height = pos.height;
        }

        console.log(
          `Positioned child ${childNode.id} at relative coords: (${pos.x}, ${pos.y}) within container ${containerNode.id}`
        );
      }
    });

    // Calculate required container size based on children
    let maxChildX = 0;
    let maxChildY = 0;

    childPositions.forEach((pos) => {
      maxChildX = Math.max(maxChildX, pos.x + (pos.width || 120));
      maxChildY = Math.max(maxChildY, pos.y + (pos.height || 60));
    });

    // Update container size to fit children plus padding and header
    const requiredWidth = maxChildX + padding * 2;
    const requiredHeight = maxChildY + headerHeight + padding * 2;

    const currentWidth = (containerData as any).width || 250;
    const currentHeight = (containerData as any).height || 200;

    if (requiredWidth > currentWidth || requiredHeight > currentHeight) {
      (containerData as any).width = Math.max(currentWidth, requiredWidth);
      (containerData as any).height = Math.max(currentHeight, requiredHeight);

      console.log(
        `Updated container ${containerNode.id} size to: ${
          (containerData as any).width
        }x${(containerData as any).height}`
      );
    }

    // Store bounds for layout calculations
    containerNode.containerBounds = {
      x: containerNode.position.x,
      y: containerNode.position.y,
      width: (containerData as any).width,
      height: (containerData as any).height,
    };
  }

  /**
   * Position root level nodes (nodes without parents)
   */
  private positionRootNodes(
    rootNodes: HierarchicalNode[],
    layoutManager: ContainerLayoutManager
  ): void {
    if (rootNodes.length === 0) return;

    // Create a virtual container for root nodes
    const viewportBounds: Rectangle = {
      x: 50,
      y: 50,
      width: 1200,
      height: 800,
    };

    const layoutStrategy: LayoutStrategy = { type: 'auto' };

    const positions = layoutManager.arrangeChildren(
      viewportBounds,
      rootNodes,
      layoutStrategy,
      {
        padding: 50,
        spacing: { x: 100, y: 100 },
        alignment: 'center',
      }
    );

    // Apply positions to root nodes
    positions.forEach((pos) => {
      const node = rootNodes.find((n) => n.id === pos.id);
      if (node) {
        // Only update position if not explicitly set by visual metadata
        const hasExplicitPosition =
          node.position.x !== 0 || node.position.y !== 0;
        if (!hasExplicitPosition) {
          node.position = { x: pos.x, y: pos.y };
        }
      }
    });
  }

  /**
   * Calculate initial position for a node (before layout algorithms)
   */
  private calculateInitialPosition(
    stateId: string,
    stateInfo: StateRegistryEntry
  ): { x: number; y: number } {
    // Use existing method but with some modifications for hierarchy
    const depth = stateInfo.depth;
    const baseOffset = depth * 50; // Slight offset per depth level

    return {
      x: 100 + baseOffset,
      y: 100 + baseOffset,
    };
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
            console.log('SCXML Log:', params);
          },
          assign: ({ context }, params: any) => {
            return { ...context, ...params };
          },
        },
      }).createMachine(config);

      console.log('✅ Successfully created XState machine');
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
                  childInfo.parentPath
                    ? childInfo.parentPath + '.' + childState
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
            stateConfig.states[childId] = childConfig;
            console.log(`Added child state: ${childId} to parent: ${stateId}`);
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
            stateConfig.states[childId] = childConfig;
            console.log(
              `Added child parallel: ${childId} to parent: ${stateId}`
            );
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
                  console.log(
                    `Set history default target: ${historyId} -> ${resolvedTarget}`
                  );
                  break; // Only use the first default transition
                }
              }
            }

            stateConfig.states[historyId] = historyConfig;
            console.log(
              `Added history state: ${historyId} (${historyType}) to parent: ${stateId}`
            );
          }
        }
      }

      // Set initial child state
      const initial = this.getAttribute(state, 'initial');
      if (initial) {
        stateConfig.initial = initial;
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
            console.log(
              `Added transition: ${stateId} -> ${resolvedTarget} on event '${event}'`
            );
          } else {
            // Always transition (no event)
            if (!stateConfig.always) stateConfig.always = [];
            stateConfig.always.push(transitionConfig);
            console.log(
              `Added always transition: ${stateId} -> ${resolvedTarget}`
            );
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

    return {
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

    // Resolve the target - extract just the state ID for React Flow
    // Since we already resolved paths in XState config, here we need the final state ID
    const finalTargetId = target.includes('.')
      ? target.split('.').pop()
      : target;

    // Verify both source and target exist in our registry
    if (!this.stateRegistry.has(sourceStateId)) {
      console.warn(`Source state '${sourceStateId}' not found in registry`);
      return null;
    }

    if (!this.stateRegistry.has(finalTargetId!)) {
      console.warn(`Target state '${finalTargetId}' not found in registry`);
      return null;
    }

    // Generate unique edge ID
    const edgeId = `${sourceStateId}-to-${finalTargetId}-${event || 'always'}`;

    console.log(
      `🔗 Creating edge: ${sourceStateId} -> ${finalTargetId} (${
        event || 'always'
      })`
    );

    return {
      id: edgeId,
      type: 'scxmlTransition',
      source: sourceStateId,
      target: finalTargetId!,
      data: {
        event,
        condition,
        actions,
      },
    };
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

    // Extract visual metadata from the viz namespace
    const vizXywh = this.getAttribute(element, 'viz:xywh');
    const vizRgb = this.getAttribute(element, 'viz:rgb');

    // Parse viz:xywh format: "x y width height"
    if (vizXywh) {
      const parts = vizXywh.trim().split(/\s+/);
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

    return {
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
            console.log(
              `Added parallel transition: ${parallelId} -> ${resolvedTarget} on event '${event}'`
            );
          } else {
            // Always transition
            if (!parallelConfig.always) parallelConfig.always = [];
            parallelConfig.always.push(transitionConfig);
            console.log(
              `Added parallel always transition: ${parallelId} -> ${resolvedTarget}`
            );
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
          parallelConfig.states[childId] = childConfig;
        }
      }
    }

    return parallelConfig;
  }

  /**
   * Register all states in the SCXML document with their parent paths and hierarchy
   */
  private registerAllStates(parent: any, parentPath: string): void {
    const parentId = parentPath ? parentPath.split('.').pop() : null;
    const depth = parentPath ? parentPath.split('.').length : 0;

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
          const fullPath = parentPath ? `${parentPath}.${stateId}` : stateId;

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

          console.log(
            `📍 Registered state: ${stateId} under parent: '${
              parentPath || 'root'
            }' (container: ${hasChildren})`
          );

          // Recursively register nested states
          this.registerAllStates(state, fullPath);

          // After recursive call, collect children for this state
          if (hasChildren) {
            const childStates = this.collectDirectChildIds(state);
            registryEntry.children = childStates;
            this.hierarchyMap.set(stateId, childStates);
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
            ? `${parentPath}.${parallelId}`
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

          console.log(
            `⚡ Registered parallel: ${parallelId} under parent: '${
              parentPath || 'root'
            }'`
          );

          // Recursively register nested states within parallel
          this.registerAllStates(parallel, fullPath);

          // After recursive call, collect children for this parallel state
          const childStates = this.collectDirectChildIds(parallel);
          registryEntry.children = childStates;
          this.hierarchyMap.set(parallelId, childStates);
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
            ? `${parentPath}.${historyId}`
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

          console.log(
            `📜 Registered history: ${historyId} under parent: '${
              parentPath || 'root'
            }'`
          );
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
   */
  private collectDirectChildIds(element: any): string[] {
    const childIds: string[] = [];

    // Collect child states
    const states = this.getElements(element, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        const stateId = this.getAttribute(state, 'id');
        if (stateId) childIds.push(stateId);
      }
    }

    // Collect child parallel states
    const parallels = this.getElements(element, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        const parallelId = this.getAttribute(parallel, 'id');
        if (parallelId) childIds.push(parallelId);
      }
    }

    // Collect child history states
    const histories = this.getElements(element, 'history');
    if (histories) {
      const historiesArray = Array.isArray(histories) ? histories : [histories];
      for (const history of historiesArray) {
        const historyId = this.getAttribute(history, 'id');
        if (historyId) childIds.push(historyId);
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
   * Check if a state is a container (compound or parallel)
   */
  isContainer(stateId: string): boolean {
    const entry = this.stateRegistry.get(stateId);
    return entry?.isContainer || false;
  }

  /**
   * Resolve a target state ID to the proper XState path
   */
  private resolveTarget(
    targetId: string,
    currentStatePath: string = ''
  ): string {
    if (!targetId) return targetId;

    // Check if target exists in registry
    const targetInfo = this.stateRegistry.get(targetId);
    if (!targetInfo) {
      console.warn(
        `Target state '${targetId}' not found in registry. Using as-is.`
      );
      return targetId;
    }

    const currentParent = this.getParentPath(currentStatePath);
    const targetParent = targetInfo.parentPath;

    console.log(
      `Resolving '${targetId}' from '${currentStatePath}' (parent: '${currentParent}') to target parent: '${targetParent}'`
    );

    // If target is at root level, return as-is
    if (!targetParent) {
      return targetId;
    }

    // If target and current state share the same parent, use relative reference
    if (currentParent === targetParent) {
      console.log(`Same parent context, using relative: '${targetId}'`);
      return targetId;
    }

    // For cross-hierarchy references, we need absolute paths in XState v5
    // Use dot notation to specify the full path from root
    const absolutePath = targetParent
      ? `${targetParent}.${targetId}`
      : targetId;
    console.log(
      `Cross-hierarchy reference, using absolute path: '${absolutePath}'`
    );
    return absolutePath;
  }

  /**
   * Get parent path from a full state path
   */
  private getParentPath(statePath: string): string {
    const parts = statePath.split('.');
    return parts.length > 1 ? parts.slice(0, -1).join('.') : '';
  }

  /**
   * Build the full state path for a given state ID
   */
  private buildStatePath(stateId: string): string {
    const stateInfo = this.stateRegistry.get(stateId);
    if (!stateInfo) {
      return stateId;
    }

    return stateInfo.parentPath
      ? `${stateInfo.parentPath}.${stateId}`
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
    const parentParts = parentPath.split('.');
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
      return stateId === rootInitial;
    }

    // Find parent state and check its initial attribute
    const parentId = parentPath.split('.').pop();
    if (parentId) {
      const parentInfo = this.stateRegistry.get(parentId);
      if (parentInfo) {
        const parentInitial = this.getAttribute(parentInfo.state, 'initial');
        return stateId === parentInitial;
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

    const validateStateTransitions = (stateConfig: any, statePath: string) => {
      if (stateConfig.on) {
        for (const [event, transition] of Object.entries(stateConfig.on)) {
          const trans = transition as any;
          if (
            trans.target &&
            !this.stateRegistry.has(trans.target.split('.').pop())
          ) {
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
          if (
            trans.target &&
            !this.stateRegistry.has(trans.target.split('.').pop())
          ) {
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
}
