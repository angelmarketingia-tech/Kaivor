'use client';

// Shared "data failed to load" state with a retry button.
// Used by list pages so a network/API failure shows a real error — not a
// misleading empty state.
export default function LoadError({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <div className="text-3xl mb-2">⚠️</div>
      <p className="text-sm font-medium text-slate-700 mb-1">No pudimos cargar los datos</p>
      <p className="text-xs text-slate-400 mb-4">{message || 'Revisa tu conexión e intenta de nuevo.'}</p>
      <button
        onClick={onRetry}
        className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
