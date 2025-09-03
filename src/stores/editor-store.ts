import { create } from 'zustand';
import type { ValidationError, FileInfo, EditorState } from '@/types/common';

interface EditorStore extends EditorState {
  fileInfo: FileInfo | null;
  isValidationPanelVisible: boolean;
  
  // Actions
  setContent: (content: string) => void;
  setErrors: (errors: ValidationError[]) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  setValidationPanelVisible: (visible: boolean) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
}

const initialState: EditorState = {
  content: '',
  isDirty: false,
  errors: []
};

export const useEditorStore = create<EditorStore>((set, get) => ({
  ...initialState,
  fileInfo: null,
  isValidationPanelVisible: false,

  setContent: (content: string) => {
    const currentContent = get().content;
    set({ 
      content,
      isDirty: content !== (get().fileInfo?.content || '')
    });
  },

  setErrors: (errors: ValidationError[]) => {
    set({ errors });
  },

  setFileInfo: (fileInfo: FileInfo | null) => {
    set({ 
      fileInfo,
      content: fileInfo?.content || '',
      isDirty: false,
      errors: []
    });
  },

  setValidationPanelVisible: (visible: boolean) => {
    set({ isValidationPanelVisible: visible });
  },

  markDirty: () => {
    set({ isDirty: true });
  },

  markClean: () => {
    set({ isDirty: false });
  },

  reset: () => {
    set({
      ...initialState,
      fileInfo: null,
      isValidationPanelVisible: false
    });
  }
}));