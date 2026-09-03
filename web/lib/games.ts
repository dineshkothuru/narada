export type WheelReward =
  { type: "comp"; item: string } | { type: "discount"; pct: number } | { type: "none" };

export type WheelSlice = {
  label: string;
  emoji: string;
  reward: WheelReward;
  weight: number;
  color: string;
};

// Pre-order wheel: discounts only (complimentary items come from the waiting
// game after ordering). Visual slices are equal; hidden weights set generosity.
export const WHEEL: WheelSlice[] = [
  {
    label: "5% OFF",
    emoji: "💸",
    reward: { type: "discount", pct: 5 },
    weight: 3,
    color: "#e11d48",
  },
  { label: "Try Again", emoji: "😅", reward: { type: "none" }, weight: 3, color: "#64748b" },
  {
    label: "10% OFF",
    emoji: "🎉",
    reward: { type: "discount", pct: 10 },
    weight: 2,
    color: "#0ea5e9",
  },
  { label: "Better Luck", emoji: "🍀", reward: { type: "none" }, weight: 3, color: "#475569" },
  {
    label: "15% OFF",
    emoji: "🏆",
    reward: { type: "discount", pct: 15 },
    weight: 1,
    color: "#6366f1",
  },
  {
    label: "5% OFF",
    emoji: "💰",
    reward: { type: "discount", pct: 5 },
    weight: 3,
    color: "#f43f5e",
  },
];

// Post-order waiting game: memory match levels (pairs of food emojis).
export const MEMORY_LEVELS: { pairs: number; cols: number }[] = [
  { pairs: 4, cols: 4 },
  { pairs: 6, cols: 4 },
  { pairs: 8, cols: 4 },
];

export const MEMORY_EMOJIS = [
  "🍛",
  "🍚",
  "🫓",
  "🍢",
  "🍮",
  "🥤",
  "🌶️",
  "🧀",
  "🍗",
  "🥬",
  "🍋",
  "🥛",
];

export function spinWheel(): number {
  const totalWeight = WHEEL.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight;
    if (r <= 0) return i;
  }
  return WHEEL.length - 1;
}
