import test from "node:test";
import assert from "node:assert/strict";

import {
  validatePasswordStrength,
  isExistingAccountSignup,
  describeAuthFailure,
} from "../../src/lib/passwordPolicy.js";

import {
  isAllowedStudentEmail,
  emailDomain,
  hostMatchesSuffix,
  UNIVERSAL_STUDENT_EMAIL_SUFFIXES,
} from "../../src/lib/studentEmailDomain.js";

import {
  emailHost,
  hostMatchesDomain,
  SRI_LANKA_UNIVERSITIES,
  mergeUniversityOptions,
} from "../../src/lib/universities.js";

import { asHttpUrl } from "../../src/lib/httpUrl.js";

import {
  buildOfferLabel,
  parseOfferLabel,
  validateOfferValue,
  validateSchedule,
  isOfferValueRequired,
} from "../../src/lib/dealOffer.js";

import {
  OFFICIAL_CATEGORIES,
  CATEGORY_META,
  CATEGORY_DESCRIPTIONS,
  OLD_TO_NEW_CATEGORY,
  normalizeCategory,
} from "../../src/lib/categories.js";

import {
  extractDealEmbedIds,
  splitBlogContent,
} from "../../src/lib/blogContent.js";

import {
  slugify,
  categoryHubPath,
  brandHubPath,
  resolveBrandExplorePath,
} from "../../src/lib/seo.js";

import {
  isComingSoonDeal,
  isExpiredDeal,
  isFinishedDeal,
  getDealComputedStatus,
  isFinishedEvent,
} from "../../src/lib/comingSoon.js";

import { formatVerificationRejectReason } from "../../src/lib/verificationRejectReasons.js";
import { formatScannedCode } from "../../src/lib/scannedPayload.js";

test("Password Policy Unit Tests", async (t) => {
  await t.test("validatePasswordStrength: length and composition checks", () => {
    assert.equal(validatePasswordStrength("Short1!"), "Password must be at least 8 characters.");
    assert.equal(
      validatePasswordStrength("a".repeat(73) + "A1"),
      "Password must be 72 characters or fewer."
    );
    assert.equal(
      validatePasswordStrength("lowercaseonly123"),
      "Password must include both uppercase and lowercase letters."
    );
    assert.equal(
      validatePasswordStrength("UPPERCASEONLY123"),
      "Password must include both uppercase and lowercase letters."
    );
    assert.equal(
      validatePasswordStrength("NoNumberPassword"),
      "Password must include at least one number."
    );
    assert.equal(validatePasswordStrength("ValidPassword1"), null);
    assert.equal(validatePasswordStrength("StrongP@ssw0rd!#2026"), null);
  });

  await t.test("isExistingAccountSignup: error codes and message detections", () => {
    assert.equal(isExistingAccountSignup({ code: "user_already_exists" }), true);
    assert.equal(isExistingAccountSignup({ code: "email_exists" }), true);
    assert.equal(
      isExistingAccountSignup({ message: "User is already registered" }),
      true
    );
    assert.equal(
      isExistingAccountSignup({ message: "An account already exists" }),
      true
    );
    // GoTrue empty identities array check
    assert.equal(
      isExistingAccountSignup(null, { user: { identities: [] } }),
      true
    );
    // Unconfirmed resend check (created_at older than request start)
    const now = Date.now();
    assert.equal(
      isExistingAccountSignup(
        null,
        { user: { created_at: new Date(now - 10000).toISOString(), identities: [{}] } },
        now
      ),
      true
    );
    // Fresh new signup
    assert.equal(
      isExistingAccountSignup(
        null,
        { user: { created_at: new Date(now).toISOString(), identities: [{}] } },
        now
      ),
      false
    );
  });

  await t.test("describeAuthFailure: status code mapping", () => {
    assert.match(
      describeAuthFailure({ status: 500 }, "default"),
      /couldn't reach the server/i
    );
    assert.match(
      describeAuthFailure({ status: 429 }, "default"),
      /too many attempts/i
    );
    assert.equal(describeAuthFailure({ status: 400 }, "Custom error"), "Custom error");
  });
});

test("Student Email Domain & Universities Unit Tests", async (t) => {
  await t.test("emailHost and emailDomain parsing", () => {
    assert.equal(emailHost("student@cmb.ac.lk"), "cmb.ac.lk");
    assert.equal(emailHost("USER@SLIIT.LK "), "sliit.lk");
    assert.equal(emailHost("invalid-email"), "");
    assert.equal(emailHost(null), "");
  });

  await t.test("hostMatchesDomain & hostMatchesSuffix", () => {
    assert.equal(hostMatchesDomain("mail.pdn.ac.lk", "pdn.ac.lk"), true);
    assert.equal(hostMatchesDomain("pdn.ac.lk", "pdn.ac.lk"), true);
    assert.equal(hostMatchesDomain("fakepdn.ac.lk", "pdn.ac.lk"), false);
    assert.equal(hostMatchesSuffix("eng.sliit.lk", ".sliit.lk"), true);
    assert.equal(hostMatchesSuffix("sliit.lk", "sliit.lk"), true);
  });

  await t.test("isAllowedStudentEmail: universal suffixes and catalog universities", () => {
    // Universal suffixes (.ac.lk, .edu.lk, .sliit.lk, .edu, .edu.au, .ac.uk)
    assert.equal(isAllowedStudentEmail("john@kln.ac.lk"), true);
    assert.equal(isAllowedStudentEmail("student@mit.edu"), true);
    assert.equal(isAllowedStudentEmail("jane@unimelb.edu.au"), true);
    assert.equal(isAllowedStudentEmail("student@oxford.ac.uk"), true);
    assert.equal(isAllowedStudentEmail("it@my.sliit.lk"), true);
    assert.equal(isAllowedStudentEmail("student@cinec.edu"), true);

    // Non-student public domains
    assert.equal(isAllowedStudentEmail("scammer@gmail.com"), false);
    assert.equal(isAllowedStudentEmail("user@yahoo.com"), false);
    assert.equal(isAllowedStudentEmail("contact@unideals.co"), false);

    // Extra dynamic allowed domains
    assert.equal(
      isAllowedStudentEmail("student@custom-college.com", ["custom-college.com"]),
      true
    );
  });

  await t.test("mergeUniversityOptions: integrity and deduping", () => {
    const dbRows = [
      { institution_name: "University of Colombo", domain: "cmb.ac.lk" },
      { institution_name: "Custom Institute", domain: "custom.lk" },
    ];
    const merged = mergeUniversityOptions(dbRows);
    assert.ok(merged.length >= SRI_LANKA_UNIVERSITIES.length);
    const custom = merged.find((u) => u.name === "Custom Institute");
    assert.ok(custom);
    assert.ok(custom.domains.includes("custom.lk"));
  });
});

test("Safe HTTP URL Unit Tests", async (t) => {
  await t.test("asHttpUrl: protocol filtering and validation", () => {
    assert.equal(asHttpUrl("https://example.com"), "https://example.com/");
    assert.equal(asHttpUrl("http://localhost:3000/deal"), "http://localhost:3000/deal");
    assert.equal(asHttpUrl("https://unideals.co/terms?ref=promo"), "https://unideals.co/terms?ref=promo");

    // XSS / Malicious protocols blocked
    assert.equal(asHttpUrl("javascript:alert(1)"), null);
    assert.equal(asHttpUrl("data:text/html,<script>alert(1)</script>"), null);
    assert.equal(asHttpUrl("file:///etc/passwd"), null);
    assert.equal(asHttpUrl("ftp://ftp.example.com"), null);
    assert.equal(asHttpUrl(""), null);
    assert.equal(asHttpUrl("   "), null);
    assert.equal(asHttpUrl(null), null);
    assert.equal(asHttpUrl(undefined), null);
    assert.equal(asHttpUrl(12345), null);
  });
});

test("Deal Offer Logic Unit Tests", async (t) => {
  await t.test("buildOfferLabel: formatting various offer types", () => {
    assert.equal(buildOfferLabel("percentage_off", "20"), "20% OFF");
    assert.equal(buildOfferLabel("percentage_off", "25%"), "25% OFF");
    assert.equal(buildOfferLabel("flat_amount_off", "Rs. 500"), "Rs. 500 OFF");
    assert.equal(buildOfferLabel("bogo", ""), "BUY 1 GET 1");
    assert.equal(buildOfferLabel("free_trial", "1 Month"), "FREE 1 Month");
    assert.equal(buildOfferLabel("free_item", "Beverage"), "FREE Beverage");
    assert.equal(buildOfferLabel("custom", "Special Uni Bundle"), "Special Uni Bundle");
  });

  await t.test("parseOfferLabel: reverse parsing known labels", () => {
    assert.deepEqual(parseOfferLabel("15% OFF"), { offerType: "percentage_off", offerValue: "15" });
    assert.deepEqual(parseOfferLabel("BUY 1 GET 1"), { offerType: "bogo", offerValue: "" });
    assert.deepEqual(parseOfferLabel("BOGO"), { offerType: "bogo", offerValue: "" });
    assert.deepEqual(parseOfferLabel("FREE 30-Day Trial"), { offerType: "free_trial", offerValue: "30-Day Trial" });
    assert.deepEqual(parseOfferLabel("FREE Drink"), { offerType: "free_item", offerValue: "Drink" });
    assert.deepEqual(parseOfferLabel("Rs. 1000 OFF"), { offerType: "flat_amount_off", offerValue: "Rs. 1000" });
    assert.deepEqual(parseOfferLabel("Combo Discount"), { offerType: "custom", offerValue: "Combo Discount" });
  });

  await t.test("validateOfferValue: range & number validations", () => {
    assert.equal(validateOfferValue("bogo", ""), "");
    assert.equal(validateOfferValue("percentage_off", "0"), "Percent off must be between 1 and 100.");
    assert.equal(validateOfferValue("percentage_off", "101"), "Percent off must be between 1 and 100.");
    assert.equal(validateOfferValue("percentage_off", "-5"), "Percent off must be between 1 and 100.");
    assert.equal(validateOfferValue("percentage_off", "20"), "");
    assert.equal(validateOfferValue("flat_amount_off", "0"), "Flat amount off must be greater than 0.");
    assert.equal(validateOfferValue("flat_amount_off", "-10"), "Flat amount off must be greater than 0.");
    assert.equal(validateOfferValue("flat_amount_off", "abc"), "Flat amount off must be greater than 0.");
    assert.equal(validateOfferValue("flat_amount_off", "500"), "");
    assert.equal(validateOfferValue("custom", ""), "Please enter an offer value.");
  });

  await t.test("validateSchedule: start/end temporal ordering", () => {
    assert.equal(
      validateSchedule("2026-10-01", "2026-09-01"),
      "End date must be on or after the start date."
    );
    assert.equal(validateSchedule("2026-09-01", "2026-10-01"), "");
    assert.equal(validateSchedule("invalid-date", "2026-10-01"), "Invalid start date.");
    assert.equal(validateSchedule("2026-09-01", "invalid-date"), "Invalid end date.");
    // End date in the past when no start date given
    assert.equal(validateSchedule(null, "2020-01-01"), "End date must be in the future.");
  });
});

test("Taxonomy & Categories Unit Tests", async (t) => {
  await t.test("All official categories have metadata and descriptions", () => {
    assert.equal(OFFICIAL_CATEGORIES.length, 10);
    for (const cat of OFFICIAL_CATEGORIES) {
      assert.ok(CATEGORY_META[cat], `Missing metadata for category: ${cat}`);
      assert.ok(CATEGORY_META[cat].icon, `Missing icon for category: ${cat}`);
      assert.ok(CATEGORY_META[cat].color, `Missing color for category: ${cat}`);
      assert.ok(CATEGORY_DESCRIPTIONS[cat], `Missing description for category: ${cat}`);
    }
  });

  await t.test("Old categories map to valid official categories", () => {
    for (const [oldCat, newCat] of Object.entries(OLD_TO_NEW_CATEGORY)) {
      assert.ok(
        OFFICIAL_CATEGORIES.includes(newCat),
        `Old category '${oldCat}' maps to '${newCat}' which is not in OFFICIAL_CATEGORIES`
      );
    }
  });

  await t.test("normalizeCategory handles variants, official categories, and fallbacks", () => {
    assert.equal(normalizeCategory("Fashion"), "Fashion");
    assert.equal(normalizeCategory("Fashion & Apparel"), "Fashion");
    assert.equal(normalizeCategory("Health & Beauty"), "Beauty & Care");
    assert.equal(normalizeCategory("Food and Drink"), "Food & Drink");
    assert.equal(normalizeCategory("Tech"), "Tech & Mobile");
    assert.equal(normalizeCategory("Coffee"), "Food & Drink");
    assert.equal(normalizeCategory("Custom Category"), "Custom Category");
    assert.equal(normalizeCategory(""), "");
    assert.equal(normalizeCategory(null), "");
    assert.equal(normalizeCategory(undefined), "");
  });
});

test("Blog Content Embed Parsing Unit Tests", async (t) => {
  await t.test("extractDealEmbedIds: correctly finds and deduplicates deal tokens", () => {
    const markdown = `
# Student Guide
Check this out: [deal:10] and also [deal:42].
Repeat [deal:10] should not duplicate.
Broken token [deal:abc] should be ignored.
    `;
    const ids = extractDealEmbedIds(markdown);
    assert.deepEqual(ids, [10, 42]);
  });

  await t.test("splitBlogContent: partitions markdown and deal tokens in order", () => {
    const text = "Introduction text\n\n[deal:15]\n\nConclusion text";
    const parts = splitBlogContent(text);
    assert.equal(parts.length, 3);
    assert.equal(parts[0].type, "markdown");
    assert.equal(parts[1].type, "deal");
    assert.equal(parts[1].id, 15);
    assert.equal(parts[2].type, "markdown");
  });
});

test("SEO & Slugs Unit Tests", async (t) => {
  await t.test("slugify: cleans, lowercases, and formats strings safely", () => {
    assert.equal(slugify("Tech & Mobile"), "tech-mobile");
    assert.equal(slugify("Domino's Pizza"), "domino-s-pizza");
    assert.equal(slugify("  Spaces & Special !? Characters-- "), "spaces-special-characters");
    assert.equal(slugify(""), "");
    assert.equal(slugify(null), "");
  });

  await t.test("categoryHubPath and brandHubPath", () => {
    assert.equal(categoryHubPath("Food & Drink"), "/category/food-drink");
    assert.equal(categoryHubPath(""), "/categories");
    assert.equal(brandHubPath("KFC Sri Lanka"), "/brand/kfc-sri-lanka");
    assert.equal(brandHubPath(null), "/brands");
  });

  await t.test("resolveBrandExplorePath: exact, prefix, substring, or query", () => {
    const brands = ["Apple", "Apparel Co", "Samsung", "Nike"];
    assert.equal(resolveBrandExplorePath("", brands), "/brands");
    assert.equal(resolveBrandExplorePath("Apple", brands), "/brand/apple");
    assert.equal(resolveBrandExplorePath("apparel", brands), "/brand/apparel-co");
    assert.equal(resolveBrandExplorePath("sam", brands), "/brand/samsung");
    assert.equal(resolveBrandExplorePath("nonexistent", brands), "/brands?q=nonexistent");
  });
});

test("Coming Soon & Expiration Timing Unit Tests", async (t) => {
  await t.test("isComingSoonDeal: future start detection", () => {
    const futureDeal = { startTime: new Date(Date.now() + 86400000).toISOString() };
    const pastDeal = { startTime: new Date(Date.now() - 86400000).toISOString() };
    assert.equal(isComingSoonDeal(futureDeal), true);
    assert.equal(isComingSoonDeal(pastDeal), false);
    assert.equal(isComingSoonDeal(null), false);
  });

  await t.test("isExpiredDeal and isFinishedDeal", () => {
    const expiredDeal = { endTime: new Date(Date.now() - 86400000).toISOString() };
    const liveDeal = { endTime: new Date(Date.now() + 86400000).toISOString() };
    const pausedDeal = { status: "paused", endTime: new Date(Date.now() - 86400000).toISOString() };

    assert.equal(isExpiredDeal(expiredDeal), true);
    assert.equal(isExpiredDeal(liveDeal), false);
    assert.equal(isFinishedDeal(expiredDeal), true);
    assert.equal(isFinishedDeal(pausedDeal), false); // Paused deals stay paused
  });

  await t.test("getDealComputedStatus: state machine resolution", () => {
    const now = new Date();
    assert.equal(getDealComputedStatus({ status: "paused" }, now), "paused");
    assert.equal(
      getDealComputedStatus({ status: "active", endTime: new Date(now.getTime() - 1000).toISOString() }, now),
      "finished"
    );
    assert.equal(
      getDealComputedStatus({ status: "active", startTime: new Date(now.getTime() + 100000).toISOString() }, now),
      "scheduled"
    );
    assert.equal(
      getDealComputedStatus({ status: "active", startTime: new Date(now.getTime() - 100000).toISOString() }, now),
      "active"
    );
  });

  await t.test("isFinishedEvent: 24h fallback and explicit end_time", () => {
    const now = new Date();
    // Event that started 25 hours ago without end_time is finished
    const oldEvent = { start_time: new Date(now.getTime() - 25 * 3600 * 1000).toISOString() };
    assert.equal(isFinishedEvent(oldEvent, now), true);

    // Event that started 2 hours ago is not finished
    const currentEvent = { start_time: new Date(now.getTime() - 2 * 3600 * 1000).toISOString() };
    assert.equal(isFinishedEvent(currentEvent, now), false);
  });
});

test("Verification Reject Reasons Unit Tests", async (t) => {
  await t.test("formatVerificationRejectReason formatting", () => {
    assert.equal(
      formatVerificationRejectReason("unreadable", "Corners cut off"),
      "Unreadable ID: Corners cut off"
    );
    assert.equal(
      formatVerificationRejectReason("unreadable", ""),
      "Unreadable ID"
    );
    assert.equal(
      formatVerificationRejectReason("other", "Expired student ID card"),
      "Expired student ID card"
    );
    assert.equal(
      formatVerificationRejectReason("other", ""),
      "Other"
    );
  });
});

test("Scanned Code Payload Formatting Unit Tests", async (t) => {
  await t.test("formatScannedCode parses and strips unideals protocol prefixes", () => {
    assert.equal(formatScannedCode("unideals://ticket/A7X9K2"), "A7X9K2");
    assert.equal(formatScannedCode("UNIDEALS://TICKET/B3W1P0"), "B3W1P0");
    assert.equal(
      formatScannedCode("unideals://student/8be55b01-1234-5678-9abc-def012345678"),
      "Student Pass (8be55b01…)"
    );
    assert.equal(formatScannedCode("PLAIN-COUPON-CODE"), "PLAIN-COUPON-CODE");
    assert.equal(formatScannedCode(""), "—");
    assert.equal(formatScannedCode(null), "—");
  });
});
