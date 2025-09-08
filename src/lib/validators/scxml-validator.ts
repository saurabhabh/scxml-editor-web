import type {
  SCXMLElement,
  StateElement,
  TransitionElement,
  ParallelElement,
  FinalElement,
  HistoryElement,
  OnEntryElement,
  OnExitElement,
  DataModelElement,
  DataElement,
  InvokeElement,
  ScriptElement,
  AssignElement,
  SendElement,
  RaiseElement,
  LogElement,
  CancelElement,
  IfElement,
  ElseIfElement,
  ElseElement,
  ForEachElement,
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
    // Validate required attributes for all elements in the SCXML document
    this.validateRequiredAttributesRecursive(scxml, errors);
  }

  private validateRequiredAttributesRecursive(
    element: any,
    errors: ValidationError[],
    elementName: string = 'scxml',
    path: string = ''
  ): void {
    if (!element) return;

    const currentPath = path ? `${path}.${elementName}` : elementName;

    // Validate based on element type
    switch (elementName) {
      case 'state':
        this.validateStateRequiredAttributes(element, errors, currentPath);
        break;
      case 'parallel':
        this.validateParallelRequiredAttributes(element, errors, currentPath);
        break;
      case 'final':
        this.validateFinalRequiredAttributes(element, errors, currentPath);
        break;
      case 'transition':
        this.validateTransitionRequiredAttributes(element, errors, currentPath);
        break;
      case 'history':
        this.validateHistoryRequiredAttributes(element, errors, currentPath);
        break;
      case 'initial':
        this.validateInitialRequiredAttributes(element, errors, currentPath);
        break;
      case 'invoke':
        this.validateInvokeRequiredAttributes(element, errors, currentPath);
        break;
      case 'data':
        this.validateDataRequiredAttributes(element, errors, currentPath);
        break;
      case 'assign':
        this.validateAssignRequiredAttributes(element, errors, currentPath);
        break;
      case 'send':
        this.validateSendRequiredAttributes(element, errors, currentPath);
        break;
      case 'cancel':
        this.validateCancelRequiredAttributes(element, errors, currentPath);
        break;
      case 'raise':
        this.validateRaiseRequiredAttributes(element, errors, currentPath);
        break;
      case 'log':
        this.validateLogRequiredAttributes(element, errors, currentPath);
        break;
      case 'if':
        this.validateIfRequiredAttributes(element, errors, currentPath);
        break;
      case 'elseif':
        this.validateElseIfRequiredAttributes(element, errors, currentPath);
        break;
      case 'foreach':
        this.validateForEachRequiredAttributes(element, errors, currentPath);
        break;
    }

    // Recursively validate child elements
    this.validateChildElements(element, errors, currentPath);
  }

  private validateStateRequiredAttributes(
    state: StateElement,
    errors: ValidationError[],
    path: string
  ): void {
    // State requires 'id' attribute if it is a target of transitions
    // Since we can't easily determine if it's a target here, we'll check if it has an ID
    // and warn if it doesn't (as most states should have IDs for proper functioning)
    if (!state['@_id']) {
      errors.push({
        message: `State at ${path} should have an 'id' attribute if it is a target of transitions`,
        severity: 'warning',
      });
    }
  }

  private validateParallelRequiredAttributes(
    parallel: ParallelElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Parallel requires 'id' attribute if it is a target of transitions
    if (!parallel['@_id']) {
      errors.push({
        message: `Parallel state at ${path} should have an 'id' attribute if it is a target of transitions`,
        severity: 'warning',
      });
    }
  }

  private validateFinalRequiredAttributes(
    final: FinalElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Final requires 'id' attribute if it is a target of transitions
    if (!final['@_id']) {
      errors.push({
        message: `Final state at ${path} should have an 'id' attribute if it is a target of transitions`,
        severity: 'warning',
      });
    }
  }

  private validateTransitionRequiredAttributes(
    transition: TransitionElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Transition requires 'target' attribute if not internal/self-transition
    if (!transition['@_target'] && transition['@_type'] !== 'internal') {
      errors.push({
        message: `Transition at ${path} must have a 'target' attribute if it is not an internal transition`,
        severity: 'error',
      });
    }
  }

  private validateHistoryRequiredAttributes(
    history: HistoryElement,
    errors: ValidationError[],
    path: string
  ): void {
    // History requires 'id' attribute if referenced by transitions
    if (!history['@_id']) {
      errors.push({
        message: `History element at ${path} should have an 'id' attribute if referenced by transitions`,
        severity: 'warning',
      });
    }
  }

  private validateInitialRequiredAttributes(
    initial: any,
    errors: ValidationError[],
    path: string
  ): void {
    // Initial must contain a transition
    if (!initial.transition) {
      errors.push({
        message: `Initial element at ${path} must contain a transition`,
        severity: 'error',
      });
    }
  }

  private validateInvokeRequiredAttributes(
    invoke: InvokeElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Invoke requires 'type' or 'src' attribute
    if (!invoke['@_type'] && !invoke['@_src']) {
      errors.push({
        message: `Invoke element at ${path} must have either 'type' or 'src' attribute`,
        severity: 'error',
      });
    }
  }

  private validateDataRequiredAttributes(
    data: DataElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Data requires 'id' attribute
    if (!data['@_id']) {
      errors.push({
        message: `Data element at ${path} must have an 'id' attribute`,
        severity: 'error',
      });
    }
  }

  private validateAssignRequiredAttributes(
    assign: AssignElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Assign requires 'location' attribute
    if (!assign['@_location']) {
      errors.push({
        message: `Assign element at ${path} must have a 'location' attribute`,
        severity: 'error',
      });
    }
  }

  private validateSendRequiredAttributes(
    send: SendElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Send requires 'event' or 'eventexpr' attribute
    if (!send['@_event'] && !send['@_eventexpr']) {
      errors.push({
        message: `Send element at ${path} must have either 'event' or 'eventexpr' attribute`,
        severity: 'error',
      });
    }
  }

  private validateCancelRequiredAttributes(
    cancel: CancelElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Cancel requires 'sendid' or 'sendidexpr' attribute
    if (!cancel['@_sendid'] && !cancel['@_sendidexpr']) {
      errors.push({
        message: `Cancel element at ${path} must have either 'sendid' or 'sendidexpr' attribute`,
        severity: 'error',
      });
    }
  }

  private validateRaiseRequiredAttributes(
    raise: RaiseElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Raise requires 'event' attribute
    if (!raise['@_event']) {
      errors.push({
        message: `Raise element at ${path} must have an 'event' attribute`,
        severity: 'error',
      });
    }
  }

  private validateLogRequiredAttributes(
    log: LogElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Log requires 'expr' attribute
    if (!log['@_expr']) {
      errors.push({
        message: `Log element at ${path} must have an 'expr' attribute`,
        severity: 'error',
      });
    }
  }

  private validateIfRequiredAttributes(
    ifElement: IfElement,
    errors: ValidationError[],
    path: string
  ): void {
    // If requires 'cond' attribute
    if (!ifElement['@_cond']) {
      errors.push({
        message: `If element at ${path} must have a 'cond' attribute`,
        severity: 'error',
      });
    }
  }

  private validateElseIfRequiredAttributes(
    elseif: ElseIfElement,
    errors: ValidationError[],
    path: string
  ): void {
    // ElseIf requires 'cond' attribute
    if (!elseif['@_cond']) {
      errors.push({
        message: `ElseIf element at ${path} must have a 'cond' attribute`,
        severity: 'error',
      });
    }
  }

  private validateForEachRequiredAttributes(
    foreach: ForEachElement,
    errors: ValidationError[],
    path: string
  ): void {
    // ForEach requires 'item' and 'array' attributes
    if (!foreach['@_item']) {
      errors.push({
        message: `ForEach element at ${path} must have an 'item' attribute`,
        severity: 'error',
      });
    }
    if (!foreach['@_array']) {
      errors.push({
        message: `ForEach element at ${path} must have an 'array' attribute`,
        severity: 'error',
      });
    }
  }

  private validateChildElements(
    element: any,
    errors: ValidationError[],
    path: string
  ): void {
    if (!element) return;

    // Define the mapping of property names to element types
    const elementMappings = [
      { prop: 'state', type: 'state' },
      { prop: 'parallel', type: 'parallel' },
      { prop: 'final', type: 'final' },
      { prop: 'history', type: 'history' },
      { prop: 'initial', type: 'initial' },
      { prop: 'transition', type: 'transition' },
      { prop: 'onentry', type: 'onentry' },
      { prop: 'onexit', type: 'onexit' },
      { prop: 'invoke', type: 'invoke' },
      { prop: 'datamodel', type: 'datamodel' },
      { prop: 'data', type: 'data' },
      { prop: 'script', type: 'script' },
      { prop: 'assign', type: 'assign' },
      { prop: 'send', type: 'send' },
      { prop: 'raise', type: 'raise' },
      { prop: 'log', type: 'log' },
      { prop: 'cancel', type: 'cancel' },
      { prop: 'if', type: 'if' },
      { prop: 'elseif', type: 'elseif' },
      { prop: 'else', type: 'else' },
      { prop: 'foreach', type: 'foreach' },
    ];

    // Process each type of child element
    elementMappings.forEach(({ prop, type }) => {
      if (element[prop]) {
        const children = Array.isArray(element[prop]) ? element[prop] : [element[prop]];
        children.forEach((child: any, index: number) => {
          const childPath = `${path}.${prop}[${index}]`;
          this.validateRequiredAttributesRecursive(child, errors, type, childPath);
        });
      }
    });
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
    if (element.state) {
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
    if (element.parallel) {
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
      if (element.state) {
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
      if (element.parallel) {
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

      // Count final state IDs - check if element has final property
      if ((element as any).final) {
        const finals = Array.isArray((element as any).final)
          ? (element as any).final
          : [(element as any).final];
        finals.forEach((final: FinalElement) => {
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
      if ((element as any).transition) {
        const transitions = Array.isArray((element as any).transition)
          ? (element as any).transition
          : [(element as any).transition];

        transitions.forEach((transition: TransitionElement) => {
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
            const sourceId = (element as any)['@_id'] ? (element as any)['@_id'] : undefined;

            if (targets.some((target: string) => target !== sourceId)) {
              errors.push({
                message: 'Internal transitions cannot target other states',
                severity: 'error',
              });
            }
          }

          // Validate event names (basic check for valid event syntax)
          if (transition['@_event']) {
            const events = transition['@_event'].split(/\s+/);
            events.forEach((event: string) => {
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
      if (element.state) {
        const states = Array.isArray(element.state)
          ? element.state
          : [element.state];
        states.forEach((state) => validateTransitions(state));
      }

      if (element.parallel) {
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
      if ((element as any).script) {
        const scripts = Array.isArray((element as any).script)
          ? (element as any).script
          : [(element as any).script];
        scripts.forEach((script: any) => {
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
      if (element.state) {
        const states = Array.isArray(element.state)
          ? element.state
          : [element.state];
        states.forEach((state) => validateExecutable(state));
      }

      if (element.parallel) {
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
      scxml as unknown as Record<string, unknown>,
      this.getValidScxmlAttributes(),
      errors
    );
    this.validateChildElementAttributes(scxml, errors);
  }

  private validateChildElementAttributes(
    element: SCXMLElement | StateElement | ParallelElement,
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
          state as unknown as Record<string, unknown>,
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
          parallel as unknown as Record<string, unknown>,
          this.getValidParallelAttributes(),
          errors
        );
        this.validateChildElementAttributes(parallel, errors);
      });
    }

    // Validate final states
    if ((element as any).final) {
      const finals = Array.isArray((element as any).final)
        ? (element as any).final
        : [(element as any).final];
      finals.forEach((final: FinalElement) => {
        this.validateElementAttributes(
          'final',
          final as unknown as Record<string, unknown>,
          this.getValidFinalAttributes(),
          errors
        );
      });
    }

    // Validate history states
    if ((element as any).history) {
      const histories = Array.isArray((element as any).history)
        ? (element as any).history
        : [(element as any).history];
      histories.forEach((history: HistoryElement) => {
        this.validateElementAttributes(
          'history',
          history as unknown as Record<string, unknown>,
          this.getValidHistoryAttributes(),
          errors
        );
      });
    }

    // Validate transitions
    if ((element as any).transition) {
      const transitions = Array.isArray((element as any).transition)
        ? (element as any).transition
        : [(element as any).transition];
      transitions.forEach((transition: TransitionElement) => {
        this.validateElementAttributes(
          'transition',
          transition as unknown as Record<string, unknown>,
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
      onentries.forEach((onentry: OnEntryElement) => {
        this.validateElementAttributes(
          'onentry',
          onentry as unknown as Record<string, unknown>,
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
      onexits.forEach((onexit: OnExitElement) => {
        this.validateElementAttributes(
          'onexit',
          onexit as unknown as Record<string, unknown>,
          this.getValidOnexitAttributes(),
          errors
        );
      });
    }

    // Note: @_initial is a string attribute, not an element array

    // Validate datamodel
    if (state.datamodel) {
      const datamodels = Array.isArray(state.datamodel)
        ? state.datamodel
        : [state.datamodel];
      datamodels.forEach((datamodel: DataModelElement) => {
        this.validateElementAttributes(
          'datamodel',
          datamodel as unknown as Record<string, unknown>,
          this.getValidDatamodelAttributes(),
          errors
        );

        // Validate data elements
        if (datamodel.data) {
          const dataElements = Array.isArray(datamodel.data)
            ? datamodel.data
            : [datamodel.data];
          dataElements.forEach((data: DataElement) => {
            this.validateElementAttributes(
              'data',
              data as unknown as Record<string, unknown>,
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
      invokes.forEach((invoke: InvokeElement) => {
        this.validateElementAttributes(
          'invoke',
          invoke as unknown as Record<string, unknown>,
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
    element:
      | OnEntryElement
      | OnExitElement
      | OnEntryElement[]
      | OnExitElement[]
      | undefined,
    errors: ValidationError[]
  ): void {
    if (!element) return;
    const elements = Array.isArray(element) ? element : [element];
    elements.forEach((el: OnEntryElement | OnExitElement) => {
      // Validate executable elements array
      if (el.executable) {
        el.executable.forEach((executable) => {
          this.validateExecutableElement(executable, errors);
        });
      }
    });
  }

  private validateExecutableElement(
    executable: import('@/types/scxml').ExecutableElement,
    errors: ValidationError[]
  ): void {
    // Validate based on the executable element type
    const elementType = Object.keys(executable).find(
      (key) => !key.startsWith('@_') && key !== '#text' && key !== '#cdata'
    );

    if (!elementType) return;

    switch (elementType) {
      case 'raise':
        this.validateElementAttributes(
          'raise',
          executable as Record<string, unknown>,
          this.getValidRaiseAttributes(),
          errors
        );
        break;
      case 'if':
        this.validateElementAttributes(
          'if',
          executable as Record<string, unknown>,
          this.getValidIfAttributes(),
          errors
        );
        const ifEl = executable as IfElement;
        if (ifEl.executable) {
          ifEl.executable.forEach((nested) =>
            this.validateExecutableElement(nested, errors)
          );
        }
        break;
      case 'elseif':
        this.validateElementAttributes(
          'elseif',
          executable as Record<string, unknown>,
          this.getValidElseifAttributes(),
          errors
        );
        break;
      case 'else':
        this.validateElementAttributes(
          'else',
          executable as Record<string, unknown>,
          this.getValidElseAttributes(),
          errors
        );
        const elseEl = executable as ElseElement;
        if (elseEl.executable) {
          elseEl.executable.forEach((nested) =>
            this.validateExecutableElement(nested, errors)
          );
        }
        break;
      case 'foreach':
        this.validateElementAttributes(
          'foreach',
          executable as Record<string, unknown>,
          this.getValidForeachAttributes(),
          errors
        );
        const foreachEl = executable as ForEachElement;
        if (foreachEl.executable) {
          foreachEl.executable.forEach((nested) =>
            this.validateExecutableElement(nested, errors)
          );
        }
        break;
      case 'log':
        this.validateElementAttributes(
          'log',
          executable as Record<string, unknown>,
          this.getValidLogAttributes(),
          errors
        );
        break;
      case 'assign':
        this.validateElementAttributes(
          'assign',
          executable as Record<string, unknown>,
          this.getValidAssignAttributes(),
          errors
        );
        break;
      case 'script':
        this.validateElementAttributes(
          'script',
          executable as Record<string, unknown>,
          this.getValidScriptAttributes(),
          errors
        );
        break;
      case 'send':
        this.validateElementAttributes(
          'send',
          executable as Record<string, unknown>,
          this.getValidSendAttributes(),
          errors
        );
        break;
      case 'cancel':
        this.validateElementAttributes(
          'cancel',
          executable as Record<string, unknown>,
          this.getValidCancelAttributes(),
          errors
        );
        break;
    }
  }

  private validateElementAttributes(
    elementName: string,
    element: Record<string, unknown>,
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
