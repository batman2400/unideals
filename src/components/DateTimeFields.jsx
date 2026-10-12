const FIELD_CLASS =
  "w-full bg-surface border border-outline-variant/30 rounded-xl px-4 py-3 min-h-[48px] text-sm text-on-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all";

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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
          {dateLabel}
        </label>
        <input
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          required={required}
          className={`${FIELD_CLASS} native-datetime-input`}
        />
      </div>
      <div>
        <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
          {timeLabel}
        </label>
        <input
          type="time"
          value={timeValue}
          onChange={(e) => onTimeChange(e.target.value)}
          required={required}
          step="60"
          className={`${FIELD_CLASS} native-datetime-input`}
        />
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
