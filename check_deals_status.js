// Quick diagnostic: check all deals in the database
// Loads keys from .env.local — never hardcode secrets in this file.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envFile = fs.readFileSync(".env.local", "utf8");
let supabaseUrl = "";
let supabaseAnonKey = "";

envFile.split("\n").forEach((line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return;
  if (trimmed.startsWith("VITE_SUPABASE_URL=")) {
    supabaseUrl = trimmed.slice("VITE_SUPABASE_URL=".length).trim();
  }
  if (trimmed.startsWith("VITE_SUPABASE_ANON_KEY=")) {
    supabaseAnonKey = trimmed.slice("VITE_SUPABASE_ANON_KEY=".length).trim();
  }
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 1. Check what get_public_deals returns (should be only approved)
const { data: publicDeals, error: rpcErr } = await supabase.rpc("get_public_deals");
console.log("=== get_public_deals() RPC ===");
console.log("Count:", publicDeals?.length ?? 0);
if (rpcErr) console.log("Error:", rpcErr.message);
if (publicDeals?.length) console.log("Deals:", JSON.stringify(publicDeals, null, 2));

// 2. Try direct table read (will be blocked by RLS for anon, but let's confirm)
const { data: directDeals, error: directErr } = await supabase
  .from("deals")
  .select("id, title, brand, status, brand_id")
  .limit(20);
console.log("\n=== Direct deals table read (anon) ===");
console.log("Count:", directDeals?.length ?? 0);
if (directErr) console.log("Error:", directErr.message);
if (directDeals?.length) console.log("Deals:", JSON.stringify(directDeals, null, 2));

// 3. Check if there's any deal at all by trying deal ID 1
const { data: singleDeal, error: singleErr } = await supabase.rpc(
  "get_public_deal_by_id",
  { target_deal_id: 1 },
);
console.log("\n=== get_public_deal_by_id(1) ===");
console.log("Result:", JSON.stringify(singleDeal));
if (singleErr) console.log("Error:", singleErr.message);

// 4. Check latest deals by trying higher IDs
for (const id of [1, 2, 3, 10, 50, 100]) {
  const { data } = await supabase.rpc("get_public_deal_by_id", {
    target_deal_id: id,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (row) console.log(`  Deal ${id}:`, row.title, "- status: visible (approved)");
}

console.log("\n=== DIAGNOSIS ===");
if ((publicDeals?.length ?? 0) === 0) {
  console.log(
    '❌ No approved deals exist. ALL deals in the DB are likely "pending" or "rejected".',
  );
  console.log("   FIX: Run this in Supabase SQL Editor:");
  console.log(
    "   UPDATE public.deals SET status = 'approved' WHERE status = 'pending';",
  );
} else {
  console.log("✅ Deals exist and are visible");
}
