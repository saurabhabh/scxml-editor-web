'use client';

import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import Editor from '@monaco-editor/react';
import type { ValidationError } from '@/types/common';

interface XMLEditorProps {
  value: string;
  onChange: (value: string) => void;
  errors?: ValidationError[];
  readOnly?: boolean;
  height?: string | number;
  theme?: 'light' | 'dark';
  onNavigateToLine?: (line: number, column?: number) => void;
}

export interface XMLEditorRef {
  navigateToLine: (line: number, column?: number) => void;
  focus: () => void;
}

export const XMLEditor = forwardRef<XMLEditorRef, XMLEditorProps>(({
  value,
  onChange,
  errors = [],
  readOnly = false,
  height = '500px',
  theme = 'light'
}, ref) => {
  const editorRef = useRef<import('monaco-editor').editor.IStandaloneCodeEditor | null>(null);

  useImperativeHandle(ref, () => ({
    navigateToLine: (line: number, column?: number) => {
      if (editorRef.current) {
        editorRef.current.revealLine(line);
        editorRef.current.setPosition({ 
          lineNumber: line, 
          column: column || 1 
        });
        editorRef.current.focus();
      }
    },
    focus: () => {
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  }), []);

  useEffect(() => {
    if (editorRef.current && errors.length > 0 && typeof window !== 'undefined') {
      import('monaco-editor').then((monaco) => {
        const model = editorRef.current?.getModel();
        if (model) {
          const markers = errors.map((error) => ({
            severity: error.severity === 'error' 
              ? monaco.MarkerSeverity.Error 
              : monaco.MarkerSeverity.Warning,
            message: error.message,
            startLineNumber: error.line || 1,
            startColumn: error.column || 1,
            endLineNumber: error.line || 1,
            endColumn: error.column ? error.column + 10 : 10,
            code: error.code || undefined
          }));
          
          monaco.editor.setModelMarkers(model, 'scxml-parser', markers);
        }
      });
    }
  }, [errors]);

  const handleEditorMount = (editor: import('monaco-editor').editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    if (typeof window !== 'undefined') {
      import('monaco-editor').then((monaco) => {
        // Configure XML language features
        monaco.languages.setLanguageConfiguration('xml', {
          brackets: [['<', '>']],
          autoClosingPairs: [
            { open: '<', close: '>' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ],
          surroundingPairs: [
            { open: '<', close: '>' },
            { open: '"', close: '"' },
            { open: "'", close: "'" }
          ]
        });

        // Add SCXML-specific completions
        monaco.languages.registerCompletionItemProvider('xml', {
          provideCompletionItems: (model, position) => {
            const word = model.getWordUntilPosition(position);
            const range = {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endColumn: word.endColumn
            };

            const suggestions = [
              {
                label: 'scxml',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: '<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0">\n\t$0\n</scxml>',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'SCXML root element',
                range
              },
              {
                label: 'state',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: '<state id="$1">\n\t$0\n</state>',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'SCXML state element',
                range
              },
              {
                label: 'transition',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: '<transition event="$1" target="$2" />$0',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'SCXML transition element',
                range
              },
              {
                label: 'onentry',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: '<onentry>\n\t$0\n</onentry>',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'SCXML onentry element',
                range
              },
              {
                label: 'onexit',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: '<onexit>\n\t$0\n</onexit>',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'SCXML onexit element',
                range
              },
              {
                label: 'final',
                kind: monaco.languages.CompletionItemKind.Keyword,
                insertText: '<final id="$1" />$0',
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'SCXML final state element',
                range
              }
            ];

            return { suggestions };
          }
        });

        // Set editor options
        editor.updateOptions({
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          formatOnPaste: true,
          formatOnType: true
        });
      });
    }
  };

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Editor
        height={height}
        language="xml"
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={{
          readOnly,
          fontSize: 14,
          lineNumbers: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          insertSpaces: true
        }}
      />
    </div>
  );
});

XMLEditor.displayName = 'XMLEditor';