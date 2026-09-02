/**
 * Toast Notification Component
 *
 * Renders a sleek, mobile-friendly floating pill notification at the bottom
 * of the screen for lightweight status confirmations (e.g. "Link copied to clipboard!").
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Toast({
  message,
  icon = "check_circle",
  onClose,
  duration = 2600,
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message || typeof document === "undefined") return null;

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none max-w-[90vw]"
    >
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#18181b]/95 text-white dark:bg-[#fcf9f8]/95 dark:text-[#18181b] shadow-2xl border border-white/10 dark:border-black/10 backdrop-blur-md animate-fade-in text-sm font-medium">
        <span className="material-symbols-outlined text-emerald-400 dark:text-emerald-600 text-lg leading-none select-none">
          {icon}
        </span>
        <span className="truncate">{message}</span>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
