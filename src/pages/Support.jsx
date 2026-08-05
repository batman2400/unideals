export default function Support() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 animate-fade-in">
      <div className="mb-8 text-center md:text-left">
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
          Help & Support
        </h1>
        <p className="text-on-surface-variant text-base mt-2">
          We're here to help you get the most out of UniDeals.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 shadow-sm flex flex-col items-center md:items-start text-center md:text-left">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">mail</span>
          <h3 className="font-headline font-bold text-xl text-on-background mb-2">Email Us</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Have a question or need assistance? Drop us an email and our support team will get back to you within 24 hours.
          </p>
          <a href="mailto:unideals.lk@gmail.com" className="inline-flex items-center gap-2 text-primary font-bold hover:underline">
            unideals.lk@gmail.com
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        </div>

        <div className="bg-surface-container-low border border-outline-variant/20 rounded-2xl p-6 shadow-sm flex flex-col items-center md:items-start text-center md:text-left">
          <span className="material-symbols-outlined text-primary text-4xl mb-4">school</span>
          <h3 className="font-headline font-bold text-xl text-on-background mb-2">Verification Help</h3>
          <p className="text-on-surface-variant text-sm mb-4">
            Having trouble verifying your student status? Make sure your university email is valid or use the manual verification method in your profile.
          </p>
        </div>
      </div>
    </div>
  );
}
