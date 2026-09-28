import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import handler from "../../api/list-og-proxy.js";

function mockRes() {
  const headers = {};
  let statusCode = 200;
  let body = "";
  const res = {
    setHeader(key, value) {
      headers[key.toLowerCase()] = value;
      return res;
    },
    status(code) {
      statusCode = code;
      return res;
    },
    send(html) {
      body = html;
      return res;
    },
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
  };
  return res;
}

describe("list hub bot HTML", () => {
  const pages = [
    ["/deals", "deals", "All Student Deals", "https://www.unideals.co/deals"],
    ["/brands", "brands", "Partner Directory", "https://www.unideals.co/brands"],
    ["/categories", "categories", "Deals by Category", "https://www.unideals.co/categories"],
    ["/events", "events", "Events", "https://www.unideals.co/events"],
    ["/blog", "blog", "Uni Deals Blog", "https://www.unideals.co/blog"],
    ["/contact", "contact", "Get in Touch / Partner With Us", "https://www.unideals.co/contact"],
    ["/support", "support", "Help &amp; Support", "https://www.unideals.co/support"],
    ["/privacy", "privacy", "Privacy Policy", "https://www.unideals.co/privacy"],
    ["/terms", "terms", "Terms of Service", "https://www.unideals.co/terms"],
  ];

  for (const [path, type, h1, canonical] of pages) {
    it(`${path} has its own canonical, title, and H1`, async () => {
      const res = mockRes();
      await handler({ query: { type } }, res);
      assert.equal(res.statusCode, 200);
      assert.match(res.body, new RegExp(`<link rel="canonical" href="${canonical}" />`));
      assert.doesNotMatch(res.body, /rel="canonical" href="https:\/\/www\.unideals\.co\/" /);
      assert.match(res.body, /<meta name="description" content="[^"]+" \/>/);
      assert.match(res.body, new RegExp(`<h1>${h1}</h1>`));
      assert.match(res.body, /BreadcrumbList/);
      assert.doesNotMatch(res.body, /ticket_code|promo_code/i);
    });
  }

  it("contact includes the FAQ", async () => {
    const res = mockRes();
    await handler({ query: { type: "contact" } }, res);
    assert.match(res.body, /FAQPage/);
    assert.match(res.body, /How do I verify my student status/);
  });

  it("unknown type is noindex", async () => {
    const res = mockRes();
    await handler({ query: { type: "nope" } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body, /noindex, nofollow/);
  });
});

describe("bot rewrites", () => {
  it("sends hubs and static pages to the list proxy", () => {
    const vercel = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
    const destinations = new Map(
      vercel.rewrites.map((rule) => [rule.source, rule.destination]),
    );
    assert.equal(destinations.get("/deals"), "/api/list-og-proxy?type=deals");
    assert.equal(destinations.get("/brands"), "/api/list-og-proxy?type=brands");
    assert.equal(destinations.get("/events"), "/api/list-og-proxy?type=events");
    assert.equal(destinations.get("/blog"), "/api/list-og-proxy?type=blog");
    assert.equal(destinations.get("/categories"), "/api/list-og-proxy?type=categories");
    assert.equal(destinations.get("/contact"), "/api/list-og-proxy?type=contact");
    assert.equal(destinations.get("/support"), "/api/list-og-proxy?type=support");
    assert.equal(destinations.get("/privacy"), "/api/list-og-proxy?type=privacy");
    assert.equal(destinations.get("/terms"), "/api/list-og-proxy?type=terms");
    assert.equal(destinations.get("/deals/:id"), "/api/deal-og-proxy?id=:id");
  });
});
