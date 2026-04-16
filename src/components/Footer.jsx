/**
 * Footer Component
 *
 * The bottom footer with branding, legal links, and social icons.
 * Uses React Router <Link> for the brand name (routes to /)
 * and proper onClick handlers for all interactive elements.
 */
import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="bg-[#f6f3f2] dark:bg-[#1a1a1b] w-full py-10 md:py-12 px-4 sm:px-6 md:px-8">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Brand — links back to home */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <Link
            to="/"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src="/images/logo.png" alt="Uni Deals" className="h-7 w-auto" />
            <span className="font-['Manrope'] font-black text-[#323233] dark:text-[#fcf9f8] text-xl">
              Uni Deals
            </span>
          </Link>
          <p className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40">
            © 2026 Uni Deals. The Digital Curator.
          </p>
        </div>

        {/* Legal Links — use Link to avoid full page reloads */}
        <div className="flex gap-8">
          <Link
            to="/"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Privacy
          </Link>
          <Link
            to="/"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Terms
          </Link>
          <Link
            to="/"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Support
          </Link>
          <Link
            to="/brands"
            className="font-['Inter'] text-sm tracking-wide text-[#323233]/40 dark:text-[#fcf9f8]/40 hover:text-[#323233] dark:hover:text-[#fcf9f8] transition-opacity duration-300"
          >
            Partnerships
          </Link>
        </div>

        {/* Social Icons — log click for now */}
        <div className="flex gap-4">
          <button
            onClick={() => alert("Share link copied!")}
            className="text-[#323233]/40 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">share</span>
          </button>
          <button
            onClick={() => window.open("https://unideals.com", "_blank")}
            className="text-[#323233]/40 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined">language</span>
          </button>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
