'use client';

import React, { useState } from 'react';
import { Download, FileDown } from 'lucide-react';
import { downloadFile, formatXML } from '@/lib/utils';

interface FileDownloadProps {
  content: string;
  filename?: string;
  disabled?: boolean;
  formatContent?: boolean;
}

export function FileDownload({
  content,
  filename = 'document.scxml',
  disabled = false,
  formatContent = true
}: FileDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (disabled || !content.trim()) return;

    setIsDownloading(true);
    
    try {
      const processedContent = formatContent ? formatXML(content) : content;
      downloadFile(processedContent, filename);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const canDownload = !disabled && content.trim().length > 0;

  return (
    <button
      onClick={handleDownload}
      disabled={!canDownload || isDownloading}
      className={`
        inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
        transition-colors duration-200
        ${canDownload && !isDownloading
          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }
      `}
    >
      {isDownloading ? (
        <FileDown className="h-4 w-4 mr-2 animate-pulse" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      
      {isDownloading ? 'Downloading...' : 'Download SCXML'}
    </button>
  );
}