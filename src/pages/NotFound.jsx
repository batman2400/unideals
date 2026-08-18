import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export default function NotFound() {
  return (
    <section className="max-w-[760px] mx-auto px-6 py-16 text-center animate-fade-in">
      <Helmet>
        <title>Page Not Found | Uni Deals</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <span className="material-symbols-outlined text-6xl text-primary mb-4">
        search_off
      </span>
      <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tight text-on-background mb-2">
        Page not found
      </h1>
      <p className="text-on-surface-variant mb-8 max-w-md mx-auto">
        That URL does not match a page on Uni Deals. Check the link or head back
        to browse live student offers.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/deals"
          className="inline-flex items-center gap-2 rounded-xl emerald-gradient px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
        >
          Browse deals
        </Link>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 px-6 py-3 font-headline text-sm font-bold text-on-surface-variant hover:bg-surface-container-low transition-all"
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}
