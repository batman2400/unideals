import { useMemo } from "react";
import { Link } from "react-router-dom";
import DealCard from "./DealCard";
import { useDeals } from "../lib/useDeals";
import { brandHubPath, categoryHubPath } from "../lib/seo";

const ROW_LIMIT = 4;

export default function RelatedDeals({ deal }) {
  const { deals, loading } = useDeals();

  const { brandDeals, categoryDeals } = useMemo(() => {
    if (!deal || !Array.isArray(deals) || deals.length === 0) {
      return { brandDeals: [], categoryDeals: [] };
    }

    const currentId = Number(deal.id);
    const fromBrand = deals
      .filter((item) => Number(item.id) !== currentId && item.brand === deal.brand)
      .slice(0, ROW_LIMIT);
    const shownIds = new Set(fromBrand.map((item) => item.id));
    const fromCategory = deal.category
      ? deals
          .filter(
            (item) =>
              Number(item.id) !== currentId &&
              item.category === deal.category &&
              !shownIds.has(item.id),
          )
          .slice(0, ROW_LIMIT)
      : [];

    return { brandDeals: fromBrand, categoryDeals: fromCategory };
  }, [deal, deals]);

  if (loading || (!brandDeals.length && !categoryDeals.length)) return null;

  return (
    <section className="mx-auto mt-8 max-w-[1440px] space-y-10 px-4 md:px-8 lg:mt-12">
      {brandDeals.length > 0 ? (
        <RelatedRow
          title={`More from ${deal.brand}`}
          href={brandHubPath(deal.brand)}
          deals={brandDeals}
        />
      ) : null}
      {categoryDeals.length > 0 ? (
        <RelatedRow
          title={`More in ${deal.category}`}
          href={categoryHubPath(deal.category)}
          deals={categoryDeals}
        />
      ) : null}
    </section>
  );
}

function RelatedRow({ title, href, deals }) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-headline text-xl font-extrabold tracking-tight text-on-background md:text-2xl">
          {title}
        </h2>
        <Link
          to={href}
          className="shrink-0 text-sm font-headline font-bold text-primary transition-colors hover:text-primary/80"
        >
          View all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
        {deals.map((item) => (
          <DealCard key={item.id} deal={item} />
        ))}
      </div>
    </div>
  );
}
