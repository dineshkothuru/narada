export type MenuCategory = {
  id: string;
  name: string;
  emoji: string;
};

export type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceInr: number;
  isVeg: boolean;
  spiceLevel: 0 | 1 | 2 | 3;
  allergens: string[];
  tags: string[];
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
