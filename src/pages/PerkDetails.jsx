import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "../lib/supabaseClient";
import {
  formatVerifiedOn,
  mapPerk,
  perkDisclaimer,
  PERK_COLUMNS,
  perksSchemaMissing,
} from "../lib/studentPerks";
import { SITE_URL } from "../lib/seo";

export default function PerkDetails() {
  const { id } = useParams();
  const [perk, setPerk] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: fetchError } = await supabase
        .from("student_perks")
        .select(PERK_COLUMNS)
        .eq("id", id)
        .eq("is_active", true)
        .maybeSingle();
      if (!active) return;
      if (fetchError) {
        setError(
          perksSchemaMissing(fetchError)
            ? "Student perks are not live yet."
            : fetchError.message || "Couldn't load this perk.",
        );
      } else if (!data) {
        setError("This perk is unavailable.");
      } else {
        setPerk(mapPerk(data));
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <p className="px-6 py-16 text-sm text-on-surface-variant">Loading…</p>;
  }

  if (!perk) {
    return (
      <section className="max-w-xl mx-auto px-6 py-16">
        <h1 className="font-headline font-black text-3xl text-on-background">
          Perk unavailable
        </h1>
        <p className="mt-3 text-on-surface-variant">{error}</p>
        <Link to="/perks" className="mt-6 inline-block font-bold text-primary">
          All perks
        </Link>
      </section>
    );
  }

  const verified = formatVerifiedOn(perk.lastVerifiedOn);
  const offerUrl = /^https:\/\//i.test(perk.officialUrl) ? perk.officialUrl : null;

  return (
    <article className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-14">
      <Helmet>
        <title>{perk.providerName} | Uni Deals</title>
        <meta name="description" content={perk.summary} />
        <link rel="canonical" href={`${SITE_URL}/perks/${perk.id}`} />
      </Helmet>
      <Link to="/perks" className="text-sm font-bold text-primary">
        Global student perks
      </Link>
      <h1 className="mt-3 font-headline font-black text-3xl md:text-4xl text-on-background tracking-tight">
        {perk.providerName}
      </h1>
      {perk.category ? (
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-primary">
          {perk.category}
        </p>
      ) : null}
      <p className="mt-4 text-on-background leading-relaxed">{perk.summary}</p>
      {perk.availability ? (
        <p className="mt-3 text-sm text-on-surface-variant">
          Available: {perk.availability}
        </p>
      ) : null}
      {verified ? (
        <p className="mt-1 text-sm text-on-surface-variant">
          Last verified on {verified}
        </p>
      ) : null}

      {perk.eligibility ? (
        <section className="mt-8">
          <h2 className="font-headline font-extrabold text-xl text-on-background">
            Who can claim it
          </h2>
          <p className="mt-2 text-on-surface-variant leading-relaxed">
            {perk.eligibility}
          </p>
        </section>
      ) : null}

      {perk.claimSteps.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-headline font-extrabold text-xl text-on-background">
            How to claim it
          </h2>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-on-surface-variant">
            {perk.claimSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="mt-8 text-sm text-on-surface-variant">
        {perkDisclaimer(perk.providerName)} Uni Deals does not check your
        eligibility or issue this offer.
      </p>
      {offerUrl ? (
        <a
          href={offerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-primary px-5 font-bold text-on-primary"
        >
          Go to offer
        </a>
      ) : null}
    </article>
  );
}
