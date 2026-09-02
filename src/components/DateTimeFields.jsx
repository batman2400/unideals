import { useRef } from "react";

const FIELD_CLASS =
  "w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] pr-12 text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all appearance-auto";

function openNativePicker(input) {
  if (!input) return;
  try {
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
  } catch {
    // showPicker throws if the input is not user-activated or not supported.
  }
  input.focus();
}

/**
 * Separate native date + time controls. Combined datetime-local hides its
 * calendar/clock on Windows when Tailwind Forms sets appearance:none.
 */
export default function DateTimeFields({
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  required = false,
  dateLabel = "Date",
  timeLabel = "Time",
}) {
  const dateRef = useRef(null);
  const timeRef = useRef(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
          {dateLabel}
        </label>
        <div className="relative">
          <input
            ref={dateRef}
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange(e.target.value)}
            required={required}
            className={`${FIELD_CLASS} native-datetime-input`}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Open calendar"
            onClick={() => openNativePicker(dateRef.current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 inline-flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-background"
          >
            <span className="material-symbols-outlined text-[20px]">calendar_month</span>
          </button>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
          {timeLabel}
        </label>
        <div className="relative">
          <input
            ref={timeRef}
            type="time"
            value={timeValue}
            onChange={(e) => onTimeChange(e.target.value)}
            required={required}
            step="60"
            className={`${FIELD_CLASS} native-datetime-input`}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-label="Open time picker"
            onClick={() => openNativePicker(timeRef.current)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-9 w-9 inline-flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-background"
          >
            <span className="material-symbols-outlined text-[20px]">schedule</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function combineLocalDateAndTime(date, time) {
  if (!date) return null;
  const clock = time && String(time).length >= 4 ? time : "00:00";
  const parsed = new Date(`${date}T${clock}`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
