import { setup, createMachine, type StateNode } from 'xstate';
import type { SCXMLElement, SCXMLDocument } from '@/types/scxml';
import type { Node, Edge } from 'reactflow';
import type { SCXMLStateNodeData, SCXMLTransitionEdgeData } from '@/components/diagram';

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
  style?: string;
  waypoints?: string;
  labelOffset?: string;
}

/**
 * Converts SCXML documents to XState v5 machine configurations and React Flow diagram data
 */
export class SCXMLToXStateConverter {
  /**
   * Convert SCXML document to XState machine configuration
   */
  convertToXState(scxmlDoc: SCXMLDocument): XStateMachineConfig {
    const scxml = scxmlDoc.scxml;
    
    const config: XStateMachineConfig = {
      id: this.getAttribute(scxml, 'name') || 'scxmlMachine',
      initial: this.getAttribute(scxml, 'initial'),
      states: {},
      context: {},
    };

    // Process states
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

    // Process data model for context
    const dataModel = this.getElements(scxml, 'datamodel');
    if (dataModel) {
      config.context = this.convertDataModel(dataModel);
    }

    return config;
  }

  /**
   * Convert SCXML document to React Flow nodes and edges
   */
  convertToReactFlow(scxmlDoc: SCXMLDocument): { nodes: Node[], edges: Edge[] } {
    const scxml = scxmlDoc.scxml;
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Convert states to nodes
    const states = this.getElements(scxml, 'state');
    if (states) {
      const statesArray = Array.isArray(states) ? states : [states];
      const initialState = this.getAttribute(scxml, 'initial');

      for (let i = 0; i < statesArray.length; i++) {
        const state = statesArray[i];
        const node = this.convertStateToNode(state, initialState, i, statesArray.length);
        if (node) {
          nodes.push(node);
        }

        // Convert transitions to edges
        const transitions = this.getElements(state, 'transition');
        if (transitions) {
          const transitionsArray = Array.isArray(transitions) ? transitions : [transitions];
          for (const transition of transitionsArray) {
            const edge = this.convertTransitionToEdge(transition, node?.id || '');
            if (edge) {
              edges.push(edge);
            }
          }
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Create XState machine from SCXML document
   */
  createXStateMachine(scxmlDoc: SCXMLDocument) {
    const config = this.convertToXState(scxmlDoc);
    
    return setup({
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
    if (childStates) {
      stateConfig.states = {};
      const childStatesArray = Array.isArray(childStates) ? childStates : [childStates];
      
      for (const childState of childStatesArray) {
        const childConfig = this.convertState(childState);
        const childId = this.getAttribute(childState, 'id');
        if (childId && childConfig) {
          stateConfig.states[childId] = childConfig;
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
      const transitionsArray = Array.isArray(transitions) ? transitions : [transitions];
      
      for (const transition of transitionsArray) {
        const event = this.getAttribute(transition, 'event');
        const target = this.getAttribute(transition, 'target');
        const cond = this.getAttribute(transition, 'cond');

        if (target) {
          const transitionConfig: any = { target };
          
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

  private convertStateToNode(state: any, initialStateId?: string, nodeIndex: number = 0, totalNodes: number = 1): Node<SCXMLStateNodeData> | null {
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

  private convertTransitionToEdge(transition: any, sourceStateId: string): Edge<SCXMLTransitionEdgeData> | null {
    const target = this.getAttribute(transition, 'target');
    if (!target) return null;

    const event = this.getAttribute(transition, 'event');
    const condition = this.getAttribute(transition, 'cond');
    const actions = this.convertTransitionActions(transition);

    // Generate unique edge ID
    const edgeId = `${sourceStateId}-to-${target}-${event || 'always'}`;

    return {
      id: edgeId,
      type: 'scxmlTransition',
      source: sourceStateId,
      target: target,
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
      const dataArray = Array.isArray(dataElements) ? dataElements : [dataElements];
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
    
    // Extract visual metadata from the visual namespace
    const visualX = this.getAttribute(element, 'visual:x');
    const visualY = this.getAttribute(element, 'visual:y');
    const visualWidth = this.getAttribute(element, 'visual:width');
    const visualHeight = this.getAttribute(element, 'visual:height');
    const visualStyle = this.getAttribute(element, 'visual:style');
    const visualWaypoints = this.getAttribute(element, 'visual:waypoints');
    const visualLabelOffset = this.getAttribute(element, 'visual:label-offset');

    if (visualX) metadata.x = parseFloat(visualX);
    if (visualY) metadata.y = parseFloat(visualY);
    if (visualWidth) metadata.width = parseFloat(visualWidth);
    if (visualHeight) metadata.height = parseFloat(visualHeight);
    if (visualStyle) metadata.style = visualStyle;
    if (visualWaypoints) metadata.waypoints = visualWaypoints;
    if (visualLabelOffset) metadata.labelOffset = visualLabelOffset;

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
}