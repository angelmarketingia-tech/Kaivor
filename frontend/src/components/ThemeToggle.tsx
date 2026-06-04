'use client';

import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={dark ? 'Modo claro' : 'Modo oscuro'}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
        dark ? 'bg-brand-600' : 'bg-ink-300'
      } ${className}`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] shadow transition-transform ${
          dark ? 'translate-x-6' : 'translate-x-1'
        }`}
      >
        {dark ? '🌙' : '☀️'}
      </span>
    </button>
  );
}
