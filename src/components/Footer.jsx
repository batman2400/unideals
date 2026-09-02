/**
 * Footer Component
 *
 * The bottom footer with branding, legal links, and social icons.
 * Uses React Router <Link> for the brand name (routes to /)
 * and proper onClick handlers for all interactive elements.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { shareLink } from "../lib/share";
import Toast from "./Toast";

function Footer() {
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const handleShare = async () => {
    const result = await shareLink({
      title: "Uni Deals | Sri Lanka's Student Deals & Perks",
      text: "Check out Uni Deals for exclusive student discounts and perks in Sri Lanka!",
      url: window.location.origin,
    });

    if (result.method === "clipboard" && result.success) {
      setCopied(true);
      setToastMessage("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else if (result.error) {
      setToastMessage("Could not copy link");
    }
  };

  return (
    <footer className="mt-auto bg-[#f6f3f2] dark:bg-[#1a1a1b] w-full py-10 md:py-12 px-4 sm:px-6 md:px-8">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Brand — links back to home */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              src="/images/logo.png"
              alt="Uni Deals"
              className="h-7 w-auto"
            />
            <span className="font-['Manrope'] font-black text-[#323233] dark:text-[#fcf9f8] text-xl">
              Uni Deals
            </span>
          </Link>
          <p className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40">
            © 2026 Uni Deals. The Digital Curator.
          </p>
        </div>

        {/* Legal Links — use Link to avoid full page reloads */}
        <div className="flex flex-wrap gap-6 md:gap-8 justify-center">
          <Link
            to="/privacy"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Privacy Policy
          </Link>
          <Link
            to="/terms"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Terms of Service
          </Link>
          <Link
            to="/delete-account"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Delete account
          </Link>
          <Link
            to="/contact"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Contact Us
          </Link>
          <Link
            to="/brands"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Brands
          </Link>
          <Link
            to="/contact?type=partner"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Partner Application
          </Link>
          <Link
            to="/blog"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Blog
          </Link>
        </div>

        {/* Action / Share Icon */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleShare}
            title="Share Uni Deals"
            aria-label="Share Uni Deals"
            className="flex items-center justify-center h-9 w-9 rounded-full text-[#323233]/40 hover:text-primary hover:bg-black/5 dark:text-[#fcf9f8]/40 dark:hover:text-primary dark:hover:bg-white/5 transition-all"
          >
            <span className="material-symbols-outlined text-xl">
              {copied ? "check" : "share"}
            </span>
          </button>
        </div>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </footer>
  );
}

export default Footer;
