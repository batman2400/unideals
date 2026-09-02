/**
 * Shared category taxonomy — single source of truth for the Categories
 * page (/categories) and the dedicated per-category landing pages
 * (/category/:categoryId), so both stay in sync and slugs never drift.
 */

// Official V1 category taxonomy
export const OFFICIAL_CATEGORIES = [
  "Fashion",
  "Food & Drink",
  "Tech & Mobile",
  "Beauty & Care",
  "Learning",
  "Travel & Auto",
  "Health & Fitness",
  "Household",
  "Finance",
  "Events & Tickets",
];

// Category metadata — icon + colour accent for each section header
export const CATEGORY_META = {
  Fashion: { icon: "checkroom", color: "text-pink-500" },
  "Food & Drink": { icon: "restaurant", color: "text-amber-600" },
  "Tech & Mobile": { icon: "smartphone", color: "text-blue-500" },
  "Beauty & Care": { icon: "spa", color: "text-rose-400" },
  Learning: { icon: "school", color: "text-indigo-500" },
  "Travel & Auto": { icon: "flight", color: "text-sky-500" },
  "Health & Fitness": { icon: "fitness_center", color: "text-orange-500" },
  Household: { icon: "home", color: "text-teal-500" },
  Finance: { icon: "account_balance", color: "text-emerald-500" },
  "Events & Tickets": { icon: "confirmation_number", color: "text-purple-500" },
};

// Short, keyword-rich blurbs used as the meta description / intro copy for
// each category's dedicated landing page.
export const CATEGORY_DESCRIPTIONS = {
  Fashion:
    "Student discounts on clothing, shoes, and accessories from top fashion brands in Sri Lanka.",
  "Food & Drink":
    "Cheap eats, cafe deals, and restaurant discounts for university students across Sri Lanka.",
  "Tech & Mobile":
    "Student pricing on laptops, phones, accessories, and software in Sri Lanka.",
  "Beauty & Care":
    "Student discounts on skincare, haircare, and beauty essentials in Sri Lanka.",
  Learning:
    "Discounted courses, books, stationery, and learning tools for Sri Lankan students.",
  "Travel & Auto":
    "Student discounts on flights, transport, and auto services in Sri Lanka.",
  "Health & Fitness":
    "Gym memberships, wellness, and fitness discounts for verified university students.",
  Household:
    "Student discounts on home essentials and household goods in Sri Lanka.",
  Finance:
    "Student banking perks, financial tools, and money offers in Sri Lanka.",
  "Events & Tickets":
    "Discounted tickets and student offers for events and entertainment in Sri Lanka.",
};

// Migration map: old placeholder categories & brand category variants → new V1 names
export const OLD_TO_NEW_CATEGORY = {
  Tech: "Tech & Mobile",
  Coffee: "Food & Drink",
  Clothing: "Fashion",
  Fitness: "Health & Fitness",
  Home: "Household",
  Creative: "Learning",
  "Fashion & Apparel": "Fashion",
  "Health & Beauty": "Beauty & Care",
  "Food and Drink": "Food & Drink",
  "Food & Beverage": "Food & Drink",
  Beauty: "Beauty & Care",
  Health: "Health & Fitness",
  Travel: "Travel & Auto",
  Events: "Events & Tickets",
};

/**
 * Normalizes a raw brand or deal category name to a canonical taxonomy category if matched.
 */
export function normalizeCategory(category) {
  if (!category || typeof category !== "string") return "";
  const trimmed = category.trim();
  return OLD_TO_NEW_CATEGORY[trimmed] || trimmed;
}

