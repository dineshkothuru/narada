export type Lang = "en" | "hi" | "te";

export type Localized = { en: string; hi: string; te: string };

export type MenuCategory = {
  id: string;
  name: Localized;
  emoji: string;
  // a "drink" section reads an item's 0-3 intensity as sweetness, not spice
  kind?: "food" | "drink";
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: Localized;
  description: Localized;
  priceInr: number;
  isVeg: boolean;
  spiceLevel: number;
  allergens: string[];
  tags: string[];
  emoji: string;
  imageUrl: string | null;
  isAvailable: boolean;
};

export type RestaurantInfo = {
  name: string;
  tagline: string;
  upiVpa: string;
  paymentTiming: "pre" | "post";
};

export type MenuPayload = {
  restaurant: RestaurantInfo;
  tableLabel: string;
  uiVariant: "classic" | "stories";
  categories: MenuCategory[];
  items: MenuItem[];
};

export type CartLine = {
  itemId: string;
  qty: number;
  notes?: string;
};

export type AnnaAction =
  | { type: "add"; itemId: string; qty: number; notes?: string }
  | { type: "remove"; itemId: string }
  | { type: "set_qty"; itemId: string; qty: number }
  | { type: "confirm_order" }
  | { type: "set_name"; name: string };

export type AnnaResponse = {
  reply: string;
  actions: AnnaAction[];
  suggestCheckout?: boolean;
  showItems?: string[];
  quickReplies?: string[];
  uiLanguage?: "en" | "hi" | "te";
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};
