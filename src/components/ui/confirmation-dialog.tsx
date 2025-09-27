'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Portal } from './portal';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'text-red-600',
          iconBg: 'bg-red-100',
          confirmBtn: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
        };
      case 'warning':
        return {
          icon: 'text-amber-600',
          iconBg: 'bg-amber-100',
          confirmBtn: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
        };
      case 'info':
        return {
          icon: 'text-blue-600',
          iconBg: 'bg-blue-100',
          confirmBtn: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
        };
      default:
        return {
          icon: 'text-gray-600',
          iconBg: 'bg-gray-100',
          confirmBtn: 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <Portal>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed left-[50%] top-[50%] z-[10000] w-full max-w-md -translate-x-[50%] -translate-y-[50%] animate-in zoom-in-95 duration-200">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-start space-x-4">
              {/* Icon */}
              <div className={`p-3 rounded-full ${styles.iconBg} flex-shrink-0`}>
                <AlertTriangle className={`h-6 w-6 ${styles.icon}`} />
              </div>

              {/* Content */}
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {message}
                </p>
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6">
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${styles.confirmBtn}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
};