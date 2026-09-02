import { useState } from "react";

function PasswordInput({ className = "", disabled, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`${className} !pr-12`}
      />
      <button
        type="button"
        onClick={() => setVisible((open) => !open)}
        disabled={disabled}
        className="absolute inset-y-0 right-0 min-w-[44px] inline-flex items-center justify-center text-on-surface-variant hover:text-on-background disabled:opacity-50"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {visible ? "visibility_off" : "visibility"}
        </span>
      </button>
    </div>
  );
}

export default PasswordInput;
