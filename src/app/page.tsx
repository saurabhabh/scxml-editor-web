'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { XMLEditor, type XMLEditorRef } from '@/components/editor';
import { FileUpload, FileDownload } from '@/components/file-operations';
import { Upload } from 'lucide-react';
import { ErrorBoundary, ValidationPanel } from '@/components/ui';
import { SCXMLParser, SCXMLValidator } from '@/lib';
import { useEditorStore } from '@/stores/editor-store';
import type { FileInfo, ValidationError } from '@/types/common';

const DEFAULT_SCXML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" initial="idle">
  <state id="idle">
    <transition event="start" target="active" />
  </state>
  
  <state id="active">
    <onentry>
      <log label="Entering active state" />
    </onentry>
    
    <transition event="stop" target="idle" />
    
    <onexit>
      <log label="Exiting active state" />
    </onexit>
  </state>
</scxml>`;

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
        const validationErrors = validator.validate(parseResult.data.scxml);
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

  return (
    <ErrorBoundary>
      <div className='min-h-screen bg-gray-50 overflow-hidden'>
        <div className='container mx-auto px-4 py-8'>
          <div className='mb-5'>
            <h1 className='text-3xl font-bold text-gray-900 mb-2'>
              SCXML Parser & Editor
            </h1>
            <p className='text-gray-600'>
              Load, edit, and validate SCXML files with real-time syntax
              checking
            </p>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
            <div className='lg:col-span-2 space-y-6'>
              {!content && (
                <div className='bg-white rounded-lg shadow-sm p-6'>
                  <FileUpload
                    onFileLoad={handleFileLoad}
                    onError={handleFileError}
                  />
                </div>
              )}

              {content && (
                <div className='bg-white rounded-lg shadow-sm p-6'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    accept='.scxml,.xml'
                    onChange={handleFileInputChange}
                    className='hidden'
                  />
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center space-x-4'>
                      <h2 className='text-lg font-semibold text-gray-900'>
                        {fileInfo?.name || 'Untitled Document'}
                      </h2>
                      {isDirty && (
                        <span className='text-xs text-amber-600 font-medium'>
                          • Modified
                        </span>
                      )}
                    </div>

                    <div className='flex items-center space-x-3'>
                      <button
                        onClick={handleNewFileUpload}
                        className='flex items-center space-x-2 text-sm px-3 py-1 rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors'
                      >
                        <Upload className='h-4 w-4' />
                        <span>Load New File</span>
                      </button>

                      <button
                        onClick={() =>
                          setValidationPanelVisible(!isValidationPanelVisible)
                        }
                        className={`text-sm px-3 py-1 rounded-md transition-colors ${
                          hasErrors
                            ? 'bg-red-100 text-red-800 hover:bg-red-200'
                            : hasWarnings
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {errors.length === 0
                          ? 'Valid'
                          : `${
                              errors.filter((e) => e.severity === 'error')
                                .length
                            } errors, ${
                              errors.filter((e) => e.severity === 'warning')
                                .length
                            } warnings`}
                      </button>

                      <FileDownload
                        content={content}
                        filename={getDownloadFilename()}
                      />
                    </div>
                  </div>

                  <XMLEditor
                    ref={editorRef}
                    value={content}
                    onChange={handleContentChange}
                    errors={errors}
                    height='62vh'
                  />
                </div>
              )}
            </div>

            <div className='space-y-6'>
              {content && (
                <ValidationPanel
                  errors={errors}
                  isVisible={isValidationPanelVisible}
                  onClose={() => setValidationPanelVisible(false)}
                  onErrorClick={handleErrorClick}
                />
              )}

              {!content && (
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
                        Edit your SCXML with syntax highlighting and
                        autocomplete
                      </p>
                    </div>
                    <div className='flex items-start space-x-3'>
                      <div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium'>
                        3
                      </div>
                      <p>Real-time validation shows errors and warnings</p>
                    </div>
                    <div className='flex items-start space-x-3'>
                      <div className='flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium'>
                        4
                      </div>
                      <p>Download your validated SCXML file</p>
                    </div>
                  </div>
                </div>
              )}

              <div className='bg-white rounded-lg shadow-sm p-6'>
                <h3 className='text-lg font-semibold text-gray-900 mb-4'>
                  Features
                </h3>
                <ul className='space-y-2 text-sm text-gray-600'>
                  <li className='flex items-center space-x-2'>
                    <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                    <span>XML syntax highlighting</span>
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
                    <span>Error highlighting in editor</span>
                  </li>
                  <li className='flex items-center space-x-2'>
                    <div className='w-1.5 h-1.5 bg-green-500 rounded-full'></div>
                    <span>File import/export</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
