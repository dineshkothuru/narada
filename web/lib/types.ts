export type Lang = "en" | "hi" | "te";

export type Localized = { en: string; hi: string; te: string };

export type MenuCategory = {
  id: string;
  name: Localized;
  emoji: string;
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
  | { type: "set_qty"; itemId: string; qty: number };

export type AnnaResponse = {
  reply: string;
  actions: AnnaAction[];
  suggestCheckout?: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};
