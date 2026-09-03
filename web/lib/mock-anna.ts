import "server-only";
import type { AnnaResponse, MenuItem, MenuPayload } from "./types";

// Deterministic stand-in for Gemini when MOCK_AI=1 — demos and UI testing
// without spending Sarvam/Gemini credits. Keyword-driven, three languages.
const L = {
  English: {
    greet: "Namaste! I'm Narada (demo mode). Veg or non-veg today?",
    veg: "Lovely — here are our best veg picks!",
    nonveg: "Great choice — these are the crowd favourites!",
    dessert: "Something sweet coming up!",
    drink: "Here's what's cooling today!",
    added: (n: string, p: number) => `Added ${n} — ₹${p}. Anything else?`,
    readback: (list: string, total: number) =>
      `So that's ${list} — ₹${total} total. Shall I send it to the kitchen?`,
    confirmed: "Done! Your order is going to the kitchen. 🍽️",
    fallback: "Here are today's favourites — or tap the menu to browse!",
    chips: { pref: ["Veg 🌱", "Non-veg 🍗"], more: ["Desserts 🍮", "Drinks 🥤", "That's all ✅"], yes: ["Yes ✅", "Add more ➕"] },
  },
  Hindi: {
    greet: "नमस्ते! मैं नारद हूँ (डेमो)। आज वेज या नॉन-वेज?",
    veg: "बढ़िया — ये हैं हमारे बेस्ट वेज!",
    nonveg: "शानदार — ये हैं सबके पसंदीदा!",
    dessert: "कुछ मीठा हाज़िर!",
    drink: "आज की ठंडक ये रही!",
    added: (n: string, p: number) => `${n} जोड़ दिया — ₹${p}। और कुछ?`,
    readback: (list: string, total: number) =>
      `तो हुआ ${list} — कुल ₹${total}। किचन भेज दूँ?`,
    confirmed: "हो गया! ऑर्डर किचन जा रहा है। 🍽️",
    fallback: "ये रहे आज के पसंदीदा — या मेन्यू देखिए!",
    chips: { pref: ["वेज 🌱", "नॉन-वेज 🍗"], more: ["मिठाई 🍮", "ड्रिंक्स 🥤", "बस इतना ✅"], yes: ["हाँ ✅", "और जोड़ें ➕"] },
  },
  Telugu: {
    greet: "నమస్తే! నేను నారద (డెమో). వెజ్ లేదా నాన్-వెజ్?",
    veg: "సూపర్ — మా బెస్ట్ వెజ్ ఇవే!",
    nonveg: "మంచి ఛాయిస్ — అందరికీ ఇష్టమైనవి ఇవే!",
    dessert: "తీపి వస్తోంది!",
    drink: "ఈరోజు చల్లగా ఇవి!",
    added: (n: string, p: number) => `${n} జోడించాను — ₹${p}. ఇంకేమైనా?`,
    readback: (list: string, total: number) =>
      `మొత్తం ${list} — ₹${total}. కిచెన్‌కు పంపనా?`,
    confirmed: "అయిపోయింది! ఆర్డర్ కిచెన్‌కు వెళ్తోంది. 🍽️",
    fallback: "ఈరోజు ఫేవరెట్స్ ఇవే — లేదా మెనూ చూడండి!",
    chips: { pref: ["వెజ్ 🌱", "నాన్-వెజ్ 🍗"], more: ["స్వీట్స్ 🍮", "డ్రింక్స్ 🥤", "అంతే ✅"], yes: ["సరే ✅", "ఇంకా ➕"] },
  },
};

const pick = (items: MenuItem[], n = 3) => items.filter((m) => m.isAvailable).slice(0, n);

function guessUiLanguage(text: string, fallback: string): "en" | "hi" | "te" {
  if (/[ऀ-ॿ]/.test(text)) return "hi";
  if (/[ఀ-౿]/.test(text)) return "te";
  // romanized markers (Tenglish first: "anna/oka/kavali" are unambiguous,
  // while Hinglish fillers like "hai" also appear in Telugu sentences)
  if (/(kavali|cheyyi|bagundi|enti|naaku|pettu|konchem|rendu|oka |anna|ivvu)/i.test(text)) {
    return "te";
  }
  if (/(chahiye|bhaiya|bhai |karo|kya |nahi|thoda|mera |batao|dedo|ek )/i.test(text)) {
    return "hi";
  }
  return fallback === "Hindi" ? "hi" : fallback === "Telugu" ? "te" : "en";
}

export function mockAsk(
  menu: MenuPayload,
  text: string,
  cart: { itemId: string; qty: number }[],
  language: string,
  greet: boolean,
): AnnaResponse {
  const ui = guessUiLanguage(text, language);
  const t = L[ui === "hi" ? "Hindi" : ui === "te" ? "Telugu" : "English"] ?? L.English;
  const items = menu.items;
  const lower = text.toLowerCase();
  const show = (list: MenuItem[]) => list.map((m) => m.id);

  if (greet) {
    return { reply: t.greet, actions: [], quickReplies: t.chips.pref, showItems: [], uiLanguage: ui };
  }

  // name capture
  const nameMatch =
    lower.match(/(?:i am|i'm|my name is|mera naam|na peru|నా పేరు|मेरा नाम)\s+([a-zA-Zऀ-ॿఀ-౿]+)/i);

  // explicit confirmation
  if (/^(yes|yeah|haan|ok|okay|confirm|సరే|हाँ|ha)\b|✅/.test(lower) && cart.length > 0) {
    return { reply: t.confirmed, actions: [{ type: "confirm_order" }], quickReplies: [], showItems: [], uiLanguage: ui };
  }
  // done → readback
  if (/that'?s all|bas |bass|అంతే|order (it|kar)|enough/.test(lower) && cart.length > 0) {
    const byId = new Map(items.map((m) => [m.id, m]));
    const list = cart
      .map((l) => `${l.qty}× ${byId.get(l.itemId)?.name.en ?? "item"}`)
      .join(", ");
    const total = cart.reduce((s, l) => s + (byId.get(l.itemId)?.priceInr ?? 0) * l.qty, 0);
    return {
      reply: t.readback(list, total),
      actions: [],
      suggestCheckout: true,
      quickReplies: t.chips.yes,
      showItems: [],
      uiLanguage: ui,
    };
  }
  // dish name match → add
  const hit = items.find(
    (m) => m.isAvailable && lower.includes(m.name.en.toLowerCase().split(" (")[0].toLowerCase()),
  );
  if (hit && /add|chahiye|కావాలి|जोड़|order|one |two |ఒక|एक/.test(lower)) {
    const qty = /two|do |రెండు|दो/.test(lower) ? 2 : 1;
    const actions: AnnaResponse["actions"] = [{ type: "add", itemId: hit.id, qty }];
    if (nameMatch) actions.push({ type: "set_name", name: nameMatch[1] });
    return {
      reply: t.added(hit.name.en, hit.priceInr),
      actions,
      quickReplies: t.chips.more,
      showItems: [hit.id],
      uiLanguage: ui,
    };
  }
  // category-ish intents
  if (/veg(?!.*non)|🌱|శాక|वेज(?!.*नॉन)/.test(lower) && !/non/.test(lower)) {
    const picks = pick(items.filter((m) => m.isVeg && m.tags.length > 0));
    return { reply: t.veg, actions: nameMatch ? [{ type: "set_name", name: nameMatch[1] }] : [], quickReplies: t.chips.more, showItems: show(picks), uiLanguage: ui };
  }
  if (/non[- ]?veg|chicken|🍗|नॉन|నాన్/.test(lower)) {
    const picks = pick(items.filter((m) => !m.isVeg));
    return { reply: t.nonveg, actions: nameMatch ? [{ type: "set_name", name: nameMatch[1] }] : [], quickReplies: t.chips.more, showItems: show(picks), uiLanguage: ui };
  }
  if (/dessert|sweet|मिठाई|స్వీట్|🍮/.test(lower)) {
    const picks = pick(items.filter((m) => /jamun|rasmalai|dessert/i.test(m.name.en)));
    return { reply: t.dessert, actions: [], quickReplies: t.chips.yes, showItems: show(picks), uiLanguage: ui };
  }
  if (/drink|juice|soda|lassi|chaas|డ్రింక్|ड्रिंक|🥤/.test(lower)) {
    const picks = pick(items.filter((m) => /juice|soda|lassi|chaas/i.test(m.name.en)));
    return { reply: t.drink, actions: [], quickReplies: t.chips.more, showItems: show(picks), uiLanguage: ui };
  }
  if (nameMatch) {
    const picks = pick(items.filter((m) => m.tags.includes("bestseller")));
    return {
      reply: t.fallback,
      actions: [{ type: "set_name", name: nameMatch[1] }],
      quickReplies: t.chips.pref,
      showItems: show(picks),
      uiLanguage: ui,
    };
  }
  const picks = pick(items.filter((m) => m.tags.includes("bestseller")));
  return { reply: t.fallback, actions: [], quickReplies: t.chips.pref, showItems: show(picks), uiLanguage: ui };
}
