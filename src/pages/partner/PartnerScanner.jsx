import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRoleContext } from "../../lib/RoleContext";
import { getPartnerBrand } from "../../lib/partnerBrand";
import PortalLayout from "../../layouts/PortalLayout";
import jsQR from "jsqr";

function PartnerScanner() {
  const {
    user,
    role,
    loading: roleLoading,
    impersonatedPartnerId,
  } = useRoleContext();
  const targetUserId = impersonatedPartnerId || user?.id;
  const [partnerBrand, setPartnerBrand] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);

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
      setError(
        "Admin View: Please impersonate a brand from the sidebar to scan tickets.",
      );
      setLoading(false);
      return;
    }

    let active = true;

    async function init() {
      const { brandName, error: brandError } =
        await getPartnerBrand(targetUserId);
      if (!active) return;
      setPartnerBrand(brandName || "");
      if (brandError) setError(brandError);
      setLoading(false);
    }

    init();
    return () => {
      active = false;
    };
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

  // Use a ref so the interval callback always calls the latest processCode
  const processCodeRef = useRef(null);

  const processCode = useCallback(async (code, method = "manual") => {
    setVerifying(true);
    setError("");
    setResult(null);

    try {
      // Try the new ticket-based validation first
      const { data, error: rpcError } = await supabase.rpc(
        "validate_instore_ticket",
        {
          scanned_payload: code,
          scan_method: method,
        },
      );

      if (!isMountedRef.current) return;

      if (rpcError) {
        throw rpcError;
      }

      const row = data?.[0];
      if (row) {
        setResult(row);
        if (row.result === "valid" && row.deal_title) {
          setScanHistory((prev) => {
            const newLog = {
              id: Date.now(),
              title: row.deal_title,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            return [newLog, ...prev].slice(0, 3);
          });
        }
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
        const { data, error: legacyError } = await supabase.rpc(
          "record_partner_redemption_scan",
          {
            scanned_payload: code,
            scan_method: method,
          },
        );

        if (!isMountedRef.current) return;

        if (legacyError) throw legacyError;

        const row = data?.[0];
        if (row) {
          setResult(row);
          if (row.result === "valid" && row.deal_title) {
            setScanHistory((prev) => {
              const newLog = {
                id: Date.now(),
                title: row.deal_title,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              };
              return [newLog, ...prev].slice(0, 3);
            });
          }
        }
      } catch (fallbackErr) {
        if (!isMountedRef.current) return;
        setError(
          fallbackErr?.message || "Verification failed. Please try again.",
        );
      }
    } finally {
      if (isMountedRef.current) setVerifying(false);
    }
  }, []);

  // Keep the ref always pointing to the latest processCode
  useEffect(() => {
    processCodeRef.current = processCode;
  }, [processCode]);

  // Connect stream to video element when camera becomes active
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((err) => console.error("Error playing video:", err));
    }
  }, [cameraActive]);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setResult(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setCameraActive(true);

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
        if (!videoRef.current || !canvasRef.current || !isMountedRef.current)
          return;

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

        if (!codeValue) {
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qr = jsQR(imgData.data, canvas.width, canvas.height);
          if (qr) codeValue = qr.data;
        }

        if (codeValue) {
          stopCamera();
          if (processCodeRef.current) {
            processCodeRef.current(codeValue, "camera");
          }
        }
      }, 350);
    } catch (err) {
      if (!isMountedRef.current) return;
      setCameraError(err?.message || "Camera not available. Try manual entry.");
    }
  }, [stopCamera]);


  const handleManualSubmit = useCallback(
    (e) => {
      e.preventDefault();
      const code = manualCode.trim().toUpperCase();
      if (!code) return;
      processCode(code, "manual");
      setManualCode("");
    },
    [manualCode, processCode],
  );

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
    valid: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-700",
      icon: "check_circle",
      iconColor: "text-emerald-500",
    },
    already_redeemed: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "info",
      iconColor: "text-amber-500",
    },
    expired: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "timer_off",
      iconColor: "text-amber-500",
    },
    not_found: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-600",
      icon: "search_off",
      iconColor: "text-red-500",
    },
    wrong_brand: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-600",
      icon: "block",
      iconColor: "text-red-500",
    },
    not_approved: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
      icon: "pending",
      iconColor: "text-amber-500",
    },
    invalid: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-600",
      icon: "error",
      iconColor: "text-red-500",
    },
    error: {
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-600",
      icon: "error",
      iconColor: "text-red-500",
    },
  };

  return (
    <PortalLayout portalType="partner" brandName={partnerBrand}>
      <div className="mb-6">
        <h1 className="font-headline font-extrabold text-2xl md:text-3xl tracking-tight text-on-background mb-1">
          Ticket Scanner
        </h1>
        <p className="text-on-surface-variant text-sm">
          Scan student QR tickets or enter codes manually to validate in-store
          redemptions.
        </p>
      </div>

      {error && (
        <div className="mb-5 bg-error/10 border border-error/20 rounded-xl px-4 py-3">
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 animate-fade-in">
        
        {/* Left Column - Scanner Console */}
        <div className="lg:col-span-8 flex flex-col">
          {/* Result Display Overlaying Scanner */}
          {result ? (
            <div className="h-full min-h-[400px] flex items-center justify-center bg-surface border border-outline-variant/15 rounded-3xl shadow-sm p-8">
              {(() => {
                const style = resultColors[result.result] || resultColors.error;
                return (
                  <div className={`w-full max-w-md rounded-3xl border-2 ${style.border} ${style.bg} p-8 text-center animate-fade-in`}>
                    <span className={`material-symbols-outlined text-6xl ${style.iconColor} mb-4 block`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {style.icon}
                    </span>
                    <p className={`font-headline font-extrabold text-2xl ${style.text} mb-2`}>
                      {result.result === "valid"
                        ? "Valid Ticket!"
                        : result.result?.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                    </p>
                    <p className={`text-base ${style.text} mb-6`}>{result.message}</p>

                    {result.deal_title && (
                      <div className="bg-white/60 rounded-xl p-4 mb-6 inline-block w-full">
                        <p className="text-sm font-bold text-on-background">
                          {result.deal_title}
                        </p>
                        {result.deal_discount && (
                          <p className="text-primary text-sm font-headline font-bold mt-1">
                            {result.deal_discount}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      onClick={handleScanAnother}
                      className="w-full inline-flex justify-center items-center gap-2 emerald-gradient text-on-primary px-6 py-4 rounded-xl font-headline font-bold text-base shadow-sm hover:shadow-md transition-all"
                    >
                      <span className="material-symbols-outlined text-xl">replay</span>
                      Scan Another
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="bg-surface rounded-3xl border border-outline-variant/15 p-6 md:p-10 shadow-sm flex-1 flex flex-col items-center justify-center min-h-[500px] relative">
              
              {cameraError && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[90%] max-w-md bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center z-10 shadow-sm">
                  <p className="text-amber-700 text-sm font-bold">{cameraError}</p>
                </div>
              )}

              {verifying && (
                <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center z-20 rounded-3xl border border-outline-variant/15">
                  <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="font-headline font-bold text-lg text-on-background">
                    Verifying...
                  </p>
                </div>
              )}

              {cameraActive ? (
                <div className="w-full max-w-xl flex flex-col items-center">
                  <div className="relative rounded-3xl overflow-hidden bg-black w-full aspect-square md:aspect-video shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover opacity-90"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Scan overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-56 h-56 md:w-72 md:h-72 border-2 border-dashed border-primary rounded-3xl relative">
                        <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
                        <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
                        <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-xl"></div>
                      </div>
                      <div className="absolute inset-0" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }} />
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="mt-8 px-8 py-3 rounded-xl border-2 border-error/20 text-error font-headline font-bold text-sm hover:bg-error/10 transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">stop_circle</span>
                    Close Scanner
                  </button>
                </div>
              ) : (
                <div onClick={startCamera} className="w-full max-w-md aspect-square rounded-3xl border-2 border-dashed border-outline-variant/40 bg-surface-container/30 flex flex-col items-center justify-center hover:bg-surface-container/50 transition-colors hover:border-primary/50 group cursor-pointer shadow-sm">
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-primary text-4xl">qr_code_scanner</span>
                  </div>
                  <h3 className="font-headline font-bold text-xl text-on-background mb-2 group-hover:text-primary transition-colors">Start Scanning</h3>
                  <p className="text-on-surface-variant text-sm text-center max-w-[250px]">
                    Click to grant camera access and scan student ticket QR codes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Contextual Tools */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Manual Entry Card */}
          <div className="bg-surface rounded-3xl border border-outline-variant/15 p-6 shadow-sm">
            <h3 className="font-headline font-bold text-base text-on-background mb-4">Manual Entry</h3>
            <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">keyboard</span>
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="Ticket Code (e.g. A7X9K2)"
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl pl-12 pr-4 py-3 text-sm font-body font-bold tracking-widest focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none uppercase placeholder:font-normal placeholder:tracking-normal"
                />
              </div>
              <button
                type="submit"
                disabled={verifying || !manualCode.trim()}
                className="w-full inline-flex items-center justify-center gap-2 emerald-gradient text-on-primary py-3.5 rounded-xl font-headline font-bold text-sm shadow-sm hover:shadow-md transition-all disabled:opacity-60"
              >
                {verifying ? (
                  <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    Verify Ticket
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Quick Scan History Card */}
          <div className="bg-surface rounded-3xl border border-outline-variant/15 p-6 shadow-sm flex-1 flex flex-col">
            <h3 className="font-headline font-bold text-base text-on-background mb-4 flex items-center justify-between">
              Recent Activity
              <span className="material-symbols-outlined text-on-surface-variant/50 text-[18px]">history</span>
            </h3>
            
            {scanHistory.length === 0 ? (
              <div className="flex flex-col flex-1 items-center justify-center text-center py-8">
                 <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-3">
                   <span className="material-symbols-outlined text-on-surface-variant/50">receipt_long</span>
                 </div>
                 <p className="text-sm font-bold text-on-surface-variant">No recent scans</p>
                 <p className="text-xs text-on-surface-variant/70 mt-1">Scanned tickets will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {scanHistory.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-emerald-600 text-[16px]">check</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-on-background truncate">{log.title}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-wider mt-0.5">{log.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </PortalLayout>
  );
}

export default PartnerScanner;
