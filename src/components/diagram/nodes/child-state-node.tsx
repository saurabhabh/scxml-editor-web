'use client';

import React from 'react';
import { Square, History, CheckCircle } from 'lucide-react';
import type { HierarchicalNode } from '@/types/hierarchical-node';

interface ChildStateNodeProps {
  node: HierarchicalNode;
  position: { x: number; y: number };
  size: { width: number; height: number };
  isActive?: boolean;
  onClick?: (nodeId: string) => void;
  onDoubleClick?: (nodeId: string) => void;
}

export const ChildStateNode: React.FC<ChildStateNodeProps> = ({
  node,
  position,
  size,
  isActive = false,
  onClick,
  onDoubleClick,
}) => {
  const { id, data } = node;
  const { label, stateType, isInitial = false } = data;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(id);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(id);
  };

  // Get icon for state type
  const getStateIcon = () => {
    switch (stateType) {
      case 'final':
        return <CheckCircle className='h-3 w-3 text-green-600' />;
      case 'history':
        return <History className='h-3 w-3 text-blue-600' />;
      case 'parallel':
        return (
          <div className='flex'>
            <Square className='h-3 w-3 text-orange-600' />
            <Square className='h-3 w-3 text-orange-600 -ml-1' />
          </div>
        );
      default:
        return <Square className='h-3 w-3 text-blue-600' />;
    }
  };

  // Generate classes based on state type and status
  const getNodeClasses = () => {
    let baseClasses = 'absolute border-2 rounded-lg transition-all duration-200 cursor-pointer hover:shadow-md';

    if (isActive) {
      baseClasses += ' ring-2 ring-blue-400 ring-opacity-75';
    }

    if (stateType === 'final') {
      baseClasses += ' border-green-500 bg-green-100 hover:bg-green-200';
    } else if (stateType === 'parallel') {
      baseClasses += ' border-orange-400 bg-orange-100 hover:bg-orange-200';
    } else if (stateType === 'compound') {
      baseClasses += ' border-purple-400 bg-purple-100 hover:bg-purple-200';
    } else {
      baseClasses += ' border-blue-400 bg-blue-100 hover:bg-blue-200';
    }

    return baseClasses;
  };

  return (
    <div
      className={getNodeClasses()}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className='h-full flex flex-col justify-center p-2'>
        <div className='flex items-center space-x-2 mb-1'>
          {getStateIcon()}
          <span className='text-sm font-medium text-gray-900 truncate flex-1'>
            {label}
          </span>
          {isInitial && (
            <div className='bg-green-100 text-green-800 text-xs px-1 py-0.5 rounded font-medium'>
              I
            </div>
          )}
        </div>

        {/* Show state type if not simple */}
        {stateType !== 'simple' && (
          <div className='text-xs text-gray-600 capitalize'>
            {stateType}
          </div>
        )}

        {/* Show child count for compound states */}
        {node.childIds && node.childIds.length > 0 && (
          <div className='text-xs text-gray-500 mt-1'>
            {node.childIds.length} children
          </div>
        )}
      </div>
    </div>
  );
};