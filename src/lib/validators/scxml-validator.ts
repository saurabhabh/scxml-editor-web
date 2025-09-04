import type {
  SCXMLElement,
  StateElement,
  TransitionElement,
  ParallelElement,
  FinalElement,
  HistoryElement,
} from '@/types/scxml';
import type { ValidationError } from '@/types/common';

export class SCXMLValidator {
  validate(scxml: SCXMLElement): ValidationError[] {
    const errors: ValidationError[] = [];
    const stateIds = new Set<string>();

    // Collect all state IDs first
    this.collectStateIds(scxml, stateIds);
    
    // Perform all validation checks
    this.validateStateReferences(scxml, stateIds, errors);
    this.validateInitialStates(scxml, stateIds, errors);
    this.validateRequiredAttributes(scxml, errors);
    this.validateStateStructure(scxml, errors);

    return errors;
  }

  private collectStateIds(scxml: SCXMLElement, stateIds: Set<string>): void {
    // Collect state IDs
    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state) => {
        if (state['@_id']) {
          stateIds.add(state['@_id']);
        }
        this.collectStateIdsFromState(state, stateIds);
      });
    }

    // Collect parallel state IDs
    if (scxml.parallel) {
      const parallels = Array.isArray(scxml.parallel)
        ? scxml.parallel
        : [scxml.parallel];
      parallels.forEach((parallel) => {
        if (parallel['@_id']) {
          stateIds.add(parallel['@_id']);
        }
        this.collectStateIdsFromParallel(parallel, stateIds);
      });
    }

    // Collect final state IDs
    if (scxml.final) {
      const finals = Array.isArray(scxml.final) ? scxml.final : [scxml.final];
      finals.forEach((final) => {
        if (final['@_id']) {
          stateIds.add(final['@_id']);
        }
      });
    }
  }

  private collectStateIdsFromState(
    state: StateElement,
    stateIds: Set<string>
  ): void {
    if (state.state) {
      const states = Array.isArray(state.state) ? state.state : [state.state];
      states.forEach((s) => {
        if (s['@_id']) {
          stateIds.add(s['@_id']);
        }
        this.collectStateIdsFromState(s, stateIds);
      });
    }

    if (state.parallel) {
      const parallels = Array.isArray(state.parallel)
        ? state.parallel
        : [state.parallel];
      parallels.forEach((p) => {
        if (p['@_id']) {
          stateIds.add(p['@_id']);
        }
        this.collectStateIdsFromParallel(p, stateIds);
      });
    }

    if (state.final) {
      const finals = Array.isArray(state.final) ? state.final : [state.final];
      finals.forEach((f) => {
        if (f['@_id']) {
          stateIds.add(f['@_id']);
        }
      });
    }

    if (state.history) {
      const histories = Array.isArray(state.history)
        ? state.history
        : [state.history];
      histories.forEach((h) => {
        if (h['@_id']) {
          stateIds.add(h['@_id']);
        }
      });
    }
  }

  private collectStateIdsFromParallel(
    parallel: ParallelElement,
    stateIds: Set<string>
  ): void {
    if (parallel.state) {
      const states = Array.isArray(parallel.state)
        ? parallel.state
        : [parallel.state];
      states.forEach((s: StateElement) => {
        if (s['@_id']) {
          stateIds.add(s['@_id']);
        }
        this.collectStateIdsFromState(s, stateIds);
      });
    }

    if (parallel.parallel) {
      const parallels = Array.isArray(parallel.parallel)
        ? parallel.parallel
        : [parallel.parallel];
      parallels.forEach((p: ParallelElement) => {
        if (p['@_id']) {
          stateIds.add(p['@_id']);
        }
        this.collectStateIdsFromParallel(p, stateIds);
      });
    }

    if (parallel.history) {
      const histories = Array.isArray(parallel.history)
        ? parallel.history
        : [parallel.history];
      histories.forEach((h: HistoryElement) => {
        if (h['@_id']) {
          stateIds.add(h['@_id']);
        }
      });
    }
  }

  private validateStateReferences(
    scxml: SCXMLElement,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    // Validate initial attribute references
    if (scxml['@_initial']) {
      const initialStates = scxml['@_initial'].split(/\s+/);
      initialStates.forEach((stateId) => {
        if (!stateIds.has(stateId)) {
          errors.push({
            message: `Initial state '${stateId}' not found`,
            severity: 'error',
          });
        }
      });
    }

    this.validateTransitionTargets(scxml, stateIds, errors);
  }

  private validateTransitionTargets(
    element: SCXMLElement | StateElement | ParallelElement,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    // Check transitions in states
    if (element.state) {
      const states = Array.isArray(element.state)
        ? element.state
        : [element.state];
      states.forEach((state: StateElement) => {
        this.validateTransitionsInElement(state, stateIds, errors);
        this.validateTransitionTargets(state, stateIds, errors);
      });
    }

    // Check transitions in parallel states
    if (element.parallel) {
      const parallels = Array.isArray(element.parallel)
        ? element.parallel
        : [element.parallel];
      parallels.forEach((parallel: ParallelElement) => {
        this.validateTransitionsInElement(parallel, stateIds, errors);
        this.validateTransitionTargets(parallel, stateIds, errors);
      });
    }
  }

  private validateTransitionsInElement(
    element: StateElement | ParallelElement,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    if (element.transition) {
      const transitions = Array.isArray(element.transition)
        ? element.transition
        : [element.transition];
      transitions.forEach((transition: TransitionElement) => {
        if (transition['@_target']) {
          const targets = transition['@_target'].split(/\s+/);
          targets.forEach((target) => {
            if (!stateIds.has(target)) {
              errors.push({
                message: `Transition target '${target}' not found`,
                severity: 'error',
              });
            }
          });
        }
      });
    }
  }

  private validateInitialStates(
    scxml: SCXMLElement,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state) => {
        if (state['@_initial']) {
          const initialStates = state['@_initial'].split(/\s+/);
          initialStates.forEach((stateId) => {
            if (!stateIds.has(stateId)) {
              errors.push({
                message: `Initial state '${stateId}' in state '${state['@_id']}' not found`,
                severity: 'error',
              });
            }
          });
        }
      });
    }
  }

  private validateRequiredAttributes(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    // Check for required SCXML attributes
    if (!scxml['@_name'] && !scxml['@_initial'] && !scxml.state) {
      errors.push({
        message: 'SCXML must have either a name attribute, initial attribute, or at least one state',
        severity: 'warning',
      });
    }

    // Validate version attribute
    if (scxml['@_version'] && String(scxml['@_version']) !== '1.0') {
      errors.push({
        message: `Unsupported SCXML version '${scxml['@_version']}'. Expected '1.0'`,
        severity: 'warning',
      });
    }

    // Validate namespace
    if (scxml['@_xmlns'] && scxml['@_xmlns'] !== 'http://www.w3.org/2005/07/scxml') {
      errors.push({
        message: `Invalid SCXML namespace '${scxml['@_xmlns']}'. Expected 'http://www.w3.org/2005/07/scxml'`,
        severity: 'warning',
      });
    }
  }

  private validateStateStructure(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    // Validate states have IDs
    this.validateElementsHaveIds(scxml.state, 'State', errors);
    
    // Validate parallel states have IDs
    this.validateElementsHaveIds(scxml.parallel, 'Parallel state', errors);
    
    // Validate final states have IDs
    this.validateElementsHaveIds(scxml.final, 'Final state', errors);

    // Validate nested state structures
    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state) => {
        this.validateNestedStateStructure(state, errors);
      });
    }

    if (scxml.parallel) {
      const parallels = Array.isArray(scxml.parallel) ? scxml.parallel : [scxml.parallel];
      parallels.forEach((parallel) => {
        this.validateNestedParallelStructure(parallel, errors);
      });
    }
  }

  private validateElementsHaveIds(
    elements: StateElement | StateElement[] | ParallelElement | ParallelElement[] | FinalElement | FinalElement[] | HistoryElement | HistoryElement[] | undefined,
    elementType: string,
    errors: ValidationError[]
  ): void {
    if (elements) {
      const elementArray = Array.isArray(elements) ? elements : [elements];
      elementArray.forEach((element, index) => {
        if (!element['@_id']) {
          errors.push({
            message: `${elementType} at index ${index} must have an id attribute`,
            severity: 'error',
          });
        }
      });
    }
  }

  private validateNestedStateStructure(
    state: StateElement,
    errors: ValidationError[]
  ): void {
    // Validate nested states
    this.validateElementsHaveIds(state.state, 'Nested state', errors);
    this.validateElementsHaveIds(state.parallel, 'Nested parallel state', errors);
    this.validateElementsHaveIds(state.final, 'Nested final state', errors);
    this.validateElementsHaveIds(state.history, 'History state', errors);

    // Recursively validate nested states
    if (state.state) {
      const states = Array.isArray(state.state) ? state.state : [state.state];
      states.forEach((nestedState) => {
        this.validateNestedStateStructure(nestedState, errors);
      });
    }

    if (state.parallel) {
      const parallels = Array.isArray(state.parallel) ? state.parallel : [state.parallel];
      parallels.forEach((parallel) => {
        this.validateNestedParallelStructure(parallel, errors);
      });
    }
  }

  private validateNestedParallelStructure(
    parallel: ParallelElement,
    errors: ValidationError[]
  ): void {
    // Validate nested states in parallel
    this.validateElementsHaveIds(parallel.state, 'State in parallel', errors);
    this.validateElementsHaveIds(parallel.parallel, 'Nested parallel state', errors);
    this.validateElementsHaveIds(parallel.history, 'History state in parallel', errors);

    // Recursively validate nested structures
    if (parallel.state) {
      const states = Array.isArray(parallel.state) ? parallel.state : [parallel.state];
      states.forEach((state: StateElement) => {
        this.validateNestedStateStructure(state, errors);
      });
    }

    if (parallel.parallel) {
      const parallels = Array.isArray(parallel.parallel) ? parallel.parallel : [parallel.parallel];
      parallels.forEach((nestedParallel: ParallelElement) => {
        this.validateNestedParallelStructure(nestedParallel, errors);
      });
    }
  }
}
