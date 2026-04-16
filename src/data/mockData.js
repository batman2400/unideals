/**
 * mockData.js — Centralized Deal Data
 *
 * All deal objects live here so every page and component
 * can import from one place. No more duplicated arrays!
 *
 * Fields:
 *   id        – unique number
 *   title     – brand / deal name
 *   brand     – parent brand
 *   discount  – display string ("20% OFF", "FREE MONTH", etc.)
 *   type      – "Online" or "In-Store"
 *   category  – one of: Tech, Coffee, Clothing, Fitness, Home, Creative
 *   imageUrl  – product image
 *   description – short blurb
 */

const deals = [
  {
    id: 1,
    title: "TechNova Pro",
    brand: "TechNova",
    discount: "20% OFF",
    type: "Online",
    category: "Tech",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCdG-2Jqc1sFEzIzRESXx8K8BItiMhQ7Fe3m2AwiW40ScLzJS5LQ56bEj7jshQCDva9eMVA3JrRls31IJeWBNFPDgcG34uqhvhI22s9ESRnEM9Sj4PrzhV6bT4iYZ_fNn89yaKc9JQ7vEujYUUEPKsmArVBU2fOiY7723xXXQqv1mafUPMNq6AEmiayO1B7SUoBrZ36-V_W_E9mrI_8zAN37_jT-EjpmU0mpdudzYqAiGr_HJIpgtCCHHK492hiHpyw442eXsFueEc",
    description:
      "Save on the latest generation of flagship devices and professional creative software.",
  },
  {
    id: 2,
    title: "Brew & Co.",
    brand: "Brew & Co.",
    discount: "15% OFF",
    type: "In-Store",
    category: "Coffee",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDvOrc_ZGFRba9R0_nKoRINZ5tRxNmW-4lIEr_V0GN6gXTnSu7DWgW5rQ4_n0v7d2cmf-H5R-SgaRn5RmvjhFlwbLM5UaZiogKwcUmnk3G4V6a27DcVlGWQMnbwd1mKvUY-y6DAVR9gpxHs9OYCv1EgUKpslQDiRzFMn1Ou0XmJN5NL88ScH4IYQmD-qmZzIgsGr-8rFCDl-9fqQMueV77q82InBqAHqrDWYRIdNQShFMx54sbJnELdQf2gvbkpzZ0HES91UohXj2A",
    description:
      "Daily caffeine essentials with exclusive membership pricing at all urban locations.",
  },
  {
    id: 3,
    title: "Essence Wear",
    brand: "Essence Wear",
    discount: "25% OFF",
    type: "Online",
    category: "Clothing",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCzOvLNPgk03USFCKNu-GSzr9_dG9Cm3IPn04us2RsA5WNrpv7kXluz1pKVGDoWg25RiLBQB1fB29I5ZtSSxP-VRZO9pTj4_i7YzmJQGsB5rWtNPQYfBMSpYn8ecO1qkcOImTsFwhBvI9d_zwBCanWoMsWcoGglkPVREOwhsLl4333y_W6F-aBfjPfU0jhgJf8o-43sazueipq-nYtKuUCo56Hh3oQ1uWZJ6v_XJep8TPKq9lSRlBs9a7UD7DDWezf0kbdke4zHLvA",
    description:
      "Elevate your campus style with sustainable basics and premium seasonal collections.",
  },
  {
    id: 4,
    title: "Nexus Fitness",
    brand: "Nexus Fitness",
    discount: "FREE MONTH",
    type: "In-Store",
    category: "Fitness",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBlQ36ohtoAh9iCNqXOhzdY_i9C66nAuwPjEoY7ATPU7F6ORrkJ9RNozLPw-UlMH_AQ6347sUVdnofSpsAPDPcEDTbHI8kJ-sDd4U4-FL7KtVn0Vid0AKYeDKMnI3_zrZVee7dE003pYw1DkC4gX1Zu8gPPZpyP8zuwQXr8nMXfnT_uQQ8dElkjTXuO7k0Qc_YLrFAX7Ad1UFcbhm5fe5ZOEXLXSjyn2WLYkVCVBMx6LLOVrjorS4brUS3XyKYwP0blJjuevpgSx-Q",
    description:
      "Achieve your peak performance with all-access passes to state-of-the-art facilities.",
  },
  {
    id: 5,
    title: "Habitat Home",
    brand: "Habitat Home",
    discount: "10% OFF",
    type: "Online",
    category: "Home",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAZJkcufRYEZVBJQHpPPMMFRRa666JoWSP--59sPJn-M8ZQeeSSxdKIwlVoClxOXzXBkbWLnBjnSTeu3ZbVd9bwUZrllroLwKliU1H0NZAdsUaTJRWnKE0OtKjq0C6PLsuEeBBaxYg1twgDiskLcyPcjOZjP3IRopDylKF6eRD0uLoKbXdzTR630xOd9-btXTE0Odtm79tP7Gb7goFCqRbK7VMJG-8OxL_V4-SNH5DS_OliUk6NEnRVxzgpXA350ggKALFQL5WQOkg",
    description:
      "Modernize your living space with curated furniture and functional decor designed for students.",
  },
  {
    id: 6,
    title: "Creative Cloud",
    brand: "Creative Cloud",
    discount: "60% OFF",
    type: "Online",
    category: "Creative",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBzrewh7Yaxx08JPFCRJjYZ5K9cxEFPyolBeyW8OBhUSI5x-xOOAo9x0RG4oPhNqX8GgKbLiBOnF8dV7M27keE7jCT7Gb1rS3VfkKgVPcA3bj7ZWZ3XPQHy8gFkElPs9lQq95eBonjtM0EUVHkz_SZ7cLVwqn5-H3WSDGf4Eu4kuHf9SpzmdT3GSnV97tcJJYYI6u83KKtolla22Lx0IuvDu7I4gP9ja9hrdmhbGjftDHpBwa_SQX_2k7rNKhnHjcUK9QIMLab3iMs",
    description:
      "Full suite of professional tools for photography, design, video, and UI/UX projects.",
  },
  {
    id: 7,
    title: "ByteBooks",
    brand: "ByteBooks",
    discount: "30% OFF",
    type: "Online",
    category: "Tech",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCdG-2Jqc1sFEzIzRESXx8K8BItiMhQ7Fe3m2AwiW40ScLzJS5LQ56bEj7jshQCDva9eMVA3JrRls31IJeWBNFPDgcG34uqhvhI22s9ESRnEM9Sj4PrzhV6bT4iYZ_fNn89yaKc9JQ7vEujYUUEPKsmArVBU2fOiY7723xXXQqv1mafUPMNq6AEmiayO1B7SUoBrZ36-V_W_E9mrI_8zAN37_jT-EjpmU0mpdudzYqAiGr_HJIpgtCCHHK492hiHpyw442eXsFueEc",
    description:
      "Premium laptops and accessories built for students who code, design, and create.",
  },
  {
    id: 8,
    title: "Grind House",
    brand: "Grind House",
    discount: "Buy 1 Get 1",
    type: "In-Store",
    category: "Coffee",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDvOrc_ZGFRba9R0_nKoRINZ5tRxNmW-4lIEr_V0GN6gXTnSu7DWgW5rQ4_n0v7d2cmf-H5R-SgaRn5RmvjhFlwbLM5UaZiogKwcUmnk3G4V6a27DcVlGWQMnbwd1mKvUY-y6DAVR9gpxHs9OYCv1EgUKpslQDiRzFMn1Ou0XmJN5NL88ScH4IYQmD-qmZzIgsGr-8rFCDl-9fqQMueV77q82InBqAHqrDWYRIdNQShFMx54sbJnELdQf2gvbkpzZ0HES91UohXj2A",
    description:
      "Artisan blends and cozy study spots — perfect for your next all-night cram session.",
  },
  {
    id: 9,
    title: "FitFuel",
    brand: "FitFuel",
    discount: "20% OFF",
    type: "Online",
    category: "Fitness",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBlQ36ohtoAh9iCNqXOhzdY_i9C66nAuwPjEoY7ATPU7F6ORrkJ9RNozLPw-UlMH_AQ6347sUVdnofSpsAPDPcEDTbHI8kJ-sDd4U4-FL7KtVn0Vid0AKYeDKMnI3_zrZVee7dE003pYw1DkC4gX1Zu8gPPZpyP8zuwQXr8nMXfnT_uQQ8dElkjTXuO7k0Qc_YLrFAX7Ad1UFcbhm5fe5ZOEXLXSjyn2WLYkVCVBMx6LLOVrjorS4brUS3XyKYwP0blJjuevpgSx-Q",
    description:
      "Supplements, protein shakes, and workout gear to keep you performing at your best.",
  },
  {
    id: 10,
    title: "ThreadLine",
    brand: "ThreadLine",
    discount: "35% OFF",
    type: "In-Store",
    category: "Clothing",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCzOvLNPgk03USFCKNu-GSzr9_dG9Cm3IPn04us2RsA5WNrpv7kXluz1pKVGDoWg25RiLBQB1fB29I5ZtSSxP-VRZO9pTj4_i7YzmJQGsB5rWtNPQYfBMSpYn8ecO1qkcOImTsFwhBvI9d_zwBCanWoMsWcoGglkPVREOwhsLl4333y_W6F-aBfjPfU0jhgJf8o-43sazueipq-nYtKuUCo56Hh3oQ1uWZJ6v_XJep8TPKq9lSRlBs9a7UD7DDWezf0kbdke4zHLvA",
    description:
      "Streetwear meets sustainability — limited drops and campus-ready essentials.",
  },
  {
    id: 11,
    title: "Nest & Rest",
    brand: "Nest & Rest",
    discount: "15% OFF",
    type: "Online",
    category: "Home",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAZJkcufRYEZVBJQHpPPMMFRRa666JoWSP--59sPJn-M8ZQeeSSxdKIwlVoClxOXzXBkbWLnBjnSTeu3ZbVd9bwUZrllroLwKliU1H0NZAdsUaTJRWnKE0OtKjq0C6PLsuEeBBaxYg1twgDiskLcyPcjOZjP3IRopDylKF6eRD0uLoKbXdzTR630xOd9-btXTE0Odtm79tP7Gb7goFCqRbK7VMJG-8OxL_V4-SNH5DS_OliUk6NEnRVxzgpXA350ggKALFQL5WQOkg",
    description:
      "Bedding, lighting, and dorm essentials that turn any room into a relaxation zone.",
  },
  {
    id: 12,
    title: "PixelForge",
    brand: "PixelForge",
    discount: "40% OFF",
    type: "In-Store",
    category: "Creative",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBzrewh7Yaxx08JPFCRJjYZ5K9cxEFPyolBeyW8OBhUSI5x-xOOAo9x0RG4oPhNqX8GgKbLiBOnF8dV7M27keE7jCT7Gb1rS3VfkKgVPcA3bj7ZWZ3XPQHy8gFkElPs9lQq95eBonjtM0EUVHkz_SZ7cLVwqn5-H3WSDGf4Eu4kuHf9SpzmdT3GSnV97tcJJYYI6u83KKtolla22Lx0IuvDu7I4gP9ja9hrdmhbGjftDHpBwa_SQX_2k7rNKhnHjcUK9QIMLab3iMs",
    description:
      "Cameras, drawing tablets, and studio gear for the next generation of creators.",
  },
];

export default deals;
