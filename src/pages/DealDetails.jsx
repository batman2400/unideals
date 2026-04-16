/**
 * DealDetails Page (/perks/:id)
 *
 * Displays a full detailed view of a single deal with dual-redemption UX:
 *
 *   • In-Store  → QR code ticket with live 15-minute countdown timer
 *   • Online    → Copyable promo code + "Go to Store" affiliate button
 *
 * Uses useParams to grab the deal ID from the URL,
 * then looks it up in mockData.js.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import deals from "../data/mockData";

// ── Countdown Timer Hook ────────────────────────────────
function useCountdown(totalSeconds) {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = secondsLeft / totalSeconds; // 1 → 0

  return { minutes, seconds, progress, expired: secondsLeft <= 0 };
}

// ── In-Store Redemption (QR Ticket) ─────────────────────
function InStoreRedemption({ redemptionCode, brand }) {
  const { minutes, seconds, progress, expired } = useCountdown(15 * 60);
  const [activated, setActivated] = useState(false);

  if (!activated) {
    return (
      <div className="text-center">
        <button
          onClick={() => setActivated(true)}
          className="w-full emerald-gradient text-on-primary py-4 rounded-xl font-headline font-bold text-base tracking-tight shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
          Show at Register
        </button>
        <p className="text-on-surface-variant/50 text-xs mt-3">
          Activating starts a 15-minute timer. Show the QR code to the cashier.
        </p>
      </div>
    );
  }

  return (
    <div className="animate-modal-enter">
      {/* QR Ticket Card */}
      <div
        className={`relative border-2 rounded-2xl overflow-hidden transition-colors ${
          expired ? "border-error/40 bg-error/5" : "border-primary/30 bg-surface-container-low"
        }`}
      >
        {/* Live indicator */}
        {!expired && (
          <div className="flex items-center justify-center gap-2 bg-primary/10 py-2.5 px-4">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
            </span>
            <span className="text-primary text-xs font-headline font-bold tracking-wide uppercase">
              Live Ticket
            </span>
          </div>
        )}

        {expired && (
          <div className="flex items-center justify-center gap-2 bg-error/10 py-2.5 px-4">
            <span className="material-symbols-outlined text-error text-sm">timer_off</span>
            <span className="text-error text-xs font-headline font-bold tracking-wide uppercase">
              Ticket Expired
            </span>
          </div>
        )}

        <div className="p-6 md:p-8 flex flex-col items-center">
          {/* QR Code */}
          <div
            className={`p-4 bg-white rounded-xl shadow-sm mb-5 transition-opacity ${
              expired ? "opacity-30 grayscale" : ""
            }`}
          >
            <QRCodeSVG
              value={`unideals://redeem/${redemptionCode}`}
              size={180}
              level="H"
              fgColor={expired ? "#9e9c9c" : "#29695b"}
              bgColor="#ffffff"
              includeMargin={false}
            />
          </div>

          {/* Countdown Timer */}
          <div className="text-center mb-4">
            <p className="text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-2">
              {expired ? "Time Expired" : "Time Remaining"}
            </p>
            <div className="flex items-center justify-center gap-1.5">
              <span
                className={`font-headline font-black text-4xl tabular-nums tracking-tight ${
                  expired
                    ? "text-error"
                    : progress < 0.2
                      ? "text-error animate-pulse"
                      : "text-on-background"
                }`}
              >
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                expired
                  ? "bg-error"
                  : progress < 0.2
                    ? "bg-error"
                    : "emerald-gradient"
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Instructions */}
          <p className="text-on-surface-variant text-sm text-center leading-relaxed">
            {expired ? (
              <>This ticket has expired. Please generate a new one.</>
            ) : (
              <>
                Present this QR code at any{" "}
                <span className="font-bold text-on-surface">{brand}</span> register.
                The cashier will scan it to apply your discount.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Regenerate button when expired */}
      {expired && (
        <button
          onClick={() => window.location.reload()}
          className="w-full mt-4 py-3 rounded-xl border border-outline-variant/20 font-headline font-bold text-sm text-on-surface-variant hover:bg-surface-container transition-all active:scale-[0.98]"
        >
          Generate New Ticket
        </button>
      )}
    </div>
  );
}

// ── Online Redemption (Promo Code) ──────────────────────
function OnlineRedemption({ redemptionCode, brand, storeUrl }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(redemptionCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = redemptionCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [redemptionCode]);

  return (
    <div className="space-y-4 animate-modal-enter">
      {/* Promo Code Display */}
      <div className="bg-surface-container-low border-2 border-dashed border-primary/30 rounded-2xl p-6 md:p-8 text-center">
        <p className="text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase mb-3 flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-sm">confirmation_number</span>
          Your Promo Code
        </p>
        <p className="font-headline font-black text-3xl md:text-4xl text-primary tracking-[0.15em] mb-4 select-all">
          {redemptionCode}
        </p>

        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-headline font-bold text-sm tracking-tight transition-all active:scale-[0.98] ${
            copied
              ? "bg-primary text-on-primary shadow-md"
              : "bg-surface-container border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {copied ? "check_circle" : "content_copy"}
          </span>
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
      </div>

      {/* Go to Store Button */}
      <a
        href={storeUrl || "#"}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          console.log(`[Affiliate] Redirecting to ${brand}: ${storeUrl}`);
          alert(`🔗 Redirecting to ${brand}...\n\n(This would open: ${storeUrl})`);
        }}
        className="w-full emerald-gradient text-on-primary py-4 rounded-xl font-headline font-bold text-base tracking-tight shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
      >
        <span className="material-symbols-outlined text-xl">open_in_new</span>
        Go to {brand} Store
      </a>

      <p className="text-on-surface-variant/50 text-xs text-center leading-relaxed">
        Apply code <span className="font-bold text-on-surface-variant">{redemptionCode}</span> at
        checkout on {brand}'s website to receive your discount.
      </p>
    </div>
  );
}

// ── Main DealDetails Page ───────────────────────────────
function DealDetails() {
  const { id } = useParams();
  const deal = deals.find((d) => d.id === Number(id));

  // 404 — deal not found
  if (!deal) {
    return (
      <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-16 text-center">
        <div className="max-w-md mx-auto">
          <span className="material-symbols-outlined text-6xl text-on-surface-variant/30 mb-4 block">
            search_off
          </span>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-4">
            Deal Not Found
          </h1>
          <p className="text-on-surface-variant mb-8">
            Sorry, we couldn't find a deal with that ID. It may have expired or
            been removed.
          </p>
          <Link
            to="/perks"
            className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-8 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Browse All Perks
          </Link>
        </div>
      </section>
    );
  }

  const { title, brand, discount, type, category, imageUrl, description, redemptionCode, storeUrl } = deal;
  const isInStore = type === "In-Store";

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-on-surface-variant/60 mb-8">
        <Link
          to="/perks"
          className="hover:text-primary transition-colors font-headline font-bold"
        >
          Perks
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-on-surface font-headline font-bold truncate">
          {title}
        </span>
      </nav>

      {/* Main content — stacks on mobile, side-by-side on desktop */}
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
        {/* ── Left: Hero Image ────────────────────────────── */}
        <div className="w-full lg:w-1/2">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl relative bg-surface-container group">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Badges */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm ${
                  isInStore
                    ? "bg-amber-50/90 text-amber-800 border border-amber-200/60"
                    : "bg-primary-container/90 text-on-primary-container border border-primary/20"
                }`}
              >
                <span className="material-symbols-outlined text-xs">
                  {isInStore ? "storefront" : "language"}
                </span>
                {isInStore ? "In-Store" : "Online"}
              </span>
              <span className="bg-surface/80 backdrop-blur-sm text-on-surface text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm border border-outline-variant/10">
                {category}
              </span>
            </div>
          </div>
        </div>

        {/* ── Right: Deal Info + Redemption ────────────────── */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center">
          {/* Brand label */}
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase mb-3 block">
            {brand}
          </span>

          {/* Title + discount */}
          <h1 className="font-headline font-extrabold text-4xl md:text-5xl tracking-tighter text-on-background mb-2">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="emerald-gradient text-on-primary text-lg md:text-xl font-headline font-black px-4 py-1.5 rounded-lg shadow-sm">
              {discount}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full ${
                isInStore
                  ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                  : "bg-primary-container/40 text-primary border border-primary/15"
              }`}
            >
              <span className="material-symbols-outlined text-xs">
                {isInStore ? "storefront" : "language"}
              </span>
              {isInStore ? "In-Store Redemption" : "Online Redemption"}
            </span>
          </div>

          {/* Full description */}
          <p className="text-on-surface-variant text-base md:text-lg leading-relaxed mb-8">
            {description}
          </p>

          {/* Terms & Conditions */}
          <div className="bg-surface-container-low rounded-xl p-5 md:p-6 mb-8 border border-outline-variant/10">
            <h3 className="font-headline font-bold text-sm text-on-background mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">
                gavel
              </span>
              Terms &amp; Conditions
            </h3>
            <ul className="text-on-surface-variant text-sm leading-relaxed space-y-2">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                Valid student ID or .edu email required for verification.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                Offer valid through the current academic semester.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                Cannot be combined with other promotions or discounts.
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                One redemption per verified student account.
              </li>
              {isInStore && (
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                  QR ticket expires 15 minutes after activation to prevent screenshot fraud.
                </li>
              )}
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">check_circle</span>
                {brand} reserves the right to modify or cancel this offer at any time.
              </li>
            </ul>
          </div>

          {/* ── Redemption Section ────────────────────────── */}
          {isInStore ? (
            <InStoreRedemption redemptionCode={redemptionCode} brand={brand} />
          ) : (
            <OnlineRedemption
              redemptionCode={redemptionCode}
              brand={brand}
              storeUrl={storeUrl}
            />
          )}

          {/* Back link */}
          <Link
            to="/perks"
            className="mt-6 inline-flex items-center gap-1 text-sm text-on-surface-variant/60 hover:text-primary font-headline font-bold transition-colors self-start"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to all deals
          </Link>
        </div>
      </div>
    </section>
  );
}

export default DealDetails;
