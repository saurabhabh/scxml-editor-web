/**
 * Visual Namespace Completion Provider for Monaco Editor
 * 
 * Adds IntelliSense support for visual metadata attributes in SCXML files
 */

import type * as monaco from 'monaco-editor';

/**
 * Visual namespace attributes organized by category
 */
const VISUAL_ATTRIBUTES = {
  layout: [
    { name: 'x', description: 'X coordinate position in pixels' },
    { name: 'y', description: 'Y coordinate position in pixels' },
    { name: 'width', description: 'Width of the element in pixels' },
    { name: 'height', description: 'Height of the element in pixels' },
    { name: 'z-index', description: 'Z-index for layering' },
  ],
  style: [
    { name: 'fill', description: 'Fill color (CSS color value)' },
    { name: 'stroke', description: 'Stroke color (CSS color value)' },
    { name: 'stroke-width', description: 'Stroke width in pixels' },
    { name: 'border-radius', description: 'Border radius in pixels' },
    { name: 'class', description: 'Custom CSS classes to apply' },
    { name: 'style', description: 'Inline CSS styles (semicolon-separated)' },
    { name: 'opacity', description: 'Opacity value (0-1)' },
  ],
  diagram: [
    { name: 'waypoints', description: 'Waypoints for transition paths (x1,y1 x2,y2 ...)' },
    { name: 'label-offset', description: 'Label positioning offset (x,y)' },
    { name: 'curve-type', description: 'Curve type for edges (smooth, step, straight, bezier)' },
    { name: 'marker-type', description: 'Arrow marker type (arrow, diamond, circle, none)' },
    { name: 'connection-source', description: 'Source connection point (x,y)' },
    { name: 'connection-target', description: 'Target connection point (x,y)' },
  ],
  actions: [
    { name: 'action-namespaces', description: 'Custom action namespaces (comma-separated)' },
    { name: 'custom-actions', description: 'Custom action definitions (JSON)' },
  ],
  view: [
    { name: 'collapsed', description: 'Collapsed state IDs (comma-separated)' },
    { name: 'selected', description: 'Selected element IDs (comma-separated)' },
  ],
};

/**
 * Elements that support visual attributes
 */
const VISUAL_SUPPORTED_ELEMENTS = ['scxml', 'state', 'parallel', 'final', 'history', 'transition'];

/**
 * Attribute value suggestions for specific visual attributes
 */
const VISUAL_ATTRIBUTE_VALUES: Record<string, string[]> = {
  'curve-type': ['smooth', 'step', 'straight', 'bezier'],
  'marker-type': ['arrow', 'diamond', 'circle', 'none'],
};

/**
 * Check if document has visual namespace declaration
 */
function hasVisualNamespace(documentText: string): { hasNamespace: boolean; prefix: string } {
  const namespacePattern = /xmlns:(\w+)\s*=\s*["']http:\/\/visual-scxml-editor\/metadata["']/;
  const match = documentText.match(namespacePattern);
  return {
    hasNamespace: !!match,
    prefix: match ? match[1] : 'visual'
  };
}

/**
 * Get all visual attributes with a given prefix
 */
function getVisualAttributeSuggestions(
  prefix: string, 
  monacoInstance: typeof import('monaco-editor')
): monaco.languages.CompletionItem[] {
  const suggestions: monaco.languages.CompletionItem[] = [];
  
  Object.entries(VISUAL_ATTRIBUTES).forEach(([category, attributes]) => {
    attributes.forEach(attr => {
      suggestions.push({
        label: `${prefix}:${attr.name}`,
        kind: monacoInstance.languages.CompletionItemKind.Property,
        detail: `Visual ${category} attribute`,
        documentation: {
          value: `**${prefix}:${attr.name}**\n\n${attr.description}\n\n*Category: ${category}*`
        },
        insertText: `${prefix}:${attr.name}=\"$1\"`,
        insertTextRules: monacoInstance.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range: undefined as any, // Will be set by Monaco
      });
    });
  });
  
  return suggestions;
}

/**
 * Get visual namespace declaration suggestion
 */
function getVisualNamespaceDeclaration(
  monacoInstance: typeof import('monaco-editor')
): monaco.languages.CompletionItem {
  return {
    label: 'xmlns:visual',
    kind: monacoInstance.languages.CompletionItemKind.Property,
    detail: 'Visual metadata namespace declaration',
    documentation: {
      value: '**xmlns:visual**\n\nDeclares the visual metadata namespace for storing non-intrusive visual layout and styling information.\n\n*Namespace URI: http://visual-scxml-editor/metadata*'
    },
    insertText: 'xmlns:visual=\"http://visual-scxml-editor/metadata\"',
    range: undefined as any,
  };
}

/**
 * Get visual attribute value suggestions
 */
function getVisualAttributeValueSuggestions(
  attributeName: string,
  prefix: string,
  monacoInstance: typeof import('monaco-editor')
): monaco.languages.CompletionItem[] {
  const cleanAttrName = attributeName.replace(`${prefix}:`, '');
  const values = VISUAL_ATTRIBUTE_VALUES[cleanAttrName];
  
  if (!values) {
    return [];
  }
  
  return values.map(value => ({
    label: value,
    kind: monacoInstance.languages.CompletionItemKind.Value,
    detail: `${cleanAttrName} value`,
    insertText: value,
    range: undefined as any,
  }));
}

/**
 * Analyze completion context for visual attributes
 */
function analyzeVisualContext(model: monaco.editor.ITextModel, position: monaco.Position) {
  const line = model.getLineContent(position.lineNumber);
  const beforeCursor = line.substring(0, position.column - 1);
  const fullText = model.getValue();
  
  // Check if we're in an attribute context
  const inAttributeValue = /\s*\w*:?\w*\s*=\s*["'][^"']*$/.test(beforeCursor);
  const inAttributeName = /\s+$/.test(beforeCursor) || /\s+\w*:?\w*$/.test(beforeCursor);
  
  // Find current element
  let currentElement = '';
  const tagMatch = beforeCursor.match(/<(\w+)(?:\s|$)/);
  if (tagMatch) {
    currentElement = tagMatch[1];
  }
  
  // Check for existing attributes on current line
  const attributeMatches = beforeCursor.match(/\b\w+(?::\w+)?\s*=/g) || [];
  const existingAttributes = attributeMatches.map(match => match.replace(/\s*=$/, ''));
  
  return {
    inAttributeValue,
    inAttributeName,
    currentElement,
    existingAttributes,
    beforeCursor,
    line,
    fullText,
  };
}

/**
 * Create visual namespace completion provider
 */
export function createVisualNamespaceCompletionProvider(
  monaco: typeof import('monaco-editor')
): monaco.languages.CompletionItemProvider {
  return {
    triggerCharacters: [':', ' ', '=', '"', "'"],
    
    provideCompletionItems: (model, position, context, token) => {
      const analysisContext = analyzeVisualContext(model, position);
      const visualInfo = hasVisualNamespace(analysisContext.fullText);
      const suggestions: monaco.languages.CompletionItem[] = [];
      
      // Only provide visual suggestions if we're in a supported element
      if (!VISUAL_SUPPORTED_ELEMENTS.includes(analysisContext.currentElement)) {
        return { suggestions };
      }
      
      // If in attribute name context
      if (analysisContext.inAttributeName && !analysisContext.inAttributeValue) {
        // Add namespace declaration if not present and we're in root element
        if (!visualInfo.hasNamespace && analysisContext.currentElement === 'scxml') {
          suggestions.push(getVisualNamespaceDeclaration(monaco));
        }
        
        // Add visual attributes if namespace is present
        if (visualInfo.hasNamespace) {
          const visualSuggestions = getVisualAttributeSuggestions(visualInfo.prefix, monaco);
          // Filter out already existing attributes
          const filteredSuggestions = visualSuggestions.filter(
            suggestion => {
              const labelText = typeof suggestion.label === 'string' ? suggestion.label : suggestion.label.label;
              return !analysisContext.existingAttributes.includes(labelText);
            }
          );
          suggestions.push(...filteredSuggestions);
        }
      }
      
      // If in attribute value context for visual attributes
      if (analysisContext.inAttributeValue && visualInfo.hasNamespace) {
        // Extract the attribute name being completed
        const attributeMatch = analysisContext.beforeCursor.match(/\b(\w+:\w+)\s*=\s*["'][^"']*$/);
        if (attributeMatch) {
          const attributeName = attributeMatch[1];
          if (attributeName.startsWith(`${visualInfo.prefix}:`)) {
            const valueSuggestions = getVisualAttributeValueSuggestions(attributeName, visualInfo.prefix, monaco);
            suggestions.push(...valueSuggestions);
          }
        }
      }
      
      return { suggestions };
    },
  };
}

/**
 * Create hover provider for visual attributes
 */
export function createVisualNamespaceHoverProvider(
  monaco: typeof import('monaco-editor')
): monaco.languages.HoverProvider {
  return {
    provideHover: (model, position, token) => {
      const line = model.getLineContent(position.lineNumber);
      const word = model.getWordAtPosition(position);
      const fullText = model.getValue();
      
      if (!word) {
        return null;
      }
      
      const visualInfo = hasVisualNamespace(fullText);
      if (!visualInfo.hasNamespace) {
        return null;
      }
      
      // Check if hovering over a visual attribute
      const attributePattern = new RegExp(`\\b${visualInfo.prefix}:(\\w+[-\\w]*)\\b`);
      const attributeMatch = line.match(attributePattern);
      
      if (!attributeMatch || !line.substring(word.startColumn - 1, word.endColumn).includes(word.word)) {
        return null;
      }
      
      const attributeName = attributeMatch[1];
      
      // Find the attribute definition
      let attributeInfo = null;
      for (const [category, attributes] of Object.entries(VISUAL_ATTRIBUTES)) {
        const found = attributes.find(attr => attr.name === attributeName);
        if (found) {
          attributeInfo = { ...found, category };
          break;
        }
      }
      
      if (!attributeInfo) {
        return null;
      }
      
      const hoverContent = [
        `**${visualInfo.prefix}:${attributeInfo.name}**`,
        '',
        attributeInfo.description,
        '',
        `*Category: ${attributeInfo.category}*`,
        '*Namespace: http://visual-scxml-editor/metadata*'
      ].join('\n');
      
      return {
        contents: [{ value: hoverContent }],
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
      };
    },
  };
}

/**
 * Register visual namespace language features
 */
export function registerVisualNamespaceFeatures(
  monaco: typeof import('monaco-editor'),
  languageId: string = 'xml'
): void {
  // Register completion provider
  monaco.languages.registerCompletionItemProvider(
    languageId,
    createVisualNamespaceCompletionProvider(monaco)
  );
  
  // Register hover provider
  monaco.languages.registerHoverProvider(
    languageId,
    createVisualNamespaceHoverProvider(monaco)
  );
}