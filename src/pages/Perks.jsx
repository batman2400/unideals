import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import PerkMark from "../components/PerkMark";
import { fetchActivePerks, PERK_CATEGORIES, perkDisclaimer } from "../lib/studentPerks";
import { SITE_URL } from "../lib/seo";

export default function Perks() {
  const [perks, setPerks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

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

  const categories = useMemo(
    () => [
      "All",
      ...PERK_CATEGORIES.filter((item) => perks.some((perk) => perk.category === item)),
    ],
    [perks],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return perks.filter((perk) => {
      if (category !== "All" && perk.category !== category) return false;
      if (!needle) return true;
      return [perk.providerName, perk.category, perk.summary, perk.availability]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [perks, query, category]);

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

      <div className="mt-6 flex flex-col gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search perks, such as domains, design, or AI"
          className="h-12 w-full rounded-xl border border-outline-variant/30 bg-surface px-4 text-sm text-on-background"
        />
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map((item) => {
            const selected = item === category;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                  selected
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-sm text-on-surface-variant">Loading…</p>
      ) : error ? (
        <p className="mt-8 text-sm text-error">{error}</p>
      ) : visible.length === 0 ? (
        <p className="mt-8 text-sm text-on-surface-variant">
          {perks.length === 0
            ? "No global perks are published yet."
            : "No perks match that search."}
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {visible.map((perk) => (
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
