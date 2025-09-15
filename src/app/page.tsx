'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { XMLEditor, type XMLEditorRef } from '@/components/editor';
import {
  FileUpload,
  FileDownload,
  VisualMetadataExport,
} from '@/components/file-operations';
import { TwoTabLayout } from '@/components/layout';
import { VisualDiagram } from '@/components/diagram';
import { Upload } from 'lucide-react';
import { ErrorBoundary, ValidationPanel } from '@/components/ui';
import { SCXMLParser, SCXMLValidator } from '@/lib';
import { SCXMLToXStateConverter } from '@/lib/converters';
import { hasVisualMetadata } from '@/lib/utils';
import { useEditorStore } from '@/stores/editor-store';
import type { FileInfo, ValidationError } from '@/types/common';

const DEFAULT_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:viz="http://visual-scxml-editor/metadata" version="1.0" initial="red">
  <state id="red" viz:xywh="100 50 140 80" viz:rgb="FFEEEE">
    <onentry>
      <log label="Traffic Light" expr="Red"></log>
      <send event="next" delay="5s"></send>
    </onentry>
    <transition event="next" target="green" ></transition>
  </state>
  <state id="green" viz:xywh="400 300 140 80" viz:rgb="e8f5e8">
    <onentry>
      <log label="Traffic Light" expr="Green"></log>
      <send event="next" delay="3s"></send>
    </onentry>
    <transition event="next" target="yellow" ></transition>
  </state>
  <state id="yellow" viz:xywh="700 50 140 80" viz:rgb="fffde7">
    <onentry>
      <log label="Traffic Light" expr="Yellow"></log>
      <send event="next" delay="2s"></send>
    </onentry>
    <transition event="next" target="red" ></transition>
  </state>
</scxml>
`;

export default function Home() {
  const {
    content,
    errors,
    fileInfo,
    isDirty,
    isValidationPanelVisible,
    setContent,
    setErrors,
    setFileInfo,
    setValidationPanelVisible,
  } = useEditorStore();

  const parser = useMemo(() => new SCXMLParser(), []);
  const validator = useMemo(() => new SCXMLValidator(), []);
  const converter = useMemo(() => new SCXMLToXStateConverter(), []);
  const editorRef = useRef<XMLEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateContent = useCallback(
    (xmlContent: string) => {
      if (!xmlContent.trim()) {
        setErrors([]);
        return;
      }

      const parseResult = parser.parse(xmlContent);

      let allErrors = [...parseResult.errors];

      if (parseResult.success && parseResult.data) {
        const validationErrors = validator.validate(
          parseResult.data.scxml,
          xmlContent
        );
        allErrors = [...allErrors, ...validationErrors];
      }

      setErrors(allErrors);
    },
    [parser, validator, setErrors]
  );

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      validateContent(content);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [content, validateContent]);

  const handleFileLoad = useCallback(
    (loadedFileInfo: FileInfo) => {
      setFileInfo(loadedFileInfo);
    },
    [setFileInfo]
  );

  const handleFileError = useCallback(
    (errorMessages: string[]) => {
      const errors: ValidationError[] = errorMessages.map((message) => ({
        message,
        severity: 'error' as const,
      }));
      setErrors(errors);
      setValidationPanelVisible(true);
    },
    [setErrors, setValidationPanelVisible]
  );

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
    },
    [setContent]
  );

  const handleSCXMLChangeFromDiagram = useCallback(
    (newContent: string) => {
      // Update content from visual diagram changes
      setContent(newContent);
      console.log('SCXML updated from diagram changes');
    },
    [setContent]
  );

  const handleErrorClick = useCallback((error: ValidationError) => {
    if (error.line && error.column && editorRef.current) {
      editorRef.current.navigateToLine(error.line, error.column);
    }
  }, []);

  const handleCreateNewDocument = useCallback(() => {
    const fileInfo: FileInfo = {
      name: 'new-document.scxml',
      size: DEFAULT_SCXML_TEMPLATE.length,
      lastModified: new Date(),
      content: DEFAULT_SCXML_TEMPLATE,
    };

    setContent(DEFAULT_SCXML_TEMPLATE);
    setFileInfo(fileInfo);
    setErrors([]);
  }, [setContent, setFileInfo, setErrors]);

  const handleNewFileUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        // Basic file validation
        if (file.size > 10 * 1024 * 1024) {
          // 10MB limit
          const errors: ValidationError[] = [
            {
              message: 'File size too large. Maximum size is 10MB.',
              severity: 'error',
            },
          ];
          setErrors(errors);
          setValidationPanelVisible(true);
          return;
        }

        if (!file.name.match(/\.(scxml|xml)$/i)) {
          const errors: ValidationError[] = [
            {
              message: 'Invalid file type. Please select an SCXML or XML file.',
              severity: 'error',
            },
          ];
          setErrors(errors);
          setValidationPanelVisible(true);
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (content) {
            const fileInfo: FileInfo = {
              name: file.name,
              size: file.size,
              lastModified: new Date(file.lastModified),
              content,
            };
            setContent(content);
            setFileInfo(fileInfo);
            setErrors([]);
          }
        };

        reader.onerror = () => {
          const errors: ValidationError[] = [
            {
              message: 'Failed to read file. Please try again.',
              severity: 'error',
            },
          ];
          setErrors(errors);
          setValidationPanelVisible(true);
        };

        reader.readAsText(file);

        // Reset the input so the same file can be selected again
        event.target.value = '';
      }
    },
    [setContent, setFileInfo, setErrors, setValidationPanelVisible]
  );

  const getDownloadFilename = () => {
    if (fileInfo?.name) {
      return fileInfo.name;
    }
    return 'document.scxml';
  };

  const hasErrors = errors.filter((e) => e.severity === 'error').length > 0;
  const hasWarnings = errors.filter((e) => e.severity === 'warning').length > 0;

  const renderCodeEditor = () => (
    <div className='flex gap-4 h-[calc(100vh-200px)]'>
      <div className='flex-1'>
        <XMLEditor
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          errors={errors}
          height='80vh'
        />
      </div>

      <div className='w-80'>
        <ValidationPanel
          errors={errors}
          isVisible={isValidationPanelVisible}
          onClose={() => setValidationPanelVisible(false)}
          onErrorClick={handleErrorClick}
        />
      </div>
    </div>
  );

  const renderVisualDiagram = () => (
    <div className='h-full'>
      <VisualDiagram
        scxmlContent={content}
        onNodeChange={(nodes) => {
          console.log('Nodes changed:', nodes);
        }}
        onEdgeChange={(edges) => {
          console.log('Edges changed:', edges);
        }}
        onSCXMLChange={handleSCXMLChangeFromDiagram}
      />
    </div>
  );

  const renderActions = () => (
    <>
      <input
        ref={fileInputRef}
        type='file'
        accept='.scxml,.xml'
        onChange={handleFileInputChange}
        className='hidden'
      />

      <button
        onClick={handleNewFileUpload}
        className='cursor-pointer flex items-center space-x-2 text-sm px-3 py-2 rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors'
      >
        <Upload className='h-4 w-4' />
        <span>Load New File</span>
      </button>

      <button
        onClick={() => setValidationPanelVisible(!isValidationPanelVisible)}
        className={`cursor-pointer text-sm px-3 py-2 rounded-md transition-colors ${
          hasErrors
            ? 'bg-red-100 text-red-800 hover:bg-red-200'
            : hasWarnings
            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
            : 'bg-green-100 text-green-800 hover:bg-green-200'
        }`}
      >
        {errors.length === 0
          ? 'Valid'
          : `${errors.filter((e) => e.severity === 'error').length} errors, ${
              errors.filter((e) => e.severity === 'warning').length
            } warnings`}
      </button>

      <VisualMetadataExport
        scxmlContent={content}
        filename={getDownloadFilename()}
        hasVisualMetadata={hasVisualMetadata(content)}
        onExportComplete={(exportType) => {
          console.log(`Exported SCXML as: ${exportType}`);
        }}
      />
    </>
  );

  return (
    <ErrorBoundary>
      <div className='min-h-screen bg-gray-50 overflow-hidden'>
        {!content ? (
          <div className='container mx-auto px-4 py-8'>
            <div className='mb-8'>
              <h1 className='text-3xl font-bold text-gray-900 mb-2'>
                Visual SCXML Editor
              </h1>
              <p className='text-gray-600'>
                Edit SCXML files with syntax highlighting, validation, and
                interactive visual diagrams
              </p>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
              <div className='bg-white rounded-lg shadow-sm p-6'>
                <FileUpload
                  onFileLoad={handleFileLoad}
                  onError={handleFileError}
                />
              </div>

              <div className='space-y-6'>
                <div className='bg-white rounded-lg shadow-sm p-6'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                    Getting Started
                  </h3>
                  <div className='space-y-4 text-sm text-gray-600'>
                    <div className='flex items-start space-x-3'>
                      <div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium'>
                        1
                      </div>
                      <p>
                        Upload an SCXML file or{' '}
                        <button
                          type='button'
                          onClick={handleCreateNewDocument}
                          className='inline text-blue-600 cursor-pointer hover:text-blue-800 underline transition-colors focus:outline-none'
                          aria-label='Create new SCXML document'
                        >
                          create a new one
                        </button>
                      </p>
                    </div>
                    <div className='flex items-start space-x-3'>
                      <div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium'>
                        2
                      </div>
                      <p>
                        Edit with syntax highlighting and real-time validation
                      </p>
                    </div>
                    <div className='flex items-start space-x-3'>
                      <div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium'>
                        3
                      </div>
                      <p>Switch to visual diagram for interactive editing</p>
                    </div>
                    <div className='flex items-start space-x-3'>
                      <div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium'>
                        4
                      </div>
                      <p>Download your validated SCXML file</p>
                    </div>
                  </div>
                </div>

                <div className='bg-white rounded-lg shadow-sm p-6'>
                  <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                    Features
                  </h3>
                  <ul className='space-y-2 text-sm text-gray-600'>
                    <li className='flex items-center space-x-2'>
                      <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                      <span>Two-way synchronization (Code ↔ Visual)</span>
                    </li>
                    <li className='flex items-center space-x-2'>
                      <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                      <span>Interactive state diagram editing</span>
                    </li>
                    <li className='flex items-center space-x-2'>
                      <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                      <span>SCXML-specific autocomplete</span>
                    </li>
                    <li className='flex items-center space-x-2'>
                      <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                      <span>Real-time validation</span>
                    </li>
                    <li className='flex items-center space-x-2'>
                      <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                      <span>Visual metadata preservation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className='h-screen'>
            <TwoTabLayout
              codeEditor={renderCodeEditor()}
              visualDiagram={renderVisualDiagram()}
              fileInfo={{
                name: fileInfo?.name,
                isDirty,
              }}
              actions={renderActions()}
            />
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
