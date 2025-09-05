import type * as monaco from 'monaco-editor';

export interface CopilotConfig {
  endpoint: string;
  apiKey: string;
  language: string;
  trigger: 'automatic' | 'manual';
  maxLines: number;
  enableOnPaste: boolean;
  enableOnType: boolean;
  requestDelay: number;
  contextLines: number;
  systemPrompt: string;
}

export const getSCXMLCopilotConfig = (): CopilotConfig | null => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const config = {
    endpoint:
      process.env.NEXT_PUBLIC_OPENAI_ENDPOINT ||
      'https://api.openai.com/v1/chat/completions',
    apiKey,
    language: 'scxml',
    trigger: 'automatic' as const,
    maxLines: 10,
    enableOnPaste: true,
    enableOnType: true,
    requestDelay: 750, // Slightly longer delay to avoid too many requests
    contextLines: 25,
    systemPrompt: `You are an expert SCXML (State Chart XML) assistant specialized in the W3C SCXML specification. You MUST only suggest completions that are 100% valid according to the SCXML W3C standard.

CRITICAL: You MUST NOT suggest any XML elements, attributes, or patterns that are not part of the official SCXML specification.

Valid SCXML Elements ONLY:
- <scxml> - Root element (xmlns="http://www.w3.org/2005/07/scxml", version="1.0", initial required)
- <state> - Basic state (id required, initial optional for compound states)
- <parallel> - Parallel state (id required)  
- <final> - Final state (id optional)
- <initial> - Explicit initial transition (only inside compound states)
- <history> - History pseudostate (id required, type="shallow|deep")
- <transition> - Transition (event, cond, target optional; executable content allowed)
- <onentry> - Entry actions (executable content only)
- <onexit> - Exit actions (executable content only)
- <datamodel> - Data model container (data elements only)
- <data> - Data declaration (id required, expr or src optional)
- <assign> - Variable assignment (location required, expr optional)
- <raise> - Raise internal event (event required)
- <send> - Send event (event optional, target optional, delay optional)
- <cancel> - Cancel delayed event (sendid required)
- <log> - Logging (label optional, expr optional)
- <if>, <elseif>, <else> - Conditionals (cond required for if/elseif)
- <foreach> - Iteration (array required, item required, index optional)
- <script> - Script execution (text content)
- <invoke> - External service invocation (type required, src optional)
- <finalize> - Invoke finalization (inside invoke only)
- <content> - Event payload (inside send only)
- <param> - Parameter (name required, expr optional)

Valid SCXML Attributes ONLY:
- Common: id, name
- <scxml>: xmlns, version, initial, datamodel, binding
- <state>: id, initial  
- <parallel>: id
- <final>: id
- <initial>: no attributes
- <history>: id, type
- <transition>: event, cond, target, type
- <data>: id, expr, src
- <assign>: location, expr
- <raise>: event
- <send>: event, target, delay, id, type
- <cancel>: sendid
- <log>: label, expr
- <if>, <elseif>: cond
- <foreach>: array, item, index
- <invoke>: type, src, id, idlocation, autoforward
- <content>: expr
- <param>: name, expr, location

STRICT RULES:
1. NEVER suggest non-SCXML elements (no custom tags, no HTML, no other XML vocabularies)
2. NEVER suggest invalid attributes for SCXML elements
3. ONLY suggest hierarchically valid structures (e.g., executable content only in onentry/onexit/transition)
4. ALWAYS include required attributes (e.g., id for state, location for assign)
5. Use proper SCXML namespace: xmlns="http://www.w3.org/2005/07/scxml"
6. Follow SCXML content models strictly (e.g., datamodel can only contain data elements)
7. NEVER suggest deprecated or non-standard SCXML features

Always validate your suggestions against the official SCXML specification before providing them.`,
  };
  return config;
};

/**
 * Enhanced SCXML completion provider that works alongside monacopilot
 * This provides immediate, context-aware suggestions for SCXML elements
 */
export const createSCXMLCompletionProvider = (
  monaco: typeof import('monaco-editor')
): monaco.languages.CompletionItemProvider => ({
  triggerCharacters: ['<', ' ', '"', "'"],

  provideCompletionItems: (model, position, context) => {
    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    // Log surrounding context for debugging
    const linesBefore = Math.min(3, position.lineNumber - 1);
    const linesAfter = Math.min(3, model.getLineCount() - position.lineNumber);
    const contextRange = model.getValueInRange({
      startLineNumber: Math.max(1, position.lineNumber - linesBefore),
      startColumn: 1,
      endLineNumber: Math.min(
        model.getLineCount(),
        position.lineNumber + linesAfter
      ),
      endColumn: model.getLineMaxColumn(
        Math.min(model.getLineCount(), position.lineNumber + linesAfter)
      ),
    });
    // Enhanced document detection - support XML files and SCXML context
    const hasXMLDeclaration = textUntilPosition.includes('<?xml');
    const hasSCXMLContent =
      textUntilPosition.includes('<scxml') ||
      textUntilPosition.includes('http://www.w3.org/2005/07/scxml');
    const hasMinimalContext = textUntilPosition.trim().length < 100;
    const isEmptyDocument = textUntilPosition.trim().length === 0;

    // Check file context - assume XML/SCXML based on Monaco language setting
    const isXMLFile =
      model.getLanguageId() === 'xml' || model.getLanguageId() === 'scxml';

    // Always provide suggestions for:
    // 1. Any XML file (based on Monaco language)
    // 2. Documents with XML declaration
    // 3. Documents with SCXML content
    // 4. Empty/minimal context documents
    const shouldProvideSuggestions =
      isXMLFile ||
      hasXMLDeclaration ||
      hasSCXMLContent ||
      hasMinimalContext ||
      isEmptyDocument;


    if (!shouldProvideSuggestions) {
      return { suggestions: [] };
    }

    const line = model.getLineContent(position.lineNumber);
    const linePrefix = line.substring(0, position.column - 1);
    const lineSuffix = line.substring(position.column - 1);


    // Context-aware suggestions based on current location
    const suggestions: monaco.languages.CompletionItem[] = [];
    const range = {
      startLineNumber: position.lineNumber,
      startColumn: position.column,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    };

    // Different suggestion strategies based on context

    // If we're starting a new XML element
    if (linePrefix.endsWith('<')) {

      // Get context by looking at the parent element
      const textBeforeCursor = model
        .getValue()
        .slice(0, model.getOffsetAt(position));
      const parentElement = getParentElement(textBeforeCursor);


      switch (parentElement) {
        case 'scxml':
          const rootSuggestions = getSCXMLRootSuggestions(monaco, range);
          suggestions.push(...rootSuggestions);
          break;
        case 'state':
          const stateSuggestions = getStateSuggestions(monaco, range);
          suggestions.push(...stateSuggestions);
          break;
        case 'transition':
          const transitionSuggestions = getTransitionSuggestions(monaco, range);
          suggestions.push(...transitionSuggestions);
          break;
        case 'onentry':
        case 'onexit':
          const executableSuggestions = getExecutableContentSuggestions(
            monaco,
            range
          );
          suggestions.push(...executableSuggestions);
          break;
        case 'datamodel':
          const dataModelSuggestions = getDataModelSuggestions(monaco, range);
          suggestions.push(...dataModelSuggestions);
          break;
        default:
          // Always provide core SCXML elements regardless of context
          const coreElements = getCoreScxmlElements(monaco, range);
          suggestions.push(...coreElements);

          const generalSuggestions = getGeneralSCXMLSuggestions(monaco, range);
          suggestions.push(...generalSuggestions);

          // For minimal context, provide extra helpful suggestions
          if (hasMinimalContext) {
            suggestions.unshift({
              label: 'xml-declaration',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '?xml version="1.0" encoding="UTF-8"?>',
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'XML declaration for SCXML document',
              range,
            });
          }
      }
    } else if (
      linePrefix.trim().length === 0 &&
      (hasMinimalContext || isEmptyDocument)
    ) {
      // Empty line or document - provide bootstrap suggestions
      const bootstrapSuggestions = getBootstrapSuggestions(monaco, range);
      suggestions.push(...bootstrapSuggestions);

      // Also provide core SCXML elements
      const coreElements = getCoreScxmlElements(monaco, range);
      suggestions.push(...coreElements);
    } else {

      // Always provide core SCXML elements as fallback
      const coreElements = getCoreScxmlElements(monaco, range);
      suggestions.push(...coreElements);

      // Check if we're typing inside an element tag for attributes
      if (linePrefix.includes('<') && !linePrefix.includes('>')) {
        // Could suggest attributes here in the future
      }
    }


    return { suggestions };
  },
});

function getParentElement(text: string): string | null {
  // Simple parser to find the current parent element
  const openTags: string[] = [];
  const tagRegex = /<(\/?)([\w-]+)[^>]*>/g;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    const isClosing = match[1] === '/';
    const tagName = match[2];

    if (isClosing) {
      openTags.pop();
    } else if (!match[0].endsWith('/>')) {
      openTags.push(tagName);
    }
  }

  return openTags[openTags.length - 1] || null;
}

function getSCXMLRootSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'state',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'state id="${1:stateName}">\n\t${0}\n</state>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a new state',
      range,
    },
    {
      label: 'parallel',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'parallel id="${1:parallelName}">\n\t${0}\n</parallel>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a parallel state',
      range,
    },
    {
      label: 'final',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'final id="${1:finalName}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a final state',
      range,
    },
    {
      label: 'datamodel',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'datamodel>\n\t${0}\n</datamodel>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a data model',
      range,
    },
  ];
}

function getStateSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'onentry',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'onentry>\n\t${0}\n</onentry>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Actions executed when entering the state',
      range,
    },
    {
      label: 'onexit',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'onexit>\n\t${0}\n</onexit>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Actions executed when exiting the state',
      range,
    },
    {
      label: 'transition',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        'transition event="${1:eventName}" target="${2:targetState}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a transition to another state',
      range,
    },
    {
      label: 'state',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'state id="${1:childState}">\n\t${0}\n</state>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Create a child state',
      range,
    },
    {
      label: 'initial',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        'initial>\n\t<transition target="${1:initialState}"${0}/>\n</initial>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Explicit initial transition',
      range,
    },
  ];
}

function getTransitionSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'assign',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'assign location="${1:variable}" expr="${2:value}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Assign a value to a variable',
      range,
    },
    {
      label: 'raise',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'raise event="${1:eventName}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Raise an internal event',
      range,
    },
    {
      label: 'send',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'send event="${1:eventName}" target="${2:target}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Send an event',
      range,
    },
    {
      label: 'log',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'log label="${1:message}" expr="${2:expression}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Log a message',
      range,
    },
  ];
}

function getExecutableContentSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'assign',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'assign location="${1:variable}" expr="${2:value}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Assign a value to a variable',
      range,
    },
    {
      label: 'raise',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'raise event="${1:eventName}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Raise an internal event',
      range,
    },
    {
      label: 'send',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'send event="${1:eventName}" target="${2:target}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Send an event',
      range,
    },
    {
      label: 'log',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'log label="${1:message}" expr="${2:expression}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Log a message',
      range,
    },
    {
      label: 'if',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'if cond="${1:condition}">\n\t${0}\n</if>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Conditional execution',
      range,
    },
    {
      label: 'script',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'script>\n\t${0}\n</script>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Execute script content',
      range,
    },
  ];
}

function getDataModelSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'data',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'data id="${1:variableName}" expr="${2:initialValue}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Declare a data variable',
      range,
    },
    {
      label: 'data-src',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: 'data id="${1:variableName}" src="${2:source.json}"${0}/>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Declare a data variable from external source',
      range,
    },
  ];
}

function getGeneralSCXMLSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'scxml-root',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        'scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="${1:initialState}">\n\t${0}\n</scxml>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'SCXML root element',
      range,
    },
  ];
}

function getCoreScxmlElements(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'state',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: 'state id="${1:stateName}"${0}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'SCXML state element',
      range,
    },
    {
      label: 'transition',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText:
        'transition event="${1:eventName}" target="${2:targetState}"${0}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'SCXML transition element',
      range,
    },
    {
      label: 'scxml',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText:
        'scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="${1:initialState}"${0}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'SCXML root element',
      range,
    },
    {
      label: 'parallel',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: 'parallel id="${1:parallelName}"${0}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'SCXML parallel state element',
      range,
    },
    {
      label: 'final',
      kind: monaco.languages.CompletionItemKind.Keyword,
      insertText: 'final id="${1:finalName}"${0}',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'SCXML final state element',
      range,
    },
  ];
}

function getBootstrapSuggestions(
  monaco: typeof import('monaco-editor'),
  range: monaco.IRange
): monaco.languages.CompletionItem[] {
  return [
    {
      label: 'scxml-document-full',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        '<?xml version="1.0" encoding="UTF-8"?>\n<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="${1:initialState}">\n\t<state id="${1:initialState}">\n\t\t<transition event="${2:event}" target="${3:targetState}"/>\n\t</state>\n\t<state id="${3:targetState}">\n\t\t${0}\n\t</state>\n</scxml>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Complete SCXML document template with sample states',
      range,
    },
    {
      label: 'scxml-minimal',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText:
        '<?xml version="1.0" encoding="UTF-8"?>\n<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="${1:initialState}">\n\t${0}\n</scxml>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'Minimal SCXML document template',
      range,
    },
    {
      label: 'xml-declaration',
      kind: monaco.languages.CompletionItemKind.Snippet,
      insertText: '<?xml version="1.0" encoding="UTF-8"?>',
      insertTextRules:
        monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
      documentation: 'XML declaration',
      range,
    },
  ];
}
