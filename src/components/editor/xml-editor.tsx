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
          console.log('✅ SCXML completion provider registered');

          // Also register for XML to catch more cases
          const xmlDisposable = monaco.languages.registerCompletionItemProvider(
            'xml',
            {
              ...scxmlProvider,
              provideCompletionItems: async (model, position, context, token) => {
                console.log('🔍 XML completion provider triggered (backup)');
                const result = await scxmlProvider.provideCompletionItems(model, position, context, token);
                console.log('📋 XML provider result:', result?.suggestions?.length || 0, 'suggestions');
                return result;
              }
            }
          );
          console.log('✅ XML completion provider registered as backup');

          // Register monacopilot for intelligent autocompletion
          console.log('🔧 Checking monacopilot configuration...');
          console.log('📋 Environment variables check:');
          console.log('  - NEXT_PUBLIC_OPENAI_API_KEY:', process.env.NEXT_PUBLIC_OPENAI_API_KEY ? '✅ Set' : '❌ Not set');
          console.log('  - NEXT_PUBLIC_OPENAI_ENDPOINT:', process.env.NEXT_PUBLIC_OPENAI_ENDPOINT || '(using default)');
          
          const copilotConfig = getSCXMLCopilotConfig();
          console.log('🤖 Monacopilot config:', copilotConfig);
          
          if (copilotConfig) {
            try {
              console.log('🚀 Registering monacopilot with Monaco Editor...');
              const registration = registerCopilot(monaco, editor, copilotConfig);
              console.log('✅ Monacopilot registered successfully:', registration);
              console.log('💡 AI-powered suggestions are now available!');
            } catch (error) {
              console.error('❌ Failed to register monacopilot:', error);
              console.info('💡 To enable AI-powered suggestions, set NEXT_PUBLIC_OPENAI_API_KEY environment variable');
            }
          } else {
            console.warn('⚠️  Monacopilot not configured');
            console.info('💡 Set NEXT_PUBLIC_OPENAI_API_KEY in .env.local for AI-powered suggestions');
            console.info('📖 See .env.example for setup instructions');
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
          editor.onDidChangeCursorPosition((e) => {
            console.log('📍 Cursor position changed:', e.position);
          });

          editor.onDidChangeModelContent((e) => {
            console.log('✏️ Content changed:', e.changes.length, 'changes');
          });

          // Track when suggestions are shown/hidden
          editor.onDidFocusEditorText(() => {
            console.log('🎯 Editor focused');
          });

          editor.onDidBlurEditorText(() => {
            console.log('👁️ Editor blurred');
          });

          // Track key presses that might trigger completions
          editor.onKeyDown((e) => {
            const browserEvent = e.browserEvent;
            if (browserEvent) {
              const key = browserEvent.key;
              // Check for keys that trigger completions
              if (key === '<' || 
                  key === ' ' || 
                  key === '"' || 
                  key === "'" ||
                  (e.ctrlKey && key === ' ')) {
                console.log('⌨️ Key pressed that might trigger completions:', {
                  key,
                  keyCode: e.keyCode,
                  ctrlKey: e.ctrlKey,
                  position: editor.getPosition()
                });
              }
            }
          });
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
