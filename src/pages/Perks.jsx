import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import PerkMark from "../components/PerkMark";
import { fetchActivePerks, perkDisclaimer } from "../lib/studentPerks";
import { SITE_URL } from "../lib/seo";

export default function Perks() {
  const [perks, setPerks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void fetchActivePerks().then((result) => {
      if (!active) return;
      setPerks(result.perks);
      setError(
        result.unavailable
          ? ""
          : result.error?.message || "",
      );
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 md:py-14">
      <Helmet>
        <title>Global student perks | Uni Deals</title>
        <meta
          name="description"
          content="Global student programs such as the GitHub Student Developer Pack. Uni Deals links to the provider. We do not issue their offers."
        />
        <link rel="canonical" href={`${SITE_URL}/perks`} />
      </Helmet>
      <p className="text-xs uppercase tracking-[0.2em] text-on-surface-variant/60 font-semibold">
        Providers
      </p>
      <h1 className="mt-2 font-headline font-black text-3xl md:text-4xl text-on-background tracking-tight">
        Global student perks
      </h1>
      <p className="mt-3 max-w-2xl text-on-surface-variant leading-relaxed">
        These offers come from the provider. Uni Deals does not check your
        eligibility, issue a code, or take a referral fee.
      </p>

      {loading ? (
        <p className="mt-8 text-sm text-on-surface-variant">Loading…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-error">{error}</p>
      ) : perks.length === 0 ? (
        <p className="mt-8 text-sm text-on-surface-variant">
          No global perks are published yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {perks.map((perk) => (
            <li
              key={perk.id}
              className="flex h-full flex-col rounded-2xl border border-outline-variant/20 bg-surface p-5"
            >
              <Link to={`/perks/${perk.id}`} className="block hover:opacity-90">
                <div className="flex items-start gap-3">
                  <PerkMark perk={perk} />
                  <div className="min-w-0">
                    <p className="font-headline font-extrabold text-lg text-on-background">
                      {perk.providerName}
                    </p>
                    {perk.category ? (
                      <p className="mt-1 text-xs font-bold uppercase tracking-wide text-primary">
                        {perk.category}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
                  {perk.summary}
                </p>
                {perk.availability ? (
                  <p className="mt-3 text-xs text-on-surface-variant">
                    {perk.availability}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-on-surface-variant">
                  {perkDisclaimer(perk.providerName)}
                </p>
              </Link>
              {/^https:\/\//i.test(perk.officialUrl || "") ? (
                <a
                  href={perk.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex max-w-full flex-col text-primary"
                >
                  <span className="text-sm font-bold">Get this perk</span>
                  <span className="truncate text-xs font-normal text-on-surface-variant">
                    {perk.officialUrl}
                  </span>
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
