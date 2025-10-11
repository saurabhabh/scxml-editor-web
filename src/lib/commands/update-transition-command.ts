import { BaseCommand, type CommandResult } from './base-command';

/**
 * UpdateTransitionCommand
 *
 * Updates a transition's event or condition attribute
 * Finds the transition by matching source, target, and existing event/cond
 */
export class UpdateTransitionCommand extends BaseCommand {
  private oldValue?: string;

  constructor(
    private sourceId: string,
    private targetId: string,
    private originalEvent: string | undefined,
    private originalCond: string | undefined,
    private newValue: string,
    private editingField: 'event' | 'cond'
  ) {
    super();
  }

  execute(scxmlContent: string): CommandResult {
    const { doc, error } = this.parseXML(scxmlContent);
    if (!doc) {
      return this.createFailureResult(
        error || 'Failed to parse XML',
        scxmlContent
      );
    }

    // Find the source state element
    const sourceElement = this.findStateElement(doc, this.sourceId);
    if (!sourceElement) {
      return this.createFailureResult(
        `Source state not found: ${this.sourceId}`,
        scxmlContent
      );
    }

    // Find all transitions in the source state
    const transitions = sourceElement.querySelectorAll('transition');
    let transitionFound = false;

    console.log('[UpdateTransitionCommand] Looking for transition:', {
      source: this.sourceId,
      target: this.targetId,
      originalEvent: this.originalEvent,
      originalCond: this.originalCond,
      newValue: this.newValue,
      editingField: this.editingField,
      totalTransitions: transitions.length
    });

    for (const transition of Array.from(transitions)) {
      const transitionTarget = transition.getAttribute('target');
      const transitionEvent = transition.getAttribute('event');
      const transitionCond = transition.getAttribute('cond');

      console.log('[UpdateTransitionCommand] Checking transition:', {
        target: transitionTarget,
        event: transitionEvent,
        cond: transitionCond
      });

      // Match by target and either event or condition
      const isMatch =
        transitionTarget === this.targetId &&
        ((this.originalEvent && transitionEvent === this.originalEvent) ||
          (this.originalCond && transitionCond === this.originalCond) ||
          (!this.originalEvent &&
            !this.originalCond &&
            !transitionEvent &&
            !transitionCond));

      console.log('[UpdateTransitionCommand] Match result:', isMatch);

      if (isMatch) {
        // Store old value for undo
        if (this.editingField === 'cond') {
          this.oldValue = transitionCond || '';
          transition.setAttribute('cond', this.newValue);
          transition.removeAttribute('event');
        } else {
          this.oldValue = transitionEvent || '';
          transition.setAttribute('event', this.newValue);
          transition.removeAttribute('cond');
        }
        transitionFound = true;
        console.log('[UpdateTransitionCommand] Transition updated successfully');
        break;
      }
    }

    if (!transitionFound) {
      console.error('[UpdateTransitionCommand] No matching transition found');
      return this.createFailureResult(
        `Transition not found from ${this.sourceId} to ${this.targetId}`,
        scxmlContent
      );
    }

    // Serialize and return
    const newContent = this.serializeXML(doc);
    return this.createSuccessResult(newContent, [this.sourceId]);
  }

  undo(scxmlContent: string): CommandResult {
    if (this.oldValue === undefined) {
      return this.createFailureResult(
        'No previous value to restore',
        scxmlContent
      );
    }

    // Create inverse command with old value
    const inverseCommand = new UpdateTransitionCommand(
      this.sourceId,
      this.targetId,
      this.editingField === 'event' ? this.newValue : this.originalEvent,
      this.editingField === 'cond' ? this.newValue : this.originalCond,
      this.oldValue,
      this.editingField
    );

    return inverseCommand.execute(scxmlContent);
  }

  getDescription(): string {
    const field = this.editingField === 'cond' ? 'condition' : 'event';
    return `Update transition ${field} to "${this.newValue}"`;
  }
}
