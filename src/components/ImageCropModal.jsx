import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  calculateCropBoxSize,
  calculatePanBounds,
  clampPan,
  renderCroppedImageToFile,
  DEAL_ASPECT_OPTIONS,
} from "../lib/imageCropUtils";

/**
 * ImageCropModal
 * Provides an interactive cropping experience with rule-of-thirds grid overlay,
 * aspect ratio presets, pan/zoom/rotate controls, and high-resolution export.
 */
export default function ImageCropModal({
  isOpen,
  imageFile,
  imageUrl,
  title = "Frame & Crop Image",
  subtitle = "Choose which part will be showcased in the card layout.",
  aspectOptions = DEAL_ASPECT_OPTIONS,
  initialAspectId = "1:1",
  onCropComplete,
  onClose,
}) {
  const [selectedAspect, setSelectedAspect] = useState(initialAspectId);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 520, height: 360 });

  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const objectUrlRef = useRef(null);
  const [activeImageSrc, setActiveImageSrc] = useState("");

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const touchDistanceRef = useRef(null);

  // Set up image source from File or URL
  useEffect(() => {
    if (!isOpen) return;

    if (imageFile instanceof File || imageFile instanceof Blob) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(imageFile);
      objectUrlRef.current = url;
      setActiveImageSrc(url);
    } else if (imageUrl) {
      setActiveImageSrc(imageUrl);
    }

    // Reset controls
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setSelectedAspect(initialAspectId || aspectOptions[0]?.id || "1:1");

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [isOpen, imageFile, imageUrl, initialAspectId, aspectOptions]);

  // Update container size on mount/resize
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerSize({ width: rect.width, height: rect.height });
        }
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isOpen]);

  // Find active aspect config
  const currentAspectOption =
    aspectOptions.find((opt) => opt.id === selectedAspect) || aspectOptions[0];

  // Resolve target ratio (if "original", compute from natural image dimensions)
  const targetRatio =
    currentAspectOption.ratio ||
    (imgRef.current && imgRef.current.naturalWidth && imgRef.current.naturalHeight
      ? imgRef.current.naturalWidth / imgRef.current.naturalHeight
      : 1);

  // Crop frame size inside the viewport
  const cropBox = calculateCropBoxSize(
    containerSize.width,
    containerSize.height,
    targetRatio
  );

  // Image bounds calculation
  const bounds = imgRef.current
    ? calculatePanBounds({
        cropWidth: cropBox.width,
        cropHeight: cropBox.height,
        imageWidth: imgRef.current.naturalWidth,
        imageHeight: imgRef.current.naturalHeight,
        rotation,
        zoom,
      })
    : { baseScale: 1, currentScale: 1, maxPanX: 0, maxPanY: 0 };

  // Keep pan within valid limits
  const clampedPan = clampPan(pan.x, pan.y, bounds.maxPanX, bounds.maxPanY);

  // Mouse pan handlers
  const handleMouseDown = (e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { ...clampedPan };
  };

  const handleMouseMove = useCallback(
    (e) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    },
    []
  );

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Touch pan & pinch-to-zoom handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStartRef.current = { ...clampedPan };
      touchDistanceRef.current = null;
    } else if (e.touches.length === 2) {
      isDraggingRef.current = false;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDistanceRef.current = dist;
    }
  };

  const handleTouchMove = useCallback(
    (e) => {
      if (e.touches.length === 1 && isDraggingRef.current) {
        const dx = e.touches[0].clientX - dragStartRef.current.x;
        const dy = e.touches[0].clientY - dragStartRef.current.y;
        setPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        });
      } else if (e.touches.length === 2 && touchDistanceRef.current) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchDistanceRef.current;
        setZoom((prev) => Math.min(3, Math.max(1, +(prev * factor).toFixed(2))));
        touchDistanceRef.current = dist;
      }
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    touchDistanceRef.current = null;
  }, []);

  // Mouse wheel zoom
  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setZoom((prev) => Math.min(3, Math.max(1, +(prev + delta).toFixed(2))));
  };

  // Keyboard navigation & escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Rotation handler
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setPan({ x: 0, y: 0 });
  };

  // Reset handler
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Apply and export cropped image
  const handleApply = async () => {
    if (!imgRef.current) return;

    setIsProcessing(true);
    try {
      const fileName =
        imageFile?.name ||
        (imageUrl ? imageUrl.split("/").pop().split("?")[0] : "deal-event-image.jpg");

      const mimeType = imageFile?.type || "image/jpeg";

      const result = await renderCroppedImageToFile({
        imageElement: imgRef.current,
        cropWidth: cropBox.width,
        cropHeight: cropBox.height,
        panX: clampedPan.x,
        panY: clampedPan.y,
        zoom,
        rotation,
        originalFileName: fileName,
        mimeType,
      });

      const previewUrl = URL.createObjectURL(result.blob);
      onCropComplete(result.file, previewUrl);
      onClose();
    } catch (err) {
      console.error("Failed to crop image:", err);
      alert("Unable to process image crop. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-fade-in"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-dialog-title"
    >
      <div className="bg-surface text-on-surface rounded-3xl border border-outline-variant/30 shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/15 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">crop</span>
            </div>
            <div>
              <h2
                id="crop-dialog-title"
                className="font-headline font-bold text-lg text-on-background leading-tight"
              >
                {title}
              </h2>
              <p className="text-xs text-on-surface-variant font-medium">
                {subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Close dialog"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Aspect Ratio Selector Bar */}
        <div className="px-6 py-3 border-b border-outline-variant/15 bg-surface-container-lowest flex items-center justify-between gap-3 overflow-x-auto">
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex-shrink-0 flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">aspect_ratio</span>
            Aspect Ratio:
          </span>

          <div className="flex items-center gap-2 flex-nowrap">
            {aspectOptions.map((opt) => {
              const isActive = opt.id === selectedAspect;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSelectedAspect(opt.id);
                    setPan({ x: 0, y: 0 });
                  }}
                  className={`relative px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? "bg-primary text-on-primary shadow-sm"
                      : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.recommended && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-primary/15 text-primary"
                      }`}
                    >
                      Best
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Viewport Area */}
        <div className="relative p-4 sm:p-6 bg-surface-container-lowest">
          <div
            ref={containerRef}
            onWheel={handleWheel}
            className="relative w-full h-[320px] sm:h-[380px] bg-neutral-900 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner select-none cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            {/* Hidden natural image for calculations & canvas drawing */}
            <img
              ref={imgRef}
              src={activeImageSrc}
              alt="Source"
              onLoad={() => setImageLoaded(true)}
              className="hidden"
              crossOrigin="anonymous"
            />

            {imageLoaded && (
              <>
                {/* Visual Crop Frame with 3x3 Grid Overlay */}
                <div
                  style={{
                    width: `${cropBox.width}px`,
                    height: `${cropBox.height}px`,
                  }}
                  className="relative overflow-hidden border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] pointer-events-none rounded-sm transition-[width,height] duration-200"
                >
                  {/* Rule of Thirds - 3x3 Grid Overlay */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3">
                    {/* Horizontal dividing lines */}
                    <div className="absolute left-0 right-0 top-[33.333%] h-[1px] bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    <div className="absolute left-0 right-0 top-[66.666%] h-[1px] bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />

                    {/* Vertical dividing lines */}
                    <div className="absolute top-0 bottom-0 left-[33.333%] w-[1px] bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                    <div className="absolute top-0 bottom-0 left-[66.666%] w-[1px] bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />

                    {/* Center guide mark */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-white/50 rounded-full pointer-events-none opacity-60" />
                  </div>

                  {/* Corner Accent Brackets */}
                  <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-white" />
                  <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-white" />
                  <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-white" />
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-white" />

                  {/* Image Rendered Inside Frame */}
                  <div
                    className="absolute pointer-events-none will-change-transform"
                    style={{
                      left: "50%",
                      top: "50%",
                      transform: `translate(-50%, -50%) translate(${clampedPan.x}px, ${clampedPan.y}px)`,
                    }}
                  >
                    <img
                      src={activeImageSrc}
                      alt="Framing preview"
                      style={{
                        transform: `rotate(${rotation}deg) scale(${bounds.currentScale})`,
                        transformOrigin: "center center",
                        maxWidth: "none",
                      }}
                      className="transition-transform duration-75 select-none"
                      draggable={false}
                    />
                  </div>
                </div>

                {/* Helper hint tag */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-full text-[11px] text-white/90 font-medium pointer-events-none flex items-center gap-1.5 shadow-sm">
                  <span className="material-symbols-outlined text-[14px] text-primary-fixed">
                    drag_pan
                  </span>
                  Drag to pan • Scroll or use slider to zoom
                </div>
              </>
            )}
          </div>

          {/* Controls Bar: Zoom Slider + Rotation + Reset */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 px-1">
            {/* Zoom Slider */}
            <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
              <button
                type="button"
                onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.1).toFixed(2)))}
                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
                title="Zoom out"
              >
                <span className="material-symbols-outlined text-lg">zoom_out</span>
              </button>

              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-primary h-1.5 bg-surface-container-highest rounded-lg cursor-pointer"
                aria-label="Zoom scale"
              />

              <button
                type="button"
                onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.1).toFixed(2)))}
                className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant transition-colors"
                title="Zoom in"
              >
                <span className="material-symbols-outlined text-lg">zoom_in</span>
              </button>

              <span className="text-xs font-bold text-on-surface-variant w-12 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRotate}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors"
                title="Rotate 90 degrees"
              >
                <span className="material-symbols-outlined text-base">rotate_right</span>
                Rotate
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold transition-colors"
                title="Reset position and zoom"
              >
                <span className="material-symbols-outlined text-base">restart_alt</span>
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/15 bg-surface-container-low flex items-center justify-between gap-4">
          <div className="text-xs text-on-surface-variant">
            <span className="font-bold text-on-background">{currentAspectOption.label}</span>
            {currentAspectOption.note && (
              <span className="hidden sm:inline text-on-surface-variant/70">
                {" "}
                — {currentAspectOption.note}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing || !imageLoaded}
              className="inline-flex items-center gap-2 emerald-gradient text-on-primary px-6 py-2 rounded-xl font-headline font-bold text-sm tracking-tight shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Framing...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg">check</span>
                  Apply Framing
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
