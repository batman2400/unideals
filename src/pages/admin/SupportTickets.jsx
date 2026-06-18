export default function SupportTickets() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 md:py-10 animate-fade-in">
      <div className="mb-8">
        <h1 className="font-headline font-extrabold text-3xl md:text-4xl tracking-tighter text-on-background">
          Support Tickets
        </h1>
        <p className="text-on-surface-variant text-base mt-2">
          Manage user reports and help desk inquiries.
        </p>
      </div>
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary-container/30 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-primary text-3xl">
            support_agent
          </span>
        </div>
        <h2 className="font-headline font-bold text-xl text-on-background">
          Ticketing System Offline
        </h2>
        <p className="text-on-surface-variant text-sm mt-2 max-w-md">
          The support desk module is currently being integrated. Please check back later.
        </p>
      </div>
    </div>
  );
}
