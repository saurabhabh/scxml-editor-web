// scxml-manipulation-utils.ts
import type {
  SCXMLDocument,
  StateElement,
  TransitionElement,
  OnEntryElement,
  OnExitElement,
} from '@/types/scxml';

/**
 * Find a state element by its ID in the SCXML document
 */
export function findStateById(
  scxmlDoc: SCXMLDocument,
  stateId: string
): StateElement | null {
  function searchInStates(
    states: StateElement | StateElement[] | undefined
  ): StateElement | null {
    if (!states) return null;

    const stateArray = Array.isArray(states) ? states : [states];

    for (const state of stateArray) {
      if (state['@_id'] === stateId) {
        return state;
      }

      // Search in nested states
      const found = searchInStates(state.state);
      if (found) return found;
    }

    return null;
  }

  // Search in root states
  return searchInStates(scxmlDoc.scxml.state);
}

/**
 * Update all transition targets that reference the old state ID
 */
export function updateTransitionTargets(
  scxmlDoc: SCXMLDocument,
  oldStateId: string,
  newStateId: string
): void {
  function updateTransitionsInStates(
    states: StateElement | StateElement[] | undefined
  ) {
    if (!states) return;

    const stateArray = Array.isArray(states) ? states : [states];

    for (const state of stateArray) {
      // Update transitions in this state
      if (state.transition) {
        const transitions = Array.isArray(state.transition)
          ? state.transition
          : [state.transition];
        transitions.forEach((transition) => {
          if (transition['@_target'] === oldStateId) {
            transition['@_target'] = newStateId;
          }
        });
      }

      // Recursively update in nested states
      updateTransitionsInStates(state.state);
      updateTransitionsInStates(state.parallel);
    }
  }

  // Update transitions in all states
  updateTransitionsInStates(scxmlDoc.scxml.state);
  updateTransitionsInStates(scxmlDoc.scxml.parallel);

  // Update initial attribute if it references the old state
  if (scxmlDoc.scxml['@_initial'] === oldStateId) {
    scxmlDoc.scxml['@_initial'] = newStateId;
  }
}

/**
 * Update entry or exit actions for a state
 */
export function updateStateActions(
  stateElement: StateElement,
  actionType: 'onentry' | 'onexit',
  actions: string[]
): void {
  if (actions.length === 0) {
    // Remove the action element if no actions
    if (actionType === 'onentry') {
      delete stateElement.onentry;
    } else {
      delete stateElement.onexit;
    }
    return;
  }

  // Create executable elements for the actions
  const executable = actions.map((action) => ({
    '@_label': 'Action',
    '@_expr': action,
  }));

  // Create the action element
  const actionElement = { executable };

  if (actionType === 'onentry') {
    stateElement.onentry = actionElement;
  } else {
    stateElement.onexit = actionElement;
  }
}

/**
 * Update state type (simple, compound, parallel, final)
 * Note: This is complex as it may require converting between element types
 * For now, we'll keep the state element and just ensure proper attributes
 */
export function updateStateType(
  stateElement: StateElement,
  newStateType: 'simple' | 'compound' | 'parallel' | 'final'
): void {
  // For final states, remove transitions since final states can't have outgoing transitions
  if (newStateType === 'final') {
    delete stateElement.transition;
    delete stateElement.state; // Final states can't have substates
    delete stateElement.parallel;
  }

  // For compound states, ensure they can have substates
  // (This is already supported by the StateElement structure)

  // For parallel states, this would require changing the element type entirely
  // which is complex, so we'll log a warning for now
  if (newStateType === 'parallel') {
    console.warn(
      'Converting to parallel state requires element type change - not fully implemented'
    );
  }
}

/**
 * Create a new state element
 */
export function createStateElement(
  id: string,
  stateType: 'simple' | 'compound' | 'parallel' | 'final' = 'simple',
  x?: number,
  y?: number,
  width?: number,
  height?: number
): StateElement {
  const element: StateElement = {
    '@_id': id,
  };

  // Add visual metadata if position provided
  if (x !== undefined && y !== undefined) {
    const w = width || 120; // Default width
    const h = height || 60; // Default height
    (element as any)['@_viz:xywh'] = `${x} ${y} ${w} ${h}`;
  }

  return element;
}

/**
 * Create a new transition element
 */
export function createTransitionElement(
  source: string,
  target: string,
  event?: string,
  condition?: string,
  actions?: string[]
): TransitionElement {
  const transition: TransitionElement = {
    '@_target': target,
  };

  if (event) {
    transition['@_event'] = event;
  }

  if (condition) {
    transition['@_cond'] = condition;
  }

  // Actions would be added as child elements, but for now we'll keep it simple

  return transition;
}

/**
 * Add a state to the SCXML document
 */
export function addStateToDocument(
  scxmlDoc: SCXMLDocument,
  stateElement: StateElement,
  parentId?: string
): void {
  if (parentId) {
    // Add to parent state
    const parentState = findStateById(scxmlDoc, parentId);
    if (parentState) {
      if (!parentState.state) {
        parentState.state = stateElement;
      } else if (Array.isArray(parentState.state)) {
        parentState.state.push(stateElement);
      } else {
        parentState.state = [parentState.state, stateElement];
      }
    }
  } else {
    // Add to root level
    if (!scxmlDoc.scxml.state) {
      scxmlDoc.scxml.state = stateElement;
    } else if (Array.isArray(scxmlDoc.scxml.state)) {
      scxmlDoc.scxml.state.push(stateElement);
    } else {
      scxmlDoc.scxml.state = [scxmlDoc.scxml.state, stateElement];
    }
  }
}

/**
 * Remove a state from the SCXML document
 */
export function removeStateFromDocument(
  scxmlDoc: SCXMLDocument,
  stateId: string
): void {
  function removeFromStates(
    states: StateElement | StateElement[] | undefined
  ): StateElement | StateElement[] | undefined {
    if (!states) return undefined;

    if (Array.isArray(states)) {
      const filtered = states.filter((state) => state['@_id'] !== stateId);
      filtered.forEach((state) => {
        state.state = removeFromStates(state.state) as any;
      });
      return filtered.length > 0 ? filtered : undefined;
    } else {
      if (states['@_id'] === stateId) {
        return undefined;
      }
      states.state = removeFromStates(states.state) as any;
      return states;
    }
  }

  // Remove from document
  scxmlDoc.scxml.state = removeFromStates(scxmlDoc.scxml.state) as any;

  // Remove transitions that target this state
  removeTransitionsTargeting(scxmlDoc, stateId);

  // Update initial state if it was the removed state
  if (scxmlDoc.scxml['@_initial'] === stateId) {
    // Find the first available state as new initial
    const firstState = findFirstState(scxmlDoc);
    scxmlDoc.scxml['@_initial'] = firstState?.['@_id'] || '';
  }
}

/**
 * Remove all transitions targeting a specific state
 */
export function removeTransitionsTargeting(
  scxmlDoc: SCXMLDocument,
  targetStateId: string
): void {
  function removeTransitionsFromStates(
    states: StateElement | StateElement[] | undefined
  ) {
    if (!states) return;

    const stateArray = Array.isArray(states) ? states : [states];

    for (const state of stateArray) {
      // Remove transitions targeting the state
      if (state.transition) {
        if (Array.isArray(state.transition)) {
          state.transition = state.transition.filter(
            (t) => t['@_target'] !== targetStateId
          );
          if (state.transition.length === 0) {
            delete state.transition;
          }
        } else if (state.transition['@_target'] === targetStateId) {
          delete state.transition;
        }
      }

      // Recursively process nested states
      removeTransitionsFromStates(state.state);
      removeTransitionsFromStates(state.parallel);
    }
  }

  removeTransitionsFromStates(scxmlDoc.scxml.state);
  removeTransitionsFromStates(scxmlDoc.scxml.parallel);
}

/**
 * Find the first state element in the document
 */
export function findFirstState(scxmlDoc: SCXMLDocument): StateElement | null {
  function findInStates(
    states: StateElement | StateElement[] | undefined
  ): StateElement | null {
    if (!states) return null;

    if (Array.isArray(states)) {
      return states.length > 0 ? states[0] : null;
    } else {
      return states;
    }
  }

  return findInStates(scxmlDoc.scxml.state);
}

/**
 * Add a transition to a state element
 */
export function addTransitionToState(
  stateElement: StateElement,
  transition: TransitionElement
): void {
  if (!stateElement.transition) {
    stateElement.transition = transition;
  } else if (Array.isArray(stateElement.transition)) {
    stateElement.transition.push(transition);
  } else {
    stateElement.transition = [stateElement.transition, transition];
  }
}

/**
 * Remove a specific transition from a state element
 */
export function removeTransitionFromState(
  stateElement: StateElement,
  transitionIndex: number
): void {
  if (!stateElement.transition) return;

  if (Array.isArray(stateElement.transition)) {
    if (
      transitionIndex >= 0 &&
      transitionIndex < stateElement.transition.length
    ) {
      stateElement.transition.splice(transitionIndex, 1);
      if (stateElement.transition.length === 0) {
        delete stateElement.transition;
      } else if (stateElement.transition.length === 1) {
        stateElement.transition = stateElement.transition[0];
      }
    }
  } else if (transitionIndex === 0) {
    delete stateElement.transition;
  }
}

/**
 * Update the visual position metadata for a state
 */
export function updateStatePosition(
  stateElement: StateElement,
  x: number,
  y: number,
  width?: number,
  height?: number
): void {
  // Extract existing dimensions if not provided
  const currentXywh = (stateElement as any)['@_viz:xywh'];
  let w = width || 120; // Default width
  let h = height || 60; // Default height

  if (currentXywh && !width && !height) {
    const parts = currentXywh.split(' ');
    if (parts.length >= 4) {
      w = parseInt(parts[2]) || 120;
      h = parseInt(parts[3]) || 60;
    }
  }

  // Add or update visual metadata attributes using the parser's attribute format
  (stateElement as any)['@_viz:xywh'] = `${x} ${y} ${w} ${h}`;
}
