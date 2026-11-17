import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PerkMark from "./PerkMark";
import { fetchActivePerks } from "../lib/studentPerks";

export default function HomePerks() {
  const [perks, setPerks] = useState([]);

  useEffect(() => {
    let active = true;
    void fetchActivePerks().then((result) => {
      if (active && !result.error) setPerks(result.perks.slice(0, 8));
    });
    return () => {
      active = false;
    };
  }, []);

  if (perks.length === 0) return null;

  return (
    <section className="border-t border-outline-variant/10 py-6">
      <div className="mb-4 flex items-end justify-between gap-3 px-4 md:px-8">
        <h2 className="font-headline font-extrabold text-xl tracking-tight text-on-background md:text-2xl">
          Global student perks
        </h2>
        <Link to="/perks" className="shrink-0 text-sm font-bold text-primary">
          View all
        </Link>
      </div>
      <div className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide md:gap-4 md:px-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {perks.map((perk) => {
          const offerUrl = /^https:\/\//i.test(perk.officialUrl || "")
            ? perk.officialUrl
            : "";

          return (
            <article
              key={perk.id}
              className="flex w-[min(88vw,320px)] shrink-0 snap-start flex-col justify-between rounded-2xl border border-outline-variant/20 bg-surface p-4"
            >
              <Link to={`/perks/${perk.id}`} className="hover:opacity-90">
                <div className="flex items-start gap-3">
                  <PerkMark perk={perk} className="h-10 w-10 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-headline font-extrabold text-on-background line-clamp-2">
                      {perk.providerName}
                    </p>
                    {perk.category ? (
                      <p className="text-xs font-bold text-primary">{perk.category}</p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant line-clamp-2">
                  {perk.summary}
                </p>
                {perk.availability ? (
                  <p className="mt-2 text-xs text-on-surface-variant">
                    {perk.availability}
                  </p>
                ) : null}
              </Link>
              {offerUrl ? (
                <a
                  href={offerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto pt-3 text-sm font-bold text-primary"
                >
                  Get this perk
                </a>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
