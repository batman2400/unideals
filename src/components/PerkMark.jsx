import { perkLogoSrc } from "../lib/studentPerks";

export default function PerkMark({ perk, className = "h-12 w-12" }) {
  const src = perkLogoSrc(perk);
  if (!src) {
    return (
      <span
        className={`${className} inline-flex shrink-0 items-center justify-center rounded-xl bg-primary/10 font-headline font-black text-primary`}
      >
        {String(perk.providerName || "?").slice(0, 1).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={perk.providerName || "Provider logo"}
      className={`${className} shrink-0 rounded-xl border border-outline-variant/15 bg-surface-container-low object-contain p-2`}
    />
  );
}
