import type { AnnaResponse, CartLine, ChatMessage } from "@narada/shared";
import { badRequest, HttpError } from "../lib/http.js";
import type { Repos } from "../repositories/index.js";
import { askAnna } from "./agent.js";
import { getApiKeys } from "./keys.js";
import { fetchMenu } from "./menu.js";

// Port of web/app/api/voice/route.ts. Sarvam STT auto-detects the spoken
// language; we answer (text + speech) in it.

const SARVAM = "https://api.sarvam.ai";

export type VoiceInput = {
  audio?: string;
  text?: string;
  greet?: boolean;
  cart?: CartLine[];
  messages?: ChatMessage[];
  tableCode?: string;
  language?: string;
};

export type VoiceResult = {
  transcript: string;
  detectedLanguage: string;
  uiLanguage: "en" | "hi" | "te";
  reply: string;
  actions: AnnaResponse["actions"];
  suggestCheckout: boolean;
  showItems: string[];
  quickReplies: string[];
  audio: string | null;
};

// spoken fallback when Gemini is unavailable — Sarvam TTS still voices it,
// so the mic keeps "working" even while the brain is rate-limited
function fallbackReply(langName: string, greet: boolean): AnnaResponse {
  const texts: Record<string, { greet: string; busy: string; chips: string[] }> = {
    Hindi: {
      greet:
        "नमस्ते! मैं नारद हूँ। मेन्यू देखिए और जो पसंद आए बताइए — मैं अभी थोड़ा व्यस्त हूँ, पर आपका ऑर्डर स्क्रीन से ले सकता हूँ।",
      busy: "माफ़ कीजिए, मैं अभी सोच नहीं पा रहा — मेन्यू से चुनिए या वेटर को बुलाइए।",
      chips: ["मेन्यू देखें", "🔔 वेटर बुलाएँ"],
    },
    Telugu: {
      greet:
        "నమస్తే! నేను నారద. మెనూ చూడండి, నచ్చింది చెప్పండి — ప్రస్తుతం కాస్త బిజీగా ఉన్నాను, కానీ స్క్రీన్ నుంచి ఆర్డర్ చేయవచ్చు.",
      busy: "క్షమించండి, ప్రస్తుతం ఆలోచించలేకపోతున్నాను — మెనూ నుంచి ఎంచుకోండి లేదా వెయిటర్‌ను పిలవండి.",
      chips: ["మెనూ చూడండి", "🔔 వెయిటర్"],
    },
    English: {
      greet:
        "Namaste! I'm Narada. Browse the menu and tap what you like — I'm a little busy right now, but your screen can take the order.",
      busy: "Sorry, I'm having trouble thinking right now — please pick from the menu or call the waiter.",
      chips: ["Browse menu", "🔔 Call waiter"],
    },
  };
  const t = texts[langName] ?? texts.English;
  return {
    reply: greet ? t.greet : t.busy,
    actions: [],
    suggestCheckout: false,
    showItems: [],
    quickReplies: [],
  };
}

type SpeechRepos = Pick<Repos, "outlets" | "tables" | "menuCategories" | "menuItems">;

export async function processVoiceTurn(
  repos: SpeechRepos,
  input: VoiceInput,
): Promise<VoiceResult> {
  const { sarvam: sarvamKey } = await getApiKeys(repos);
  if (!sarvamKey) {
    // legacy responds 500 here (misconfiguration, not the caller's fault)
    throw new HttpError(500, "Sarvam API key not configured (admin settings or env)");
  }

  if (!input.audio && !input.text && !input.greet) {
    throw badRequest("audio, text or greet required");
  }
  if (input.audio && input.audio.length > 4_000_000) {
    throw new HttpError(413, "audio too long");
  }

  const appLangCode =
    input.language === "Hindi" ? "hi-IN" : input.language === "Telugu" ? "te-IN" : "en-IN";
  let transcript = "";
  let detected = appLangCode;

  // menu fetch is independent of STT — overlap them
  const menuPromise = fetchMenu(repos, input.tableCode || "");

  if (input.audio) {
    const wavBytes = Buffer.from(input.audio, "base64");
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(wavBytes)], { type: "audio/wav" }), "input.wav");
    form.append("model", "saarika:v2.5");
    form.append("language_code", "unknown");

    const sttRes = await fetch(`${SARVAM}/speech-to-text`, {
      method: "POST",
      headers: { "api-subscription-key": sarvamKey },
      body: form,
    });
    if (!sttRes.ok) {
      console.error("sarvam stt", sttRes.status, (await sttRes.text()).slice(0, 300));
      throw new HttpError(502, "could not hear you");
    }
    const stt = (await sttRes.json()) as { transcript: string; language_code?: string };
    transcript = (stt.transcript || "").trim();
    if (!transcript) {
      throw new HttpError(422, "empty transcript");
    }
    detected = stt.language_code || appLangCode;
  } else if (input.text) {
    transcript = input.text.trim();
  } else {
    // greet: hidden trigger — not stored in the visible conversation
    transcript =
      "[The customer just sat down and opened the voice assistant. Greet them and start the conversation.]";
  }

  const langName = detected.startsWith("hi")
    ? "Hindi"
    : detected.startsWith("te")
      ? "Telugu"
      : detected.startsWith("en") && input.audio
        ? "English"
        : input.language || "English";

  const menu = await menuPromise;
  if (!menu) {
    throw new HttpError(500, "voice failed");
  }
  const allMessages: ChatMessage[] = [
    ...(input.messages ?? []),
    { role: "user", text: transcript },
  ];
  let anna: AnnaResponse;
  try {
    anna = await askAnna(repos, menu, allMessages, input.cart ?? [], langName, { voice: true });
  } catch {
    // brain throttled/down: stay conversational instead of erroring the dock
    anna = fallbackReply(langName, Boolean(input.greet));
  }

  // the brain's judgement wins for code-mixed speech (Hinglish → hi, Tenglish → te)
  const uiLanguage: "en" | "hi" | "te" =
    anna.uiLanguage === "hi" || anna.uiLanguage === "te" || anna.uiLanguage === "en"
      ? anna.uiLanguage
      : detected.startsWith("hi")
        ? "hi"
        : detected.startsWith("te")
          ? "te"
          : "en";

  // speak the reply in the language the customer is actually using
  const ttsLang = uiLanguage === "hi" ? "hi-IN" : uiLanguage === "te" ? "te-IN" : "en-IN";
  let audioOut: string | null = null;
  const ttsRes = await fetch(`${SARVAM}/text-to-speech`, {
    method: "POST",
    headers: { "api-subscription-key": sarvamKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: anna.reply.slice(0, 1500),
      target_language_code: ttsLang,
      model: "bulbul:v3",
    }),
  });
  if (ttsRes.ok) {
    const tts = (await ttsRes.json()) as { audios?: string[] };
    audioOut = tts.audios?.[0] ?? null;
  } else {
    console.error("sarvam tts", ttsRes.status, (await ttsRes.text()).slice(0, 300));
  }

  return {
    transcript: input.greet ? "" : transcript,
    detectedLanguage: detected,
    uiLanguage,
    reply: anna.reply,
    actions: anna.actions,
    suggestCheckout: Boolean(anna.suggestCheckout),
    showItems: anna.showItems ?? [],
    quickReplies: anna.quickReplies ?? [],
    audio: audioOut,
  };
}
