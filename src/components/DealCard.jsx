/**
 * DealCard Component
 *
 * A single deal card showing the deal image, brand name, discount,
 * description, and a "Claim Deal" button.
 *
 * The "Claim Deal" button now fires an alert so users know
 * the button is responsive. Replace with real logic later.
 *
 * Props:
 *   - deal : object from mockData.js with shape:
 *       { id, title, brand, discount, type, category, imageUrl, description }
 */
function DealCard({ deal }) {
  const { title, type, discount, imageUrl, description } = deal;

  // Map type to badge label
  const badgeLabel = type === "Online" ? "Online Offer" : "In-Store Subscription";

  // Handle claim button click
  const handleClaim = () => {
    alert(`Deal Claimed! 🎉\n\n${title} — ${discount}`);
    console.log(`[Claim Deal] User claimed: ${title} (${discount})`);
  };

  return (
    <div className="flex flex-col group cursor-pointer">
      {/* Deal Image */}
      <div className="aspect-[16/10] overflow-hidden rounded-xl relative bg-surface-container">
        <img
          alt={title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          src={imageUrl}
        />
        <div className="absolute top-4 right-4">
          <span className="bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm">
            {badgeLabel}
          </span>
        </div>
      </div>

      {/* Deal Info */}
      <div className="pt-6">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-headline font-extrabold text-2xl tracking-tight">{title}</h3>
          <span className="text-primary font-headline font-black text-xl">{discount}</span>
        </div>
        <p className="text-on-surface-variant text-sm mb-4 leading-relaxed">{description}</p>
        <button
          onClick={handleClaim}
          className="w-full py-3 rounded-md border border-outline-variant/20 font-headline font-bold text-sm group-hover:bg-primary group-hover:text-on-primary transition-all active:scale-[0.98]"
        >
          Claim Deal
        </button>
      </div>
    </div>
  );
}

export default DealCard;
