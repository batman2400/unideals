import { describe, it } from "node:test";
import assert from "node:assert/strict";
import handler from "../../api/sitemap.js";

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

describe("sitemap static routes", () => {
  it("lists /perks and /become-partner", async () => {
    const previousUrl = process.env.VITE_SUPABASE_URL;
    const previousKey = process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;

    try {
      const res = createMockResponse();
      await handler({}, res);
      assert.equal(res.statusCode, 200);
      assert.match(res.body, /<loc>https:\/\/www\.unideals\.co\/perks<\/loc>/);
      assert.match(
        res.body,
        /<loc>https:\/\/www\.unideals\.co\/become-partner<\/loc>/,
      );
    } finally {
      if (previousUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = previousUrl;
      if (previousKey === undefined) delete process.env.VITE_SUPABASE_ANON_KEY;
      else process.env.VITE_SUPABASE_ANON_KEY = previousKey;
    }
  });
});
