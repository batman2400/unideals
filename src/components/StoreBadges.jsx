/**
 * Official App Store and Google Play badges.
 * Google's PNG includes transparent padding, so its box is 60px and the
 * visible button is 40px. The Apple badge is set to that same 40px.
 * Use px, not rem: the site root font size makes h-10 shorter than 40px.
 */
import { useEffect, useState } from "react";

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=co.unideals.app";
export const APP_STORE_URL = "https://apps.apple.com/lk/app/id6818631055";

const STORES = [
  {
    id: "play",
    href: PLAY_STORE_URL,
    label: "Get it on Google Play",
    src: "/images/store/google-play-badge.png",
    className: "h-[60px] w-auto",
  },
  {
    id: "apple",
    href: APP_STORE_URL,
    label: "Download on the App Store",
    src: "/images/store/app-store-badge.svg",
    darkSrc: "/images/store/app-store-badge-white.svg",
    className: "h-[40px] w-auto",
  },
];

export default function StoreBadges({ className = "" }) {
  const [iosFirst, setIosFirst] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const ios =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIosFirst(ios);
  }, []);

  const stores = iosFirst ? [...STORES].reverse() : STORES;

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {stores.map((store) => (
        <a
          key={store.id}
          href={store.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={store.label}
          className="inline-flex items-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {store.darkSrc ? (
            <>
              <img
                src={store.src}
                alt=""
                className={`${store.className} dark:hidden`}
              />
              <img
                src={store.darkSrc}
                alt=""
                className={`${store.className} hidden dark:block`}
              />
            </>
          ) : (
            <img src={store.src} alt="" className={store.className} />
          )}
        </a>
      ))}
    </div>
  );
}
