import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";

function PartnerScanner() {
  const { user, role, loading: roleLoading, impersonatedPartnerId } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;
  const [partnerBrand, setPartnerBrand] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (roleLoading || !user?.id) return;
    if (role !== "partner" && role !== "admin") return;
    
    setError("");
    
    if (role === "admin" && !impersonatedPartnerId) {
      setError("Admin View: Please impersonate a brand from the sidebar to scan tickets.");
      setLoading(false);
      return;
    }

    let active = true;

    async function init() {
      const { brandName, error: brandError } = await getPartnerBrand(targetUserId);
      if (!active) return;
      setPartnerBrand(brandName || "");
      if (brandError) setError(brandError);
      setLoading(false);
    }

    init();
    return () => { active = false; };
  }, [role, roleLoading, targetUserId, impersonatedPartnerId]);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Attempt BarcodeDetector API first, fallback to jsQR
      let detector = null;
      if ("BarcodeDetector" in window) {
        try {
          detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }

      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current || !isMountedRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");

        if (video.readyState < 2) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let codeValue = null;

        if (detector) {
          try {
            const codes = await detector.detect(canvas);
            if (codes.length > 0) {
              codeValue = codes[0].rawValue;
            }
          } catch {
            // fallback
          }
        }

        if (!codeValue && window.jsQR) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = window.jsQR(imgData.data, canvas.width, canvas.height);
          if (qr) codeValue = qr.data;
        }

        if (codeValue) {
          stopCamera();
          processCode(codeValue, "camera");
        }
      }, 350);
    } catch (err) {
      if (!isMountedRef.current) return;
      setCameraError(err?.message || "Camera not available. Try manual entry.");
    }
  }, [stopCamera]);

  const processCode = useCallback(async (code, method = "manual") => {
    setVerifying(true);
    setError("");
    setResult(null);

    try {
      // Try the new ticket-based validation first
      const { data, error: rpcError } = await supabase.rpc("validate_instore_ticket", {
        scanned_payload: code,
        scan_method: method,
      });

      if (!isMountedRef.current) return;

      if (rpcError) {
        throw rpcError;
      }

      const row = data?.[0];
      if (row) {
        setResult(row);
      } else {
        setResult({
          result: "error",
          message: "Unexpected response from server.",
        });
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      // Fallback to legacy scanner if new RPC doesn't exist
      try {
        const { data, error: legacyError } = await supabase.rpc("record_partner_redemption_scan", {
          scanned_payload: code,
          scan_method: method,
        });

        if (!isMountedRef.current) return;

        if (legacyError) throw legacyError;

        const row = data?.[0];
        if (row) {
          setResult(row);
        }
      } catch (fallbackErr) {
        if (!isMountedRef.current) return;
        setError(fallbackErr?.message || "Verification failed. Please try again.");
      }
    } finally {
      if (isMountedRef.current) setVerifying(false);
    }
  }, []);

  const handleManualSubmit = useCallback((e) => {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code) return;
    processCode(code, "manual");
    setManualCode("");
  }, [manualCode, processCode]);

  const handleScanAnother = useCallback(() => {
    setResult(null);
    setError("");
    setManualCode("");
  }, []);

  if (roleLoading || loading) {
    return (
      <PortalLayout portalType="partner" brandName="">
        <div className="space-y-5">
          <div className="h-8 w-40 rounded-xl skeleton-shimmer" />
          <div className="h-96 rounded-2xl skeleton-shimmer" />
        </div>
      </PortalLayout>
    );
  }

  const resultColors = {
    valid: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: "check_circle", iconColor: "text-emerald-500" },
    already_redeemed: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "info", iconColor: "text-amber-500" },
    expired: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "timer_off", iconColor: "text-amber-500" },
    not_found: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", icon: "search_off", iconColor: "text-red-500" },
    wrong_brand: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", icon: "block", iconColor: "text-red-500" },
    not_approved: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: "pending", iconColor: "text-amber-500" },
    invalid: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", icon: "error", iconColor: "text-red-500" },
    error: { bg: "bg-red-50", border: "border-red-200", text: "text-red-600", icon: "error", iconColor: "text-red-500" },
  };

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Ticket Scanner
        </h1>
        <p className="text-on-surface-variant text-sm">
          Scan student QR tickets or enter codes manually to validate in-store redemptions.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Result Display */}
        {result && (() => {
          const style = resultColors[result.result] || resultColors.error;
          return (
            <div className={`rounded-2xl border-2 ${style.border} ${style.bg} p-6 text-center animate-fade-in`}>
              <span
                className={`material-symbols-outlined text-5xl ${style.iconColor} mb-3 block`}
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                {style.icon}
              </span>
              <p className={`font-headline font-extrabold text-xl ${style.text} mb-2`}>
                {result.result === "valid" ? "Valid Ticket!" : result.result?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </p>
              <p className={`text-sm ${style.text} mb-4`}>{result.message}</p>

              {result.deal_title && (
                <div className="bg-white/60 rounded-xl p-4 mb-4 inline-block">
                  <p className="text-sm font-bold text-on-background">{result.deal_title}</p>
                  {result.deal_discount && (
                    <p className="text-primary text-sm font-headline font-bold mt-1">{result.deal_discount}</p>
                  )}
                </div>
              )}

              <button
                onClick={handleScanAnother}
                className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-lg">replay</span>
                Scan Another
              </button>
            </div>
          );
        })()}

        {/* Scanner UI */}
        {!result && (
          <>
            {/* Camera Scanner */}
            <div className="bg-surface rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <h2 className="font-headline font-bold text-lg text-on-background mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">photo_camera</span>
                QR Scanner
              </h2>

              {cameraError && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <p className="text-amber-700 text-sm">{cameraError}</p>
                </div>
              )}

              {cameraActive ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 md:w-56 md:h-56 border-2 border-primary/50 rounded-2xl">
                        <div className="w-full h-full border-2 border-transparent rounded-2xl"
                          style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.35)" }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant font-headline font-bold text-sm hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">stop</span>
                    Stop Camera
                  </button>
                </div>
              ) : (
                <button
                  onClick={startCamera}
                  className="w-full inline-flex items-center justify-center gap-3 emerald-gradient text-on-primary py-4 rounded-xl font-headline font-bold text-base shadow-sm hover:shadow-md transition-all"
                >
                  <span className="material-symbols-outlined text-2xl">qr_code_scanner</span>
                  Open Camera Scanner
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-outline-variant/15" />
              <span className="text-xs font-bold tracking-[0.15em] text-on-surface-variant/50 uppercase">or</span>
              <div className="flex-1 h-px bg-outline-variant/15" />
            </div>

            {/* Manual Entry */}
            <div className="bg-surface rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <h2 className="font-headline font-bold text-lg text-on-background mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">keyboard</span>
                Manual Code Entry
              </h2>

              <form onSubmit={handleManualSubmit} className="flex gap-3">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="Enter ticket code (e.g. UD-A7X9K2)"
                  className="flex-1 bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-sm font-body font-bold tracking-wider focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none uppercase"
                />
                <button
                  type="submit"
                  disabled={verifying || !manualCode.trim()}
                  className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-3 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-60"
                >
                  {verifying ? (
                    <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-lg">verified</span>
                  )}
                  Verify
                </button>
              </form>
            </div>
          </>
        )}

        {/* Verifying state */}
        {verifying && (
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-headline font-bold text-on-surface-variant">Verifying ticket...</p>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export default PartnerScanner;
