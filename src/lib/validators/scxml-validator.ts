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

    // Enhanced W3C compliance checks
    this.validateW3CCompliance(scxml, errors);
    this.validateStateMachineSemantics(scxml, stateIds, errors);
    this.validateTransitionSemantics(scxml, stateIds, errors);
    this.validateExecutableElements(scxml, errors);

    // Comprehensive attribute validation
    this.validateAllElementAttributes(scxml, errors);

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
        message:
          'SCXML must have either a name attribute, initial attribute, or at least one state',
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
    if (
      scxml['@_xmlns'] &&
      scxml['@_xmlns'] !== 'http://www.w3.org/2005/07/scxml'
    ) {
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
      const parallels = Array.isArray(scxml.parallel)
        ? scxml.parallel
        : [scxml.parallel];
      parallels.forEach((parallel) => {
        this.validateNestedParallelStructure(parallel, errors);
      });
    }
  }

  private validateElementsHaveIds(
    elements:
      | StateElement
      | StateElement[]
      | ParallelElement
      | ParallelElement[]
      | FinalElement
      | FinalElement[]
      | HistoryElement
      | HistoryElement[]
      | undefined,
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
    this.validateElementsHaveIds(
      state.parallel,
      'Nested parallel state',
      errors
    );
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
      const parallels = Array.isArray(state.parallel)
        ? state.parallel
        : [state.parallel];
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
    this.validateElementsHaveIds(
      parallel.parallel,
      'Nested parallel state',
      errors
    );
    this.validateElementsHaveIds(
      parallel.history,
      'History state in parallel',
      errors
    );

    // Recursively validate nested structures
    if (parallel.state) {
      const states = Array.isArray(parallel.state)
        ? parallel.state
        : [parallel.state];
      states.forEach((state: StateElement) => {
        this.validateNestedStateStructure(state, errors);
      });
    }

    if (parallel.parallel) {
      const parallels = Array.isArray(parallel.parallel)
        ? parallel.parallel
        : [parallel.parallel];
      parallels.forEach((nestedParallel: ParallelElement) => {
        this.validateNestedParallelStructure(nestedParallel, errors);
      });
    }
  }

  private validateW3CCompliance(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    // Validate namespace
    if (
      !scxml['@_xmlns'] ||
      scxml['@_xmlns'] !== 'http://www.w3.org/2005/07/scxml'
    ) {
      errors.push({
        message:
          'SCXML root element must have xmlns="http://www.w3.org/2005/07/scxml"',
        severity: 'error',
      });
    }

    // Validate version
    if (!scxml['@_version']) {
      errors.push({
        message: 'SCXML root element must have a version attribute',
        severity: 'error',
      });
    }

    // Check for at least one state or initial attribute
    if (
      !scxml['@_initial'] &&
      !scxml.state &&
      !scxml.parallel &&
      !scxml.final
    ) {
      errors.push({
        message:
          'SCXML must have either an initial attribute or at least one state',
        severity: 'error',
      });
    }

    // Validate datamodel attribute values
    if (
      scxml['@_datamodel'] &&
      !['null', 'ecmascript', 'xpath'].includes(scxml['@_datamodel'])
    ) {
      errors.push({
        message: `Invalid datamodel '${scxml['@_datamodel']}'. Must be 'null', 'ecmascript', or 'xpath'`,
        severity: 'warning',
      });
    }

    // Validate binding attribute values
    if (scxml['@_binding'] && !['early', 'late'].includes(scxml['@_binding'])) {
      errors.push({
        message: `Invalid binding '${scxml['@_binding']}'. Must be 'early' or 'late'`,
        severity: 'error',
      });
    }
  }

  private validateStateMachineSemantics(
    scxml: SCXMLElement,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    // Check for unreachable states
    const reachableStates = new Set<string>();
    const visitedStates = new Set<string>();

    // Add initial states to reachable set
    if (scxml['@_initial']) {
      const initialStates = scxml['@_initial'].split(/\s+/);
      initialStates.forEach((id) => reachableStates.add(id));
    }

    // Find states reachable through transitions
    this.findReachableStates(scxml, reachableStates, visitedStates);

    // Report unreachable states
    stateIds.forEach((stateId) => {
      if (!reachableStates.has(stateId)) {
        errors.push({
          message: `State '${stateId}' is unreachable`,
          severity: 'warning',
        });
      }
    });

    // Check for duplicate state IDs
    const duplicateIds = this.findDuplicateIds(scxml);
    duplicateIds.forEach((id) => {
      errors.push({
        message: `Duplicate state ID '${id}'`,
        severity: 'error',
      });
    });

    // Validate compound state requirements
    this.validateCompoundStates(scxml, errors);
  }

  private findReachableStates(
    element: SCXMLElement | StateElement | ParallelElement,
    reachableStates: Set<string>,
    visitedStates: Set<string>
  ): void {
    // Process states
    if ('state' in element && element.state) {
      const states = Array.isArray(element.state)
        ? element.state
        : [element.state];
      states.forEach((state) => {
        const stateId = state['@_id'];
        if (stateId && !visitedStates.has(stateId)) {
          visitedStates.add(stateId);

          // Add states reachable through transitions
          if (state.transition) {
            const transitions = Array.isArray(state.transition)
              ? state.transition
              : [state.transition];
            transitions.forEach((transition) => {
              if (transition['@_target']) {
                const targets = transition['@_target'].split(/\s+/);
                targets.forEach((target) => reachableStates.add(target));
              }
            });
          }

          // Check initial states in compound states
          if (state['@_initial']) {
            const initialStates = state['@_initial'].split(/\s+/);
            initialStates.forEach((id) => reachableStates.add(id));
          }

          // Recursively check nested states
          this.findReachableStates(state, reachableStates, visitedStates);
        }
      });
    }

    // Process parallel states
    if ('parallel' in element && element.parallel) {
      const parallels = Array.isArray(element.parallel)
        ? element.parallel
        : [element.parallel];
      parallels.forEach((parallel) => {
        const parallelId = parallel['@_id'];
        if (parallelId && !visitedStates.has(parallelId)) {
          visitedStates.add(parallelId);
          this.findReachableStates(parallel, reachableStates, visitedStates);
        }
      });
    }
  }

  private findDuplicateIds(scxml: SCXMLElement): string[] {
    const idCounts = new Map<string, number>();
    const duplicates: string[] = [];

    const countIds = (
      element: SCXMLElement | StateElement | ParallelElement
    ) => {
      // Count state IDs
      if ('state' in element && element.state) {
        const states = Array.isArray(element.state)
          ? element.state
          : [element.state];
        states.forEach((state) => {
          if (state['@_id']) {
            const count = idCounts.get(state['@_id']) || 0;
            idCounts.set(state['@_id'], count + 1);
          }
          countIds(state);
        });
      }

      // Count parallel IDs
      if ('parallel' in element && element.parallel) {
        const parallels = Array.isArray(element.parallel)
          ? element.parallel
          : [element.parallel];
        parallels.forEach((parallel) => {
          if (parallel['@_id']) {
            const count = idCounts.get(parallel['@_id']) || 0;
            idCounts.set(parallel['@_id'], count + 1);
          }
          countIds(parallel);
        });
      }

      // Count final state IDs
      if ('final' in element && element.final) {
        const finals = Array.isArray(element.final)
          ? element.final
          : [element.final];
        finals.forEach((final) => {
          if (final['@_id']) {
            const count = idCounts.get(final['@_id']) || 0;
            idCounts.set(final['@_id'], count + 1);
          }
        });
      }
    };

    countIds(scxml);

    // Find duplicates
    idCounts.forEach((count, id) => {
      if (count > 1) {
        duplicates.push(id);
      }
    });

    return duplicates;
  }

  private validateCompoundStates(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    const validateCompoundState = (state: StateElement) => {
      const hasChildren =
        state.state || state.parallel || state.final || state.history;

      if (hasChildren) {
        // Compound state must have initial attribute or initial state
        if (!state['@_initial']) {
          const hasInitialChild =
            state.state && Array.isArray(state.state)
              ? state.state.some(
                  (s) => s['@_id'] && s['@_id'].includes('initial')
                )
              : state.state &&
                state.state['@_id'] &&
                state.state['@_id'].includes('initial');

          if (!hasInitialChild) {
            errors.push({
              message: `Compound state '${state['@_id']}' must have an initial attribute or initial state`,
              severity: 'error',
            });
          }
        }
      }

      // Recursively validate nested states
      if (state.state) {
        const states = Array.isArray(state.state) ? state.state : [state.state];
        states.forEach((nestedState) => validateCompoundState(nestedState));
      }
    };

    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state) => validateCompoundState(state));
    }
  }

  private validateTransitionSemantics(
    scxml: SCXMLElement,
    stateIds: Set<string>,
    errors: ValidationError[]
  ): void {
    const validateTransitions = (
      element: SCXMLElement | StateElement | ParallelElement
    ) => {
      if ('transition' in element && element.transition) {
        const transitions = Array.isArray(element.transition)
          ? element.transition
          : [element.transition];

        transitions.forEach((transition) => {
          // Validate transition types
          if (
            transition['@_type'] &&
            !['internal', 'external'].includes(transition['@_type'])
          ) {
            errors.push({
              message: `Invalid transition type '${transition['@_type']}'. Must be 'internal' or 'external'`,
              severity: 'error',
            });
          }

          // Internal transitions must not have targets unless they are self-targeting
          if (transition['@_type'] === 'internal' && transition['@_target']) {
            const targets = transition['@_target'].split(/\s+/);
            const sourceId = '@_id' in element ? element['@_id'] : undefined;

            if (targets.some((target) => target !== sourceId)) {
              errors.push({
                message: 'Internal transitions cannot target other states',
                severity: 'error',
              });
            }
          }

          // Validate event names (basic check for valid event syntax)
          if (transition['@_event']) {
            const events = transition['@_event'].split(/\s+/);
            events.forEach((event) => {
              if (
                event !== '*' &&
                !/^[a-zA-Z_][a-zA-Z0-9_\-\.]*(\.\*)?$/.test(event)
              ) {
                errors.push({
                  message: `Invalid event name '${event}'. Event names must be valid identifiers`,
                  severity: 'warning',
                });
              }
            });
          }
        });
      }

      // Recursively validate nested elements
      if ('state' in element && element.state) {
        const states = Array.isArray(element.state)
          ? element.state
          : [element.state];
        states.forEach((state) => validateTransitions(state));
      }

      if ('parallel' in element && element.parallel) {
        const parallels = Array.isArray(element.parallel)
          ? element.parallel
          : [element.parallel];
        parallels.forEach((parallel) => validateTransitions(parallel));
      }
    };

    validateTransitions(scxml);
  }

  private validateExecutableElements(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    // This method would validate executable content like <script>, <assign>, <send>, etc.
    // For now, we'll add basic validation structure

    const validateExecutable = (
      element: SCXMLElement | StateElement | ParallelElement
    ) => {
      // Validate script elements
      if ('script' in element && element.script) {
        const scripts = Array.isArray(element.script)
          ? element.script
          : [element.script];
        scripts.forEach((script) => {
          if (!script['@_src'] && !script['#text']) {
            errors.push({
              message:
                'Script element must have either src attribute or text content',
              severity: 'error',
            });
          }
        });
      }

      // Recursively validate nested elements
      if ('state' in element && element.state) {
        const states = Array.isArray(element.state)
          ? element.state
          : [element.state];
        states.forEach((state) => validateExecutable(state));
      }

      if ('parallel' in element && element.parallel) {
        const parallels = Array.isArray(element.parallel)
          ? element.parallel
          : [element.parallel];
        parallels.forEach((parallel) => validateExecutable(parallel));
      }
    };

    validateExecutable(scxml);
  }

  private validateAllElementAttributes(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    this.validateElementAttributes(
      'scxml',
      scxml,
      this.getValidScxmlAttributes(),
      errors
    );
    this.validateChildElementAttributes(scxml, errors);
  }

  private validateChildElementAttributes(
    element: SCXMLElement | StateElement | ParallelElement | any,
    errors: ValidationError[]
  ): void {
    // Validate states
    if (element.state) {
      const states = Array.isArray(element.state)
        ? element.state
        : [element.state];
      states.forEach((state: StateElement) => {
        this.validateElementAttributes(
          'state',
          state,
          this.getValidStateAttributes(),
          errors
        );
        this.validateStateChildren(state, errors);
        this.validateChildElementAttributes(state, errors);
      });
    }

    // Validate parallel states
    if (element.parallel) {
      const parallels = Array.isArray(element.parallel)
        ? element.parallel
        : [element.parallel];
      parallels.forEach((parallel: ParallelElement) => {
        this.validateElementAttributes(
          'parallel',
          parallel,
          this.getValidParallelAttributes(),
          errors
        );
        this.validateChildElementAttributes(parallel, errors);
      });
    }

    // Validate final states
    if (element.final) {
      const finals = Array.isArray(element.final)
        ? element.final
        : [element.final];
      finals.forEach((final: FinalElement) => {
        this.validateElementAttributes(
          'final',
          final,
          this.getValidFinalAttributes(),
          errors
        );
      });
    }

    // Validate history states
    if (element.history) {
      const histories = Array.isArray(element.history)
        ? element.history
        : [element.history];
      histories.forEach((history: HistoryElement) => {
        this.validateElementAttributes(
          'history',
          history,
          this.getValidHistoryAttributes(),
          errors
        );
      });
    }

    // Validate transitions
    if (element.transition) {
      const transitions = Array.isArray(element.transition)
        ? element.transition
        : [element.transition];
      transitions.forEach((transition: TransitionElement) => {
        this.validateElementAttributes(
          'transition',
          transition,
          this.getValidTransitionAttributes(),
          errors
        );
      });
    }
  }

  private validateStateChildren(
    state: StateElement,
    errors: ValidationError[]
  ): void {
    // Validate onentry
    if (state.onentry) {
      const onentries = Array.isArray(state.onentry)
        ? state.onentry
        : [state.onentry];
      onentries.forEach((onentry: any) => {
        this.validateElementAttributes(
          'onentry',
          onentry,
          this.getValidOnentryAttributes(),
          errors
        );
      });
    }

    // Validate onexit
    if (state.onexit) {
      const onexits = Array.isArray(state.onexit)
        ? state.onexit
        : [state.onexit];
      onexits.forEach((onexit: any) => {
        this.validateElementAttributes(
          'onexit',
          onexit,
          this.getValidOnexitAttributes(),
          errors
        );
      });
    }

    // Validate initial
    if (state['@_initial']) {
      const initials = Array.isArray(state['@_initial'])
        ? state['@_initial']
        : [state['@_initial']];
      initials.forEach((initial: any) => {
        this.validateElementAttributes(
          'initial',
          initial,
          this.getValidInitialAttributes(),
          errors
        );
      });
    }

    // Validate datamodel
    if (state.datamodel) {
      const datamodels = Array.isArray(state.datamodel)
        ? state.datamodel
        : [state.datamodel];
      datamodels.forEach((datamodel: any) => {
        this.validateElementAttributes(
          'datamodel',
          datamodel,
          this.getValidDatamodelAttributes(),
          errors
        );

        // Validate data elements
        if (datamodel.data) {
          const dataElements = Array.isArray(datamodel.data)
            ? datamodel.data
            : [datamodel.data];
          dataElements.forEach((data: any) => {
            this.validateElementAttributes(
              'data',
              data,
              this.getValidDataAttributes(),
              errors
            );
          });
        }
      });
    }

    // Validate invoke
    if (state.invoke) {
      const invokes = Array.isArray(state.invoke)
        ? state.invoke
        : [state.invoke];
      invokes.forEach((invoke: any) => {
        this.validateElementAttributes(
          'invoke',
          invoke,
          this.getValidInvokeAttributes(),
          errors
        );
      });
    }

    // Validate executable content in onentry/onexit
    this.validateExecutableContent(state.onentry, errors);
    this.validateExecutableContent(state.onexit, errors);
  }

  private validateExecutableContent(
    element: any,
    errors: ValidationError[]
  ): void {
    if (!element) return;

    const elements = Array.isArray(element) ? element : [element];
    elements.forEach((el: any) => {
      // Validate script elements
      if (el.script) {
        const scripts = Array.isArray(el.script) ? el.script : [el.script];
        scripts.forEach((script: any) => {
          this.validateElementAttributes(
            'script',
            script,
            this.getValidScriptAttributes(),
            errors
          );
        });
      }

      // Validate assign elements
      if (el.assign) {
        const assigns = Array.isArray(el.assign) ? el.assign : [el.assign];
        assigns.forEach((assign: any) => {
          this.validateElementAttributes(
            'assign',
            assign,
            this.getValidAssignAttributes(),
            errors
          );
        });
      }

      // Validate send elements
      if (el.send) {
        const sends = Array.isArray(el.send) ? el.send : [el.send];
        sends.forEach((send: any) => {
          this.validateElementAttributes(
            'send',
            send,
            this.getValidSendAttributes(),
            errors
          );
        });
      }

      // Validate raise elements
      if (el.raise) {
        const raises = Array.isArray(el.raise) ? el.raise : [el.raise];
        raises.forEach((raise: any) => {
          this.validateElementAttributes(
            'raise',
            raise,
            this.getValidRaiseAttributes(),
            errors
          );
        });
      }

      // Validate log elements
      if (el.log) {
        const logs = Array.isArray(el.log) ? el.log : [el.log];
        logs.forEach((log: any) => {
          this.validateElementAttributes(
            'log',
            log,
            this.getValidLogAttributes(),
            errors
          );
        });
      }

      // Validate cancel elements
      if (el.cancel) {
        const cancels = Array.isArray(el.cancel) ? el.cancel : [el.cancel];
        cancels.forEach((cancel: any) => {
          this.validateElementAttributes(
            'cancel',
            cancel,
            this.getValidCancelAttributes(),
            errors
          );
        });
      }

      // Validate if elements
      if (el.if) {
        const ifs = Array.isArray(el.if) ? el.if : [el.if];
        ifs.forEach((ifEl: any) => {
          this.validateElementAttributes(
            'if',
            ifEl,
            this.getValidIfAttributes(),
            errors
          );
          this.validateExecutableContent(ifEl, errors);
        });
      }

      // Validate elseif elements
      if (el.elseif) {
        const elseifs = Array.isArray(el.elseif) ? el.elseif : [el.elseif];
        elseifs.forEach((elseif: any) => {
          this.validateElementAttributes(
            'elseif',
            elseif,
            this.getValidElseifAttributes(),
            errors
          );
        });
      }

      // Validate else elements
      if (el.else) {
        const elses = Array.isArray(el.else) ? el.else : [el.else];
        elses.forEach((elseEl: any) => {
          this.validateElementAttributes(
            'else',
            elseEl,
            this.getValidElseAttributes(),
            errors
          );
        });
      }

      // Validate foreach elements
      if (el.foreach) {
        const foreachs = Array.isArray(el.foreach) ? el.foreach : [el.foreach];
        foreachs.forEach((foreach: any) => {
          this.validateElementAttributes(
            'foreach',
            foreach,
            this.getValidForeachAttributes(),
            errors
          );
          this.validateExecutableContent(foreach, errors);
        });
      }
    });
  }

  private validateElementAttributes(
    elementName: string,
    element: any,
    validAttributes: Set<string>,
    errors: ValidationError[]
  ): void {
    if (!element || typeof element !== 'object') return;

    Object.keys(element).forEach((key) => {
      // Skip non-attribute properties (child elements and text content)
      if (!key.startsWith('@_') && key !== '#text' && key !== '#cdata') return;

      const attributeName = key.startsWith('@_') ? key.substring(2) : key;

      if (!validAttributes.has(attributeName)) {
        const suggestion = this.findSimilarAttribute(
          attributeName,
          validAttributes
        );
        const elementId = element['@_id'] ? ` (id: ${element['@_id']})` : '';

        errors.push({
          message: `Unknown attribute '${attributeName}' in <${elementName}>${elementId}${
            suggestion ? `. Did you mean '${suggestion}'?` : ''
          }`,
          severity: 'error',
        });
      }
    });
  }

  private findSimilarAttribute(
    attr: string,
    validAttributes: Set<string>
  ): string | null {
    const threshold = 2; // Maximum edit distance
    let bestMatch: string | null = null;
    let minDistance = threshold + 1;

    for (const validAttr of validAttributes) {
      const distance = this.levenshteinDistance(attr, validAttr);
      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = validAttr;
      }
    }

    return minDistance <= threshold ? bestMatch : null;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getValidScxmlAttributes(): Set<string> {
    return new Set([
      'xmlns',
      'version',
      'datamodel',
      'initial',
      'name',
      'binding',
      'exmode',
    ]);
  }

  private getValidStateAttributes(): Set<string> {
    return new Set(['id', 'initial']);
  }

  private getValidParallelAttributes(): Set<string> {
    return new Set(['id']);
  }

  private getValidFinalAttributes(): Set<string> {
    return new Set(['id']);
  }

  private getValidHistoryAttributes(): Set<string> {
    return new Set(['id', 'type']);
  }

  private getValidTransitionAttributes(): Set<string> {
    return new Set(['event', 'cond', 'target', 'type']);
  }

  private getValidOnentryAttributes(): Set<string> {
    return new Set([]);
  }

  private getValidOnexitAttributes(): Set<string> {
    return new Set([]);
  }

  private getValidInitialAttributes(): Set<string> {
    return new Set([]);
  }

  private getValidDatamodelAttributes(): Set<string> {
    return new Set([]);
  }

  private getValidDataAttributes(): Set<string> {
    return new Set(['id', 'src', 'expr']);
  }

  private getValidInvokeAttributes(): Set<string> {
    return new Set([
      'type',
      'typeexpr',
      'src',
      'srcexpr',
      'id',
      'idlocation',
      'namelist',
      'autoforward',
    ]);
  }

  private getValidScriptAttributes(): Set<string> {
    return new Set(['src']);
  }

  private getValidAssignAttributes(): Set<string> {
    return new Set(['location', 'expr']);
  }

  private getValidSendAttributes(): Set<string> {
    return new Set([
      'event',
      'eventexpr',
      'target',
      'targetexpr',
      'type',
      'typeexpr',
      'id',
      'idlocation',
      'delay',
      'delayexpr',
      'namelist',
    ]);
  }

  private getValidRaiseAttributes(): Set<string> {
    return new Set(['event']);
  }

  private getValidLogAttributes(): Set<string> {
    return new Set(['label', 'expr']);
  }

  private getValidCancelAttributes(): Set<string> {
    return new Set(['sendid', 'sendidexpr']);
  }

  private getValidIfAttributes(): Set<string> {
    return new Set(['cond']);
  }

  private getValidElseifAttributes(): Set<string> {
    return new Set(['cond']);
  }

  private getValidElseAttributes(): Set<string> {
    return new Set([]);
  }

  private getValidForeachAttributes(): Set<string> {
    return new Set(['array', 'item', 'index']);
  }
}
