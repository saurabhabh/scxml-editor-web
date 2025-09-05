'use client';

import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import Editor from '@monaco-editor/react';
import { registerCopilot } from 'monacopilot';
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

export const XMLEditor = forwardRef<XMLEditorRef, XMLEditorProps>(
  (
    {
      value,
      onChange,
      errors = [],
      readOnly = false,
      height = '500px',
      theme = 'light',
    },
    ref
  ) => {
    const editorRef = useRef<
      import('monaco-editor').editor.IStandaloneCodeEditor | null
    >(null);

    useImperativeHandle(
      ref,
      () => ({
        navigateToLine: (line: number, column?: number) => {
          if (editorRef.current) {
            editorRef.current.revealLine(line);
            editorRef.current.setPosition({
              lineNumber: line,
              column: column || 1,
            });
            editorRef.current.focus();
          }
        },
        focus: () => {
          if (editorRef.current) {
            editorRef.current.focus();
          }
        },
      }),
      []
    );

    useEffect(() => {
      if (
        editorRef.current &&
        errors.length > 0 &&
        typeof window !== 'undefined'
      ) {
        import('monaco-editor').then((monaco) => {
          const model = editorRef.current?.getModel();
          if (model) {
            const markers = errors.map((error) => ({
              severity:
                error.severity === 'error'
                  ? monaco.MarkerSeverity.Error
                  : monaco.MarkerSeverity.Warning,
              message: error.message,
              startLineNumber: error.line || 1,
              startColumn: error.column || 1,
              endLineNumber: error.line || 1,
              endColumn: error.column ? error.column + 10 : 10,
              code: error.code || undefined,
            }));

            monaco.editor.setModelMarkers(model, 'scxml-parser', markers);
          }
        });
      }
    }, [errors]);

    const handleEditorMount = (
      editor: import('monaco-editor').editor.IStandaloneCodeEditor
    ) => {
      editorRef.current = editor;

      if (typeof window !== 'undefined') {
        import('monaco-editor').then(async (monaco) => {
          // Import and setup comprehensive SCXML language support
          // const { setupSCXMLLanguageSupport } = await import(
          //   '@/lib/monaco/scxml-language'
          // );
          // setupSCXMLLanguageSupport(monaco);

          // Import enhanced copilot configuration
          const { getSCXMLCopilotConfig, createSCXMLCompletionProvider } =
            await import('@/lib/monaco/copilot-config');

          // Register enhanced SCXML completion provider
          const scxmlProvider = createSCXMLCompletionProvider(monaco);
          const disposable = monaco.languages.registerCompletionItemProvider(
            'scxml',
            scxmlProvider
          );

          // Also register for XML to catch more cases
          const xmlDisposable = monaco.languages.registerCompletionItemProvider(
            'xml',
            {
              ...scxmlProvider,
              provideCompletionItems: async (
                model,
                position,
                context,
                token
              ) => {
                const result = await scxmlProvider.provideCompletionItems(
                  model,
                  position,
                  context,
                  token
                );
                return result;
              },
            }
          );

          const copilotConfig = getSCXMLCopilotConfig();

          if (copilotConfig) {
            try {
              const registration = registerCopilot(
                monaco,
                editor,
                copilotConfig
              );
            } catch (error) {
              console.error('❌ Failed to register monacopilot:', error);
              console.info(
                '💡 To enable AI-powered suggestions, set OPENAI_API_KEY environment variable'
              );
            }
          }

          // Set editor options
          editor.updateOptions({
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: true,
              strings: true,
            },
            parameterHints: { enabled: true },
            hover: { enabled: true },
            folding: true,
            foldingStrategy: 'indentation',
            inlineSuggest: { enabled: true },
            suggest: {
              preview: true,
              showInlineDetails: true,
              showStatusBar: true,
            },
          });

          // Add event listeners to track editor interactions
          editor.onDidChangeCursorPosition((e) => {});

          editor.onDidChangeModelContent((e) => {});

          // Track when suggestions are shown/hidden
          editor.onDidFocusEditorText(() => {});

          editor.onDidBlurEditorText(() => {});

          // Track key presses that might trigger completions
          editor.onKeyDown((e) => {});
        });
      }
    };

    const handleEditorChange = (value: string | undefined) => {
      onChange(value || '');
    };

    return (
      <div className='border rounded-lg overflow-hidden'>
        <Editor
          height={height}
          language='xml'
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
            insertSpaces: true,
          }}
        />
      </div>
    );
  }
);

XMLEditor.displayName = 'XMLEditor';
