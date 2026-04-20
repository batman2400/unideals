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
    const skeletonItems = Array.from({ length: 6 }, (_, index) => `deal-skeleton-${index}`);

    return (
      <div className="py-8 md:py-10 space-y-6 animate-fade-in">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-lg bg-surface-container-low animate-pulse" />
          <div className="h-4 w-64 rounded-lg bg-surface-container-low animate-pulse" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {skeletonItems.map((key) => (
            <article
              key={key}
              className="rounded-xl overflow-hidden border border-outline-variant/10 bg-surface"
            >
              <div className="aspect-[16/10] skeleton-shimmer" />
              <div className="p-6 space-y-3">
                <div className="h-6 w-2/3 rounded-md skeleton-shimmer" />
                <div className="h-4 w-full rounded-md skeleton-shimmer" />
                <div className="h-4 w-5/6 rounded-md skeleton-shimmer" />
                <div className="h-10 w-full rounded-lg skeleton-shimmer mt-2" />
              </div>
            </article>
          ))}
        </div>
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
