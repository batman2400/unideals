/** Canonical Sri Lankan universities / institutes for the verification dropdown. */
export const OTHER_UNIVERSITY = "__other__";

const NAME_ALIASES = {
  "sri lanka institute of information technology":
    "Sri Lanka Institute of Information Technology (SLIIT)",
  "national institute of business management":
    "National Institute of Business Management (NIBM)",
  "informatics institute of technology":
    "Informatics Institute of Technology (IIT)",
  "asia pacific institute of information technology":
    "Asia Pacific Institute of Information Technology (APIIT)",
};

export const SRI_LANKA_UNIVERSITIES = [
  { name: "University of Colombo", domains: ["cmb.ac.lk"] },
  { name: "University of Peradeniya", domains: ["pdn.ac.lk"] },
  { name: "University of Sri Jayewardenepura", domains: ["sjp.ac.lk"] },
  { name: "University of Kelaniya", domains: ["kln.ac.lk"] },
  { name: "University of Moratuwa", domains: ["uom.lk", "mrt.ac.lk"] },
  { name: "University of Jaffna", domains: ["jfn.ac.lk"] },
  { name: "University of Ruhuna", domains: ["ruh.ac.lk"] },
  { name: "The Open University of Sri Lanka", domains: ["ou.ac.lk"] },
  { name: "Eastern University, Sri Lanka", domains: ["esn.ac.lk"] },
  { name: "South Eastern University of Sri Lanka", domains: ["seu.ac.lk"] },
  { name: "Rajarata University of Sri Lanka", domains: ["rjt.ac.lk"] },
  { name: "Sabaragamuwa University of Sri Lanka", domains: ["sab.ac.lk"] },
  { name: "Wayamba University of Sri Lanka", domains: ["wyb.ac.lk"] },
  { name: "Uva Wellassa University", domains: ["uwu.ac.lk"] },
  { name: "University of the Visual and Performing Arts", domains: ["vpa.ac.lk"] },
  { name: "Gampaha Wickramarachchi University of Indigenous Medicine", domains: ["gwu.ac.lk"] },
  { name: "University of Vavuniya", domains: ["vau.ac.lk"] },
  { name: "General Sir John Kotelawala Defence University", domains: ["kdu.ac.lk"] },
  { name: "University of Vocational Technology", domains: ["uovt.ac.lk"] },
  { name: "Ocean University of Sri Lanka", domains: ["ocu.ac.lk"] },
  { name: "Buddhist and Pali University of Sri Lanka", domains: ["bpu.ac.lk"] },
  { name: "Bhiksu University of Sri Lanka", domains: ["busl.ac.lk"] },
  { name: "NSBM Green University", domains: ["nsbm.lk", "nsbm.ac.lk"] },
  {
    name: "Sri Lanka Institute of Information Technology (SLIIT)",
    domains: ["sliit.lk", "sliit.ac.lk"],
  },
  { name: "Informatics Institute of Technology (IIT)", domains: ["iit.lk"] },
  {
    name: "Asia Pacific Institute of Information Technology (APIIT)",
    domains: ["apiit.lk"],
  },
  { name: "National Institute of Business Management (NIBM)", domains: ["nibm.lk"] },
  { name: "CINEC Campus", domains: ["cinec.edu", "cinec.lk"] },
  { name: "KIU", domains: ["kiu.lk"] },
  { name: "ESOFT Metro Campus", domains: ["esoft.lk"] },
  { name: "ICBT Campus", domains: ["icbt.lk"] },
  { name: "Royal Institute of Colombo", domains: ["ric.lk"] },
  { name: "BMS", domains: ["bms.lk"] },
  { name: "CA Sri Lanka", domains: ["casrilanka.com"] },
];

export function emailHost(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 0) return "";
  return normalized.slice(at + 1);
}

export function hostMatchesDomain(host, domain) {
  const h = String(host ?? "").trim().toLowerCase();
  const d = String(domain ?? "").trim().toLowerCase();
  if (!h || !d) return false;
  return h === d || h.endsWith(`.${d}`);
}

export function mergeUniversityOptions(dbRows) {
  const map = new Map();

  function add(name, domain) {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return;
    const key = NAME_ALIASES[trimmed.toLowerCase()]?.toLowerCase() ?? trimmed.toLowerCase();
    const display = NAME_ALIASES[trimmed.toLowerCase()] ?? trimmed;
    if (!map.has(key)) {
      map.set(key, { name: display, domains: new Set() });
    }
    const host = String(domain ?? "").trim().toLowerCase();
    if (host) map.get(key).domains.add(host);
  }

  for (const uni of SRI_LANKA_UNIVERSITIES) {
    if (!uni.domains?.length) {
      add(uni.name, "");
      continue;
    }
    for (const domain of uni.domains) add(uni.name, domain);
  }

  for (const row of dbRows || []) {
    add(row?.institution_name, row?.domain);
  }

  return [...map.values()]
    .map((uni) => ({ name: uni.name, domains: [...uni.domains] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function findUniversityByEmail(email, options) {
  const host = emailHost(email);
  if (!host) return null;
  return (
    (options || []).find((uni) =>
      (uni.domains || []).some((domain) => hostMatchesDomain(host, domain)),
    ) ?? null
  );
}

export function emailMatchesUniversity(email, university) {
  if (!university) return false;
  const domains = university.domains || [];
  if (domains.length === 0) return true;
  const host = emailHost(email);
  return domains.some((domain) => hostMatchesDomain(host, domain));
}
