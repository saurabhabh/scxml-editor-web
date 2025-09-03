import type { FileInfo } from '@/types/common';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_FILE_TYPES = ['.scxml', '.xml'];

export function validateFile(file: File): string[] {
  const errors: string[] = [];

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File size ${formatFileSize(file.size)} exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}`);
  }

  const fileExtension = getFileExtension(file.name);
  if (!ALLOWED_FILE_TYPES.includes(fileExtension)) {
    errors.push(`File type ${fileExtension} is not supported. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`);
  }

  return errors;
}

export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot).toLowerCase() : '';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };
    
    reader.readAsText(file);
  });
}

export function downloadFile(content: string, filename: string, mimeType = 'application/xml'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function createFileInfo(file: File, content: string): FileInfo {
  return {
    name: file.name,
    size: file.size,
    lastModified: new Date(file.lastModified),
    content
  };
}