import type {
  SCXMLElement,
  StateElement,
  TransitionElement,
} from '@/types/scxml';
import type { ValidationError } from '@/types/common';

export class SCXMLValidator {
  validate(scxml: SCXMLElement): ValidationError[] {
    const errors: ValidationError[] = [];
    const stateIds = new Set<string>();

    this.collectStateIds(scxml, stateIds);
    this.validateStateReferences(scxml, stateIds, errors);
    this.validateInitialStates(scxml, stateIds, errors);

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
    parallel: any,
    stateIds: Set<string>
  ): void {
    if (parallel.state) {
      const states = Array.isArray(parallel.state)
        ? parallel.state
        : [parallel.state];
      states.forEach((s: any) => {
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
      parallels.forEach((p: any) => {
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
      histories.forEach((h: any) => {
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
    element: any,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    // Check transitions in states
    if (element.state) {
      const states = Array.isArray(element.state)
        ? element.state
        : [element.state];
      states.forEach((state: any) => {
        this.validateTransitionsInElement(state, stateIds, errors);
        this.validateTransitionTargets(state, stateIds, errors);
      });
    }

    // Check transitions in parallel states
    if (element.parallel) {
      const parallels = Array.isArray(element.parallel)
        ? element.parallel
        : [element.parallel];
      parallels.forEach((parallel: any) => {
        this.validateTransitionsInElement(parallel, stateIds, errors);
        this.validateTransitionTargets(parallel, stateIds, errors);
      });
    }
  }

  private validateTransitionsInElement(
    element: any,
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
}
