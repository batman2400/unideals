import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useRole } from "../../lib/useRole";
import {
  getPartnerBrandName,
  PARTNER_BRAND_REQUIRED_MESSAGE,
} from "../../lib/partnerBrand";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const SCAN_RESULT_STYLES = {
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  error: "bg-red-100 text-red-700 border-red-200",
};

const EVENT_BADGE_STYLES = {
  valid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  not_approved: "bg-amber-100 text-amber-700 border-amber-200",
  not_found: "bg-red-100 text-red-700 border-red-200",
  wrong_brand: "bg-red-100 text-red-700 border-red-200",
  invalid: "bg-red-100 text-red-700 border-red-200",
};

function formatDateTime(value) {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function PartnerDashboard() {
  const { user, role, loading: roleLoading, error: roleError } = useRole();

  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [partnerBrand, setPartnerBrand] = useState("");
  const [brandLoading, setBrandLoading] = useState(true);
  const [deletingDealId, setDeletingDealId] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [redemptionStats, setRedemptionStats] = useState({
    totalScans: 0,
    validScans: 0,
    confirmedRedemptions: 0,
  });
  const [recentScanEvents, setRecentScanEvents] = useState([]);
  const [recentConfirmedRedemptions, setRecentConfirmedRedemptions] = useState([]);
  const [trackingWarning, setTrackingWarning] = useState("");
  const [scannerSupported, setScannerSupported] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [lastScannedValue, setLastScannedValue] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanTimerRef = useRef(null);

  const stopScanner = useCallback(() => {
    if (scanTimerRef.current) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScannerActive(false);
  }, []);

  const refreshRedemptionStats = useCallback(async () => {
    if (!user?.id || role !== "partner") {
      setRedemptionStats({
        totalScans: 0,
        validScans: 0,
        confirmedRedemptions: 0,
      });
      setRecentScanEvents([]);
      setRecentConfirmedRedemptions([]);
      setTrackingWarning("");
      return;
    }

    const [totalScansResponse, validScansResponse, confirmedResponse, eventsResponse, recentConfirmedResponse] = await Promise.all([
      supabase
        .from("redemption_events")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", user.id),
      supabase
        .from("redemption_events")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", user.id)
        .eq("scan_result", "valid"),
      supabase
        .from("confirmed_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("partner_id", user.id),
      supabase
        .from("redemption_events")
        .select("id, deal_id, scanned_code, scan_method, scan_result, created_at")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("confirmed_redemptions")
        .select("id, deal_id, redemption_code, created_at")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (
      totalScansResponse.error
      || validScansResponse.error
      || confirmedResponse.error
      || eventsResponse.error
      || recentConfirmedResponse.error
    ) {
      setTrackingWarning(
        "Redemption activity history is unavailable. Run the latest SQL migration to enable tracking tables."
      );
      return;
    }

    setTrackingWarning("");
    setRedemptionStats({
      totalScans: totalScansResponse.count ?? 0,
      validScans: validScansResponse.count ?? 0,
      confirmedRedemptions: confirmedResponse.count ?? 0,
    });
    setRecentScanEvents(eventsResponse.data || []);
    setRecentConfirmedRedemptions(recentConfirmedResponse.data || []);
  }, [role, user?.id]);

  const verifyScannedCode = useCallback(
    async (rawValue, method = "camera") => {
      const normalizedCode = String(rawValue || "").trim();

      if (!normalizedCode) {
        setScanResult({
          status: "error",
          message: "Could not detect a valid redemption code in the scan.",
          deal: null,
        });
        return;
      }

      const { data, error: rpcError } = await supabase.rpc("record_partner_redemption_scan", {
        scanned_payload: normalizedCode,
        scan_method: method,
      });

      if (rpcError) {
        setScanResult({
          status: "error",
          message: rpcError.message || "Could not verify code.",
          deal: null,
        });
        return;
      }

      const resultRow = Array.isArray(data) ? data[0] : data;

      if (!resultRow) {
        setScanResult({
          status: "error",
          message: "No verification result returned.",
          deal: null,
        });
        return;
      }

      const statusMap = {
        valid: "success",
        not_approved: "warning",
        invalid: "error",
        not_found: "error",
        wrong_brand: "error",
      };

      const mappedStatus = statusMap[resultRow.result] || "error";

      setScanResult({
        status: mappedStatus,
        message: resultRow.message || "Scan recorded.",
        eventId: resultRow.event_id,
        redemptionId: resultRow.confirmed_redemption_id,
        deal: resultRow.deal_id
          ? {
              id: resultRow.deal_id,
              title: resultRow.deal_title,
              brand: resultRow.deal_brand,
              status: resultRow.deal_status,
            }
          : null,
      });

      await refreshRedemptionStats();
    },
    [refreshRedemptionStats]
  );

  const startScanner = useCallback(async () => {
    if (!scannerSupported) {
      setScannerError("This browser does not support camera QR scanning.");
      return;
    }

    setScannerError("");
    setScanResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });

      setScannerActive(true);

      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) {
          return;
        }

        try {
          const codes = await detectorRef.current.detect(videoRef.current);

          if (!codes || codes.length === 0) {
            return;
          }

          const rawValue = String(codes[0]?.rawValue || "").trim();
          if (!rawValue) {
            return;
          }

          setLastScannedValue(rawValue);
          stopScanner();
          verifyScannedCode(rawValue, "camera");
        } catch {
          // Ignore intermittent frame decode failures while scanning.
        }
      }, 300);
    } catch (err) {
      stopScanner();
      setScannerError(err?.message || "Could not start camera scanner.");
    }
  }, [scannerSupported, stopScanner, verifyScannedCode]);

  useEffect(() => {
    const supported =
      typeof window !== "undefined"
      && "BarcodeDetector" in window
      && !!navigator?.mediaDevices?.getUserMedia;
    setScannerSupported(supported);

    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    let active = true;

    async function fetchDeals() {
      if (!active) return;

      if (roleLoading) {
        return;
      }

      if (roleError) {
        setError(roleError || "Unable to verify account role.");
        setBrandLoading(false);
        setLoading(false);
        return;
      }

      if (!user?.id) {
        setError("Unable to load partner profile.");
        setBrandLoading(false);
        setLoading(false);
        return;
      }

      let resolvedBrand = "";

      if (role === "partner") {
        setBrandLoading(true);

        const { brandName, error: brandError } = await getPartnerBrandName(user.id);

        if (!active) return;

        if (brandError) {
          setError(brandError || "Unable to resolve your partner brand.");
          setPartnerBrand("");
          setBrandLoading(false);
          setLoading(false);
          return;
        }

        if (!brandName) {
          setError(
            "No brand profile found yet. Open Create New Deal to set your brand and publish your first offer."
          );
          setPartnerBrand("");
          setBrandLoading(false);
          setLoading(false);
          return;
        }

        resolvedBrand = brandName;
        setPartnerBrand(brandName);
      } else {
        setPartnerBrand("");
      }

      setBrandLoading(false);

      setLoading(true);
      setError("");
      setActionMessage("");

      let query = supabase
        .from("deals")
        .select("id, partner_id, brand, title, discount, type, category, status, redemption_code, created_at")
        .eq("partner_id", user.id)
        .order("created_at", { ascending: false });

      if (role === "partner") {
        query = query.eq("brand", resolvedBrand);
      }

      const { data, error: fetchError } = await query;

      if (!active) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load your submitted deals.");
        setLoading(false);
        return;
      }

      setDeals(data || []);
      setLoading(false);
    }

    fetchDeals();

    return () => {
      active = false;
    };
  }, [role, roleLoading, roleError, user?.id]);

  useEffect(() => {
    refreshRedemptionStats();
  }, [refreshRedemptionStats]);

  const handleDelete = async (dealId) => {
    if (role !== "partner") {
      setError("Only partners can delete deals from this page.");
      return;
    }

    if (!user?.id || !partnerBrand) {
      setError(PARTNER_BRAND_REQUIRED_MESSAGE);
      return;
    }

    setDeletingDealId(dealId);
    setActionMessage("");
    setError("");

    const { data, error: deleteError } = await supabase
      .from("deals")
      .delete()
      .eq("id", dealId)
      .eq("partner_id", user.id)
      .eq("brand", partnerBrand)
      .select("id");

    if (deleteError) {
      setError(deleteError.message || "Failed to delete this deal.");
      setDeletingDealId(null);
      return;
    }

    if (!data || data.length === 0) {
      setError("Delete blocked. You can only delete deals for your own brand.");
      setDeletingDealId(null);
      return;
    }

    setDeals((prev) => prev.filter((deal) => deal.id !== dealId));
    setDeletingDealId(null);
    setActionMessage("Deal deleted successfully.");
  };

  const handleManualVerify = async (event) => {
    event.preventDefault();
    setScannerError("");
    setLastScannedValue(manualCode.trim());
    await verifyScannedCode(manualCode, "manual");
  };

  const metrics = useMemo(() => {
    const total = deals.length;
    const approved = deals.filter((deal) => deal.status === "approved").length;
    const pending = deals.filter((deal) => deal.status === "pending").length;

    return {
      total,
      approved,
      pending,
    };
  }, [deals]);

  const baseMetricCards = [
    {
      label: "Total Deals Submitted",
      value: metrics.total,
      icon: "summarize",
    },
    {
      label: "Active (Approved) Deals",
      value: metrics.approved,
      icon: "verified",
    },
    {
      label: "Pending Review",
      value: metrics.pending,
      icon: "hourglass_top",
    },
  ];

  const scannerMetricCards = [
    {
      label: "Total Scans Logged",
      value: redemptionStats.totalScans,
      icon: "qr_code_scanner",
    },
    {
      label: "Confirmed Redemptions",
      value: redemptionStats.confirmedRedemptions,
      icon: "task_alt",
    },
  ];

  const metricCards = role === "partner"
    ? [...baseMetricCards, ...scannerMetricCards]
    : baseMetricCards;

  if (roleLoading || loading || (role === "partner" && brandLoading)) {
    return (
      <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
        <div className="min-h-[45vh] flex items-center justify-center">
          <div className="flex items-center gap-3 text-on-surface-variant">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-headline font-bold">Loading partner dashboard...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[1440px] mx-auto px-6 md:px-8 py-8 md:py-16 animate-fade-in">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary uppercase block mb-2">
            Partner Portal
          </span>
          <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background mb-2">
            Deal Performance Dashboard
          </h1>
          <p className="text-on-surface-variant text-sm md:text-base max-w-2xl">
            Track your submission pipeline and monitor moderation outcomes in real time.
          </p>
          {role === "partner" && partnerBrand ? (
            <p className="text-xs font-bold tracking-[0.15em] uppercase text-primary mt-3">
              Assigned Brand: {partnerBrand}
            </p>
          ) : null}
        </div>

        <Link
          to="/partner/create-deal"
          className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-lg font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Create New Deal
        </Link>
      </div>

      {role !== "partner" && role !== "admin" ? (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5 mb-6">
          <p className="text-error text-sm font-bold">Access denied. Partner role required.</p>
        </div>
      ) : null}

      {actionMessage ? (
        <div className="bg-primary-container/30 border border-primary/20 rounded-xl p-5 mb-6">
          <p className="text-primary text-sm font-bold">{actionMessage}</p>
        </div>
      ) : null}

      {error ? (
        <div className="bg-error/10 border border-error/20 rounded-xl p-5 mb-6">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      ) : (
        <>
          {role === "partner" && partnerBrand ? (
            <div className="bg-surface rounded-2xl border border-outline-variant/20 p-5 md:p-6 shadow-sm mb-8">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background">
                    QR Redemption Scanner
                  </h2>
                  <p className="text-on-surface-variant text-sm mt-1">
                    Scan student redemption QR codes and verify them server-side. Every attempt is logged.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {scannerActive ? (
                    <button
                      type="button"
                      onClick={stopScanner}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-error/25 text-error text-sm font-headline font-bold hover:bg-error/10 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">stop_circle</span>
                      Stop Scanner
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={startScanner}
                      disabled={!scannerSupported}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg emerald-gradient text-on-primary text-sm font-headline font-bold disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                      Start Scanner
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low overflow-hidden">
                  <div className="aspect-[4/3] bg-black/90 relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {!scannerActive ? (
                      <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
                        <p className="text-white/80 text-sm font-bold">
                          {scannerSupported
                            ? "Camera is off. Start scanner to read QR codes."
                            : "QR scanner is not supported in this browser."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div>
                  <form onSubmit={handleManualVerify} className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                      placeholder="Enter code manually"
                      className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-lg px-4 py-3 text-sm font-body focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!manualCode.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-3 rounded-lg border border-outline-variant/30 text-on-background text-sm font-headline font-bold hover:bg-surface-container disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      Verify
                    </button>
                  </form>

                  {scannerError ? (
                    <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 mb-3">
                      <p className="text-error text-sm font-bold">{scannerError}</p>
                    </div>
                  ) : null}

                  {scanResult ? (
                    <div
                      className={`rounded-lg border px-4 py-3 mb-3 ${SCAN_RESULT_STYLES[scanResult.status] || SCAN_RESULT_STYLES.error}`}
                    >
                      <p className="text-sm font-bold">{scanResult.message}</p>
                      {scanResult.deal ? (
                        <p className="text-xs mt-1 font-bold tracking-wide uppercase opacity-90">
                          {scanResult.deal.brand} · {scanResult.deal.title} · {scanResult.deal.status}
                        </p>
                      ) : null}
                      {scanResult.eventId ? (
                        <p className="text-[11px] mt-1 font-bold tracking-wide uppercase opacity-90">
                          Event #{scanResult.eventId}
                          {scanResult.redemptionId ? ` · Redemption #${scanResult.redemptionId}` : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {lastScannedValue ? (
                    <p className="text-xs text-on-surface-variant break-all">
                      Last scanned: {lastScannedValue}
                    </p>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      Tip: Student QR should contain a UniDeals redemption code.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {metricCards.map((card) => (
              <article
                key={card.label}
                className="bg-surface rounded-2xl border border-outline-variant/20 p-5 md:p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <p className="text-xs font-bold tracking-[0.15em] text-on-surface-variant uppercase">
                    {card.label}
                  </p>
                  <span className="material-symbols-outlined text-primary text-xl">{card.icon}</span>
                </div>
                <p className="font-headline font-black text-4xl tracking-tight text-on-background">{card.value}</p>
              </article>
            ))}
          </div>

          {role === "partner" ? (
            <div className="bg-surface rounded-2xl border border-outline-variant/20 p-5 md:p-6 shadow-sm mb-8">
              <div className="mb-5">
                <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background mb-1">
                  Your Redemption Activity
                </h2>
                <p className="text-on-surface-variant text-sm">
                  These logs are scoped to your partner account only.
                </p>
              </div>

              {trackingWarning ? (
                <div className="mb-5 bg-amber-100 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-amber-700 text-sm font-bold">{trackingWarning}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <div className="rounded-xl border border-outline-variant/15 overflow-hidden">
                  <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/15">
                    <h3 className="font-headline font-bold text-on-background">Recent Scan Events</h3>
                  </div>

                  {recentScanEvents.length === 0 ? (
                    <div className="p-4 text-sm text-on-surface-variant">No scan events yet.</div>
                  ) : (
                    <ul className="divide-y divide-outline-variant/10">
                      {recentScanEvents.map((event) => {
                        const matchedDeal = deals.find((deal) => deal.id === event.deal_id);
                        const badgeClass = EVENT_BADGE_STYLES[event.scan_result] || EVENT_BADGE_STYLES.invalid;

                        return (
                          <li key={event.id} className="px-4 py-3 text-sm">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="font-bold text-on-background">{matchedDeal?.title || `Deal #${event.deal_id || "-"}`}</p>
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold tracking-wide uppercase ${badgeClass}`}>
                                {event.scan_result}
                              </span>
                            </div>
                            <p className="text-on-surface-variant text-xs">
                              Code: {event.scanned_code} · Method: {event.scan_method}
                            </p>
                            <p className="text-on-surface-variant text-xs mt-1">
                              {formatDateTime(event.created_at)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-outline-variant/15 overflow-hidden">
                  <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/15">
                    <h3 className="font-headline font-bold text-on-background">Recent Confirmed Redemptions</h3>
                  </div>

                  {recentConfirmedRedemptions.length === 0 ? (
                    <div className="p-4 text-sm text-on-surface-variant">No confirmed redemptions yet.</div>
                  ) : (
                    <ul className="divide-y divide-outline-variant/10">
                      {recentConfirmedRedemptions.map((entry) => {
                        const matchedDeal = deals.find((deal) => deal.id === entry.deal_id);

                        return (
                          <li key={entry.id} className="px-4 py-3 text-sm">
                            <p className="font-bold text-on-background">{matchedDeal?.title || `Deal #${entry.deal_id}`}</p>
                            <p className="text-on-surface-variant text-xs mt-1">
                              Code: {entry.redemption_code}
                            </p>
                            <p className="text-on-surface-variant text-xs mt-1">
                              {formatDateTime(entry.created_at)}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="bg-surface rounded-2xl border border-outline-variant/20 shadow-sm overflow-hidden">
            <div className="px-5 md:px-6 py-4 border-b border-outline-variant/10">
              <h2 className="font-headline font-extrabold text-2xl tracking-tight text-on-background">
                Your Submitted Deals
              </h2>
            </div>

            {deals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="font-headline font-bold text-on-background text-lg mb-1">
                  No submissions yet
                </p>
                <p className="text-on-surface-variant text-sm">
                  Start by creating your first deal for admin review.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-outline-variant/10">
                {deals.map((deal) => {
                  const badgeClass = STATUS_STYLES[deal.status] || "bg-surface-container-low text-on-surface border-outline-variant/20";

                  return (
                    <li
                      key={deal.id}
                      className="px-5 md:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <p className="font-headline font-bold text-on-background text-base md:text-lg">
                          {deal.brand} · {deal.title}
                        </p>
                        <p className="text-on-surface-variant text-sm mt-1">
                          {deal.discount} · {deal.type} · {deal.category}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold tracking-wide uppercase ${badgeClass}`}
                        >
                          {deal.status}
                        </span>
                        {role === "partner" ? (
                          <Link
                            to={`/partner/edit-deal/${deal.id}`}
                            className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase hover:bg-primary/15 transition-colors"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Edit
                          </Link>
                        ) : null}
                        {role === "partner" ? (
                          <button
                            onClick={() => handleDelete(deal.id)}
                            disabled={deletingDealId === deal.id}
                            className="inline-flex items-center gap-1.5 bg-error/10 text-error border border-error/20 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase hover:bg-error/15 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                          >
                            {deletingDealId === deal.id ? (
                              <>
                                <div className="w-3.5 h-3.5 border-2 border-error border-t-transparent rounded-full animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-sm">delete</span>
                                Delete
                              </>
                            )}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default PartnerDashboard;
