/**
 * DealsLoader Component
 *
 * A clean branded loading state shown while deals are being fetched.
 * Also handles error display with retry capability.
 *
 * Props:
 *   - loading : boolean
 *   - error   : string|null
 */
function DealsLoader({ loading, error }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-on-surface-variant text-sm font-headline font-bold">
          Loading deals...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <span className="material-symbols-outlined text-5xl text-error/40 mb-4 block">
          cloud_off
        </span>
        <p className="text-on-surface-variant font-headline font-bold text-lg mb-2">
          Failed to load deals
        </p>
        <p className="text-on-surface-variant/60 text-sm mb-6 max-w-md mx-auto">
          {error}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-headline font-bold text-sm border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Try Again
        </button>
      </div>
    );
  }

  return null;
}

export default DealsLoader;
