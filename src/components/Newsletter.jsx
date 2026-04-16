/**
 * Newsletter Component
 *
 * The dark call-to-action section at the bottom that encourages
 * users to subscribe for early access to deals.
 *
 * The subscribe form uses e.preventDefault() and shows a
 * confirmation alert instead of causing a page reload.
 */
import { useState } from "react";

function Newsletter() {
  const [email, setEmail] = useState("");

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      alert("Please enter your email address.");
      return;
    }
    alert(`Subscribed! 🎉\nWe'll send deals to: ${email}`);
    console.log(`[Newsletter] Subscribed: ${email}`);
    setEmail("");
  };

  return (
    <section className="max-w-[1440px] mx-auto px-8 py-32">
      <div className="bg-on-background rounded-3xl p-16 flex flex-col items-center text-center relative overflow-hidden">
        {/* Decorative glow effect */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -mr-32 -mt-32"></div>

        <span className="text-xs font-bold tracking-[0.4em] text-primary-container uppercase mb-6 block">
          Stay Informed
        </span>
        <h2 className="font-headline font-extrabold text-5xl text-surface mb-8 tracking-tighter">
          Never miss a drop.
        </h2>
        <p className="text-surface-container-highest/60 text-lg mb-10 max-w-xl">
          Get early access to exclusive brand collaborations and limited-time student perks
          delivered to your inbox.
        </p>

        {/* Email subscription form */}
        <form
          onSubmit={handleSubscribe}
          className="flex flex-col sm:flex-row gap-4 w-full max-w-md"
        >
          <input
            className="bg-white/10 border-white/20 rounded-md py-4 px-6 text-surface focus:ring-1 focus:ring-primary-container flex-grow outline-none"
            placeholder="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            type="submit"
            className="emerald-gradient text-on-primary px-10 py-4 rounded-md font-headline font-extrabold tracking-tight active:scale-95 transition-all"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  );
}

export default Newsletter;
