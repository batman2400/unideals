import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PerkMark from "./PerkMark";
import { fetchActivePerks, perkDisclaimer } from "../lib/studentPerks";

export default function HomePerks() {
  const [perks, setPerks] = useState([]);

  useEffect(() => {
    let active = true;
    void fetchActivePerks().then((result) => {
      if (active && !result.error) setPerks(result.perks.slice(0, 4));
    });
    return () => {
      active = false;
    };
  }, []);

  if (perks.length === 0) return null;

  return (
    <section className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="font-headline font-extrabold text-2xl text-on-background tracking-tight">
          Global student perks
        </h2>
        <Link to="/perks" className="text-sm font-bold text-primary">
          View all
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {perks.map((perk) => (
          <Link
            key={perk.id}
            to={`/perks/${perk.id}`}
            className="rounded-2xl border border-outline-variant/20 bg-surface p-4 hover:border-primary/40"
          >
            <div className="flex items-start gap-3">
              <PerkMark perk={perk} className="h-10 w-10" />
              <p className="font-headline font-extrabold text-on-background">
                {perk.providerName}
              </p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant line-clamp-3">
              {perk.summary}
            </p>
            <p className="mt-3 text-xs text-on-surface-variant">
              {perkDisclaimer(perk.providerName)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
