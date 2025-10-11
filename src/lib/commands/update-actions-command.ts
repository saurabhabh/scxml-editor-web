import { BaseCommand, type CommandResult } from './base-command';

/**
 * UpdateActionsCommand
 *
 * Updates onentry and onexit actions for a state element
 * Handles creating/removing onentry and onexit elements based on action arrays
 */
export class UpdateActionsCommand extends BaseCommand {
  private oldEntryActions?: string[];
  private oldExitActions?: string[];

  constructor(
    private nodeId: string,
    private entryActions: string[],
    private exitActions: string[]
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

    // Find the state element
    const stateElement = this.findStateElement(doc, this.nodeId);
    if (!stateElement) {
      return this.createFailureResult(
        `State element not found: ${this.nodeId}`,
        scxmlContent
      );
    }

    // Store old actions for undo
    const existingOnentry = stateElement.querySelector('onentry');
    if (existingOnentry) {
      const executables = existingOnentry.querySelectorAll('executable');
      this.oldEntryActions = Array.from(executables).map(
        (exec) => exec.getAttribute('expr') || ''
      );
    } else {
      this.oldEntryActions = [];
    }

    const existingOnexit = stateElement.querySelector('onexit');
    if (existingOnexit) {
      const executables = existingOnexit.querySelectorAll('executable');
      this.oldExitActions = Array.from(executables).map(
        (exec) => exec.getAttribute('expr') || ''
      );
    } else {
      this.oldExitActions = [];
    }

    // Update onentry actions
    if (existingOnentry) {
      stateElement.removeChild(existingOnentry);
    }

    if (this.entryActions.length > 0) {
      const onentry = doc.createElement('onentry');
      this.entryActions.forEach((action) => {
        const executable = doc.createElement('executable');
        executable.setAttribute('label', 'Action');
        executable.setAttribute('expr', action);
        onentry.appendChild(executable);
      });
      stateElement.appendChild(onentry);
    }

    // Update onexit actions
    if (existingOnexit) {
      stateElement.removeChild(existingOnexit);
    }

    if (this.exitActions.length > 0) {
      const onexit = doc.createElement('onexit');
      this.exitActions.forEach((action) => {
        const executable = doc.createElement('executable');
        executable.setAttribute('label', 'Action');
        executable.setAttribute('expr', action);
        onexit.appendChild(executable);
      });
      stateElement.appendChild(onexit);
    }

    // Serialize and return
    const newContent = this.serializeXML(doc);
    return this.createSuccessResult(newContent, [this.nodeId]);
  }

  undo(scxmlContent: string): CommandResult {
    if (this.oldEntryActions === undefined || this.oldExitActions === undefined) {
      return this.createFailureResult(
        'No previous actions to restore',
        scxmlContent
      );
    }

    // Create inverse command with old actions
    const inverseCommand = new UpdateActionsCommand(
      this.nodeId,
      this.oldEntryActions,
      this.oldExitActions
    );

    return inverseCommand.execute(scxmlContent);
  }

  getDescription(): string {
    const entryCount = this.entryActions.length;
    const exitCount = this.exitActions.length;
    const parts = [];
    if (entryCount > 0) parts.push(`${entryCount} entry action${entryCount > 1 ? 's' : ''}`);
    if (exitCount > 0) parts.push(`${exitCount} exit action${exitCount > 1 ? 's' : ''}`);
    return `Update actions: ${parts.join(', ') || 'no actions'}`;
  }
}
