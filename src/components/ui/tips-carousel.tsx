'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';

interface Tip {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface TipsCarouselProps {
  tips: Tip[];
  autoAdvance?: boolean;
  autoAdvanceInterval?: number;
  className?: string;
}

export const TipsCarousel: React.FC<TipsCarouselProps> = ({
  tips,
  autoAdvance = true,
  autoAdvanceInterval = 5000,
  className = '',
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance functionality
  useEffect(() => {
    if (!autoAdvance || tips.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, autoAdvanceInterval);

    return () => clearInterval(timer);
  }, [autoAdvance, autoAdvanceInterval, tips.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  if (tips.length === 0) return null;

  const currentTip = tips[currentIndex];

  return (
    <div className={`relative ${className}`}>
      <div className='bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-100'>
        {/* Header */}
        <div className='flex items-center gap-2 mb-3'>
          <Lightbulb className='h-5 w-5 text-blue-600' />
          <h3 className='text-lg font-semibold text-gray-900'>
            Quick Tip {currentIndex + 1} of {tips.length}
          </h3>
        </div>

        {/* Tip Content */}
        <div className='min-h-[100px]'>
          <h4 className='text-base font-medium text-gray-900 mb-2'>
            {currentTip?.title}
          </h4>
          <p className='text-sm text-gray-600 leading-relaxed'>
            {currentTip?.description}
          </p>
        </div>

        {/* Navigation Controls */}
        <div className='flex items-center justify-between mt-6'>
          {/* Previous Button */}
          <button
            onClick={goToPrevious}
            className='p-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Previous tip'
            disabled={tips.length <= 1}
          >
            <ChevronLeft className='h-5 w-5' />
          </button>

          {/* Dot Indicators */}
          <div className='flex gap-2'>
            {tips.map((_, index) => (
              <button
                key={index}
                onClick={() => goToIndex(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex
                    ? 'w-8 bg-blue-600'
                    : 'w-2 bg-blue-300 hover:bg-blue-400'
                }`}
                aria-label={`Go to tip ${index + 1}`}
              />
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={goToNext}
            className='p-2 rounded-lg hover:bg-blue-100 transition-colors text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
            aria-label='Next tip'
            disabled={tips.length <= 1}
          >
            <ChevronRight className='h-5 w-5' />
          </button>
        </div>
      </div>
    </div>
  );
};
