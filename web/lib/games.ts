export type TriviaQ = { q: string; options: string[]; answer: number };

export const TRIVIA_POOL: TriviaQ[] = [
  // mythology
  { q: "Who lifted the Govardhan hill on his little finger?", options: ["Hanuman", "Krishna", "Arjuna"], answer: 1 },
  { q: "Sage Narada is famous as the…", options: ["Divine messenger", "God of rain", "Architect of the gods"], answer: 0 },
  { q: "How many days did the Kurukshetra war last?", options: ["10", "21", "18"], answer: 2 },
  { q: "Hanuman is the son of which god?", options: ["Vayu", "Indra", "Agni"], answer: 0 },
  // cricket
  { q: "Who is called the 'God of Cricket'?", options: ["Virat Kohli", "Sachin Tendulkar", "MS Dhoni"], answer: 1 },
  { q: "How many players are on a cricket team?", options: ["11", "10", "12"], answer: 0 },
  { q: "In which year did India win its first Cricket World Cup?", options: ["1975", "1983", "2011"], answer: 1 },
  // movies
  { q: "Jai and Veeru are the heroes of which classic film?", options: ["Deewaar", "Don", "Sholay"], answer: 2 },
  { q: "Which RRR song won an Oscar?", options: ["Naatu Naatu", "Dosti", "Komuram Bheemudo"], answer: 0 },
  { q: "Baahubali's kingdom is called…", options: ["Magadha", "Mahishmati", "Maheshwari"], answer: 1 },
  // food
  { q: "Which spice costs more than gold by weight?", options: ["Cardamom", "Vanilla", "Saffron"], answer: 2 },
  { q: "Traditional biryani is slow-cooked in which style?", options: ["Dum", "Tandoor", "Bhuna"], answer: 0 },
];

export function pickTrivia(n: number): TriviaQ[] {
  const pool = [...TRIVIA_POOL];
  const picked: TriviaQ[] = [];
  while (picked.length < n && pool.length > 0) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

export type WheelReward =
  | { type: "comp"; item: string }
  | { type: "discount"; pct: number }
  | { type: "none" };

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
  { label: "5% OFF", emoji: "💸", reward: { type: "discount", pct: 5 }, weight: 3, color: "#e11d48" },
  { label: "Try Again", emoji: "😅", reward: { type: "none" }, weight: 3, color: "#64748b" },
  { label: "10% OFF", emoji: "🎉", reward: { type: "discount", pct: 10 }, weight: 2, color: "#0ea5e9" },
  { label: "Better Luck", emoji: "🍀", reward: { type: "none" }, weight: 3, color: "#475569" },
  { label: "15% OFF", emoji: "🏆", reward: { type: "discount", pct: 15 }, weight: 1, color: "#6366f1" },
  { label: "5% OFF", emoji: "💰", reward: { type: "discount", pct: 5 }, weight: 3, color: "#f43f5e" },
];

// Post-order waiting game: memory match levels (pairs of food emojis).
export const MEMORY_LEVELS: { pairs: number; cols: number }[] = [
  { pairs: 4, cols: 4 },
  { pairs: 6, cols: 4 },
  { pairs: 8, cols: 4 },
];

export const MEMORY_EMOJIS = [
  "🍛", "🍚", "🫓", "🍢", "🍮", "🥤", "🌶️", "🧀", "🍗", "🥬", "🍋", "🥛",
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
