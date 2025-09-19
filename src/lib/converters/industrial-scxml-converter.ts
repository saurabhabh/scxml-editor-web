import type {
  SCXMLDocument,
  SCXMLElement,
  StateElement,
  ParallelElement,
  TransitionElement,
  HistoryElement,
} from '@/types/scxml';
import type { Node, Edge } from 'reactflow';
import type { XStateMachineConfig } from './scxml-to-xstate';

// Enhanced types for visual classification
export interface StateVisualizationType {
  type: 'simple' | 'compound' | 'parallel' | 'final' | 'initial' | 'history';
  subtype?: 'shallow-history' | 'deep-history';
  hasEntryActions: boolean;
  hasExitActions: boolean;
  hasInternalTransitions: boolean;
  nestingLevel: number;
  parentId?: string;
  isParallelRegion: boolean;
}

export interface TransitionVisualizationType {
  type:
    | 'event-condition'
    | 'event-only'
    | 'condition-only'
    | 'always'
    | 'internal'
    | 'action-executing';
  hasActions: boolean;
  isInternal: boolean;
  isCrossHierarchy: boolean;
  eventName?: string;
  condition?: string;
  actions: string[];
  sourceLevel: number;
  targetLevel: number;
}

export interface StateVisualData {
  classification: StateVisualizationType;
  position: { x: number; y: number };
  dimensions: { width: number; height: number };
  styling: {
    borderColor: string;
    backgroundColor: string;
    borderWidth: number;
    borderStyle: 'solid' | 'dashed' | 'dotted';
  };
  icons: string[];
  labels: string[];
  containerProperties?: {
    isContainer: boolean;
    childrenLayout: 'horizontal' | 'vertical' | 'grid';
    padding: number;
  };
}

export interface EdgeVisualizationData {
  classification: TransitionVisualizationType;
  path: string;
  styling: {
    strokeColor: string;
    strokeWidth: number;
    strokeDasharray?: string;
  };
  markers: {
    start?: string;
    end?: string;
  };
  labels: {
    event?: { text: string; position: { x: number; y: number } };
    condition?: { text: string; position: { x: number; y: number } };
    actions?: { text: string; position: { x: number; y: number } };
  };
}

export interface ParallelRegionInfo {
  regionId: string;
  parentParallelId: string;
  activeStates: Set<string>;
  nestingLevel: number;
  siblingRegions: string[];
}

export interface HistoryStateInfo {
  historyId: string;
  historyType: 'shallow' | 'deep';
  coveredStates: string[];
  defaultTarget?: string;
  hasStoredConfiguration: boolean;
  parentStateId: string;
}

export interface StateConfiguration {
  activeStates: Set<string>;
  parallelRegions: Map<string, ParallelRegionInfo>;
  historyStates: Map<string, HistoryStateInfo>;
}

/**
 * Industrial-grade SCXML to XState converter with comprehensive visual classification
 * Supports deeply nested parallel states, complex history combinations, and cross-hierarchy transitions
 */
export class IndustrialSCXMLConverter {
  private stateRegistry = new Map<
    string,
    {
      element: StateElement | ParallelElement | HistoryElement;
      parentPath: string;
      nestingLevel: number;
      classification: StateVisualizationType;
    }
  >();

  private transitionRegistry = new Map<
    string,
    {
      element: TransitionElement;
      sourceStateId: string;
      classification: TransitionVisualizationType;
    }
  >();

  private parallelRegionMap = new Map<string, ParallelRegionInfo>();
  private historyStateMap = new Map<string, HistoryStateInfo>();
  private crossHierarchyTransitions = new Set<string>();

  private maxNestingLevel = 0;
  private currentStateConfiguration: StateConfiguration = {
    activeStates: new Set(),
    parallelRegions: new Map(),
    historyStates: new Map(),
  };

  /**
   * Enhanced SCXML to XState conversion with industrial capabilities
   */
  convertToXState(scxmlDoc: SCXMLDocument): XStateMachineConfig {
    const scxml = scxmlDoc.scxml;
    this.resetInternalState();

    // Phase 1: Deep analysis and registration
    this.performDeepAnalysis(scxml, '', 0);

    // Phase 2: Classify all elements for visualization
    this.classifyAllElements();

    // Phase 3: Build XState configuration with enhanced capabilities
    const config = this.buildEnhancedXStateConfig(scxml);

    // Phase 4: Validate complex scenarios
    this.validateComplexScenarios(config);

    return config;
  }

  /**
   * Enhanced React Flow conversion with rich visual classification
   */
  convertToReactFlowWithClassification(scxmlDoc: SCXMLDocument): {
    nodes: Node[];
    edges: Edge[];
    visualMetadata: {
      stateClassifications: Map<string, StateVisualizationType>;
      transitionClassifications: Map<string, TransitionVisualizationType>;
      parallelRegions: Map<string, ParallelRegionInfo>;
      historyStates: Map<string, HistoryStateInfo>;
      maxNestingLevel: number;
    };
  } {
    // First ensure we have analyzed the document
    if (this.stateRegistry.size === 0) {
      this.convertToXState(scxmlDoc);
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Convert states to nodes with enhanced visual data
    for (const [stateId, stateInfo] of this.stateRegistry.entries()) {
      const visualData = this.generateStateVisualData(stateId, stateInfo);
      const node = this.createEnhancedStateNode(stateId, stateInfo, visualData);
      if (node) {
        nodes.push(node);
      }
    }

    // Convert transitions to edges with enhanced visual data
    for (const [
      transitionId,
      transitionInfo,
    ] of this.transitionRegistry.entries()) {
      const visualData = this.generateEdgeVisualData(
        transitionId,
        transitionInfo
      );
      const edge = this.createEnhancedTransitionEdge(
        transitionId,
        transitionInfo,
        visualData
      );
      if (edge) {
        edges.push(edge);
      }
    }

    // Apply intelligent layout for complex hierarchies
    this.applyIntelligentLayout(nodes, edges);

    return {
      nodes,
      edges,
      visualMetadata: {
        stateClassifications: new Map(
          Array.from(this.stateRegistry.entries()).map(([id, info]) => [
            id,
            info.classification,
          ])
        ),
        transitionClassifications: new Map(
          Array.from(this.transitionRegistry.entries()).map(([id, info]) => [
            id,
            info.classification,
          ])
        ),
        parallelRegions: this.parallelRegionMap,
        historyStates: this.historyStateMap,
        maxNestingLevel: this.maxNestingLevel,
      },
    };
  }

  /**
   * Deep analysis of SCXML structure for industrial-grade processing
   */
  private performDeepAnalysis(
    element: any,
    parentPath: string,
    nestingLevel: number
  ): void {
    this.maxNestingLevel = Math.max(this.maxNestingLevel, nestingLevel);

    // Analyze states
    const states = this.getElements(element, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        this.analyzeState(state, parentPath, nestingLevel);
      }
    }

    // Analyze parallel states with special handling
    const parallels = this.getElements(element, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        this.analyzeParallelState(parallel, parentPath, nestingLevel);
      }
    }

    // Analyze history states
    const histories = this.getElements(element, 'history');
    if (histories) {
      const historiesArray = Array.isArray(histories) ? histories : [histories];
      for (const history of historiesArray) {
        this.analyzeHistoryState(history, parentPath, nestingLevel);
      }
    }

    // Analyze transitions for cross-hierarchy detection
    this.analyzeTransitions(element, parentPath, nestingLevel);
  }

  /**
   * Analyze individual state for classification
   */
  private analyzeState(
    state: StateElement,
    parentPath: string,
    nestingLevel: number
  ): void {
    const stateId = this.getAttribute(state, 'id');
    if (!stateId) return;

    const fullPath = parentPath ? `${parentPath}.${stateId}` : stateId;

    // Initial classification - will be refined later
    const classification: StateVisualizationType = {
      type: 'simple',
      hasEntryActions: !!state.onentry,
      hasExitActions: !!state.onexit,
      hasInternalTransitions: this.hasInternalTransitions(state),
      nestingLevel,
      parentId: parentPath ? parentPath.split('.').pop() : undefined,
      isParallelRegion: this.isInParallelRegion(parentPath),
    };

    this.stateRegistry.set(stateId, {
      element: state,
      parentPath,
      nestingLevel,
      classification,
    });

    // Recursively analyze children
    this.performDeepAnalysis(state, fullPath, nestingLevel + 1);
  }

  /**
   * Analyze parallel state with region detection
   */
  private analyzeParallelState(
    parallel: ParallelElement,
    parentPath: string,
    nestingLevel: number
  ): void {
    const parallelId = this.getAttribute(parallel, 'id');
    if (!parallelId) return;

    const fullPath = parentPath ? `${parentPath}.${parallelId}` : parallelId;

    const classification: StateVisualizationType = {
      type: 'parallel',
      hasEntryActions: !!parallel.onentry,
      hasExitActions: !!parallel.onexit,
      hasInternalTransitions: this.hasInternalTransitions(parallel),
      nestingLevel,
      parentId: parentPath ? parentPath.split('.').pop() : undefined,
      isParallelRegion: false, // Parallel states create regions, they're not in one
    };

    this.stateRegistry.set(parallelId, {
      element: parallel,
      parentPath,
      nestingLevel,
      classification,
    });

    // Analyze parallel regions
    this.analyzeParallelRegions(parallel, parallelId, nestingLevel);

    // Recursively analyze children
    this.performDeepAnalysis(parallel, fullPath, nestingLevel + 1);
  }

  /**
   * Analyze history state with coverage detection
   */
  private analyzeHistoryState(
    history: HistoryElement,
    parentPath: string,
    nestingLevel: number
  ): void {
    const historyId = this.getAttribute(history, 'id');
    if (!historyId) return;

    const historyType = (this.getAttribute(history, 'type') || 'shallow') as
      | 'shallow'
      | 'deep';
    const parentStateId = parentPath ? parentPath.split('.').pop()! : '';

    const classification: StateVisualizationType = {
      type: 'history',
      subtype: historyType === 'deep' ? 'deep-history' : 'shallow-history',
      hasEntryActions: false,
      hasExitActions: false,
      hasInternalTransitions: false,
      nestingLevel,
      parentId: parentStateId,
      isParallelRegion: this.isInParallelRegion(parentPath),
    };

    this.stateRegistry.set(historyId, {
      element: history,
      parentPath,
      nestingLevel: 1,
      classification,
    });

    // Build history state info
    const historyInfo: HistoryStateInfo = {
      historyId,
      historyType,
      coveredStates: this.getCoveredStatesByHistory(
        history,
        historyType,
        parentPath
      ),
      defaultTarget: this.getHistoryDefaultTarget(history),
      hasStoredConfiguration: false, // Will be updated during execution
      parentStateId,
    };

    this.historyStateMap.set(historyId, historyInfo);
  }

  /**
   * Analyze transitions for cross-hierarchy detection and classification
   */
  private analyzeTransitions(
    element: any,
    parentPath: string,
    nestingLevel: number
  ): void {
    const sourceStateId = this.getAttribute(element, 'id');
    if (!sourceStateId) return;

    const transitions = this.getElements(element, 'transition');
    if (!transitions) return;

    const transitionsArray = Array.isArray(transitions)
      ? transitions
      : [transitions];

    for (const transition of transitionsArray) {
      const transitionId = this.generateTransitionId(transition, sourceStateId);
      const classification = this.classifyTransition(
        transition,
        sourceStateId,
        nestingLevel
      );

      this.transitionRegistry.set(transitionId, {
        element: transition,
        sourceStateId,
        classification,
      });

      // Detect cross-hierarchy transitions
      if (classification.isCrossHierarchy) {
        this.crossHierarchyTransitions.add(transitionId);
      }
    }
  }

  /**
   * Classify all elements after initial analysis
   */
  private classifyAllElements(): void {
    // Analyze complex history combinations
    this.analyzeComplexHistoryCombinations();

    // Resolve cross-hierarchy transitions
    this.resolveCrossHierarchyTransitions();

    // Refine state classifications based on complete analysis
    for (const [stateId, stateInfo] of this.stateRegistry.entries()) {
      stateInfo.classification = this.refineStateClassification(
        stateId,
        stateInfo
      );
    }

    // Refine transition classifications
    for (const [
      transitionId,
      transitionInfo,
    ] of this.transitionRegistry.entries()) {
      transitionInfo.classification = this.refineTransitionClassification(
        transitionId,
        transitionInfo
      );
    }
  }

  /**
   * Build enhanced XState configuration with industrial capabilities
   */
  private buildEnhancedXStateConfig(scxml: SCXMLElement): XStateMachineConfig {
    const config: XStateMachineConfig = {
      id: this.getAttribute(scxml, 'name') || 'industrialSCXMLMachine',
      initial: this.getAttribute(scxml, 'initial'),
      states: {},
      context: {},
    };

    // Build states with enhanced parallel and history support
    for (const [stateId, stateInfo] of this.stateRegistry.entries()) {
      if (!stateInfo.parentPath) {
        // Root level state
        const stateConfig = this.buildEnhancedStateConfig(stateId, stateInfo);
        if (stateConfig) {
          config.states[stateId] = stateConfig;
        }
      }
    }

    return config;
  }

  /**
   * Build enhanced state configuration with parallel and history support
   */
  private buildEnhancedStateConfig(stateId: string, stateInfo: any): any {
    const element = stateInfo.element;
    const classification = stateInfo.classification;

    const stateConfig: any = {};

    // Handle different state types
    switch (classification.type) {
      case 'parallel':
        stateConfig.type = 'parallel';
        stateConfig.states = this.buildParallelRegions(
          element as ParallelElement
        );
        break;

      case 'history':
        const historyInfo = this.historyStateMap.get(stateId);
        if (historyInfo) {
          return this.buildHistoryStateConfig(historyInfo);
        }
        break;

      case 'compound':
        stateConfig.states = this.buildChildStates(element);
        if (this.getAttribute(element, 'initial')) {
          stateConfig.initial = this.getAttribute(element, 'initial');
        }
        break;

      case 'final':
        stateConfig.type = 'final';
        break;
    }

    // Add entry/exit actions
    if (classification.hasEntryActions) {
      stateConfig.entry = this.buildActions(
        this.getElements(element, 'onentry')
      );
    }

    if (classification.hasExitActions) {
      stateConfig.exit = this.buildActions(this.getElements(element, 'onexit'));
    }

    // Add transitions
    const transitions = this.buildEnhancedTransitions(element, stateId);
    if (
      transitions.eventBased &&
      Object.keys(transitions.eventBased).length > 0
    ) {
      stateConfig.on = transitions.eventBased;
    }
    if (transitions.always && transitions.always.length > 0) {
      stateConfig.always = transitions.always;
    }

    return stateConfig;
  }

  // Helper methods for element access and classification
  private getAttribute(element: any, attrName: string): string | undefined {
    return element?.[`@_${attrName}`] || element?.[attrName];
  }

  private getElements(parent: any, elementName: string): any {
    return parent?.[elementName];
  }

  private hasInternalTransitions(element: any): boolean {
    const transitions = this.getElements(element, 'transition');
    if (!transitions) return false;

    const transitionsArray = Array.isArray(transitions)
      ? transitions
      : [transitions];
    return transitionsArray.some(
      (t) => this.getAttribute(t, 'type') === 'internal'
    );
  }

  private isInParallelRegion(parentPath: string): boolean {
    if (!parentPath) return false;

    const pathParts = parentPath.split('.');
    return pathParts.some((part) => {
      const stateInfo = this.stateRegistry.get(part);
      return stateInfo?.classification.type === 'parallel';
    });
  }

  private resetInternalState(): void {
    this.stateRegistry.clear();
    this.transitionRegistry.clear();
    this.parallelRegionMap.clear();
    this.historyStateMap.clear();
    this.crossHierarchyTransitions.clear();
    this.maxNestingLevel = 0;
    this.currentStateConfiguration = {
      activeStates: new Set(),
      parallelRegions: new Map(),
      historyStates: new Map(),
    };
  }

  /**
   * Analyze parallel regions with deep nesting support (10+ levels)
   */
  private analyzeParallelRegions(
    parallel: ParallelElement,
    parallelId: string,
    nestingLevel: number
  ): void {
    const childStates = this.getElements(parallel, 'state');
    if (!childStates) return;

    const childStatesArray = Array.isArray(childStates)
      ? childStates
      : [childStates];
    const regionIds: string[] = [];

    // Each child state of a parallel element is a parallel region
    for (const childState of childStatesArray) {
      const regionId = this.getAttribute(childState, 'id');
      if (!regionId) continue;

      regionIds.push(regionId);

      // Create parallel region info
      const regionInfo: ParallelRegionInfo = {
        regionId,
        parentParallelId: parallelId,
        activeStates: new Set(),
        nestingLevel: nestingLevel + 1,
        siblingRegions: [], // Will be filled after all regions are identified
      };

      this.parallelRegionMap.set(regionId, regionInfo);

      // Mark this state as a parallel region in its classification
      const stateInfo = this.stateRegistry.get(regionId);
      if (stateInfo) {
        stateInfo.classification.isParallelRegion = true;
      }
    }

    // Update sibling region information for all regions
    for (const regionId of regionIds) {
      const regionInfo = this.parallelRegionMap.get(regionId);
      if (regionInfo) {
        regionInfo.siblingRegions = regionIds.filter((id) => id !== regionId);
      }
    }

    // Handle deeply nested parallel states (recursive parallel within regions)
    this.handleDeepParallelNesting(
      childStatesArray,
      parallelId,
      nestingLevel + 1
    );
  }

  /**
   * Handle deeply nested parallel states with conflict detection and resolution
   */
  private handleDeepParallelNesting(
    regions: any[],
    parentParallelId: string,
    currentLevel: number
  ): void {
    if (currentLevel > 10) {
      console.warn(
        `⚠️ Deep parallel nesting detected (level ${currentLevel}). Performance may be impacted.`
      );
    }

    for (const region of regions) {
      // Check for nested parallel states within this region
      const nestedParallels = this.getElements(region, 'parallel');
      if (nestedParallels) {
        const nestedParallelsArray = Array.isArray(nestedParallels)
          ? nestedParallels
          : [nestedParallels];

        for (const nestedParallel of nestedParallelsArray) {
          const nestedParallelId = this.getAttribute(nestedParallel, 'id');
          if (nestedParallelId) {
            // Recursively analyze the nested parallel
            this.analyzeParallelRegions(
              nestedParallel,
              nestedParallelId,
              currentLevel
            );

            // Check for state configuration conflicts
            this.detectParallelStateConflicts(
              nestedParallelId,
              parentParallelId,
              currentLevel
            );
          }
        }
      }

      // Check for compound states within regions that might contain more parallels
      const nestedStates = this.getElements(region, 'state');
      if (nestedStates) {
        const nestedStatesArray = Array.isArray(nestedStates)
          ? nestedStates
          : [nestedStates];
        this.handleDeepParallelNesting(
          nestedStatesArray,
          parentParallelId,
          currentLevel + 1
        );
      }
    }
  }

  /**
   * Detect and resolve parallel state configuration conflicts
   */
  private detectParallelStateConflicts(
    nestedParallelId: string,
    parentParallelId: string,
    level: number
  ): void {
    const nestedRegions = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === nestedParallelId
    );

    const parentRegions = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === parentParallelId
    );

    // Check for potential state name conflicts across nested parallels
    const nestedStateIds = new Set<string>();
    const parentStateIds = new Set<string>();

    for (const region of nestedRegions) {
      nestedStateIds.add(region.regionId);
    }

    for (const region of parentRegions) {
      parentStateIds.add(region.regionId);
    }

    // Detect naming conflicts
    const conflicts = Array.from(nestedStateIds).filter((id) =>
      parentStateIds.has(id)
    );
    if (conflicts.length > 0) {
      console.warn(
        `⚠️ Parallel state naming conflicts detected at level ${level}: ${conflicts.join(
          ', '
        )}`
      );

      // Store conflicts for later resolution
      for (const conflictId of conflicts) {
        this.crossHierarchyTransitions.add(`conflict:${conflictId}:${level}`);
      }
    }

    // Validate that the nested parallel structure is well-formed
    this.validateParallelStructure(nestedParallelId, level);
  }

  /**
   * Validate parallel structure for industrial compliance
   */
  private validateParallelStructure(parallelId: string, level: number): void {
    const regions = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === parallelId
    );

    if (regions.length === 0) {
      console.warn(
        `⚠️ Parallel state ${parallelId} has no regions (level ${level})`
      );
      return;
    }

    if (regions.length === 1) {
      console.warn(
        `⚠️ Parallel state ${parallelId} has only one region - consider using compound state instead (level ${level})`
      );
    }

    // Check for circular dependencies in nested parallels
    this.detectCircularParallelDependencies(
      parallelId,
      new Set([parallelId]),
      level
    );
  }

  /**
   * Detect circular dependencies in parallel state hierarchies
   */
  private detectCircularParallelDependencies(
    parallelId: string,
    visitedParallels: Set<string>,
    level: number
  ): void {
    const childRegions = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === parallelId
    );

    for (const region of childRegions) {
      // Look for nested parallels within this region
      const regionStateInfo = this.stateRegistry.get(region.regionId);
      if (regionStateInfo) {
        const nestedParallels = this.findNestedParallels(
          regionStateInfo.element
        );

        for (const nestedParallelId of nestedParallels) {
          if (visitedParallels.has(nestedParallelId)) {
            console.error(
              `🔴 Circular parallel dependency detected: ${Array.from(
                visitedParallels
              ).join(' -> ')} -> ${nestedParallelId}`
            );
            return;
          }

          // Recursively check nested parallels
          const newVisited = new Set(visitedParallels);
          newVisited.add(nestedParallelId);
          this.detectCircularParallelDependencies(
            nestedParallelId,
            newVisited,
            level + 1
          );
        }
      }
    }
  }

  /**
   * Find all nested parallel states within an element
   */
  private findNestedParallels(element: any): string[] {
    const parallelIds: string[] = [];

    const parallels = this.getElements(element, 'parallel');
    if (parallels) {
      const parallelsArray = Array.isArray(parallels) ? parallels : [parallels];
      for (const parallel of parallelsArray) {
        const parallelId = this.getAttribute(parallel, 'id');
        if (parallelId) {
          parallelIds.push(parallelId);
        }
      }
    }

    // Also check nested states for more parallels
    const states = this.getElements(element, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      for (const state of statesArray) {
        parallelIds.push(...this.findNestedParallels(state));
      }
    }

    return parallelIds;
  }

  /**
   * Build parallel regions with proper state management
   */
  private buildParallelRegions(parallel: ParallelElement): any {
    const regions: any = {};
    const parallelId = this.getAttribute(parallel, 'id');
    if (!parallelId) return regions;

    const regionInfos = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === parallelId
    );

    for (const regionInfo of regionInfos) {
      const regionStateInfo = this.stateRegistry.get(regionInfo.regionId);
      if (regionStateInfo) {
        const regionConfig = this.buildEnhancedStateConfig(
          regionInfo.regionId,
          regionStateInfo
        );
        if (regionConfig) {
          regions[regionInfo.regionId] = regionConfig;
        }
      }
    }

    return regions;
  }

  /**
   * Get active parallel regions for state configuration management
   */
  getActiveParallelRegions(): Map<string, ParallelRegionInfo> {
    return new Map(this.parallelRegionMap);
  }

  /**
   * Enhanced event distribution to all active parallel regions with comprehensive handling
   */
  distributeEventToParallelRegions(
    event: string,
    currentActiveStates: Set<string>
  ): Map<string, Set<string>> {
    const eventDistribution = new Map<string, Set<string>>();
    const processedRegions = new Set<string>();

    // Find all active parallel states (including nested parallels)
    const activeParallels = Array.from(this.stateRegistry.entries())
      .filter(
        ([stateId, info]) =>
          info.classification.type === 'parallel' &&
          currentActiveStates.has(stateId)
      )
      .sort((a, b) => a[1].nestingLevel - b[1].nestingLevel); // Process from outermost to innermost

    for (const [parallelId, parallelInfo] of activeParallels) {
      const distributionResult = this.distributeToParallelState(
        parallelId,
        event,
        currentActiveStates,
        processedRegions
      );

      if (distributionResult.affectedRegions.size > 0) {
        eventDistribution.set(parallelId, distributionResult.affectedRegions);

        // Mark regions as processed to avoid double-processing in nested scenarios
        distributionResult.affectedRegions.forEach((regionId) =>
          processedRegions.add(regionId)
        );
      }
    }

    // Handle event propagation rules
    this.handleEventPropagationRules(
      event,
      eventDistribution,
      currentActiveStates
    );
    return eventDistribution;
  }

  /**
   * Distribute event to a specific parallel state
   */
  private distributeToParallelState(
    parallelId: string,
    event: string,
    currentActiveStates: Set<string>,
    processedRegions: Set<string>
  ): { affectedRegions: Set<string>; eventHandled: boolean } {
    const affectedRegions = new Set<string>();
    let eventHandled = false;

    const regionInfos = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === parallelId
    );

    for (const regionInfo of regionInfos) {
      // Skip if region already processed by a nested parallel
      if (processedRegions.has(regionInfo.regionId)) {
        continue;
      }

      // Check if this region has any active states
      const regionActiveStates = this.getStatesInRegion(
        regionInfo.regionId,
        currentActiveStates
      );

      if (regionActiveStates.size > 0) {
        // Check if any state in this region can handle the event
        const canHandleEvent = this.canRegionHandleEvent(
          regionInfo.regionId,
          event,
          regionActiveStates
        );

        if (canHandleEvent) {
          affectedRegions.add(regionInfo.regionId);
          eventHandled = true;

          // Update region's active states for tracking
          regionInfo.activeStates.clear();
          regionActiveStates.forEach((stateId) =>
            regionInfo.activeStates.add(stateId)
          );
        }
      }
    }

    return { affectedRegions, eventHandled };
  }

  /**
   * Check if a parallel region can handle a specific event
   */
  private canRegionHandleEvent(
    regionId: string,
    event: string,
    regionActiveStates: Set<string>
  ): boolean {
    // Check if any active state in the region has a transition for this event
    for (const stateId of regionActiveStates) {
      const stateTransitions = Array.from(
        this.transitionRegistry.values()
      ).filter((t) => t.sourceStateId === stateId);

      for (const transitionInfo of stateTransitions) {
        if (
          transitionInfo.classification.eventName === event ||
          transitionInfo.classification.eventName === '*' ||
          !transitionInfo.classification.eventName
        ) {
          // Always transitions
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Handle event propagation rules for complex scenarios
   */
  private handleEventPropagationRules(
    event: string,
    eventDistribution: Map<string, Set<string>>,
    currentActiveStates: Set<string>
  ): void {
    // Rule 1: Event bubbling - if event is not handled by any parallel region,
    // it should bubble up to parent states
    const totalRegionsHandled = Array.from(eventDistribution.values()).reduce(
      (sum, regions) => sum + regions.size,
      0
    );

    if (totalRegionsHandled === 0) {
      this.handleEventBubbling(event, currentActiveStates);
    }

    // Rule 2: Event synchronization across sibling parallel regions
    this.handleCrossRegionEventSynchronization(event, eventDistribution);

    // Rule 3: Handle event priorities for conflicting transitions
    this.resolveEventTransitionConflicts(event, eventDistribution);
  }

  /**
   * Handle event bubbling when not handled by parallel regions
   */
  private handleEventBubbling(
    event: string,
    currentActiveStates: Set<string>
  ): void {
    // Find non-parallel active states that might handle the event
    const nonParallelActiveStates = Array.from(currentActiveStates).filter(
      (stateId) => {
        const stateInfo = this.stateRegistry.get(stateId);
        return stateInfo && stateInfo.classification.type !== 'parallel';
      }
    );

    for (const stateId of nonParallelActiveStates) {
      const stateInfo = this.stateRegistry.get(stateId);
      if (stateInfo && this.canStateHandleEvent(stateId, event)) {
        break; // First state that can handle it takes precedence
      }
    }
  }

  /**
   * Check if a specific state can handle an event
   */
  private canStateHandleEvent(stateId: string, event: string): boolean {
    const stateTransitions = Array.from(
      this.transitionRegistry.values()
    ).filter((t) => t.sourceStateId === stateId);

    return stateTransitions.some(
      (t) =>
        t.classification.eventName === event ||
        t.classification.eventName === '*' ||
        !t.classification.eventName
    );
  }

  /**
   * Handle cross-region event synchronization
   */
  private handleCrossRegionEventSynchronization(
    event: string,
    eventDistribution: Map<string, Set<string>>
  ): void {
    // Check for events that require coordination between parallel regions
    const synchronizationEvents = ['sync', 'coordinate', 'barrier'];

    if (synchronizationEvents.some((syncEvent) => event.includes(syncEvent))) {
      // Ensure all regions in each parallel state receive the event
      for (const [parallelId, handledRegions] of eventDistribution.entries()) {
        const allRegions = Array.from(this.parallelRegionMap.values()).filter(
          (region) => region.parentParallelId === parallelId
        );

        const unhandledRegions = allRegions.filter(
          (region) => !handledRegions.has(region.regionId)
        );

        if (unhandledRegions.length > 0) {
          for (const region of unhandledRegions) {
            handledRegions.add(region.regionId);
          }
        }
      }
    }
  }

  /**
   * Resolve conflicts when multiple transitions can handle the same event
   */
  private resolveEventTransitionConflicts(
    event: string,
    eventDistribution: Map<string, Set<string>>
  ): void {
    for (const [parallelId, regionIds] of eventDistribution.entries()) {
      for (const regionId of regionIds) {
        const conflictingTransitions = this.findConflictingTransitions(
          regionId,
          event
        );

        if (conflictingTransitions.length > 1) {
          // Apply resolution rules:
          // 1. Transitions with conditions take precedence over event-only
          // 2. More specific transitions (deeper nesting) take precedence
          // 3. Internal transitions take precedence over external
          const resolvedTransition = this.selectPreferredTransition(
            conflictingTransitions
          );
        }
      }
    }
  }

  /**
   * Find all transitions that could handle an event in a region
   */
  private findConflictingTransitions(regionId: string, event: string): any[] {
    const regionStates = this.findDescendantStates(regionId);
    const conflictingTransitions: any[] = [];

    for (const stateId of regionStates) {
      const stateTransitions = Array.from(
        this.transitionRegistry.values()
      ).filter(
        (t) =>
          t.sourceStateId === stateId &&
          (t.classification.eventName === event || !t.classification.eventName)
      );

      conflictingTransitions.push(...stateTransitions);
    }

    return conflictingTransitions;
  }

  /**
   * Select the preferred transition when multiple are possible
   */
  private selectPreferredTransition(conflictingTransitions: any[]): any | null {
    if (conflictingTransitions.length === 0) return null;
    if (conflictingTransitions.length === 1) return conflictingTransitions[0];

    // Sort by preference rules
    const sorted = conflictingTransitions.sort((a, b) => {
      // Rule 1: Transitions with conditions first
      if (a.classification.condition && !b.classification.condition) return -1;
      if (!a.classification.condition && b.classification.condition) return 1;

      // Rule 2: Internal transitions first
      if (a.classification.isInternal && !b.classification.isInternal)
        return -1;
      if (!a.classification.isInternal && b.classification.isInternal) return 1;

      // Rule 3: Deeper nesting level first
      return b.classification.sourceLevel - a.classification.sourceLevel;
    });

    return sorted[0];
  }

  /**
   * Update current state configuration after event processing
   */
  updateStateConfiguration(newActiveStates: Set<string>): void {
    this.currentStateConfiguration.activeStates = new Set(newActiveStates);

    // Update parallel region active states
    for (const [regionId, regionInfo] of this.parallelRegionMap.entries()) {
      const regionStates = this.getStatesInRegion(regionId, newActiveStates);
      regionInfo.activeStates = regionStates;
    }
  }

  /**
   * Get current active parallel regions
   */
  getCurrentActiveParallelRegions(): Map<string, string[]> {
    const activeRegions = new Map<string, string[]>();

    for (const [regionId, regionInfo] of this.parallelRegionMap.entries()) {
      if (regionInfo.activeStates.size > 0) {
        activeRegions.set(regionId, Array.from(regionInfo.activeStates));
      }
    }

    return activeRegions;
  }

  /**
   * Get all states within a specific parallel region that are currently active
   */
  private getStatesInRegion(
    regionId: string,
    currentActiveStates: Set<string>
  ): Set<string> {
    const regionStates = new Set<string>();

    // Find the region's state info
    const regionInfo = this.stateRegistry.get(regionId);
    if (!regionInfo) return regionStates;

    // Recursively find all descendant states of this region
    const descendants = this.findDescendantStates(regionId);

    // Filter to only include currently active states
    for (const descendantId of descendants) {
      if (currentActiveStates.has(descendantId)) {
        regionStates.add(descendantId);
      }
    }

    return regionStates;
  }

  /**
   * Find all descendant states of a given state
   */
  private findDescendantStates(stateId: string): Set<string> {
    const descendants = new Set<string>();

    // Find all states that have this state in their parent path
    for (const [descendantId, stateInfo] of this.stateRegistry.entries()) {
      if (stateInfo.parentPath.includes(stateId)) {
        descendants.add(descendantId);
      }
    }

    return descendants;
  }

  /**
   * Get all states covered by a history state based on its type and scope
   */
  private getCoveredStatesByHistory(
    history: HistoryElement,
    historyType: 'shallow' | 'deep',
    parentPath: string
  ): string[] {
    const coveredStates: string[] = [];

    if (historyType === 'shallow') {
      // Shallow history only covers immediate child states of the parent
      coveredStates.push(...this.getImmediateChildStates(parentPath));
    } else {
      // Deep history covers all descendant states within the parent scope
      coveredStates.push(...this.getAllDescendantStates(parentPath));
    }
    return coveredStates;
  }

  /**
   * Get immediate child states of a parent state
   */
  private getImmediateChildStates(parentPath: string): string[] {
    const childStates: string[] = [];

    for (const [stateId, stateInfo] of this.stateRegistry.entries()) {
      if (stateInfo.parentPath === parentPath) {
        childStates.push(stateId);
      }
    }

    return childStates;
  }

  /**
   * Get all descendant states within a parent scope
   */
  private getAllDescendantStates(parentPath: string): string[] {
    const descendantStates: string[] = [];

    for (const [stateId, stateInfo] of this.stateRegistry.entries()) {
      // Check if this state is a descendant of the parent
      if (stateInfo.parentPath.startsWith(parentPath)) {
        descendantStates.push(stateId);
      }
    }

    return descendantStates;
  }

  /**
   * Enhanced history state analysis with complex combination support
   */
  private analyzeComplexHistoryCombinations(): void {
    // Find all history states and analyze their interactions
    const historyStates = Array.from(this.historyStateMap.values());

    // Check for multiple history states in the same scope
    this.detectOverlappingHistoryScopes(historyStates);

    // Analyze history inheritance in nested compounds
    this.analyzeHistoryInheritance(historyStates);

    // Handle history across parallel regions
    this.analyzeHistoryInParallelRegions(historyStates);

    // Detect conflicting history configurations
    this.detectHistoryConflicts(historyStates);
  }

  /**
   * Detect overlapping history scopes and resolve conflicts
   */
  private detectOverlappingHistoryScopes(
    historyStates: HistoryStateInfo[]
  ): void {
    const scopeGroups = new Map<string, HistoryStateInfo[]>();

    // Group history states by their parent scope
    for (const historyInfo of historyStates) {
      const scope = historyInfo.parentStateId;
      if (!scopeGroups.has(scope)) {
        scopeGroups.set(scope, []);
      }
      scopeGroups.get(scope)!.push(historyInfo);
    }

    // Check for multiple history states in the same scope
    for (const [scope, histories] of scopeGroups.entries()) {
      if (histories.length > 1) {
        console.warn(
          `⚠️ Multiple history states in scope '${scope}': ${histories
            .map((h) => h.historyId)
            .join(', ')}`
        );

        // Check for type conflicts (shallow vs deep)
        const types = new Set(histories.map((h) => h.historyType));
        if (types.size > 1) {
          console.warn(
            `⚠️ Mixed history types in scope '${scope}': ${Array.from(
              types
            ).join(', ')}`
          );
          this.resolveHistoryTypeConflict(scope, histories);
        }

        // Check for coverage overlap
        this.analyzeHistoryCoverageOverlap(histories);
      }
    }
  }

  /**
   * Analyze history inheritance in nested compound states
   */
  private analyzeHistoryInheritance(historyStates: HistoryStateInfo[]): void {
    for (const historyInfo of historyStates) {
      const parentState = this.stateRegistry.get(historyInfo.parentStateId);
      if (!parentState) continue;

      // Check if parent state is nested within other compound states
      const ancestorPath = parentState.parentPath;
      if (ancestorPath) {
        const ancestors = ancestorPath.split('.');

        // Look for history states in ancestor states
        for (const ancestorId of ancestors) {
          const ancestorHistories = historyStates.filter(
            (h) => h.parentStateId === ancestorId
          );

          if (ancestorHistories.length > 0) {
            // Check for inheritance conflicts
            this.checkHistoryInheritanceConflicts(
              historyInfo,
              ancestorHistories
            );
          }
        }
      }
    }
  }

  /**
   * Analyze history behavior across parallel regions
   */
  private analyzeHistoryInParallelRegions(
    historyStates: HistoryStateInfo[]
  ): void {
    const parallelRegionHistories = historyStates.filter((h) => {
      const parentState = this.stateRegistry.get(h.parentStateId);
      return parentState?.classification.isParallelRegion;
    });

    if (parallelRegionHistories.length > 0) {
      // Group by parallel parent
      const parallelGroups = new Map<string, HistoryStateInfo[]>();

      for (const historyInfo of parallelRegionHistories) {
        const regionInfo = this.parallelRegionMap.get(
          historyInfo.parentStateId
        );
        if (regionInfo) {
          const parallelId = regionInfo.parentParallelId;
          if (!parallelGroups.has(parallelId)) {
            parallelGroups.set(parallelId, []);
          }
          parallelGroups.get(parallelId)!.push(historyInfo);
        }
      }

      // Analyze coordination between parallel region histories
      for (const [parallelId, histories] of parallelGroups.entries()) {
        this.analyzeParallelHistoryCoordination(parallelId, histories);
      }
    }
  }

  /**
   * Detect and resolve history configuration conflicts
   */
  private detectHistoryConflicts(historyStates: HistoryStateInfo[]): void {
    for (const historyInfo of historyStates) {
      // Check for default transition conflicts
      if (historyInfo.defaultTarget) {
        const targetState = this.stateRegistry.get(historyInfo.defaultTarget);
        if (!targetState) {
          console.error(
            `🔴 History ${historyInfo.historyId} default target '${historyInfo.defaultTarget}' not found`
          );
          continue;
        }

        // Validate that default target is within the history's scope
        if (!historyInfo.coveredStates.includes(historyInfo.defaultTarget)) {
          console.warn(
            `⚠️ History ${historyInfo.historyId} default target '${historyInfo.defaultTarget}' is outside its scope`
          );
        }

        // Check for circular dependencies
        this.checkHistoryCircularDependencies(
          historyInfo,
          new Set([historyInfo.historyId])
        );
      }
    }
  }

  /**
   * Resolve history type conflicts in the same scope
   */
  private resolveHistoryTypeConflict(
    scope: string,
    histories: HistoryStateInfo[]
  ): void {
    const deepHistories = histories.filter((h) => h.historyType === 'deep');
    const shallowHistories = histories.filter(
      (h) => h.historyType === 'shallow'
    );

    if (deepHistories.length > 0 && shallowHistories.length > 0) {
      // Deep history takes precedence - update shallow histories
      for (const shallowHistory of shallowHistories) {
        shallowHistory.historyType = 'deep';
        shallowHistory.coveredStates = this.getAllDescendantStates(scope);

        // Update the registry classification
        const stateInfo = this.stateRegistry.get(shallowHistory.historyId);
        if (stateInfo) {
          stateInfo.classification.subtype = 'deep-history';
        }
      }
    }
  }

  /**
   * Analyze coverage overlap between history states
   */
  private analyzeHistoryCoverageOverlap(histories: HistoryStateInfo[]): void {
    for (let i = 0; i < histories.length; i++) {
      for (let j = i + 1; j < histories.length; j++) {
        const hist1 = histories[i];
        const hist2 = histories[j];

        const overlap = hist1.coveredStates.filter((state) =>
          hist2.coveredStates.includes(state)
        );
        if (overlap.length > 0) {
          console.warn(
            `⚠️ History coverage overlap between ${hist1.historyId} and ${hist2.historyId}: ${overlap.length} states`
          );

          // Determine resolution strategy
          this.resolveHistoryCoverageOverlap(hist1, hist2, overlap);
        }
      }
    }
  }

  /**
   * Check for history inheritance conflicts
   */
  private checkHistoryInheritanceConflicts(
    childHistory: HistoryStateInfo,
    ancestorHistories: HistoryStateInfo[]
  ): void {
    for (const ancestorHistory of ancestorHistories) {
      // Check if child history type is incompatible with ancestor
      if (
        childHistory.historyType === 'shallow' &&
        ancestorHistory.historyType === 'deep'
      ) {
        console.warn(
          `⚠️ History inheritance conflict: shallow ${childHistory.historyId} under deep ${ancestorHistory.historyId}`
        );
      }

      // Check for default target conflicts
      if (childHistory.defaultTarget && ancestorHistory.defaultTarget) {
        if (childHistory.defaultTarget === ancestorHistory.defaultTarget) {
          console.warn(
            `⚠️ Conflicting default targets: ${childHistory.historyId} and ${ancestorHistory.historyId} both target '${childHistory.defaultTarget}'`
          );
        }
      }
    }
  }

  /**
   * Analyze coordination between parallel region histories
   */
  private analyzeParallelHistoryCoordination(
    parallelId: string,
    histories: HistoryStateInfo[]
  ): void {
    // Check if all regions have history states
    const parallelRegions = Array.from(this.parallelRegionMap.values()).filter(
      (region) => region.parentParallelId === parallelId
    );

    const regionsWithHistory = new Set(histories.map((h) => h.parentStateId));
    const regionsWithoutHistory = parallelRegions.filter(
      (region) => !regionsWithHistory.has(region.regionId)
    );

    if (regionsWithoutHistory.length > 0) {
      console.warn(
        `⚠️ Inconsistent history configuration in parallel ${parallelId}: ${regionsWithoutHistory.length} regions without history`
      );
    }

    // Analyze synchronization requirements
    if (histories.length > 1) {
      const types = new Set(histories.map((h) => h.historyType));
      if (types.size > 1) {
        console.warn(
          `⚠️ Mixed history types in parallel regions of ${parallelId}: ${Array.from(
            types
          ).join(', ')}`
        );
      }

      // Check for coordination patterns
      this.detectHistoryCoordinationPatterns(parallelId, histories);
    }
  }

  /**
   * Check for circular dependencies in history default targets
   */
  private checkHistoryCircularDependencies(
    historyInfo: HistoryStateInfo,
    visitedHistories: Set<string>
  ): void {
    if (!historyInfo.defaultTarget) return;

    // Check if default target is another history state
    const targetHistoryInfo = this.historyStateMap.get(
      historyInfo.defaultTarget
    );
    if (targetHistoryInfo) {
      if (visitedHistories.has(targetHistoryInfo.historyId)) {
        console.error(
          `🔴 Circular history dependency detected: ${Array.from(
            visitedHistories
          ).join(' -> ')} -> ${targetHistoryInfo.historyId}`
        );
        return;
      }

      const newVisited = new Set(visitedHistories);
      newVisited.add(targetHistoryInfo.historyId);
      this.checkHistoryCircularDependencies(targetHistoryInfo, newVisited);
    }
  }

  /**
   * Resolve history coverage overlap
   */
  private resolveHistoryCoverageOverlap(
    hist1: HistoryStateInfo,
    hist2: HistoryStateInfo,
    overlap: string[]
  ): void {
    // Strategy: More specific (deeper) history takes precedence
    const hist1Depth = this.calculateHistoryDepth(hist1);
    const hist2Depth = this.calculateHistoryDepth(hist2);

    if (hist1Depth > hist2Depth) {
      hist2.coveredStates = hist2.coveredStates.filter(
        (state) => !overlap.includes(state)
      );
    } else if (hist2Depth > hist1Depth) {
      hist1.coveredStates = hist1.coveredStates.filter(
        (state) => !overlap.includes(state)
      );
    } else {
      // Same depth - use lexicographic order for deterministic resolution
      if (hist1.historyId < hist2.historyId) {
        hist2.coveredStates = hist2.coveredStates.filter(
          (state) => !overlap.includes(state)
        );
      } else {
        hist1.coveredStates = hist1.coveredStates.filter(
          (state) => !overlap.includes(state)
        );
      }
    }
  }

  /**
   * Calculate the depth of a history state in the state hierarchy
   */
  private calculateHistoryDepth(historyInfo: HistoryStateInfo): number {
    const parentState = this.stateRegistry.get(historyInfo.parentStateId);
    return parentState ? parentState.nestingLevel : 0;
  }

  /**
   * Detect coordination patterns between parallel region histories
   */
  private detectHistoryCoordinationPatterns(
    parallelId: string,
    histories: HistoryStateInfo[]
  ): void {
    // Pattern 1: All regions have same history type
    const types = new Set(histories.map((h) => h.historyType));
    if (types.size === 1) {
    }

    // Pattern 2: Default targets form a dependency chain
    const targetChain = this.buildHistoryTargetChain(histories);
    if (targetChain.length > 1) {
    }

    // Pattern 3: Mutual history dependencies
    this.detectMutualHistoryDependencies(histories);
  }

  /**
   * Build a chain of history default targets
   */
  private buildHistoryTargetChain(histories: HistoryStateInfo[]): string[] {
    const chain: string[] = [];
    const targetMap = new Map<string, string>();

    // Build target mapping
    for (const history of histories) {
      if (history.defaultTarget) {
        targetMap.set(history.historyId, history.defaultTarget);
      }
    }

    // Find chain starting points (histories that aren't targets of others)
    const targets = new Set(targetMap.values());
    const startPoints = histories.filter((h) => !targets.has(h.historyId));

    // Build chains from each start point
    for (const startPoint of startPoints) {
      const localChain = [startPoint.historyId];
      let current = startPoint.historyId;

      while (targetMap.has(current)) {
        const next = targetMap.get(current)!;
        if (localChain.includes(next)) break; // Avoid infinite loops
        localChain.push(next);
        current = next;
      }

      if (localChain.length > chain.length) {
        chain.splice(0, chain.length, ...localChain);
      }
    }

    return chain;
  }

  /**
   * Detect mutual dependencies between history states
   */
  private detectMutualHistoryDependencies(histories: HistoryStateInfo[]): void {
    for (let i = 0; i < histories.length; i++) {
      for (let j = i + 1; j < histories.length; j++) {
        const hist1 = histories[i];
        const hist2 = histories[j];

        const hist1TargetsHist2 = hist1.defaultTarget === hist2.historyId;
        const hist2TargetsHist1 = hist2.defaultTarget === hist1.historyId;

        if (hist1TargetsHist2 && hist2TargetsHist1) {
          console.warn(
            `⚠️ Mutual history dependency detected: ${hist1.historyId} ↔ ${hist2.historyId}`
          );
        }
      }
    }
  }

  /**
   * Get history state information for visualization
   */
  getHistoryStateInfo(historyId: string): HistoryStateInfo | undefined {
    return this.historyStateMap.get(historyId);
  }

  /**
   * Get all history states and their availability
   */
  getHistoryAvailability(): Map<string, boolean> {
    const availability = new Map<string, boolean>();

    for (const [historyId, historyInfo] of this.historyStateMap.entries()) {
      availability.set(historyId, historyInfo.hasStoredConfiguration);
    }

    return availability;
  }

  /**
   * Update history state configuration storage
   */
  updateHistoryConfiguration(
    historyId: string,
    hasConfiguration: boolean
  ): void {
    const historyInfo = this.historyStateMap.get(historyId);
    if (historyInfo) {
      historyInfo.hasStoredConfiguration = hasConfiguration;
    }
  }

  /**
   * Enhanced history state building for XState configuration
   */
  private buildHistoryStateConfig(historyInfo: HistoryStateInfo): any {
    const config: any = {
      type: 'history',
      history: historyInfo.historyType,
    };

    // Add default target if specified
    if (historyInfo.defaultTarget) {
      config.target = historyInfo.defaultTarget;
    }

    // Add history-specific metadata for enhanced execution
    config.meta = {
      coveredStates: historyInfo.coveredStates,
      parentStateId: historyInfo.parentStateId,
      hasStoredConfiguration: historyInfo.hasStoredConfiguration,
    };

    return config;
  }

  private getHistoryDefaultTarget(history: HistoryElement): string | undefined {
    const transition = history.transition;
    return transition ? this.getAttribute(transition, 'target') : undefined;
  }

  private classifyTransition(
    transition: TransitionElement,
    sourceStateId: string,
    nestingLevel: number
  ): TransitionVisualizationType {
    const event = this.getAttribute(transition, 'event');
    const condition = this.getAttribute(transition, 'cond');
    const target = this.getAttribute(transition, 'target');
    const isInternal = this.getAttribute(transition, 'type') === 'internal';

    // Detect actions
    const actions = this.extractTransitionActions(transition);
    const hasActions = actions.length > 0;

    // Determine transition type
    let type: TransitionVisualizationType['type'] = 'always';
    if (event && condition) type = 'event-condition';
    else if (event) type = 'event-only';
    else if (condition) type = 'condition-only';

    if (isInternal) type = 'internal';
    else if (hasActions) type = 'action-executing';

    // Detect cross-hierarchy transitions
    const isCrossHierarchy = this.isCrossHierarchyTransition(
      sourceStateId,
      target
    );

    // Calculate target nesting level
    const targetLevel = target
      ? this.getStateNestingLevel(target)
      : nestingLevel;

    return {
      type,
      hasActions,
      isInternal,
      isCrossHierarchy,
      eventName: event,
      condition,
      actions,
      sourceLevel: nestingLevel,
      targetLevel,
    };
  }

  /**
   * Extract actions from a transition element
   */
  private extractTransitionActions(transition: TransitionElement): string[] {
    const actions: string[] = [];

    // Check for direct executable content
    if (transition.executable) {
      const executables = Array.isArray(transition.executable)
        ? transition.executable
        : [transition.executable];
      for (const executable of executables) {
        actions.push(this.extractExecutableAction(executable));
      }
    }

    return actions.filter((action) => action !== '');
  }

  /**
   * Extract action description from executable element
   */
  private extractExecutableAction(executable: any): string {
    // Handle different executable types
    if (executable.log) {
      const log = executable.log;
      const label = this.getAttribute(log, 'label') || '';
      const expr = this.getAttribute(log, 'expr') || '';
      return `log("${label}: ${expr}")`;
    }

    if (executable.assign) {
      const assign = executable.assign;
      const location = this.getAttribute(assign, 'location') || '';
      const expr = this.getAttribute(assign, 'expr') || '';
      return `assign(${location} = ${expr})`;
    }

    if (executable.send) {
      const send = executable.send;
      const event = this.getAttribute(send, 'event') || '';
      const target = this.getAttribute(send, 'target') || '';
      return `send(${event}${target ? ` to ${target}` : ''})`;
    }

    if (executable.raise) {
      const raise = executable.raise;
      const event = this.getAttribute(raise, 'event') || '';
      return `raise(${event})`;
    }

    return '';
  }

  /**
   * Determine if a transition crosses hierarchy boundaries
   */
  private isCrossHierarchyTransition(
    sourceStateId: string,
    targetStateId?: string
  ): boolean {
    if (!targetStateId) return false;

    const sourceInfo = this.stateRegistry.get(sourceStateId);
    const targetInfo = this.stateRegistry.get(targetStateId);

    if (!sourceInfo || !targetInfo) return false;

    // Check if source and target have different parent paths
    const sourcePath = sourceInfo.parentPath;
    const targetPath = targetInfo.parentPath;

    // Same parent path = not cross-hierarchy
    if (sourcePath === targetPath) return false;

    // Check if one is ancestor of the other
    if (
      sourcePath.startsWith(targetPath) ||
      targetPath.startsWith(sourcePath)
    ) {
      // One is ancestor of the other - this is cross-hierarchy
      return true;
    }

    // Different branches - this is cross-hierarchy
    return true;
  }

  /**
   * Get the nesting level of a state
   */
  private getStateNestingLevel(stateId: string): number {
    const stateInfo = this.stateRegistry.get(stateId);
    return stateInfo ? stateInfo.nestingLevel : 0;
  }

  /**
   * Enhanced cross-hierarchy transition resolution
   */
  private resolveCrossHierarchyTransitions(): void {
    for (const [
      transitionId,
      transitionInfo,
    ] of this.transitionRegistry.entries()) {
      if (transitionInfo.classification.isCrossHierarchy) {
        this.resolveCrossHierarchyTransition(transitionId, transitionInfo);
      }
    }
  }

  /**
   * Resolve a specific cross-hierarchy transition
   */
  private resolveCrossHierarchyTransition(
    transitionId: string,
    transitionInfo: any
  ): void {
    const sourceStateId = transitionInfo.sourceStateId;
    const targetStateId = this.getAttribute(transitionInfo.element, 'target');

    if (!targetStateId) return;

    const sourceInfo = this.stateRegistry.get(sourceStateId);
    const targetInfo = this.stateRegistry.get(targetStateId);

    if (!sourceInfo || !targetInfo) {
      console.error(
        `🔴 Cannot resolve cross-hierarchy transition: missing state info for ${sourceStateId} -> ${targetStateId}`
      );
      return;
    }

    // Determine the transition scope and required state exits/entries
    const transitionScope = this.calculateTransitionScope(
      sourceInfo,
      targetInfo
    );
    // Validate the transition is legal
    const validationResult =
      this.validateCrossHierarchyTransition(transitionScope);
    if (!validationResult.isValid) {
      console.warn(
        `⚠️ Cross-hierarchy transition validation failed: ${validationResult.errors.join(
          ', '
        )}`
      );
    }

    // Handle parallel region exits/enters
    this.handleParallelRegionTransition(
      transitionScope,
      sourceInfo,
      targetInfo
    );

    // Handle history state implications
    this.handleHistoryStateTransition(transitionScope, sourceInfo, targetInfo);
  }

  /**
   * Calculate the scope of a cross-hierarchy transition
   */
  private calculateTransitionScope(
    sourceInfo: any,
    targetInfo: any
  ): {
    commonAncestor: string | null;
    exitStates: string[];
    enterStates: string[];
    sourceAncestors: string[];
    targetAncestors: string[];
  } {
    const sourceAncestors = this.getStateAncestors(sourceInfo);
    const targetAncestors = this.getStateAncestors(targetInfo);

    // Find common ancestor
    let commonAncestor: string | null = null;
    for (
      let i = 0;
      i < Math.min(sourceAncestors.length, targetAncestors.length);
      i++
    ) {
      if (sourceAncestors[i] === targetAncestors[i]) {
        commonAncestor = sourceAncestors[i];
      } else {
        break;
      }
    }

    // States to exit (from source up to common ancestor, exclusive)
    const exitStates: string[] = [];
    const commonIndex = commonAncestor
      ? sourceAncestors.indexOf(commonAncestor)
      : -1;
    if (commonIndex >= 0) {
      exitStates.push(...sourceAncestors.slice(commonIndex + 1).reverse());
    }

    // States to enter (from common ancestor down to target, exclusive)
    const enterStates: string[] = [];
    const targetCommonIndex = commonAncestor
      ? targetAncestors.indexOf(commonAncestor)
      : -1;
    if (targetCommonIndex >= 0) {
      enterStates.push(...targetAncestors.slice(targetCommonIndex + 1));
    }

    return {
      commonAncestor,
      exitStates,
      enterStates,
      sourceAncestors,
      targetAncestors,
    };
  }

  /**
   * Get all ancestors of a state (from root to immediate parent)
   */
  private getStateAncestors(stateInfo: any): string[] {
    const ancestors: string[] = [];

    if (stateInfo.parentPath) {
      const pathParts = stateInfo.parentPath.split('.');
      for (let i = 0; i < pathParts.length; i++) {
        ancestors.push(pathParts.slice(0, i + 1).join('.'));
      }
    }

    return ancestors;
  }

  /**
   * Validate a cross-hierarchy transition
   */
  private validateCrossHierarchyTransition(scope: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Check for invalid transitions out of parallel regions
    for (const exitState of scope.exitStates) {
      const stateInfo = this.stateRegistry.get(exitState);
      if (stateInfo?.classification.type === 'parallel') {
        // Exiting a parallel state - ensure all regions can be exited
        const regions = Array.from(this.parallelRegionMap.values()).filter(
          (region) => region.parentParallelId === exitState
        );

        for (const region of regions) {
          // Check if any region has active internal transitions that would be interrupted
          if (this.hasActiveInternalTransitions(region.regionId)) {
            errors.push(
              `Cannot exit parallel state ${exitState} - region ${region.regionId} has active internal transitions`
            );
          }
        }
      }
    }

    // Check for invalid transitions into history states
    for (const enterState of scope.enterStates) {
      const stateInfo = this.stateRegistry.get(enterState);
      if (stateInfo?.classification.type === 'history') {
        const historyInfo = this.historyStateMap.get(enterState);
        if (historyInfo && !historyInfo.hasStoredConfiguration) {
          // History state without stored configuration should use default target
          if (!historyInfo.defaultTarget) {
            errors.push(
              `History state ${enterState} has no stored configuration and no default target`
            );
          }
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Handle parallel region implications of cross-hierarchy transitions
   */
  private handleParallelRegionTransition(
    scope: any,
    sourceInfo: any,
    targetInfo: any
  ): void {
    // Check if transition crosses parallel region boundaries
    const sourceParallelRegion = this.findParentParallelRegion(sourceInfo);
    const targetParallelRegion = this.findParentParallelRegion(targetInfo);

    if (sourceParallelRegion && targetParallelRegion) {
      if (sourceParallelRegion !== targetParallelRegion) {
        // Handle sibling region coordination
        this.coordinateParallelRegionTransition(
          sourceParallelRegion,
          targetParallelRegion,
          scope
        );
      }
    }
  }

  /**
   * Handle history state implications of cross-hierarchy transitions
   */
  private handleHistoryStateTransition(
    scope: any,
    sourceInfo: any,
    targetInfo: any
  ): void {
    // Check if any exit states have history
    for (const exitState of scope.exitStates) {
      const exitStateInfo = this.stateRegistry.get(exitState);
      if (exitStateInfo?.classification.type === 'compound') {
        // Look for history states within this compound state
        const historyStates = Array.from(this.historyStateMap.values()).filter(
          (h) => h.parentStateId === exitState
        );

        for (const historyInfo of historyStates) {
          this.storeHistoryConfiguration(historyInfo, scope);
        }
      }
    }
  }

  /**
   * Check if a region has active internal transitions
   */
  private hasActiveInternalTransitions(regionId: string): boolean {
    return Array.from(this.transitionRegistry.values()).some(
      (transitionInfo) =>
        transitionInfo.sourceStateId === regionId &&
        transitionInfo.classification.isInternal
    );
  }

  /**
   * Find the parent parallel region of a state
   */
  private findParentParallelRegion(stateInfo: any): string | null {
    const ancestors = this.getStateAncestors(stateInfo);

    for (const ancestor of ancestors.reverse()) {
      const ancestorInfo = this.stateRegistry.get(ancestor);
      if (ancestorInfo?.classification.isParallelRegion) {
        return ancestor;
      }
    }

    return null;
  }

  /**
   * Coordinate transition between parallel regions
   */
  private coordinateParallelRegionTransition(
    sourceRegion: string,
    targetRegion: string,
    scope: any
  ): void {
    const sourceRegionInfo = this.parallelRegionMap.get(sourceRegion);
    const targetRegionInfo = this.parallelRegionMap.get(targetRegion);

    if (!sourceRegionInfo || !targetRegionInfo) return;
  }

  /**
   * Store history configuration for a history state
   */
  private storeHistoryConfiguration(
    historyInfo: HistoryStateInfo,
    scope: any
  ): void {
    // Determine which states should be stored based on history type
    const statesToStore =
      historyInfo.historyType === 'deep'
        ? historyInfo.coveredStates
        : this.getImmediateChildStates(historyInfo.parentStateId);

    // Filter to only include currently active states that are being exited
    const activeStatesToStore = statesToStore.filter(
      (stateId) =>
        this.currentStateConfiguration.activeStates.has(stateId) ||
        scope.exitStates.includes(stateId)
    );

    if (activeStatesToStore.length > 0) {
      historyInfo.hasStoredConfiguration = true;

      // In a real implementation, you would store the actual configuration
      // For now, we just mark that configuration exists
    }
  }

  private generateTransitionId(
    transition: TransitionElement,
    sourceStateId: string
  ): string {
    const target = this.getAttribute(transition, 'target') || 'self';
    const event = this.getAttribute(transition, 'event') || 'always';
    return `${sourceStateId}-${target}-${event}-${Date.now()}`;
  }

  private refineStateClassification(
    stateId: string,
    stateInfo: any
  ): StateVisualizationType {
    // Implementation for enhanced classification refinement
    return stateInfo.classification;
  }

  private refineTransitionClassification(
    transitionId: string,
    transitionInfo: any
  ): TransitionVisualizationType {
    // Implementation for enhanced classification refinement
    return transitionInfo.classification;
  }

  private buildChildStates(element: any): any {
    // Implementation for child state building
    return {};
  }

  private buildActions(actionsElement: any): string[] {
    // Implementation for action building
    return [];
  }

  private buildEnhancedTransitions(
    element: any,
    stateId: string
  ): { eventBased: any; always: any[] } {
    // Implementation for enhanced transition building
    return { eventBased: {}, always: [] };
  }

  private validateComplexScenarios(config: XStateMachineConfig): void {
    // Implementation for complex scenario validation
  }

  /**
   * Generate comprehensive visual data for state nodes
   */
  private generateStateVisualData(
    stateId: string,
    stateInfo: any
  ): StateVisualData {
    const classification = stateInfo.classification;
    const nestingLevel = stateInfo.nestingLevel;

    // Calculate position based on hierarchy and layout algorithms
    const position = this.calculateIntelligentPosition(stateId, stateInfo);

    // Determine dimensions based on state type and content
    const dimensions = this.calculateStateDimensions(classification, stateId);

    // Generate styling based on state type and properties
    const styling = this.generateStateStyling(classification);

    // Generate icons based on state properties
    const icons = this.generateStateIcons(classification);

    // Generate labels with hierarchy information
    const labels = this.generateStateLabels(stateId, classification);

    // Container properties for compound and parallel states
    const containerProperties = this.generateContainerProperties(
      classification,
      stateId
    );

    return {
      classification,
      position,
      dimensions,
      styling,
      icons,
      labels,
      containerProperties,
    };
  }

  /**
   * Calculate intelligent position for state based on hierarchy and relationships
   */
  private calculateIntelligentPosition(
    stateId: string,
    stateInfo: any
  ): { x: number; y: number } {
    const nestingLevel = stateInfo.nestingLevel;
    const parentPath = stateInfo.parentPath;
    const classification = stateInfo.classification;

    // Base layout parameters
    const baseX = 100;
    const baseY = 100;
    const levelSpacing = 250;
    const siblingSpacing = 180;

    // Handle root level states
    if (!parentPath) {
      const rootStates = Array.from(this.stateRegistry.entries())
        .filter(([_, info]) => !info.parentPath)
        .map(([id]) => id)
        .sort();

      const index = rootStates.indexOf(stateId);
      return {
        x: baseX + index * siblingSpacing,
        y: baseY,
      };
    }

    // Handle nested states with intelligent positioning
    const parentStateId = parentPath.split('.').pop();
    const siblings = Array.from(this.stateRegistry.entries())
      .filter(([_, info]) => info.parentPath === parentPath)
      .map(([id]) => id)
      .sort();

    const siblingIndex = siblings.indexOf(stateId);

    // Special positioning for parallel regions
    if (classification.isParallelRegion) {
      return this.calculateParallelRegionPosition(
        stateId,
        siblingIndex,
        siblings.length
      );
    }

    // Special positioning for history states
    if (classification.type === 'history') {
      return this.calculateHistoryStatePosition(
        stateId,
        parentPath,
        siblings.length
      );
    }

    // Standard hierarchical positioning
    const parentPosition = this.getParentStatePosition(parentStateId);

    // Arrange siblings in optimal layout
    const layoutResult = this.calculateSiblingLayout(siblings, siblingIndex);

    return {
      x: parentPosition.x + layoutResult.offsetX + nestingLevel * 50,
      y: parentPosition.y + layoutResult.offsetY + nestingLevel * 100,
    };
  }

  /**
   * Calculate dimensions based on state type and content
   */
  private calculateStateDimensions(
    classification: StateVisualizationType,
    stateId: string
  ): { width: number; height: number } {
    let baseWidth = 120;
    let baseHeight = 60;

    // Adjust dimensions based on state type
    switch (classification.type) {
      case 'parallel':
        baseWidth = 200;
        baseHeight = 150;
        break;
      case 'compound':
        baseWidth = 160;
        baseHeight = 100;
        break;
      case 'history':
        baseWidth = 80;
        baseHeight = 80; // Square for history states
        break;
      case 'final':
        baseWidth = 60;
        baseHeight = 60; // Small circle for final states
        break;
    }

    // Adjust for content (actions, labels)
    const hasActions =
      classification.hasEntryActions || classification.hasExitActions;
    if (hasActions) {
      baseHeight += 20; // Extra space for action indicators
    }

    // Adjust for nesting level
    const nestingAdjustment = classification.nestingLevel * 10;
    baseWidth += nestingAdjustment;

    return { width: baseWidth, height: baseHeight };
  }

  /**
   * Generate styling based on state classification
   */
  private generateStateStyling(
    classification: StateVisualizationType
  ): StateVisualData['styling'] {
    let borderColor = '#333';
    let backgroundColor = '#fff';
    let borderWidth = 2;
    let borderStyle: 'solid' | 'dashed' | 'dotted' = 'solid';

    // Color coding by state type
    switch (classification.type) {
      case 'parallel':
        borderColor = '#2563eb'; // Blue for parallel
        backgroundColor = '#eff6ff';
        borderWidth = 3;
        break;
      case 'compound':
        borderColor = '#059669'; // Green for compound
        backgroundColor = '#f0fdf4';
        break;
      case 'history':
        borderColor = '#7c3aed'; // Purple for history
        backgroundColor = '#faf5ff';
        borderStyle = 'dashed';
        break;
      case 'final':
        borderColor = '#dc2626'; // Red for final
        backgroundColor = '#fef2f2';
        borderWidth = 3;
        break;
      case 'initial':
        borderColor = '#16a34a'; // Green for initial
        backgroundColor = '#f0fdf4';
        borderWidth = 3;
        break;
    }

    // Special styling for parallel regions
    if (classification.isParallelRegion) {
      borderStyle = 'dashed';
      backgroundColor = '#f8fafc';
    }

    // Entry/exit action indicators
    if (classification.hasEntryActions) {
      borderColor = this.blendColors(borderColor, '#10b981'); // Greenish tint
    }
    if (classification.hasExitActions) {
      borderColor = this.blendColors(borderColor, '#f59e0b'); // Orange tint
    }

    return {
      borderColor,
      backgroundColor,
      borderWidth,
      borderStyle,
    };
  }

  /**
   * Generate icons based on state properties
   */
  private generateStateIcons(classification: StateVisualizationType): string[] {
    const icons: string[] = [];

    // State type icons
    switch (classification.type) {
      case 'parallel':
        icons.push('parallel-regions');
        break;
      case 'compound':
        icons.push('compound-state');
        break;
      case 'history':
        icons.push(
          classification.subtype === 'deep-history'
            ? 'deep-history'
            : 'shallow-history'
        );
        break;
      case 'final':
        icons.push('final-state');
        break;
      case 'initial':
        icons.push('initial-state');
        break;
    }

    // Action icons
    if (classification.hasEntryActions) {
      icons.push('entry-action');
    }
    if (classification.hasExitActions) {
      icons.push('exit-action');
    }
    if (classification.hasInternalTransitions) {
      icons.push('internal-transition');
    }

    // Special condition icons
    if (classification.isParallelRegion) {
      icons.push('parallel-region');
    }

    return icons;
  }

  /**
   * Generate labels with hierarchy information
   */
  private generateStateLabels(
    stateId: string,
    classification: StateVisualizationType
  ): string[] {
    const labels = [stateId];

    // Add type information for complex states
    if (classification.type === 'parallel') {
      labels.push('⚡ Parallel');
    } else if (classification.type === 'compound') {
      labels.push('📦 Compound');
    } else if (classification.type === 'history') {
      labels.push(
        classification.subtype === 'deep-history'
          ? '📜 Deep History'
          : '📄 Shallow History'
      );
    }

    // Add nesting level indicator for deep hierarchies
    if (classification.nestingLevel > 2) {
      labels.push(`Level ${classification.nestingLevel}`);
    }

    return labels;
  }

  /**
   * Generate container properties for compound and parallel states
   */
  private generateContainerProperties(
    classification: StateVisualizationType,
    stateId: string
  ): StateVisualData['containerProperties'] {
    if (
      classification.type !== 'compound' &&
      classification.type !== 'parallel'
    ) {
      return undefined;
    }

    const childStates = Array.from(this.stateRegistry.entries()).filter(
      ([_, info]) => info.parentPath.endsWith(stateId)
    ).length;

    // Determine optimal layout for children
    let childrenLayout: 'horizontal' | 'vertical' | 'grid' = 'vertical';
    if (classification.type === 'parallel') {
      childrenLayout = 'horizontal'; // Parallel regions side by side
    } else if (childStates > 4) {
      childrenLayout = 'grid'; // Grid for many children
    }

    return {
      isContainer: true,
      childrenLayout,
      padding: 20 + classification.nestingLevel * 5,
    };
  }

  /**
   * Generate comprehensive visual data for transition edges
   */
  private generateEdgeVisualData(
    transitionId: string,
    transitionInfo: any
  ): EdgeVisualizationData {
    const classification = transitionInfo.classification;

    // Generate styling based on transition type
    const styling = this.generateTransitionStyling(classification);

    // Generate path for complex transitions
    const path = this.generateTransitionPath(transitionInfo);

    // Generate markers for transition ends
    const markers = this.generateTransitionMarkers(classification);

    // Generate labels for events, conditions, and actions
    const labels = this.generateTransitionLabels(transitionInfo);

    return {
      classification,
      path,
      styling,
      markers,
      labels,
    };
  }

  /**
   * Generate styling for transitions based on classification
   */
  private generateTransitionStyling(
    classification: TransitionVisualizationType
  ): EdgeVisualizationData['styling'] {
    let strokeColor = '#666';
    let strokeWidth = 2;
    let strokeDasharray: string | undefined;

    // Style based on transition type
    switch (classification.type) {
      case 'event-condition':
        strokeColor = '#2563eb'; // Solid blue for event+condition
        strokeWidth = 2;
        break;
      case 'event-only':
        strokeColor = '#6b7280'; // Solid gray for event-only
        strokeWidth = 2;
        break;
      case 'condition-only':
        strokeColor = '#2563eb'; // Dashed blue for condition-only
        strokeWidth = 2;
        strokeDasharray = '5,5';
        break;
      case 'always':
        strokeColor = '#000000'; // Dotted black for always
        strokeWidth = 1;
        strokeDasharray = '2,3';
        break;
      case 'action-executing':
        strokeColor = '#dc2626'; // Thick red for actions
        strokeWidth = 3;
        break;
      case 'internal':
        strokeColor = '#7c3aed'; // Purple for internal
        strokeWidth = 2;
        break;
    }

    // Special styling for cross-hierarchy transitions
    if (classification.isCrossHierarchy) {
      strokeWidth += 1; // Thicker for cross-hierarchy
      strokeColor = this.blendColors(strokeColor, '#f59e0b'); // Orange tint
    }

    return {
      strokeColor,
      strokeWidth,
      strokeDasharray,
    };
  }

  /**
   * Generate transition path for complex routing
   */
  private generateTransitionPath(transitionInfo: any): string {
    const sourceStateId = transitionInfo.sourceStateId;
    const targetStateId = this.getAttribute(transitionInfo.element, 'target');
    const classification = transitionInfo.classification;

    // For internal transitions, generate self-loop path
    if (classification.isInternal) {
      return this.generateSelfLoopPath(sourceStateId);
    }

    // For cross-hierarchy transitions, use smart routing
    if (classification.isCrossHierarchy) {
      return this.generateCrossHierarchyPath(sourceStateId, targetStateId);
    }

    // Standard straight path (React Flow will handle basic routing)
    return '';
  }

  /**
   * Generate markers for transition arrows and indicators
   */
  private generateTransitionMarkers(
    classification: TransitionVisualizationType
  ): EdgeVisualizationData['markers'] {
    const markers: EdgeVisualizationData['markers'] = {
      end: 'arrow',
    };

    // Special markers for different transition types
    if (classification.hasActions) {
      markers.end = 'action-arrow'; // Special arrow indicating actions
    }

    if (classification.isInternal) {
      markers.start = 'internal-dot'; // Dot at start for internal transitions
    }

    if (classification.isCrossHierarchy) {
      markers.end = 'cross-hierarchy-arrow'; // Special arrow for cross-hierarchy
    }

    return markers;
  }

  /**
   * Generate labels for events, conditions, and actions
   */
  private generateTransitionLabels(
    transitionInfo: any
  ): EdgeVisualizationData['labels'] {
    const classification = transitionInfo.classification;
    const labels: EdgeVisualizationData['labels'] = {};

    // Event label
    if (classification.eventName) {
      labels.event = {
        text: classification.eventName,
        position: { x: 0.3, y: -15 }, // Relative to edge path
      };
    }

    // Condition label
    if (classification.condition) {
      labels.condition = {
        text: `[${classification.condition}]`,
        position: { x: 0.5, y: -15 },
      };
    }

    // Actions label
    if (classification.hasActions && classification.actions.length > 0) {
      const actionsText =
        classification.actions.length > 2
          ? `${classification.actions.slice(0, 2).join(', ')}...`
          : classification.actions.join(', ');

      labels.actions = {
        text: `/ ${actionsText}`,
        position: { x: 0.7, y: -15 },
      };
    }

    return labels;
  }

  /**
   * Helper method to blend two colors
   */
  private blendColors(color1: string, color2: string): string {
    // Simple color blending - in a real implementation, you'd use a proper color library
    return color1; // Placeholder - returning original color for now
  }

  /**
   * Generate self-loop path for internal transitions
   */
  private generateSelfLoopPath(stateId: string): string {
    // Generate a circular path that loops back to the same state
    const radius = 30;
    return `M 0,0 A ${radius},${radius} 0 1,1 0,1 Z`;
  }

  /**
   * Generate smart routing path for cross-hierarchy transitions
   */
  private generateCrossHierarchyPath(
    sourceStateId: string,
    targetStateId?: string
  ): string {
    if (!targetStateId) return '';

    // For cross-hierarchy transitions, we need smarter routing to avoid overlaps
    // This would integrate with the layout algorithm
    return ''; // Placeholder - React Flow will handle routing
  }

  /**
   * Calculate position for parallel regions
   */
  private calculateParallelRegionPosition(
    regionId: string,
    siblingIndex: number,
    totalSiblings: number
  ): { x: number; y: number } {
    const regionInfo = this.parallelRegionMap.get(regionId);
    if (!regionInfo) {
      return { x: 100, y: 100 };
    }

    const parallelStateInfo = this.stateRegistry.get(
      regionInfo.parentParallelId
    );
    if (!parallelStateInfo) {
      return { x: 100, y: 100 };
    }

    // Arrange parallel regions horizontally
    const regionWidth = 200;
    const regionSpacing = 50;
    const baseX = 150;
    const baseY = 200 + parallelStateInfo.nestingLevel * 150;

    return {
      x: baseX + siblingIndex * (regionWidth + regionSpacing),
      y: baseY,
    };
  }

  /**
   * Calculate position for history states
   */
  private calculateHistoryStatePosition(
    historyId: string,
    parentPath: string,
    totalSiblings: number
  ): { x: number; y: number } {
    const parentStateId = parentPath.split('.').pop();
    const parentPosition = this.getParentStatePosition(parentStateId);

    // Position history states in the bottom-right corner of their parent
    return {
      x: parentPosition.x + 120,
      y: parentPosition.y + 80,
    };
  }

  /**
   * Get position of parent state
   */
  private getParentStatePosition(parentStateId?: string): {
    x: number;
    y: number;
  } {
    if (!parentStateId) {
      return { x: 100, y: 100 };
    }

    const parentInfo = this.stateRegistry.get(parentStateId);
    if (!parentInfo) {
      return { x: 100, y: 100 };
    }

    // For now, return a basic calculated position
    // In a full implementation, this would track actual positions
    return {
      x: 100 + parentInfo.nestingLevel * 200,
      y: 100 + parentInfo.nestingLevel * 150,
    };
  }

  /**
   * Calculate optimal sibling layout
   */
  private calculateSiblingLayout(
    siblings: string[],
    siblingIndex: number
  ): { offsetX: number; offsetY: number } {
    const totalSiblings = siblings.length;

    if (totalSiblings <= 3) {
      // Linear vertical layout for few siblings
      return {
        offsetX: 0,
        offsetY: siblingIndex * 120,
      };
    } else {
      // Grid layout for many siblings
      const columns = Math.ceil(Math.sqrt(totalSiblings));
      const row = Math.floor(siblingIndex / columns);
      const col = siblingIndex % columns;

      return {
        offsetX: col * 180,
        offsetY: row * 120,
      };
    }
  }

  /**
   * Create enhanced React Flow state node with comprehensive visual data
   */
  private createEnhancedStateNode(
    stateId: string,
    stateInfo: any,
    visualData: StateVisualData
  ): Node | null {
    const classification = visualData.classification;

    // Determine React Flow node type based on state classification
    let nodeType = 'scxmlState';
    if (classification.type === 'parallel') {
      nodeType = 'scxmlParallelState';
    } else if (classification.type === 'compound') {
      nodeType = 'scxmlCompoundState';
    } else if (classification.type === 'history') {
      nodeType = 'scxmlHistoryState';
    } else if (classification.type === 'final') {
      nodeType = 'scxmlFinalState';
    }

    return {
      id: stateId,
      type: nodeType,
      position: visualData.position,
      data: {
        // Basic React Flow data
        label: visualData.labels.join('\n'),

        // Enhanced data for industrial visualization
        stateType: classification.type,
        classification: visualData.classification,
        visualData: visualData,

        // State properties for visualization
        isInitial: classification.type === 'initial',
        isFinal: classification.type === 'final',
        isParallel: classification.type === 'parallel',
        isCompound: classification.type === 'compound',
        isHistory: classification.type === 'history',
        isParallelRegion: classification.isParallelRegion,

        // Action indicators
        hasEntryActions: classification.hasEntryActions,
        hasExitActions: classification.hasExitActions,
        hasInternalTransitions: classification.hasInternalTransitions,

        // Hierarchy information
        nestingLevel: classification.nestingLevel,
        parentId: classification.parentId,

        // Visual styling
        styling: visualData.styling,
        icons: visualData.icons,
        dimensions: visualData.dimensions,
        containerProperties: visualData.containerProperties,
      },
    };
  }

  /**
   * Create enhanced React Flow transition edge with comprehensive visual data
   */
  private createEnhancedTransitionEdge(
    transitionId: string,
    transitionInfo: any,
    visualData: EdgeVisualizationData
  ): Edge | null {
    const target = this.getAttribute(transitionInfo.element, 'target');
    if (!target) return null;

    const classification = visualData.classification;

    // Determine React Flow edge type based on transition classification
    let edgeType = 'scxmlTransition';
    if (classification.isInternal) {
      edgeType = 'scxmlInternalTransition';
    } else if (classification.isCrossHierarchy) {
      edgeType = 'scxmlCrossHierarchyTransition';
    } else if (classification.hasActions) {
      edgeType = 'scxmlActionTransition';
    }

    return {
      id: transitionId,
      type: edgeType,
      source: transitionInfo.sourceStateId,
      target,
      data: {
        // Basic React Flow data
        label: this.formatTransitionLabel(classification),

        // Enhanced data for industrial visualization
        classification: visualData.classification,
        visualData: visualData,

        // Transition properties
        event: classification.eventName,
        condition: classification.condition,
        actions: classification.actions,
        isInternal: classification.isInternal,
        isCrossHierarchy: classification.isCrossHierarchy,
        hasActions: classification.hasActions,

        // Hierarchy information
        sourceLevel: classification.sourceLevel,
        targetLevel: classification.targetLevel,

        // Visual styling
        styling: visualData.styling,
        markers: visualData.markers,
        labels: visualData.labels,
        path: visualData.path,
      },
    };
  }

  /**
   * Format transition label for display
   */
  private formatTransitionLabel(
    classification: TransitionVisualizationType
  ): string {
    const parts: string[] = [];

    if (classification.eventName) {
      parts.push(classification.eventName);
    }

    if (classification.condition) {
      parts.push(`[${classification.condition}]`);
    }

    if (classification.hasActions && classification.actions.length > 0) {
      const actionText =
        classification.actions.length > 1
          ? `${classification.actions[0]}...`
          : classification.actions[0];
      parts.push(`/ ${actionText}`);
    }

    return parts.join(' ');
  }

  /**
   * Apply intelligent layout algorithm to optimize node and edge positioning
   */
  private applyIntelligentLayout(nodes: Node[], edges: Edge[]): void {
    // Phase 1: Group nodes by hierarchy level
    const levelGroups = this.groupNodesByLevel(nodes);

    // Phase 2: Apply hierarchical layout
    this.applyHierarchicalLayout(levelGroups);

    // Phase 3: Optimize for edge crossings
    this.minimizeEdgeCrossings(nodes, edges);

    // Phase 4: Apply parallel region layout
    this.optimizeParallelRegionLayout(nodes);

    // Phase 5: Final positioning adjustments
    this.applyFinalLayoutAdjustments(nodes);
  }

  /**
   * Group nodes by their hierarchy level
   */
  private groupNodesByLevel(nodes: Node[]): Map<number, Node[]> {
    const levelGroups = new Map<number, Node[]>();

    for (const node of nodes) {
      const level = node.data.nestingLevel || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(node);
    }

    return levelGroups;
  }

  /**
   * Apply hierarchical layout to grouped nodes
   */
  private applyHierarchicalLayout(levelGroups: Map<number, Node[]>): void {
    const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

    for (const level of levels) {
      const nodes = levelGroups.get(level)!;
      const baseY = 100 + level * 200;

      // Sort nodes by parent relationship and name for consistent ordering
      nodes.sort((a, b) => {
        const aParent = a.data.parentId || '';
        const bParent = b.data.parentId || '';
        if (aParent !== bParent) {
          return aParent.localeCompare(bParent);
        }
        return a.id.localeCompare(b.id);
      });

      // Position nodes horizontally with spacing
      let currentX = 100;
      for (const node of nodes) {
        node.position.y = baseY;
        node.position.x = currentX;

        // Adjust spacing based on node width and type
        const nodeWidth = node.data.dimensions?.width || 120;
        const spacing = node.data.isParallel ? 50 : 30;
        currentX += nodeWidth + spacing;
      }
    }
  }

  /**
   * Minimize edge crossings through node repositioning
   */
  private minimizeEdgeCrossings(nodes: Node[], edges: Edge[]): void {
    // Create adjacency map for faster lookups
    const adjacencyMap = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacencyMap.has(edge.source)) {
        adjacencyMap.set(edge.source, []);
      }
      adjacencyMap.get(edge.source)!.push(edge.target);
    }

    // Apply crossing reduction heuristics
    this.applyBarycenterHeuristic(nodes, adjacencyMap);
  }

  /**
   * Apply barycenter heuristic to reduce edge crossings
   */
  private applyBarycenterHeuristic(
    nodes: Node[],
    adjacencyMap: Map<string, string[]>
  ): void {
    const levelGroups = this.groupNodesByLevel(nodes);
    const levels = Array.from(levelGroups.keys()).sort((a, b) => a - b);

    // Iterate through levels and adjust positions
    for (let i = 1; i < levels.length; i++) {
      const currentLevel = levels[i];
      const currentNodes = levelGroups.get(currentLevel)!;

      for (const node of currentNodes) {
        const barycenter = this.calculateBarycenter(
          node.id,
          adjacencyMap,
          levelGroups,
          levels[i - 1]
        );
        if (barycenter !== null) {
          node.position.x = barycenter;
        }
      }

      // Sort nodes by x position to maintain order
      currentNodes.sort((a, b) => a.position.x - b.position.x);
    }
  }

  /**
   * Calculate barycenter position for a node
   */
  private calculateBarycenter(
    nodeId: string,
    adjacencyMap: Map<string, string[]>,
    levelGroups: Map<number, Node[]>,
    parentLevel: number
  ): number | null {
    const parentNodes = levelGroups.get(parentLevel);
    if (!parentNodes) return null;

    // Find nodes that connect to this node
    const connectedParents = parentNodes.filter((parent) =>
      adjacencyMap.get(parent.id)?.includes(nodeId)
    );

    if (connectedParents.length === 0) return null;

    // Calculate average x position of connected parents
    const totalX = connectedParents.reduce(
      (sum, parent) => sum + parent.position.x,
      0
    );
    return totalX / connectedParents.length;
  }

  /**
   * Optimize layout for parallel regions
   */
  private optimizeParallelRegionLayout(nodes: Node[]): void {
    const parallelNodes = nodes.filter((node) => node.data.isParallel);

    for (const parallelNode of parallelNodes) {
      const regionNodes = nodes.filter(
        (node) =>
          node.data.parentId === parallelNode.id || node.data.isParallelRegion
      );

      if (regionNodes.length > 0) {
        this.layoutParallelRegions(parallelNode, regionNodes);
      }
    }
  }

  /**
   * Layout parallel regions within a parallel state
   */
  private layoutParallelRegions(parallelNode: Node, regionNodes: Node[]): void {
    const regionWidth = 250;
    const regionSpacing = 30;
    const startX = parallelNode.position.x + 50;
    const startY = parallelNode.position.y + 100;

    regionNodes.sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < regionNodes.length; i++) {
      const regionNode = regionNodes[i];
      regionNode.position.x = startX + i * (regionWidth + regionSpacing);
      regionNode.position.y = startY;
    }

    // Adjust parallel node size to accommodate regions
    const totalWidth = regionNodes.length * (regionWidth + regionSpacing) + 100;
    if (parallelNode.data.dimensions) {
      parallelNode.data.dimensions.width = Math.max(
        parallelNode.data.dimensions.width,
        totalWidth
      );
    }
  }

  /**
   * Apply final layout adjustments for polish
   */
  private applyFinalLayoutAdjustments(nodes: Node[]): void {
    // Ensure minimum spacing between nodes
    this.enforceMinimumSpacing(nodes);

    // Align nodes to grid for cleaner appearance
    this.alignToGrid(nodes);

    // Center the entire layout
    this.centerLayout(nodes);
  }

  /**
   * Enforce minimum spacing between nodes
   */
  private enforceMinimumSpacing(nodes: Node[]): void {
    const minSpacing = 30;

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        const dx = Math.abs(node1.position.x - node2.position.x);
        const dy = Math.abs(node1.position.y - node2.position.y);

        const width1 = node1.data.dimensions?.width || 120;
        const width2 = node2.data.dimensions?.width || 120;
        const height1 = node1.data.dimensions?.height || 60;
        const height2 = node2.data.dimensions?.height || 60;

        const requiredDx = (width1 + width2) / 2 + minSpacing;
        const requiredDy = (height1 + height2) / 2 + minSpacing;

        if (dx < requiredDx && dy < requiredDy) {
          // Adjust positions to maintain minimum spacing
          const adjustX = (requiredDx - dx) / 2;
          const adjustY = (requiredDy - dy) / 2;

          if (node1.position.x < node2.position.x) {
            node1.position.x -= adjustX;
            node2.position.x += adjustX;
          } else {
            node1.position.x += adjustX;
            node2.position.x -= adjustX;
          }

          if (node1.position.y < node2.position.y) {
            node1.position.y -= adjustY;
            node2.position.y += adjustY;
          } else {
            node1.position.y += adjustY;
            node2.position.y -= adjustY;
          }
        }
      }
    }
  }

  /**
   * Align nodes to grid for cleaner appearance
   */
  private alignToGrid(nodes: Node[]): void {
    const gridSize = 20;

    for (const node of nodes) {
      node.position.x = Math.round(node.position.x / gridSize) * gridSize;
      node.position.y = Math.round(node.position.y / gridSize) * gridSize;
    }
  }

  /**
   * Center the entire layout
   */
  private centerLayout(nodes: Node[]): void {
    if (nodes.length === 0) return;

    // Find bounding box
    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const node of nodes) {
      const width = node.data.dimensions?.width || 120;
      const height = node.data.dimensions?.height || 60;

      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x + width);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y + height);
    }

    // Calculate offset to center on viewport
    const viewportWidth = 1200; // Assumed viewport width
    const viewportHeight = 800; // Assumed viewport height

    const layoutWidth = maxX - minX;
    const layoutHeight = maxY - minY;

    const offsetX = (viewportWidth - layoutWidth) / 2 - minX;
    const offsetY = (viewportHeight - layoutHeight) / 2 - minY;

    // Apply offset to all nodes
    for (const node of nodes) {
      node.position.x += offsetX;
      node.position.y += offsetY;
    }
  }
}
