import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BOT_UA_REGEX } from "../../middleware.js";
import handler, {
  UUID_REGEX,
  isFinishedEvent,
  isComingSoonEvent,
  notFoundHtml,
} from "../../api/event-og-proxy.js";

// Load environment variables from .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf-8");
    for (const line of envConfig.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    }
  }
} catch {
  // Ignored
}

describe("Middleware BOT User-Agent Allowlist Tests", () => {
  const BOT_USER_AGENTS = [
    { name: "Googlebot", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
    { name: "Bingbot", ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" },
    { name: "Applebot", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)" },
    { name: "DuckDuckBot", ua: "DuckDuckBot/1.0; (+http://duckduckgo.com/duckduckbot.html)" },
    { name: "Yandex", ua: "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)" },
    { name: "Baiduspider", ua: "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)" },
    { name: "GPTBot", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)" },
    { name: "ChatGPT-User", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)" },
    { name: "ClaudeBot", ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" },
    { name: "Anthropic", ua: "anthropic-ai" },
    { name: "PerplexityBot", ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
    { name: "ByteSpider", ua: "Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)" },
    { name: "Facebookexternalhit", ua: "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
    { name: "Twitterbot", ua: "Twitterbot/1.0" },
    { name: "LinkedInBot", ua: "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)" },
    { name: "Slackbot", ua: "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" },
    { name: "WhatsApp", ua: "WhatsApp/2.21.12.21 A" },
    { name: "TelegramBot", ua: "TelegramBot (like TwitterBot)" },
    { name: "Discordbot", ua: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)" },
    { name: "SkypeUriPreview", ua: "Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5" },
    { name: "Pinterest", ua: "Pinterest/0.2 (+http://www.pinterest.com/bot.html)" },
    { name: "vkShare", ua: "vkShare" },
    { name: "W3C_Validator", ua: "W3C_Validator/1.3" },
    { name: "atproto", ua: "atproto/1.0" },
  ];

  for (const bot of BOT_USER_AGENTS) {
    it(`correctly matches bot crawler: ${bot.name}`, () => {
      assert.equal(BOT_UA_REGEX.test(bot.ua), true, `Expected ${bot.name} to match BOT_UA_REGEX`);
    });
  }

  const HUMAN_USER_AGENTS = [
    { name: "Chrome Desktop", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36" },
    { name: "Chrome Mobile", ua: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36" },
    { name: "Safari Desktop", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15" },
    { name: "Safari Mobile iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" },
    { name: "Firefox Desktop", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0" },
    { name: "Edge Desktop", ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0" },
  ];

  for (const human of HUMAN_USER_AGENTS) {
    it(`never falsely matches human browser: ${human.name}`, () => {
      assert.equal(BOT_UA_REGEX.test(human.ua), false, `Expected ${human.name} to NOT match BOT_UA_REGEX`);
    });
  }
});

describe("Event UUID Validation Tests", () => {
  it("accepts valid UUID v4 formats", () => {
    assert.equal(UUID_REGEX.test("ec22d6c7-39b3-4f9c-9c6c-25226bd989eb"), true);
    assert.equal(UUID_REGEX.test("EC22D6C7-39B3-4F9C-9C6C-25226BD989EB"), true);
    assert.equal(UUID_REGEX.test("00000000-0000-0000-0000-000000000000"), true);
  });

  it("rejects non-UUID formats and invalid IDs", () => {
    assert.equal(UUID_REGEX.test("99999999"), false);
    assert.equal(UUID_REGEX.test("not-a-uuid"), false);
    assert.equal(UUID_REGEX.test(""), false);
    assert.equal(UUID_REGEX.test("ec22d6c7-39b3-4f9c-9c6c"), false);
    assert.equal(UUID_REGEX.test("../../etc/passwd"), false);
    assert.equal(UUID_REGEX.test("ec22d6c7-39b3-4f9c-9c6c-25226bd989eb-extra"), false);
  });
});

describe("Event Timing & Lifecycle Logic Tests", () => {
  const referenceTime = new Date("2026-09-05T12:00:00.000Z");

  it("marks active events with future end_time as not finished", () => {
    const liveEvent = {
      start_time: "2026-09-05T09:00:00.000Z",
      end_time: "2026-09-06T01:00:00.000Z",
    };
    assert.equal(isFinishedEvent(liveEvent, referenceTime), false);
  });

  it("marks past events with end_time in the past as finished", () => {
    const finishedEvent = {
      start_time: "2026-09-04T09:00:00.000Z",
      end_time: "2026-09-04T22:00:00.000Z",
    };
    assert.equal(isFinishedEvent(finishedEvent, referenceTime), true);
  });

  it("uses 24h fallback when end_time is omitted", () => {
    const recentNoEnd = {
      start_time: "2026-09-05T01:00:00.000Z",
      end_time: null,
    };
    assert.equal(isFinishedEvent(recentNoEnd, referenceTime), false);

    const oldNoEnd = {
      start_time: "2026-09-03T01:00:00.000Z",
      end_time: null,
    };
    assert.equal(isFinishedEvent(oldNoEnd, referenceTime), true);
  });

  it("treats coming soon events as never finished", () => {
    const comingSoon = {
      publish_at: "2026-09-10T00:00:00.000Z",
      start_time: "2026-08-01T00:00:00.000Z",
      end_time: "2026-08-02T00:00:00.000Z",
    };
    assert.equal(isComingSoonEvent(comingSoon), true);
    assert.equal(isFinishedEvent(comingSoon, referenceTime), false);
  });

  it("handles empty or missing event objects safely", () => {
    assert.equal(isFinishedEvent(null), false);
    assert.equal(isFinishedEvent(undefined), false);
    assert.equal(isFinishedEvent({}), false);
  });
});

describe("Event OG Proxy Handler End-to-End Simulation", () => {
  function createMockResponse() {
    return {
      statusCode: 200,
      headers: {},
      body: "",
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(key, val) {
        this.headers[key] = val;
        return this;
      },
      send(payload) {
        this.body = payload;
        return this;
      },
    };
  }

  it("returns HTTP 404 with noindex for invalid non-UUID string", async () => {
    const res = createMockResponse();
    await handler({ query: { id: "not-a-uuid" } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.match(res.body, /Event Not Found/);
  });

  it("returns HTTP 404 with noindex for numeric non-UUID string", async () => {
    const res = createMockResponse();
    await handler({ query: { id: "99999999" } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body, /<meta name="robots" content="noindex, nofollow" \/>/);
    assert.match(res.body, /Event Not Found/);
  });

  it("returns HTTP 404 with noindex for non-existent UUID (never 500)", async () => {
    const res = createMockResponse();
    await handler({ query: { id: "00000000-0000-0000-0000-000000000000" } }, res);
    assert.equal(res.statusCode, 404);
    assert.match(res.body, /<meta name="robots" content="noindex, nofollow" \/>/);
  });

  it("returns HTTP 200 with schema.org Event JSON-LD for live Beheth 2026 event", async () => {
    const res = createMockResponse();
    await handler({ query: { id: "ec22d6c7-39b3-4f9c-9c6c-25226bd989eb" } }, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body, /https:\/\/schema\.org/);
    assert.match(res.body, /"@type":"Event"/);
    assert.match(res.body, /Beheth 2026/);
    assert.match(res.body, /Lotus Tower/);
    assert.match(res.body, /https:\/\/www\.unideals\.co\/events\/ec22d6c7-39b3-4f9c-9c6c-25226bd989eb/);
  });
});
