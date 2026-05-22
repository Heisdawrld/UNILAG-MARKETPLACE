'use client';

import React from 'react';
import { TASK_CATEGORIES } from '@/lib/types';

const CATEGORY_ICONS: Record<string, string> = {
  Delivery: '📦',
  'Food Pickup': '🍔',
  Printing: '🖨️',
  Tutoring: '📚',
  Shopping: '🛍️',
  'Queue Holding': '⏳',
  Cleaning: '✨',
  'Moving Help': '📦',
  Miscellaneous: '📋',
};

interface CategoryChipsProps {
  selected: string;
  onSelect: (category: string) => void;
}

export default function CategoryChips({ selected, onSelect }: CategoryChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onSelect('')}
        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !selected
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-muted/60 border text-muted-foreground hover:bg-muted'
        }`}
      >
        All
      </button>
      {TASK_CATEGORIES.map((category) => (
        <button
          key={category}
          onClick={() => onSelect(category === selected ? '' : category)}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
            selected === category
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/60 border text-muted-foreground hover:bg-muted'
          }`}
        >
          <span>{CATEGORY_ICONS[category] || '📋'}</span>
          {category}
        </button>
      ))}
    </div>
  );
}
