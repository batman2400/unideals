/**
 * DealDetails Page (/deals/:id)
 *
 * Lifestyle deal detail matching the home feed:
 *   • Mobile  → full-bleed portrait hero + stacked content
 *   • Desktop → sticky portrait image + info / redemption column
 *
 * Redemption UX:
 *   • In-Store  → QR ticket with live 10-minute countdown
 *   • Online    → Reveal RPC (`reveal_online_deal_code`) / copy + store link
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../lib/supabaseClient";
import { useDeal, checkIfSaved, saveDeal, unsaveDeal } from "../lib/useDeals";
import { useRoleContext } from "../lib/RoleContext";
import { formatLaunchDate, isComingSoonDeal, isExpiredDeal } from "../lib/comingSoon";
import { asHttpUrl } from "../lib/httpUrl";
import { SITE_URL, DEFAULT_OG_IMAGE, DEFAULT_OG_IMAGE_WIDTH, DEFAULT_OG_IMAGE_HEIGHT } from "../lib/seo";
import DealsLoader from "../components/DealsLoader";
import DealOfferSchema from "../components/DealOfferSchema";
import BreadcrumbSchema from "../components/BreadcrumbSchema";

function formatDealDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── In-Store Redemption (Server-Generated Unique Ticket) ─
function InStoreRedemption({ dealId, brand }) {
  const [ticket, setTicket] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [ticketError, setTicketError] = useState("");

  const generateTicket = useCallback(async () => {
    setGenerating(true);
    setTicketError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "generate_instore_ticket",
        {
          target_deal_id: dealId,
          ticket_duration_minutes: 10,
        },
      );

      if (rpcError) throw rpcError;

      const row = data?.[0];
      if (!row) throw new Error("No ticket returned from server.");

      setTicket({
        ticketCode: row.ticket_code,
        expiresAt: new Date(row.expires_at),
        alreadyActive: row.already_active,
      });
    } catch (err) {
      setTicketError(
        err?.message || "Could not generate ticket. Please try again.",
      );
    } finally {
      setGenerating(false);
    }
  }, [dealId]);

  const handleRegenerate = useCallback(() => {
    setTicket(null);
    setTicketError("");
  }, []);

  if (!ticket) {
    return (
      <div className="text-center">
        {ticketError && (
          <div className="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3">
            <p className="text-sm font-bold text-error">{ticketError}</p>
          </div>
        )}
        <button
          onClick={generateTicket}
          disabled={generating}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl emerald-gradient py-3.5 text-base font-headline font-bold tracking-tight text-on-primary shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-70"
        >
          {generating ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-on-primary border-t-transparent" />
              Generating Ticket...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-xl">
                qr_code_scanner
              </span>
              Generate In-Store Ticket
            </>
          )}
        </button>
        <p className="mt-3 text-xs text-on-surface-variant/60">
          Unique single-use ticket with a 10-minute timer for the cashier to
          scan.
        </p>
      </div>
    );
  }

  return (
    <InStoreTicketDisplay
      ticketCode={ticket.ticketCode}
      expiresAt={ticket.expiresAt}
      brand={brand}
      alreadyActive={ticket.alreadyActive}
      onRegenerate={handleRegenerate}
    />
  );
}

function InStoreTicketDisplay({
  ticketCode,
  expiresAt,
  brand,
  alreadyActive,
  onRegenerate,
}) {
  const [alreadyRedeemed, setAlreadyRedeemed] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)),
  );
  const totalSeconds = 10 * 60;

  useEffect(() => {
    if (alreadyRedeemed) return;

    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((expiresAt.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining <= 0) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [expiresAt, alreadyRedeemed]);

  useEffect(() => {
    if (alreadyRedeemed) return;

    const channel = supabase
      .channel(`ticket-${ticketCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "student_redemption_tickets",
          filter: `ticket_code=eq.${ticketCode}`,
        },
        (payload) => {
          if (payload.new && payload.new.redeemed_at) {
            setAlreadyRedeemed(true);
            setSecondsLeft(0);
          }
        },
      )
      .subscribe();

    const pollId = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("student_redemption_tickets")
          .select("redeemed_at")
          .eq("ticket_code", ticketCode)
          .single();

        if (data && data.redeemed_at) {
          setAlreadyRedeemed(true);
          setSecondsLeft(0);
        }
      } catch {
        // Silent fail — will retry on next interval
      }
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [ticketCode, alreadyRedeemed]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = secondsLeft / totalSeconds;
  const expired = secondsLeft <= 0 && !alreadyRedeemed;

  return (
    <div className="animate-modal-enter">
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition-colors ${
          alreadyRedeemed
            ? "border-emerald-400 bg-emerald-50/50"
            : expired
              ? "border-error/40 bg-error/5"
              : "border-primary/30 bg-surface-container-low"
        }`}
      >
        {!expired && !alreadyRedeemed && (
          <div className="flex items-center justify-center gap-2 bg-primary/10 px-4 py-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            <span className="font-headline text-xs font-bold uppercase tracking-wide text-primary">
              {alreadyActive ? "Active Ticket" : "Live Ticket"}
            </span>
          </div>
        )}

        {expired && !alreadyRedeemed && (
          <div className="flex items-center justify-center gap-2 bg-error/10 px-4 py-2.5">
            <span className="material-symbols-outlined text-sm text-error">
              timer_off
            </span>
            <span className="font-headline text-xs font-bold uppercase tracking-wide text-error">
              Ticket Expired
            </span>
          </div>
        )}

        {alreadyRedeemed && (
          <div className="flex items-center justify-center gap-2 border-b border-emerald-100/50 bg-emerald-50 px-4 py-2.5">
            <span className="material-symbols-outlined text-sm text-emerald-500">
              verified
            </span>
            <span className="font-headline text-xs font-bold uppercase tracking-wide text-emerald-700">
              Redeemed Successfully
            </span>
          </div>
        )}

        <div className="flex flex-col items-center px-4 py-5 sm:p-6 md:p-8">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant/60">
            Ticket Code
          </p>
          <p
            className={`mb-4 max-w-full break-all text-center font-headline text-lg font-black tracking-[0.12em] sm:text-xl sm:tracking-[0.2em] ${
              alreadyRedeemed
                ? "text-emerald-600"
                : expired
                  ? "text-on-surface-variant/40"
                  : "text-primary"
            }`}
          >
            {ticketCode}
          </p>

          {!alreadyRedeemed && (
            <div
              className={`mb-5 rounded-xl bg-white p-3 shadow-sm transition-opacity sm:p-4 ${
                expired ? "opacity-30 grayscale" : ""
              }`}
            >
              <div className="h-[148px] w-[148px] sm:h-[180px] sm:w-[180px]">
                <QRCodeSVG
                  value={`unideals://ticket/${ticketCode}`}
                  size={180}
                  level="H"
                  fgColor={expired ? "#9e9c9c" : "#29695b"}
                  bgColor="#ffffff"
                  includeMargin={false}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </div>
          )}

          {!alreadyRedeemed ? (
            <>
              <div className="mb-4 text-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                  {expired ? "Time Expired" : "Time Remaining"}
                </p>
                <span
                  className={`font-headline text-3xl font-black tabular-nums tracking-tight sm:text-4xl ${
                    expired
                      ? "text-error"
                      : progress < 0.2
                        ? "animate-pulse text-error"
                        : "text-on-background"
                  }`}
                >
                  {String(minutes).padStart(2, "0")}:
                  {String(seconds).padStart(2, "0")}
                </span>
              </div>

              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    expired || progress < 0.2 ? "bg-error" : "emerald-gradient"
                  }`}
                  style={{ width: `${Math.max(progress * 100, 0)}%` }}
                />
              </div>

              <p className="text-center text-sm leading-relaxed text-on-surface-variant">
                {expired ? (
                  <>This ticket has expired. Generate a new one to redeem.</>
                ) : (
                  <>
                    Present this QR at any{" "}
                    <span className="font-bold text-on-surface">{brand}</span>{" "}
                    register. Single-use only.
                  </>
                )}
              </p>
            </>
          ) : (
            <div className="my-4 animate-scale-in text-center sm:my-6">
              <span
                className="material-symbols-outlined mb-3 text-6xl text-emerald-500 drop-shadow-sm sm:mb-4 sm:text-7xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <h3 className="mb-2 font-headline text-xl font-black text-emerald-800 sm:text-2xl">
                You&apos;re all set!
              </h3>
              <p className="text-sm text-emerald-700/80">
                Enjoy your {brand} discount!
              </p>
            </div>
          )}
        </div>
      </div>

      {expired && !alreadyRedeemed && (
        <button
          onClick={onRegenerate}
          className="mt-4 min-h-[44px] w-full rounded-xl border border-outline-variant/20 py-3 font-headline text-sm font-bold text-on-surface-variant transition-all hover:bg-surface-container active:scale-[0.98]"
        >
          Generate New Ticket
        </button>
      )}
    </div>
  );
}

function parseRevealCode(data) {
  const row = Array.isArray(data) ? data[0] : data;
  if (typeof row === "string") return row.trim();
  const value = row?.redemption_code;
  return typeof value === "string" ? value.trim() : "";
}

function OnlineRedemption({ dealId, brand, storeUrl }) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [revealedCode, setRevealedCode] = useState("");
  const [revealError, setRevealError] = useState("");
  const [revealing, setRevealing] = useState(false);

  const logEvent = useCallback(
    async (eventType) => {
      const { error } = await supabase.rpc("log_online_code_event", {
        target_deal_id: dealId,
        target_event_type: eventType,
      });
      return { error };
    },
    [dealId],
  );

  const handleReveal = useCallback(async () => {
    setRevealing(true);
    setRevealError("");
    const { data, error } = await supabase.rpc("reveal_online_deal_code", {
      target_deal_id: dealId,
    });
    setRevealing(false);

    if (error) {
      setRevealError(
        error.message || "Could not reveal this code. Try again.",
      );
      return;
    }

    const code = parseRevealCode(data);
    if (!code) {
      setRevealError(
        "This offer does not currently have a valid redemption code.",
      );
      return;
    }

    setRevealedCode(code);
    setRevealed(true);
  }, [dealId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(revealedCode);
      setCopied(true);
      logEvent("copy");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = revealedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      logEvent("copy");
      setTimeout(() => setCopied(false), 2000);
    }
  }, [revealedCode, logEvent]);

  const handleClickThrough = useCallback(() => {
    logEvent("click_through");
  }, [logEvent]);

  if (!revealed) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={handleReveal}
          disabled={revealing}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl emerald-gradient py-3.5 text-base font-headline font-bold tracking-tight text-on-primary shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-xl">visibility</span>
          {revealing ? "Checking offer…" : "Reveal Promo Code"}
        </button>
        {revealError ? (
          <p className="mt-3 text-xs font-semibold text-error">{revealError}</p>
        ) : (
          <p className="mt-3 text-xs text-on-surface-variant/60">
            Reveal your exclusive promo code for {brand}.
          </p>
        )}
      </div>
    );
  }

  const hasStoreLink = !!asHttpUrl(storeUrl);

  return (
    <div className="animate-modal-enter space-y-3 sm:space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-surface-container-low p-5 text-center sm:p-6 md:p-8">
        <p className="mb-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
          <span className="material-symbols-outlined text-sm text-primary">
            confirmation_number
          </span>
          Your Promo Code
        </p>
        <p className="mb-5 max-w-full break-all font-mono text-2xl font-bold tracking-[0.12em] text-primary select-all sm:text-3xl md:text-4xl">
          {revealedCode}
        </p>

        <button
          onClick={handleCopy}
          className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl py-3.5 font-headline text-base font-bold tracking-tight shadow-md transition-all hover:shadow-lg active:scale-[0.98] ${
            copied
              ? "bg-primary text-on-primary"
              : "emerald-gradient text-on-primary"
          }`}
        >
          <span className="material-symbols-outlined text-xl">
            {copied ? "check_circle" : "content_copy"}
          </span>
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
      </div>

      {hasStoreLink ? (
        <a
          href={asHttpUrl(storeUrl)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClickThrough}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-outline-variant/25 bg-surface py-3.5 font-headline text-sm font-bold tracking-tight text-on-surface transition-all hover:border-primary/30 hover:text-primary active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-lg">open_in_new</span>
          Go to {brand} Store
        </a>
      ) : (
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-on-surface-variant/50">
          <span className="material-symbols-outlined text-sm">link_off</span>
          Store link unavailable for this offer
        </p>
      )}

      <p className="text-center text-xs leading-relaxed text-on-surface-variant/60">
        Apply code{" "}
        <span className="break-all font-mono font-bold text-on-surface-variant">
          {revealedCode}
        </span>{" "}
        at checkout on {brand}&apos;s website.
      </p>
    </div>
  );
}

function VerificationWall({
  isAuthenticated,
  isPending,
  expired,
  verificationLoading,
  onOpenAuthModal,
}) {
  const helperText = verificationLoading
    ? "Checking your account verification status..."
    : isPending
      ? "Your student ID is with an admin for review. You'll be able to redeem once it's approved."
      : expired
        ? "Student status is valid for 12 months. Re-verify from Profile to unlock this redemption code."
        : isAuthenticated
          ? "Your account is signed in, but not yet verified. Open Profile to complete verification. Status is valid for 12 months."
          : "Sign in or create an account, then verify your student status to unlock this redemption code. Verification lasts 12 months.";

  return (
    <div className="relative animate-modal-enter overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container-low p-5 shadow-[0_18px_55px_-35px_rgba(6,26,20,0.8)] sm:p-6 md:p-8">
      <div
        className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-16 -left-16 h-44 w-44 rounded-full bg-primary/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-4 sm:space-y-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-surface shadow-sm sm:h-14 sm:w-14">
          <span className="material-symbols-outlined text-2xl text-primary sm:text-3xl">
            lock
          </span>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-primary">
            {expired ? "Verification Expired" : "Verification Required"}
          </p>
          <h3 className="mb-2 font-headline text-xl font-extrabold tracking-tight text-on-background sm:text-2xl">
            {expired ? "Re-verify to unlock this code" : "Verify to unlock this code"}
          </h3>
          <p className="text-sm leading-relaxed text-on-surface-variant">
            {helperText}
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-outline-variant/25 bg-surface/60 px-4 py-4 backdrop-blur-sm sm:py-5">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant/60">
            Locked Redemption Code
          </p>
          <p className="select-none font-headline text-xl font-black tracking-[0.22em] text-on-surface-variant/50 sm:text-2xl">
            •••• •••• ••••
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          {isAuthenticated ? (
            <Link
              to="/profile"
              className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl emerald-gradient py-3 text-center font-headline text-sm font-bold tracking-tight text-on-primary shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
            >
              {isPending ? "Verification pending" : expired ? "Re-verify on Profile" : "Go to verification"}
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="min-h-[44px] flex-1 rounded-xl emerald-gradient py-3 font-headline text-sm font-bold tracking-tight text-on-primary shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
              >
                Sign In / Create Account
              </button>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="min-h-[44px] flex-1 rounded-xl border border-outline-variant/25 bg-surface py-3 font-headline text-sm font-bold tracking-tight text-on-surface-variant transition-all hover:border-primary/25 hover:text-on-surface"
              >
                Already Verified? Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DealDetails() {
  const { id } = useParams();
  const {
    role,
    isVerified,
    isAuthenticated,
    user,
    loading: roleLoading,
    isVerificationExpired,
  } = useRoleContext();
  const dealAccessKey = [
    isAuthenticated ? "auth" : "anon",
    role ?? "student",
    isVerified ? "verified" : "unverified",
  ].join(":");
  const { deal, loading, error } = useDeal(id, dealAccessKey);

  const [isSaved, setIsSaved] = useState(false);
  const [loadingSave, setLoadingSave] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState(null);
  const [verificationPending, setVerificationPending] = useState(false);

  const handleOpenAuthModal = useCallback(() => {
    window.dispatchEvent(new Event("open-auth-modal"));
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPending() {
      if (!user?.id || isVerified) {
        if (active) setVerificationPending(false);
        return;
      }
      const { data } = await supabase
        .from("manual_verifications")
        .select("id")
        .eq("user_id", user.id)
        .in("status", ["pending", "awaiting_confirmation"])
        .limit(1);
      if (active) setVerificationPending((data?.length ?? 0) > 0);
    }
    loadPending();
    return () => {
      active = false;
    };
  }, [user?.id, isVerified]);

  useEffect(() => {
    window.scrollTo(0, 0);
    let active = true;
    if (id) {
      checkIfSaved(id)
        .then((saved) => {
          if (active) {
            setIsSaved(saved);
            setLoadingSave(false);
          }
        })
        .catch(() => {
          if (active) {
            setSaveError("Could not verify saved state right now.");
            setLoadingSave(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!deal?.brand) {
      setBrandLogoUrl(null);
      return;
    }

    let active = true;
    supabase
      .from("brands")
      .select("logo_url")
      .ilike("name", deal.brand)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setBrandLogoUrl(data?.logo_url || null);
      })
      .catch(() => {
        if (active) setBrandLogoUrl(null);
      });

    return () => {
      active = false;
    };
  }, [deal?.brand]);

  const handleToggleSave = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSaveError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      handleOpenAuthModal();
      return;
    }

    try {
      setLoadingSave(true);
      if (isSaved) {
        await unsaveDeal(id);
        setIsSaved(false);
      } else {
        await saveDeal(id);
        setIsSaved(true);
      }
    } catch (err) {
      console.error("Error toggling save:", err);
      setSaveError(
        err?.message || "Could not update saved state. Please try again.",
      );
    } finally {
      setLoadingSave(false);
    }
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-[1440px] animate-fade-in px-4 py-10 md:px-8 md:py-16">
        <Helmet>
          <title>Deal | Uni Deals</title>
        </Helmet>
        <DealsLoader loading={true} error={null} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-[1440px] animate-fade-in px-4 py-10 md:px-8 md:py-16">
        <DealsLoader loading={false} error={error} />
      </section>
    );
  }

  if (!deal) {
    return (
      <section className="mx-auto max-w-[1440px] animate-fade-in px-4 py-10 text-center md:px-8 md:py-16">
        <Helmet>
          <title>Deal Not Found | Uni Deals</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="mx-auto max-w-md">
          <span className="material-symbols-outlined mb-4 block text-6xl text-on-surface-variant/30">
            search_off
          </span>
          <h1 className="mb-4 font-headline text-3xl font-extrabold tracking-tighter text-on-background md:text-4xl">
            Deal Not Found
          </h1>
          <p className="mb-8 text-on-surface-variant">
            Sorry, we couldn&apos;t find a deal with that ID. It may have expired
            or been removed.
          </p>
          <Link
            to="/deals"
            className="inline-flex items-center gap-2 rounded-lg emerald-gradient px-8 py-3 font-headline text-sm font-bold tracking-tight text-on-primary shadow-md transition-all hover:shadow-lg active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Browse All Deals
          </Link>
        </div>
      </section>
    );
  }

  const {
    title,
    brand,
    discount,
    type,
    category,
    imageUrl,
    description,
    storeUrl,
    startTime,
    endTime,
    showStartDate,
    showEndDate,
  } = deal;
  const isInStore = type === "In-Store";
  const comingSoon = isComingSoonDeal(deal);
  const expired = !comingSoon && isExpiredDeal(deal);
  const isPrivilegedRole = role === "admin" || role === "partner";
  const canRevealRedemption =
    isPrivilegedRole || (isAuthenticated && isVerified);
  const showVerificationWall = !comingSoon && !expired && !canRevealRedemption;
  const headline = discount || title;
  const launchLabel = comingSoon && startTime ? formatLaunchDate(startTime) : "";
  const visibleStartLabel =
    !comingSoon && showStartDate && startTime ? formatDealDate(startTime) : "";
  const visibleEndLabel =
    !comingSoon && showEndDate && endTime ? formatDealDate(endTime) : "";

  const canonicalUrl = `${SITE_URL}/deals/${deal.id}`;
  const metaTitle = `${brand} Student Discount: ${discount} | Uni Deals`;
  const metaDescription = (
    description ||
    `Get the latest ${brand} student discount in Sri Lanka. Save ${discount} on ${brand} with your verified university email — redeem ${
      isInStore ? "in-store" : "online"
    } instantly on Uni Deals.`
  ).slice(0, 300);
  const ogImage = imageUrl || DEFAULT_OG_IMAGE;

  const redemptionBlock = comingSoon ? (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900 sm:p-6 md:p-8">
      <p className="mb-2 inline-flex items-center gap-2 font-headline font-bold text-sky-800">
        <span className="material-symbols-outlined text-xl">schedule</span>
        Coming Soon
      </p>
      <p>
        {launchLabel
          ? `This offer launches on ${launchLabel}. Redemption unlocks at that time.`
          : "This offer is not live yet. Redemption unlocks on the launch date."}
      </p>
    </div>
  ) : expired ? (
    <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-low p-5 text-sm text-on-surface-variant sm:p-6 md:p-8">
      <p className="mb-2 inline-flex items-center gap-2 font-headline font-bold text-on-background">
        <span className="material-symbols-outlined text-xl">event_busy</span>
        This offer has ended
      </p>
      <p>
        You can still browse the details, but the promo code and in-store ticket
        are no longer available.
      </p>
    </div>
  ) : showVerificationWall ? (
    <VerificationWall
      isAuthenticated={isAuthenticated}
      isPending={verificationPending}
      expired={isVerificationExpired}
      verificationLoading={roleLoading && isAuthenticated}
      onOpenAuthModal={handleOpenAuthModal}
    />
  ) : isInStore ? (
    <InStoreRedemption dealId={deal.id} brand={brand} />
  ) : (
    <OnlineRedemption
      dealId={deal.id}
      brand={brand}
      storeUrl={storeUrl}
    />
  );

  const brandInitial = (brand || "?").trim().charAt(0).toUpperCase();

  return (
    <article className="animate-fade-in pb-8 lg:flex lg:h-[calc(100dvh-5rem)] lg:flex-col lg:overflow-hidden lg:pb-0">
      <Helmet>
        <title>{metaTitle}</title>
        {expired ? <meta name="robots" content="noindex, nofollow" /> : null}
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="product" />
        <meta property="og:site_name" content="Uni Deals" />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        {ogImage === DEFAULT_OG_IMAGE ? (
          <>
            <meta property="og:image:width" content={DEFAULT_OG_IMAGE_WIDTH} />
            <meta property="og:image:height" content={DEFAULT_OG_IMAGE_HEIGHT} />
          </>
        ) : null}
        <meta property="og:image:alt" content={`${brand} — ${title}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      <DealOfferSchema deal={deal} canonicalUrl={canonicalUrl} />
      <BreadcrumbSchema
        items={[
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Deals", url: `${SITE_URL}/deals` },
          { name: brand || title, url: canonicalUrl },
        ]}
      />

      {saveError && (
        <div className="mx-auto max-w-[1440px] px-4 pt-3 md:px-8">
          <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3">
            <p className="text-sm font-bold text-error">{saveError}</p>
          </div>
        </div>
      )}

      <div className="mx-auto flex h-full max-w-[1440px] flex-col px-4 pt-3 md:px-8 md:pt-4 lg:min-h-0 lg:pt-5">
        {/* Breadcrumb + back — shared top row */}
        <nav className="mb-3 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 text-sm text-on-surface-variant/60 lg:mb-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/deals"
              className="font-headline font-bold transition-colors hover:text-primary"
            >
              Deals
            </Link>
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
            <span className="truncate font-headline font-bold text-on-surface">
              {brand}
            </span>
          </div>
          <Link
            to="/deals"
            className="inline-flex items-center gap-1 font-headline text-sm font-bold text-on-surface-variant/70 transition-colors hover:text-primary"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            Back to all deals
          </Link>
        </nav>

        {/* Two-column stage — items-start so image keeps its natural height */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 md:gap-6 lg:grid-cols-12 lg:items-start lg:gap-10 lg:pb-5">
          {/* LEFT — natural-aspect hero (no crop / stretch) */}
          <div className="min-w-0 lg:col-span-5">
            <div className="relative h-fit w-full -mx-4 sm:mx-0">
              <img
                src={imageUrl}
                alt={title}
                className="h-auto w-full rounded-2xl object-contain"
                loading="eager"
                decoding="async"
              />

              <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-on-surface shadow-sm backdrop-blur-md sm:left-4 sm:top-4">
                {isInStore ? "🏪 In-Store" : "🌐 Online"}
              </span>

              <button
                type="button"
                onClick={handleToggleSave}
                disabled={loadingSave}
                aria-label={isSaved ? "Remove from saved" : "Save deal"}
                className={`absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm transition hover:scale-105 sm:right-4 sm:top-4 ${
                  loadingSave ? "opacity-50" : ""
                } ${isSaved ? "text-primary" : "text-on-surface-variant"}`}
              >
                <span
                  className="material-symbols-outlined text-xl"
                  style={
                    isSaved ? { fontVariationSettings: "'FILL' 1" } : undefined
                  }
                >
                  favorite
                </span>
              </button>

              <div className="absolute bottom-3 left-3 z-10 h-10 w-10 overflow-hidden rounded-full border-2 border-white bg-primary-container shadow-md sm:bottom-4 sm:left-4">
                {brandLogoUrl ? (
                  <img
                    src={brandLogoUrl}
                    alt={`${brand} logo`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center font-headline text-sm font-black text-on-primary-container">
                    {brandInitial}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — flex column; T&C pinned with mt-auto when column is taller */}
          <div className="flex min-h-0 min-w-0 flex-col lg:col-span-7 lg:overflow-y-auto">
            <div className="mb-3 min-w-0">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                {brand}
              </p>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-background sm:text-4xl lg:text-[2.35rem] lg:leading-tight">
                {headline}
              </h1>
              {title && title !== discount ? (
                <p className="mt-1.5 text-base text-on-surface-variant lg:line-clamp-1">
                  {title}
                </p>
              ) : null}
            </div>

            {category ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-outline-variant/20 bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">
                  {category}
                </span>
              </div>
            ) : null}

            {(comingSoon || visibleStartLabel || visibleEndLabel) && (
              <div className="mb-3 flex flex-col gap-1.5 text-sm text-on-surface-variant">
                {comingSoon && launchLabel ? (
                  <p className="inline-flex items-center gap-1.5 text-sky-700">
                    <span className="material-symbols-outlined text-base">
                      rocket_launch
                    </span>
                    Launches {launchLabel}
                  </p>
                ) : null}
                {visibleStartLabel ? (
                  <p className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">
                      event
                    </span>
                    Starts {visibleStartLabel}
                  </p>
                ) : null}
                {visibleEndLabel ? (
                  <p className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">
                      event_busy
                    </span>
                    Ends {visibleEndLabel}
                  </p>
                ) : null}
              </div>
            )}

            {description ? (
              <p className="mb-4 text-sm leading-relaxed text-on-surface-variant sm:text-base lg:mb-3 lg:line-clamp-2 lg:text-sm">
                {description}
              </p>
            ) : null}

            <div className="mb-4 lg:mb-0">
              <h2 className="mb-2 font-headline text-base font-extrabold tracking-tight text-on-background">
                {comingSoon
                  ? "Coming Soon"
                  : isInStore
                    ? "Redeem in store"
                    : "Redeem online"}
              </h2>
              {redemptionBlock}
            </div>

            <div className="mt-auto rounded-xl border border-outline-variant/20 bg-surface-container-low p-3 shadow-sm lg:p-3.5">
              <h3 className="mb-2 flex items-center gap-2 font-headline text-xs font-bold text-on-background sm:text-sm">
                <span className="material-symbols-outlined text-base text-primary">
                  gavel
                </span>
                Terms &amp; Conditions
              </h3>
              <ul className="space-y-1 text-xs leading-snug text-on-surface-variant sm:text-sm sm:leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-sm text-primary">
                    check_circle
                  </span>
                  Valid student ID or university email required.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-sm text-primary">
                    check_circle
                  </span>
                  Cannot be combined with other promotions.
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-sm text-primary">
                    check_circle
                  </span>
                  One redemption per verified student account.
                </li>
                {isInStore && (
                  <li className="flex items-start gap-2">
                    <span className="material-symbols-outlined mt-0.5 text-sm text-primary">
                      check_circle
                    </span>
                    QR ticket expires 10 minutes after activation.
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined mt-0.5 text-sm text-primary">
                    check_circle
                  </span>
                  {brand} may modify or cancel this offer at any time.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default DealDetails;
