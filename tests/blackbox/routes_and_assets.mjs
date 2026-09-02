import test from "node:test";
import assert from "node:assert/strict";

const BASE_URL = "http://localhost:5173";

const PUBLIC_ROUTES = [
  "/",
  "/deals",
  "/categories",
  "/category/food-drink",
  "/category/tech-mobile",
  "/brands",
  "/brand/spa-ceylon",
  "/events",
  "/events/new",
  "/blog",
  "/support",
  "/contact",
  "/terms",
  "/privacy",
  "/delete-account",
  "/saved",
  "/profile",
  "/partner",
  "/admin",
  "/login",
  "/signup",
  "/nonexistent-page-for-testing",
];

const STATIC_ASSETS = [
  "/favicon-48-v9.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/robots.txt",
  "/og-default.png",
  "/llms.txt",
];

test("Black-Box: Static Assets Verification", async (t) => {
  for (const asset of STATIC_ASSETS) {
    await t.test(`GET ${asset} should return HTTP 200`, async () => {
      const res = await fetch(`${BASE_URL}${asset}`);
      assert.equal(
        res.status,
        200,
        `Expected 200 for ${asset}, received ${res.status}`
      );
      assert.ok(
        Number(res.headers.get("content-length") || 1) > 0,
        `Asset ${asset} is empty`
      );
    });
  }
});

test("Black-Box: Single-Page Application (SPA) Route Delivery", async (t) => {
  for (const route of PUBLIC_ROUTES) {
    await t.test(`GET ${route} delivers HTML shell`, async () => {
      const res = await fetch(`${BASE_URL}${route}`);
      assert.equal(res.status, 200);
      const html = await res.text();
      assert.ok(html.includes("<div id=\"root\"></div>"), `Route ${route} missing #root element`);
      assert.ok(html.includes("<!DOCTYPE html>") || html.includes("<!doctype html>"), `Route ${route} not valid HTML`);
    });
  }
});

test("Black-Box: HTML Security & Meta Elements Audit", async (t) => {
  await t.test("Inspect index.html root metadata and schemas", async () => {
    const res = await fetch(`${BASE_URL}/`);
    const html = await res.text();

    // Check charset and viewport
    assert.ok(html.includes('<meta charset="UTF-8"') || html.includes('<meta charset="utf-8"'));
    assert.ok(html.includes('name="viewport"'));

    // Check favicon links
    assert.ok(html.includes('href="/favicon-48-v9.png"'));

    // Check OpenGraph tags presence
    assert.ok(html.includes('property="og:image"'));
    assert.ok(html.includes('property="og:title"'));

    // Check Structured Data JSON-LD
    assert.ok(html.includes('type="application/ld+json"'));
    assert.ok(html.includes('"@type": "Organization"'));
    assert.ok(html.includes('"name": "Uni Deals"'));
  });
});
