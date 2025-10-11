'use client';

import React, { useState, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { Code, Workflow, FileText } from 'lucide-react';
import { InlineTipsCarousel } from './inline-tips-carousel';

interface TwoTabLayoutProps {
  codeEditor: React.ReactNode;
  visualDiagram: React.ReactNode;
  fileInfo?: {
    name?: string;
    isDirty?: boolean;
  };
  actions?: React.ReactNode;
}

type TabType = 'code' | 'visual';

export const TwoTabLayout: React.FC<TwoTabLayoutProps> = ({
  codeEditor,
  visualDiagram,
  fileInfo,
  actions,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('code');

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  // Tips for the carousel
  const editorTips = [
    {
      tab: 'code' as const,
      content: (
        <>
          Press{' '}
          <kbd className='px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono'>
            Ctrl+Space
          </kbd>{' '}
          for autocomplete suggestions
        </>
      ),
    },
    {
      tab: 'both' as const,
      content: (
        <>
          Use{' '}
          <kbd className='px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono'>
            Ctrl+Z
          </kbd>{' '}
          to undo and{' '}
          <kbd className='px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono'>
            Ctrl+Y
          </kbd>{' '}
          to redo changes
        </>
      ),
    },
    {
      tab: 'visual' as const,
      content: (
        <>
          Select an edge, then{' '}
          <kbd className='px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono'>
            Alt+Click
          </kbd>{' '}
          to add waypoints
        </>
      ),
    },
    {
      tab: 'visual' as const,
      content:
        'Click the plus icon on a simple state to add a child state.',
    },
    {
      tab: 'visual' as const,
      content:
        'Click the down arrow on a compound state to navigate inside it.',
    },
    {
      tab: 'visual' as const,
      content: 'Click the network icon for auto-layout options',
    },
    {
      tab: 'visual' as const,
      content: (
        <>
          Press{' '}
          <kbd className='px-1.5 py-0.5 bg-gray-200 rounded text-gray-700 font-mono'>
            Delete
          </kbd>{' '}
          to remove selected states or transitions
        </>
      ),
    },
  ];

  return (
    <div className='h-full flex flex-col'>
      {/* Header with file info and actions */}
      <div className='flex items-center justify-between p-4 border-b bg-white'>
        <div className='flex items-center space-x-3'>
          <FileText className='h-5 w-5 text-gray-500' />
          <h2 className='text-lg font-semibold text-gray-900'>
            {fileInfo?.name || 'Untitled Document'}
          </h2>
          {fileInfo?.isDirty && (
            <span className='text-xs text-amber-600 font-medium'>
              • Modified
            </span>
          )}
        </div>
        {actions && (
          <div className='flex items-center space-x-3'>{actions}</div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className='flex items-center justify-between border-b bg-gray-50'>
        <div className='flex'>
          <button
            onClick={() => handleTabChange('code')}
            className={`px-6 py-3 text-sm font-medium flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'code'
                ? 'border-blue-500 text-blue-600 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Code className='h-4 w-4' />
            <span>Code Editor</span>
          </button>
          <button
            onClick={() => handleTabChange('visual')}
            className={`px-6 py-3 text-sm font-medium flex items-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'visual'
                ? 'border-blue-500 text-blue-600 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <Workflow className='h-4 w-4' />
            <span>Visual Diagram</span>
          </button>
        </div>

        {/* Tips Carousel */}
        <div className='px-6'>
          <InlineTipsCarousel
            tips={editorTips}
            activeTab={activeTab}
            autoAdvance={true}
            autoAdvanceInterval={6000}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className='flex-1 overflow-hidden'>
        {activeTab === 'code' && (
          <div className='h-full p-4 bg-white'>{codeEditor}</div>
        )}
        {activeTab === 'visual' && (
          <div className='h-full bg-gray-100'>{visualDiagram}</div>
        )}
      </div>
    </div>
  );
};

// Alternative split-panel layout (side-by-side)
export const SplitPanelLayout: React.FC<TwoTabLayoutProps> = ({
  codeEditor,
  visualDiagram,
  fileInfo,
  actions,
}) => {
  // Tips for the carousel
  const editorTips = [
    {
      tab: 'code' as const,
      content: (
        <>
          Press{' '}
          <kbd className='px-1 py-0.5 bg-gray-200 rounded text-gray-700 font-mono text-xs'>
            Ctrl+Space
          </kbd>{' '}
          for autocomplete
        </>
      ),
    },
    {
      tab: 'code' as const,
      content: (
        <>
          Type{' '}
          <kbd className='px-1 py-0.5 bg-gray-200 rounded text-gray-700 font-mono text-xs'>
            &quot;
          </kbd>{' '}
          inside tags for attributes
        </>
      ),
    },
    {
      tab: 'both' as const,
      content: 'Undo/Redo with Ctrl+Z and Ctrl+Y',
    },
  ];

  return (
    <div className='h-full flex flex-col'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b bg-white'>
        <div className='flex items-center space-x-3'>
          <FileText className='h-5 w-5 text-gray-500' />
          <h2 className='text-lg font-semibold text-gray-900'>
            {fileInfo?.name || 'Untitled Document'}
          </h2>
          {fileInfo?.isDirty && (
            <span className='text-xs text-amber-600 font-medium'>
              • Modified
            </span>
          )}
        </div>
        {actions && (
          <div className='flex items-center space-x-3'>{actions}</div>
        )}
      </div>

      {/* Resizable Panels */}
      <div className='flex-1'>
        <PanelGroup direction='horizontal' className='h-full'>
          <Panel defaultSize={50} minSize={30}>
            <div className='h-full flex flex-col'>
              <div className='flex items-center justify-between px-4 py-2 border-b bg-gray-50'>
                <div className='flex items-center'>
                  <Code className='h-4 w-4 mr-2 text-gray-600' />
                  <span className='text-sm font-medium text-gray-700'>
                    Code Editor
                  </span>
                </div>
                <InlineTipsCarousel
                  tips={editorTips}
                  activeTab='code'
                  autoAdvance={true}
                  autoAdvanceInterval={6000}
                />
              </div>
              <div className='flex-1 p-4 bg-white overflow-hidden'>
                {codeEditor}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className='w-2 bg-gray-200 hover:bg-gray-300 transition-colors' />

          <Panel defaultSize={50} minSize={30}>
            <div className='h-full flex flex-col'>
              <div className='flex items-center px-4 py-2 border-b bg-gray-50'>
                <Workflow className='h-4 w-4 mr-2 text-gray-600' />
                <span className='text-sm font-medium text-gray-700'>
                  Visual Diagram
                </span>
              </div>
              <div className='flex-1 bg-gray-100 overflow-hidden'>
                {visualDiagram}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};
