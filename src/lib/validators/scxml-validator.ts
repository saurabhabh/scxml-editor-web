import type {
  SCXMLElement,
  StateElement,
  TransitionElement,
  ParallelElement,
  FinalElement,
  HistoryElement,
  InitialElement,
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
  private xmlContent?: string;
  private elementPositions: Map<any, { line: number; column: number }> = new Map();
  private reportedErrors: Set<string> = new Set();
  // Parent-child mapping for hierarchy tracking
  private stateParentMap: Map<string, string | null> = new Map();

  validate(scxml: SCXMLElement, xmlContent?: string): ValidationError[] {
    this.xmlContent = xmlContent;
    this.elementPositions.clear();
    this.reportedErrors.clear();
    this.stateParentMap.clear();

    // Parse positions if XML content is provided
    if (xmlContent) {
      this.parseElementPositions(xmlContent);
    }

    const errors: ValidationError[] = [];
    const stateIds = new Set<string>();

    // Collect all state IDs first
    this.collectStateIds(scxml, stateIds);

    // Build parent-child hierarchy map
    this.buildStateHierarchy(scxml);

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

    // Cross-hierarchy transition validation (1C requirement)
    this.validateCrossHierarchyTransitions(scxml, errors);

    return this.deduplicateErrors(errors);
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

  /**
   * Build parent-child hierarchy map for cross-hierarchy validation
   */
  private buildStateHierarchy(scxml: SCXMLElement): void {
    // Process root-level states (parent = null)
    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state) => {
        if (state['@_id']) {
          this.stateParentMap.set(state['@_id'], null);
        }
        this.buildStateHierarchyFromState(state, state['@_id'] || null);
      });
    }

    if (scxml.parallel) {
      const parallels = Array.isArray(scxml.parallel)
        ? scxml.parallel
        : [scxml.parallel];
      parallels.forEach((parallel) => {
        if (parallel['@_id']) {
          this.stateParentMap.set(parallel['@_id'], null);
        }
        this.buildStateHierarchyFromParallel(parallel, parallel['@_id'] || null);
      });
    }

    if (scxml.final) {
      const finals = Array.isArray(scxml.final) ? scxml.final : [scxml.final];
      finals.forEach((final) => {
        if (final['@_id']) {
          this.stateParentMap.set(final['@_id'], null);
        }
      });
    }
  }

  private buildStateHierarchyFromState(
    state: StateElement,
    parentId: string | null
  ): void {
    // Process child states
    if (state.state) {
      const states = Array.isArray(state.state) ? state.state : [state.state];
      states.forEach((childState) => {
        if (childState['@_id']) {
          this.stateParentMap.set(childState['@_id'], parentId);
        }
        this.buildStateHierarchyFromState(
          childState,
          childState['@_id'] || parentId
        );
      });
    }

    // Process child parallel states
    if (state.parallel) {
      const parallels = Array.isArray(state.parallel)
        ? state.parallel
        : [state.parallel];
      parallels.forEach((parallel) => {
        if (parallel['@_id']) {
          this.stateParentMap.set(parallel['@_id'], parentId);
        }
        this.buildStateHierarchyFromParallel(
          parallel,
          parallel['@_id'] || parentId
        );
      });
    }

    // Process child final states
    if (state.final) {
      const finals = Array.isArray(state.final) ? state.final : [state.final];
      finals.forEach((final) => {
        if (final['@_id']) {
          this.stateParentMap.set(final['@_id'], parentId);
        }
      });
    }

    // Process child history states
    if (state.history) {
      const histories = Array.isArray(state.history)
        ? state.history
        : [state.history];
      histories.forEach((history) => {
        if (history['@_id']) {
          this.stateParentMap.set(history['@_id'], parentId);
        }
      });
    }
  }

  private buildStateHierarchyFromParallel(
    parallel: ParallelElement,
    parentId: string | null
  ): void {
    // Process child states
    if (parallel.state) {
      const states = Array.isArray(parallel.state)
        ? parallel.state
        : [parallel.state];
      states.forEach((childState: StateElement) => {
        if (childState['@_id']) {
          this.stateParentMap.set(childState['@_id'], parentId);
        }
        this.buildStateHierarchyFromState(
          childState,
          childState['@_id'] || parentId
        );
      });
    }

    // Process child parallel states
    if (parallel.parallel) {
      const parallels = Array.isArray(parallel.parallel)
        ? parallel.parallel
        : [parallel.parallel];
      parallels.forEach((childParallel: ParallelElement) => {
        if (childParallel['@_id']) {
          this.stateParentMap.set(childParallel['@_id'], parentId);
        }
        this.buildStateHierarchyFromParallel(
          childParallel,
          childParallel['@_id'] || parentId
        );
      });
    }

    // Process child history states
    if (parallel.history) {
      const histories = Array.isArray(parallel.history)
        ? parallel.history
        : [parallel.history];
      histories.forEach((history: HistoryElement) => {
        if (history['@_id']) {
          this.stateParentMap.set(history['@_id'], parentId);
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
            message: `Initial state '${stateId}' not found. Make sure a state with id="${stateId}" exists in your SCXML document.`,
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
                message: `Transition target '${target}' not found. Make sure a state with id="${target}" exists in your SCXML document.`,
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
                message: `Initial state '${stateId}' in state '${state['@_id'] || 'unnamed'}' not found. Make sure a state with id="${stateId}" exists in your SCXML document.`,
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
      const position = this.findElementPosition('state', path);
      const errorKey = `missing_state_id_${path}`;
      
      // Avoid duplicate error reporting
      if (!this.reportedErrors.has(errorKey)) {
        this.reportedErrors.add(errorKey);
        errors.push({
          message: `State missing required 'id' attribute. All states should have unique identifiers for proper SCXML functionality.`,
          severity: 'error',
          line: position?.line,
          column: position?.column,
        });
      }
    }
  }

  private validateParallelRequiredAttributes(
    parallel: ParallelElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Parallel requires 'id' attribute if it is a target of transitions
    if (!parallel['@_id']) {
      const position = this.findElementPosition('parallel', path);
      const errorKey = `missing_parallel_id_${path}`;
      
      if (!this.reportedErrors.has(errorKey)) {
        this.reportedErrors.add(errorKey);
        errors.push({
          message: `Parallel state missing required 'id' attribute. All parallel states should have unique identifiers for proper SCXML functionality.`,
          severity: 'error',
          line: position?.line,
          column: position?.column,
        });
      }
    }
  }

  private validateFinalRequiredAttributes(
    final: FinalElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Final requires 'id' attribute if it is a target of transitions
    if (!final['@_id']) {
      const position = this.findElementPosition('final', path);
      const errorKey = `missing_final_id_${path}`;
      
      if (!this.reportedErrors.has(errorKey)) {
        this.reportedErrors.add(errorKey);
        errors.push({
          message: `Final state missing required 'id' attribute. All final states should have unique identifiers for proper SCXML functionality.`,
          severity: 'error',
          line: position?.line,
          column: position?.column,
        });
      }
    }
  }

  private validateTransitionRequiredAttributes(
    transition: TransitionElement,
    errors: ValidationError[],
    path: string
  ): void {
    // Transition requires 'target' attribute if not internal/self-transition
    if (!transition['@_target'] && transition['@_type'] !== 'internal') {
      const position = this.findElementPosition('transition', path);
      const event = transition['@_event'];
      const eventInfo = event ? ` (triggered by "${event}")` : '';
      
      errors.push({
        message: `Missing required 'target' attribute in <transition> element${eventInfo}. Specify which state this transition should go to, or add type="internal" for transitions that stay in the same state.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('history', path);
      
      errors.push({
        message: `History element missing required 'id' attribute. History elements need unique identifiers to be referenced by transitions.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('initial', path);
      
      errors.push({
        message: `Initial element must contain a <transition> element. The initial element defines the default transition to take when entering a compound state.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('invoke', path);
      
      errors.push({
        message: `Missing required invocation specification in <invoke> element. Must have either 'type' (invocation type) or 'src' (external service URL) attribute.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('data', path);
      
      errors.push({
        message: `Missing required 'id' attribute in <data> element. The 'id' attribute provides a unique name for the data variable.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('assign', path);
      
      errors.push({
        message: `Missing required 'location' attribute in <assign> element. The 'location' attribute specifies which data variable to modify.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('send', path);
      
      errors.push({
        message: `Missing required event specification in <send> element. Must have either 'event' (static event name) or 'eventexpr' (dynamic event expression) attribute.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('cancel', path);
      
      errors.push({
        message: `Missing required send identifier in <cancel> element. Must have either 'sendid' (static ID) or 'sendidexpr' (dynamic expression) attribute to identify which sent event to cancel.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('raise', path);
      
      errors.push({
        message: `Missing required 'event' attribute in <raise> element. The 'event' attribute specifies which event to trigger within the state machine.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.getElementPosition(log);
      const friendlyMessage = this.createFriendlyLogErrorMessage(log, path);
      
      errors.push({
        message: friendlyMessage,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('if', path);
      
      errors.push({
        message: `Missing required 'cond' attribute in <if> element. The 'cond' attribute must contain a boolean expression that determines when to execute the if block.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
      const position = this.findElementPosition('elseif', path);
      
      errors.push({
        message: `Missing required 'cond' attribute in <elseif> element. The 'cond' attribute must contain a boolean expression that determines when to execute the elseif block.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
      });
    }
  }

  private validateForEachRequiredAttributes(
    foreach: ForEachElement,
    errors: ValidationError[],
    path: string
  ): void {
    // ForEach requires 'item' and 'array' attributes
    const position = this.findElementPosition('foreach', path);
    
    if (!foreach['@_item']) {
      errors.push({
        message: `Missing required 'item' attribute in <foreach> element. The 'item' attribute specifies the variable name for each iteration.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
      });
    }
    if (!foreach['@_array']) {
      errors.push({
        message: `Missing required 'array' attribute in <foreach> element. The 'array' attribute specifies which array to iterate over.`,
        severity: 'error',
        line: position?.line,
        column: position?.column,
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
    // Note: ID validation is now handled by validateRequiredAttributesRecursive
    // to avoid duplicate error messages
    
    // Validate nested state structures for other structural issues
    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state) => {
        this.validateNestedStateStructureNonIds(state, errors);
      });
    }

    if (scxml.parallel) {
      const parallels = Array.isArray(scxml.parallel)
        ? scxml.parallel
        : [scxml.parallel];
      parallels.forEach((parallel) => {
        this.validateNestedParallelStructureNonIds(parallel, errors);
      });
    }
  }

  // Note: validateElementsHaveIds was removed to prevent duplicate error messages.
  // ID validation is now handled by validateRequiredAttributesRecursive with better error messages.

  private validateNestedStateStructureNonIds(
    state: StateElement,
    errors: ValidationError[]
  ): void {
    // Note: ID validation is handled by validateRequiredAttributesRecursive
    // This method focuses on other structural validation

    // Recursively validate nested states
    if (state.state) {
      const states = Array.isArray(state.state) ? state.state : [state.state];
      states.forEach((nestedState) => {
        this.validateNestedStateStructureNonIds(nestedState, errors);
      });
    }

    if (state.parallel) {
      const parallels = Array.isArray(state.parallel)
        ? state.parallel
        : [state.parallel];
      parallels.forEach((parallel) => {
        this.validateNestedParallelStructureNonIds(parallel, errors);
      });
    }
  }

  private validateNestedParallelStructureNonIds(
    parallel: ParallelElement,
    errors: ValidationError[]
  ): void {
    // Note: ID validation is handled by validateRequiredAttributesRecursive
    // This method focuses on other structural validation

    // Recursively validate nested structures
    if (parallel.state) {
      const states = Array.isArray(parallel.state)
        ? parallel.state
        : [parallel.state];
      states.forEach((state: StateElement) => {
        this.validateNestedStateStructureNonIds(state, errors);
      });
    }

    if (parallel.parallel) {
      const parallels = Array.isArray(parallel.parallel)
        ? parallel.parallel
        : [parallel.parallel];
      parallels.forEach((nestedParallel: ParallelElement) => {
        this.validateNestedParallelStructureNonIds(nestedParallel, errors);
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
        // Compound state must have initial attribute or initial element
        if (!state['@_initial'] && !state.initial) {
          errors.push({
            message: `Compound state '${state['@_id']}' must have either an 'initial' attribute or an <initial> child element`,
            severity: 'error',
          });
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

      // Skip visual namespace attributes - they are valid metadata
      if (attributeName.includes(':') && attributeName.match(/^[\w-]+:[\w-]+$/)) {
        const [prefix, localName] = attributeName.split(':');
        // Allow any namespaced attributes (including visual:*)
        return;
      }

      // Skip xmlns declarations for namespaces
      if (attributeName.startsWith('xmlns:')) {
        return;
      }

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

  private parseElementPositions(xmlContent: string): void {
    // This is a simplified position tracking - in a real implementation,
    // you might want to use a more sophisticated XML parser with position tracking
    const lines = xmlContent.split('\n');
    
    // Common SCXML elements to track
    const elementsToTrack = ['log', 'assign', 'send', 'raise', 'data', 'invoke', 'if', 'transition', 'state'];
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      
      // Track all common SCXML elements
      for (const elementName of elementsToTrack) {
        const regex = new RegExp(`<${elementName}\\b[^>]*>`, 'g');
        const matches = line.match(regex);
        if (matches) {
          const columnIndex = line.indexOf(`<${elementName}`);
          if (columnIndex !== -1) {
            const position = {
              line: lineNumber,
              column: columnIndex + 1
            };
            
            // Store position for this element type on this line
            this.storePositionForPattern(elementName, lineNumber, position);
          }
        }
      }
    }
  }

  private storePositionForPattern(elementName: string, lineNumber: number, position: { line: number; column: number }): void {
    // Store position based on element type and line number
    // In practice, you'd want to associate positions with actual element objects
    this.elementPositions.set(`${elementName}_line_${lineNumber}`, position);
  }

  private getElementPosition(element: any): { line: number; column: number } | undefined {
    // Try to find position by looking for stored positions
    // This is a simplified lookup - real implementation would map actual objects
    for (const [key, position] of this.elementPositions.entries()) {
      if (key.toString().includes('log_line_')) {
        return position;
      }
    }
    return undefined;
  }

  private findElementPosition(elementType: string, path: string): { line: number; column: number } | undefined {
    // Extract line information from path if possible, or find the first occurrence of this element type
    const pathParts = path.split('.');
    
    // Try to find position by element type
    for (const [key, position] of this.elementPositions.entries()) {
      if (key.startsWith(`${elementType}_line_`)) {
        return position;
      }
    }
    
    return undefined;
  }

  private createFriendlyLogErrorMessage(log: LogElement, path: string): string {
    const label = log['@_label'];
    const contextInfo = label ? ` (with label "${label}")` : '';
    const pathParts = path.split('.');
    const lineInfo = this.getElementPosition(log);
    const locationInfo = lineInfo ? `at line ${lineInfo.line}, column ${lineInfo.column}` : `at ${path}`;
    
    // Create a more user-friendly error message
    return `Missing required 'expr' attribute in <log> element${contextInfo} ${locationInfo}. ` +
           `The 'expr' attribute specifies what to log and is required for all <log> elements.`;
  }

  /**
   * Validate cross-hierarchy transitions (Milestone 5 - 1C)
   * Detects transitions from state in one hierarchy level to state in another level
   */
  private validateCrossHierarchyTransitions(
    scxml: SCXMLElement,
    errors: ValidationError[]
  ): void {
    this.validateCrossHierarchyInElement(scxml, errors);
  }

  private validateCrossHierarchyInElement(
    element: SCXMLElement | StateElement | ParallelElement,
    errors: ValidationError[]
  ): void {
    const elementId = (element as any)['@_id'];

    // Check transitions in this element
    if ((element as any).transition) {
      const transitions = Array.isArray((element as any).transition)
        ? (element as any).transition
        : [(element as any).transition];

      transitions.forEach((transition: TransitionElement) => {
        if (transition['@_target'] && elementId) {
          const targets = transition['@_target'].split(/\s+/);

          targets.forEach((targetId) => {
            // Check if source and target have the same parent
            const sourceParent = this.stateParentMap.get(elementId);
            const targetParent = this.stateParentMap.get(targetId);

            // Only validate if both states exist in our hierarchy map
            if (sourceParent !== undefined && targetParent !== undefined) {
              // Cross-hierarchy transition detected
              if (sourceParent !== targetParent) {
                const event = transition['@_event'] || '';
                const cond = transition['@_cond'] || '';
                const transitionInfo = [event, cond].filter(Boolean).join(' [') + (cond ? ']' : '');

                // Find line/column for this transition in XML
                const position = this.findTransitionPosition(elementId, targetId, event, cond);

                errors.push({
                  message: `Cross-hierarchy transition not allowed: State '${elementId}' ${transitionInfo ? `(${transitionInfo}) ` : ''}cannot transition to '${targetId}' - they are at different hierarchy levels. Transitions must only occur between states with the same parent.`,
                  severity: 'error',
                  line: position?.line,
                  column: position?.column,
                });
              }
            }
          });
        }
      });
    }

    // Recursively check child states
    if (element.state) {
      const states = Array.isArray(element.state)
        ? element.state
        : [element.state];
      states.forEach((state) =>
        this.validateCrossHierarchyInElement(state, errors)
      );
    }

    // Recursively check child parallel states
    if (element.parallel) {
      const parallels = Array.isArray(element.parallel)
        ? element.parallel
        : [element.parallel];
      parallels.forEach((parallel) =>
        this.validateCrossHierarchyInElement(parallel, errors)
      );
    }
  }

  /**
   * Find the line/column position of a specific transition in the XML
   */
  private findTransitionPosition(
    sourceStateId: string,
    targetStateId: string,
    event?: string,
    cond?: string
  ): { line: number; column: number } | undefined {
    if (!this.xmlContent) return undefined;

    const lines = this.xmlContent.split('\n');

    // Search for the transition element
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      // Look for transition tags
      if (line.includes('<transition')) {
        // Check if this transition matches our criteria
        const hasTarget = line.includes(`target="${targetStateId}"`);
        const hasEvent = event ? line.includes(`event="${event}"`) : true;
        const hasCond = cond ? line.includes(`cond="${cond}"`) : !line.includes('cond=');

        if (hasTarget && hasEvent && hasCond) {
          const columnIndex = line.indexOf('<transition');
          if (columnIndex !== -1) {
            return {
              line: lineNumber,
              column: columnIndex + 1,
            };
          }
        }
      }
    }

    // Fallback: just find any transition element
    const position = this.findElementPosition('transition', '');
    return position;
  }

  private deduplicateErrors(errors: ValidationError[]): ValidationError[] {
    const seen = new Set<string>();
    const deduplicated: ValidationError[] = [];

    for (const error of errors) {
      // Create a key based on message and position for deduplication
      const key = `${error.message}_${error.line || 'no-line'}_${error.column || 'no-col'}`;

      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(error);
      }
    }

    return deduplicated;
  }
}
