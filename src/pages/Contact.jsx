import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import { SITE_URL } from "../lib/seo";

export default function Contact() {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    inquiry_type: ["partner", "event", "support"].includes(initialType) ? initialType : "general",
    brand_name: "",
    message: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Focus effect for the brand field transition
  const showBrandField = formData.inquiry_type === "partner" || formData.inquiry_type === "event";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: submitError } = await supabase.from("inquiries").insert([
        {
          name: formData.name,
          email: formData.email,
          inquiry_type: formData.inquiry_type,
          brand_name: showBrandField ? formData.brand_name : null,
          message: formData.message,
        },
      ]);

      if (submitError) throw submitError;

      const { error: mailError } = await supabase.functions.invoke(
        "send-inquiry-notification",
        {
          body: {
            record: {
              name: formData.name,
              email: formData.email,
              inquiry_type: formData.inquiry_type,
              brand_name: showBrandField ? formData.brand_name : null,
              message: formData.message,
            },
          },
        },
      );
      if (mailError) {
        console.error("Could not send inquiry notification:", mailError);
      }

      setIsSuccess(true);
    } catch (err) {
      console.error("Error submitting inquiry:", err);
      setError("Failed to send your message. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const seoTags = (
    <Helmet>
      <title>Contact Us | Uni Deals</title>
      <meta
        name="description"
        content="Get in touch with Uni Deals for support, brand partnerships, or event collaboration. We respond to all inquiries within 24-48 hours."
      />
      <link rel="canonical" href={`${SITE_URL}/contact`} />
    </Helmet>
  );

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-background px-4">
        {seoTags}
        <div className="max-w-md w-full bg-surface-container rounded-2xl p-8 text-center shadow-sm animate-fade-in">
          <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-3xl text-primary">check_circle</span>
          </div>
          <h2 className="font-headline font-black text-2xl text-on-background mb-3">
            Message Sent Successfully!
          </h2>
          <p className="text-on-surface-variant leading-relaxed mb-8">
            Thanks for reaching out to Uni Deals. Our team will review your message and get back to you within 24-48 hours.
          </p>
          <button
            onClick={() => {
              setIsSuccess(false);
              setFormData({ ...formData, message: "" }); // Reset message but keep name/email/type
            }}
            className="w-full h-12 bg-primary text-on-primary font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            Send Another Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 md:py-20 px-4">
      {seoTags}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
        
        {/* Left Column: Typography & FAQ */}
        <div className="lg:col-span-5 flex flex-col justify-center animate-slide-right">
          <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-2xl">mail</span>
          </div>
          <h1 className="font-headline font-black text-4xl md:text-5xl text-on-background mb-4 leading-tight">
            Get in Touch / <br className="hidden lg:block" />
            <span className="text-primary">Partner With Us</span>
          </h1>
          <p className="text-on-surface-variant text-lg leading-relaxed mb-8">
            Whether you have a question, want to host an event, or apply as a brand partner, we're here to help.
          </p>

          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-sm mb-6">
            <h3 className="font-headline font-bold text-on-background mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">schedule</span>
              Response Time
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Our support and partnership teams aim to respond to all inquiries within <strong>24–48 hours</strong> during regular business days.
            </p>
          </div>

          <div className="bg-surface-container-low border border-outline-variant/30 rounded-2xl p-6 shadow-sm">
            <h3 className="font-headline font-bold text-on-background mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">quiz</span>
              Frequently Asked Questions
            </h3>
            <div className="space-y-4">
              <div>
                <p className="font-bold text-sm text-on-background mb-1">How do I verify my student status?</p>
                <p className="text-xs text-on-surface-variant">Sign up, then verify from Profile with a university email or student ID. Status is valid for 12 months and must be renewed each year.</p>
              </div>
              <div>
                <p className="font-bold text-sm text-on-background mb-1">Can I submit an event for my society?</p>
                <p className="text-xs text-on-surface-variant">Yes! Select "Event Collaboration" in the form or use the Events page to submit directly.</p>
              </div>
              <div>
                <p className="font-bold text-sm text-on-background mb-1">Are partnerships paid?</p>
                <p className="text-xs text-on-surface-variant">We offer both free student discounts and premium featured placements. Reach out to learn more.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Form */}
        <div className="lg:col-span-7 animate-slide-left">
          <div className="bg-surface border border-outline-variant/20 rounded-3xl p-6 md:p-10 shadow-sm relative overflow-hidden">
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

            <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-6">
              {error && (
                <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-sm font-medium flex items-start gap-2">
                  <span className="material-symbols-outlined text-lg shrink-0">error</span>
                  <p>{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Full Name */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="name" className="text-sm font-bold text-on-background">
                    Full Name <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                      person
                    </span>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Jane Doe"
                      className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl pl-11 pr-4 text-base md:text-sm text-on-background placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className="text-sm font-bold text-on-background">
                    Email Address <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                      mail
                    </span>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="jane@university.edu"
                      className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl pl-11 pr-4 text-base md:text-sm text-on-background placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Inquiry Type */}
              <div className="flex flex-col gap-2">
                <label htmlFor="inquiry_type" className="text-sm font-bold text-on-background">
                  Inquiry Type <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">
                    category
                  </span>
                  <select
                    id="inquiry_type"
                    name="inquiry_type"
                    required
                    value={formData.inquiry_type}
                    onChange={handleChange}
                    className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl pl-11 pr-10 text-base md:text-sm text-on-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="general">General Question</option>
                    <option value="partner">Partner / Brand Application</option>
                    <option value="event">Event Collaboration</option>
                    <option value="support">Report an Issue / Support</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>

              {/* Dynamic Brand / Organization Name */}
              <div
                className={`flex flex-col gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
                  showBrandField ? "max-h-24 opacity-100 mt-0" : "max-h-0 opacity-0 -mt-6"
                }`}
              >
                <label htmlFor="brand_name" className="text-sm font-bold text-on-background">
                  Brand / Organization Name <span className="text-error">*</span>
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                    storefront
                  </span>
                  <input
                    id="brand_name"
                    name="brand_name"
                    type="text"
                    required={showBrandField}
                    value={formData.brand_name}
                    onChange={handleChange}
                    placeholder="e.g. Uni Deals Society"
                    className="w-full h-12 bg-surface-container-low border border-outline-variant/30 rounded-xl pl-11 pr-4 text-base md:text-sm text-on-background placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              {/* Message */}
              <div className="flex flex-col gap-2">
                <label htmlFor="message" className="text-sm font-bold text-on-background">
                  Your Message <span className="text-error">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  value={formData.message}
                  onChange={handleChange}
                  placeholder="How can we help you today?"
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-4 text-base md:text-sm text-on-background placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-y"
                />
              </div>

              <div className="flex sm:justify-start">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-4 py-3 px-8 w-full sm:w-auto bg-primary hover:bg-primary/90 text-on-primary font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed group relative overflow-hidden min-h-[44px]"
                >
                {/* Subtle highlight effect */}
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                
                <span className="relative z-10 flex items-center gap-2">
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">send</span>
                      Send Message
                    </>
                  )}
                </span>
              </button>
              </div>
            </form>
          </div>
        </div>
        
      </div>
    </div>
  );
}
