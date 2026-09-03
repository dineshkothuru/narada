export type Lang = "en" | "hi" | "te";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "hi", label: "हिं" },
  { code: "te", label: "తె" },
];

export const LANG_NAME: Record<Lang, string> = {
  en: "English",
  hi: "Hindi",
  te: "Telugu",
};

type Strings = {
  dineIn: string;
  veg: string;
  talkToAnna: string;
  annaRole: string;
  annaGreeting: string;
  askAnna: string;
  add: string;
  bestseller: string;
  viewCart: string;
  items: (n: number) => string;
  yourOrder: string;
  payNote: string;
  emptyCart: string;
  each: string;
  total: string;
  placeOrder: string;
  payToOrder: string;
  orderSent: string;
  orderSentNote: string;
  payUpi: string;
  payLater: string;
  reviewOrder: string;
  footer: string;
  suggestions: string[];
  playTitle: string;
  playSub: string;
  quizWinComp: string;
  discountApplied: string;
  spinBanner: string;
  spinSub: string;
  spin: string;
  spinWin: string;
  spinNone: string;
  level: string;
  moves: string;
  levelClear: string;
  nextLevel: string;
  statusPlaced: string;
  statusPreparing: string;
  statusReady: string;
  statusServed: string;
  listening: string;
  thinking: string;
  speaking: string;
  endVoice: string;
  voiceHint: string;
  heroSpecial: string;
  callWaiter: string;
  waiterComing: string;
  round: string;
  allServed: string;
  inQueue: string;
  servedOf: string;
  soldOut: string;
  menuTiles: string;
  storiesHint: string;
  billSubtotal: string;
  billGst: string;
  billService: string;
  billTip: string;
  billTotal: string;
  removeService: string;
  serviceRemoved: string;
  addTip: string;
  viewBill: string;
  askBill: string;
  billRequested: string;
  you: string;
  yourName: string;
  contains: string;
};

export const STRINGS: Record<Lang, Strings> = {
  en: {
    dineIn: "Dine-in",
    veg: "Veg",
    talkToAnna: "Talk to Narada",
    annaRole: "Your waiter · knows every dish on the menu",
    annaGreeting:
      "Namaste! I’m Narada. Ask me about any dish, or just tell me what you feel like eating.",
    askAnna: "Ask Narada anything…",
    add: "ADD",
    bestseller: "★ Bestseller",
    viewCart: "View cart →",
    items: (n) => `${n} item${n > 1 ? "s" : ""}`,
    yourOrder: "Your order",
    payNote: "pay at the end or right after ordering",
    emptyCart: "Your cart is empty — ask Narada for a recommendation!",
    each: "each",
    total: "Total",
    placeOrder: "Place order",
    payToOrder: "Pay & place order",
    orderSent: "Order sent to the kitchen!",
    orderSentNote:
      "Sit back — your food is on its way. You can keep ordering more rounds anytime.",
    payUpi: "Pay {amount} via UPI",
    payLater: "Pay later — continue browsing",
    reviewOrder: "Review & order →",
    footer: "Powered by Narada · Narada can make mistakes — the cart is always yours to edit",
    suggestions: [
      "What do you recommend for two?",
      "Which dishes are not spicy?",
      "What goes well with biryani?",
    ],
    playTitle: "Play while you wait 🎮",
    playSub: "Beat all 3 levels of Memory Match — win a free dessert!",
    quizWinComp: "You won a complimentary {item}! 🎁 It'll arrive with your order.",
    discountApplied: "{pct}% off applied",
    spinBanner: "Feeling lucky? 🎡",
    spinSub: "Spin the wheel — win up to 15% off today's bill!",
    spin: "SPIN",
    spinWin: "{pct}% off won! Applied to your bill 🎉",
    spinNone: "No luck this time — enjoy the food! 😊",
    level: "Level",
    moves: "Moves",
    levelClear: "Level clear!",
    nextLevel: "Next level →",
    statusPlaced: "Order received",
    statusPreparing: "Being prepared 👨‍🍳",
    statusReady: "On its way to your table 🍽️",
    statusServed: "Served — enjoy! 🍽️",
    listening: "Listening… tap to stop",
    thinking: "Narada is thinking…",
    speaking: "Narada is speaking…",
    endVoice: "End conversation",
    voiceHint: "Just talk — Narada will guide you and confirm before ordering",
    heroSpecial: "Chef's Special ✨",
    callWaiter: "Call waiter",
    waiterComing: "Staff is on the way ✋",
    round: "Round",
    allServed: "All served — enjoy! 🍽️",
    inQueue: "In queue ⏳",
    servedOf: "{a}/{b} served",
    soldOut: "Sold out",
    menuTiles: "Menu",
    storiesHint: "▲ swipe up for the next dish",
    billSubtotal: "Sub total",
    billGst: "GST",
    billService: "Service charge",
    billTip: "Tip",
    billTotal: "Total",
    removeService: "Remove service charge",
    serviceRemoved: "Service charge removed",
    addTip: "Add a tip",
    viewBill: "🧾 View / print bill",
    askBill: "Ask for the bill",
    billRequested: "Bill requested — staff are on the way ✋",
    you: "You",
    yourName: "Your name (optional — shows on the table's order)",
    contains: "Contains",
  },
  hi: {
    dineIn: "डाइन-इन",
    veg: "वेज",
    talkToAnna: "नारद से बात करें",
    annaRole: "आपका वेटर · मेन्यू की हर डिश जानता है",
    annaGreeting:
      "नमस्ते! मैं नारद हूँ। किसी भी डिश के बारे में पूछिए, या बताइए आज क्या खाने का मन है।",
    askAnna: "नारद से कुछ भी पूछें…",
    add: "जोड़ें",
    bestseller: "★ बेस्टसेलर",
    viewCart: "कार्ट देखें →",
    items: (n) => `${n} आइटम`,
    yourOrder: "आपका ऑर्डर",
    payNote: "अंत में या ऑर्डर के तुरंत बाद भुगतान करें",
    emptyCart: "कार्ट खाली है — नारद से सुझाव पूछिए!",
    each: "प्रति",
    total: "कुल",
    placeOrder: "ऑर्डर करें",
    payToOrder: "भुगतान करें और ऑर्डर करें",
    orderSent: "ऑर्डर किचन में भेज दिया गया!",
    orderSentNote:
      "आराम से बैठिए — खाना बन रहा है। आप कभी भी और ऑर्डर कर सकते हैं।",
    payUpi: "UPI से {amount} भुगतान करें",
    payLater: "बाद में भुगतान करें — ब्राउज़ करते रहें",
    reviewOrder: "ऑर्डर देखें →",
    footer: "Narada द्वारा संचालित · नारद से ग़लती हो सकती है — कार्ट हमेशा आपके नियंत्रण में है",
    suggestions: [
      "दो लोगों के लिए क्या सुझाव है?",
      "कौन सी डिश तीखी नहीं है?",
      "बिरयानी के साथ क्या अच्छा लगेगा?",
    ],
    playTitle: "इंतज़ार में खेलें 🎮",
    playSub: "मेमोरी मैच के 3 लेवल पूरे करें — मुफ़्त मिठाई जीतें!",
    quizWinComp: "आपने मुफ़्त {item} जीता! 🎁 आपके ऑर्डर के साथ आएगा।",
    discountApplied: "{pct}% छूट लागू",
    spinBanner: "किस्मत आज़माएँ? 🎡",
    spinSub: "व्हील घुमाएँ — आज के बिल पर 15% तक छूट जीतें!",
    spin: "घुमाएँ",
    spinWin: "{pct}% छूट जीती! बिल पर लागू हो गई 🎉",
    spinNone: "इस बार किस्मत नहीं — खाने का आनंद लें! 😊",
    level: "लेवल",
    moves: "चालें",
    levelClear: "लेवल पूरा!",
    nextLevel: "अगला लेवल →",
    statusPlaced: "ऑर्डर मिल गया",
    statusPreparing: "बन रहा है 👨‍🍳",
    statusReady: "आपकी टेबल पर आ रहा है 🍽️",
    statusServed: "परोस दिया गया 🍽️",
    listening: "सुन रहा हूँ… रोकने के लिए टैप करें",
    thinking: "नारद सोच रहे हैं…",
    speaking: "नारद बोल रहे हैं…",
    endVoice: "बातचीत समाप्त करें",
    voiceHint: "बस बोलिए — नारद गाइड करेंगे और ऑर्डर से पहले पुष्टि लेंगे",
    heroSpecial: "शेफ़ स्पेशल ✨",
    callWaiter: "वेटर बुलाएँ",
    waiterComing: "स्टाफ़ आ रहा है ✋",
    round: "राउंड",
    allServed: "सब परोस दिया गया — आनंद लें! 🍽️",
    inQueue: "क़तार में ⏳",
    servedOf: "{a}/{b} परोसा गया",
    soldOut: "उपलब्ध नहीं",
    menuTiles: "मेन्यू",
    storiesHint: "▲ अगली डिश के लिए ऊपर स्वाइप करें",
    billSubtotal: "सब टोटल",
    billGst: "जीएसटी",
    billService: "सर्विस चार्ज",
    billTip: "टिप",
    billTotal: "कुल",
    removeService: "सर्विस चार्ज हटाएँ",
    serviceRemoved: "सर्विस चार्ज हटा दिया गया",
    addTip: "टिप जोड़ें",
    viewBill: "🧾 बिल देखें / प्रिंट करें",
    askBill: "बिल मंगाएँ",
    billRequested: "बिल का अनुरोध भेजा — स्टाफ़ आ रहे हैं ✋",
    you: "आप",
    yourName: "आपका नाम (वैकल्पिक — टेबल के ऑर्डर पर दिखेगा)",
    contains: "इसमें है",
  },
  te: {
    dineIn: "డైన్-ఇన్",
    veg: "వెజ్",
    talkToAnna: "నారదతో మాట్లాడండి",
    annaRole: "మీ వెయిటర్ · మెనూలోని ప్రతి వంటకం తెలుసు",
    annaGreeting:
      "నమస్తే! నేను నారద. ఏ వంటకం గురించైనా అడగండి, లేదా ఈరోజు ఏమి తినాలనిపిస్తుందో చెప్పండి.",
    askAnna: "నారదను ఏదైనా అడగండి…",
    add: "కావాలి",
    bestseller: "★ బెస్ట్ సెల్లర్",
    viewCart: "కార్ట్ చూడండి →",
    items: (n) => `${n} ఐటమ్${n > 1 ? "లు" : ""}`,
    yourOrder: "మీ ఆర్డర్",
    payNote: "చివర్లో లేదా ఆర్డర్ చేసిన వెంటనే చెల్లించండి",
    emptyCart: "కార్ట్ ఖాళీగా ఉంది — నారదుని సూచన అడగండి!",
    each: "ఒక్కొక్కటి",
    total: "మొత్తం",
    placeOrder: "ఆర్డర్ చేయండి",
    payToOrder: "చెల్లించి ఆర్డర్ చేయండి",
    orderSent: "ఆర్డర్ కిచెన్‌కు పంపబడింది!",
    orderSentNote:
      "హాయిగా కూర్చోండి — మీ భోజనం సిద్ధమవుతోంది. ఎప్పుడైనా మరిన్ని ఆర్డర్ చేయవచ్చు.",
    payUpi: "UPI ద్వారా {amount} చెల్లించండి",
    payLater: "తర్వాత చెల్లించండి — బ్రౌజ్ చేస్తూ ఉండండి",
    reviewOrder: "ఆర్డర్ చూడండి →",
    footer: "Narada ఆధారితం · నారదుడు పొరపాటు చేయవచ్చు — కార్ట్ ఎప్పుడూ మీ చేతుల్లోనే",
    suggestions: [
      "ఇద్దరికి ఏమి సిఫార్సు చేస్తావు?",
      "ఏవి కారంగా ఉండవు?",
      "బిర్యానీతో ఏది బాగుంటుంది?",
    ],
    playTitle: "వేచి ఉండగా ఆడండి 🎮",
    playSub: "మెమరీ మ్యాచ్ 3 లెవెల్స్ పూర్తి చేయండి — ఉచిత స్వీట్ గెలవండి!",
    quizWinComp: "మీరు ఉచిత {item} గెలిచారు! 🎁 మీ ఆర్డర్‌తో పాటు వస్తుంది.",
    discountApplied: "{pct}% తగ్గింపు వర్తించింది",
    spinBanner: "అదృష్టం పరీక్షిస్తారా? 🎡",
    spinSub: "వీల్ తిప్పండి — నేటి బిల్లుపై 15% వరకు తగ్గింపు గెలవండి!",
    spin: "తిప్పండి",
    spinWin: "{pct}% తగ్గింపు గెలిచారు! బిల్లుకు వర్తించింది 🎉",
    spinNone: "ఈసారి అదృష్టం లేదు — భోజనం ఆస్వాదించండి! 😊",
    level: "లెవెల్",
    moves: "కదలికలు",
    levelClear: "లెవెల్ పూర్తి!",
    nextLevel: "తదుపరి లెవెల్ →",
    statusPlaced: "ఆర్డర్ అందింది",
    statusPreparing: "తయారవుతోంది 👨‍🍳",
    statusReady: "మీ టేబుల్‌కు వస్తోంది 🍽️",
    statusServed: "వడ్డించబడింది 🍽️",
    listening: "వింటున్నాను… ఆపడానికి నొక్కండి",
    thinking: "నారదుడు ఆలోచిస్తున్నాడు…",
    speaking: "నారదుడు మాట్లాడుతున్నాడు…",
    endVoice: "సంభాషణ ముగించండి",
    voiceHint: "మాట్లాడండి చాలు — నారదుడు గైడ్ చేసి, ఆర్డర్ ముందు నిర్ధారిస్తాడు",
    heroSpecial: "చెఫ్ స్పెషల్ ✨",
    callWaiter: "వెయిటర్‌ను పిలవండి",
    waiterComing: "సిబ్బంది వస్తున్నారు ✋",
    round: "రౌండ్",
    allServed: "అన్నీ వడ్డించాం — ఆస్వాదించండి! 🍽️",
    inQueue: "వరుసలో ⏳",
    servedOf: "{a}/{b} వడ్డించాం",
    soldOut: "అయిపోయింది",
    menuTiles: "మెనూ",
    storiesHint: "▲ తదుపరి వంటకానికి పైకి స్వైప్ చేయండి",
    billSubtotal: "సబ్ టోటల్",
    billGst: "జీఎస్టీ",
    billService: "సర్వీస్ ఛార్జ్",
    billTip: "టిప్",
    billTotal: "మొత్తం",
    removeService: "సర్వీస్ ఛార్జ్ తీసివేయండి",
    serviceRemoved: "సర్వీస్ ఛార్జ్ తీసివేయబడింది",
    addTip: "టిప్ జోడించండి",
    viewBill: "🧾 బిల్లు చూడండి / ప్రింట్",
    askBill: "బిల్లు అడగండి",
    billRequested: "బిల్లు అడిగారు — సిబ్బంది వస్తున్నారు ✋",
    you: "మీరు",
    yourName: "మీ పేరు (ఐచ్ఛికం — టేబుల్ ఆర్డర్‌పై కనిపిస్తుంది)",
    contains: "ఇందులో",
  },
};
