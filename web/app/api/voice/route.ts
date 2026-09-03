import { NextRequest, NextResponse } from "next/server";
import { fetchMenu } from "@/lib/menu";
import { askAnna } from "@/lib/anna";
import { getApiKeys } from "@/lib/keys";
import { mockAsk } from "@/lib/mock-anna";
import { rateLimit } from "@/lib/ratelimit";
import type { AnnaResponse, CartLine, ChatMessage } from "@/lib/types";

export const maxDuration = 60;

const SARVAM = "https://api.sarvam.ai";

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

// Sarvam STT auto-detects the spoken language; we answer (text + speech) in it.
export async function POST(req: NextRequest) {
  if (!rateLimit(req, "voice", 20)) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }
  const MOCK = process.env.MOCK_AI === "1";
  const { sarvam: sarvamKey } = MOCK ? { sarvam: "mock" } : await getApiKeys();
  if (!sarvamKey) {
    return NextResponse.json(
      { error: "Sarvam API key not configured (admin settings or env)" },
      { status: 500 },
    );
  }

  try {
    const { audio, text, greet, cart, messages, tableCode, language } =
      (await req.json()) as {
        audio?: string; // base64 wav (16k mono pcm16) — spoken turn
        text?: string; // typed/tapped turn (quick-reply chips)
        greet?: boolean; // Narada opens the conversation
        cart: CartLine[];
        messages: ChatMessage[];
        tableCode?: string;
        language?: string; // app language fallback
      };
    if (!audio && !text && !greet) {
      return NextResponse.json({ error: "audio, text or greet required" }, { status: 400 });
    }
    if (audio && audio.length > 4_000_000) {
      return NextResponse.json({ error: "audio too long" }, { status: 413 });
    }

    const appLangCode =
      language === "Hindi" ? "hi-IN" : language === "Telugu" ? "te-IN" : "en-IN";
    let transcript = "";
    let detected = appLangCode;

    // menu fetch is independent of STT — overlap them
    const menuPromise = fetchMenu(tableCode || "");

    if (audio && MOCK) {
      transcript = "(demo mode — voice recognition off; use the chips or type)";
    } else if (audio) {
      const wavBytes = Buffer.from(audio, "base64");
      const form = new FormData();
      form.append(
        "file",
        new Blob([new Uint8Array(wavBytes)], { type: "audio/wav" }),
        "input.wav",
      );
      form.append("model", "saarika:v2.5");
      form.append("language_code", "unknown");

      const sttRes = await fetch(`${SARVAM}/speech-to-text`, {
        method: "POST",
        headers: { "api-subscription-key": sarvamKey },
        body: form,
      });
      if (!sttRes.ok) {
        console.error("sarvam stt", sttRes.status, (await sttRes.text()).slice(0, 300));
        return NextResponse.json({ error: "could not hear you" }, { status: 502 });
      }
      const stt = (await sttRes.json()) as { transcript: string; language_code?: string };
      transcript = (stt.transcript || "").trim();
      if (!transcript) {
        return NextResponse.json({ error: "empty transcript" }, { status: 422 });
      }
      detected = stt.language_code || appLangCode;
    } else if (text) {
      transcript = text.trim();
    } else {
      // greet: hidden trigger — not stored in the visible conversation
      transcript =
        "[The customer just sat down and opened the voice assistant. Greet them and start the conversation.]";
    }

    const langName =
      detected.startsWith("hi") ? "Hindi"
      : detected.startsWith("te") ? "Telugu"
      : detected.startsWith("en") && audio ? "English"
      : language || "English";

    const menu = await menuPromise;
    const allMessages: ChatMessage[] = [
      ...(messages ?? []),
      { role: "user", text: transcript },
    ];
    let anna;
    if (MOCK) {
      anna = mockAsk(menu, transcript, cart ?? [], langName, Boolean(greet));
    } else {
      try {
        anna = await askAnna(menu, allMessages, cart ?? [], langName, { voice: true });
      } catch {
        // brain throttled/down: stay conversational instead of erroring the dock
        anna = fallbackReply(langName, Boolean(greet));
      }
    }

    // the brain's judgement wins for code-mixed speech (Hinglish → hi, Tenglish → te)
    const uiLanguage =
      anna.uiLanguage === "hi" || anna.uiLanguage === "te" || anna.uiLanguage === "en"
        ? anna.uiLanguage
        : detected.startsWith("hi")
          ? "hi"
          : detected.startsWith("te")
            ? "te"
            : "en";

    // speak the reply in the language the customer is actually using
    const ttsLang =
      uiLanguage === "hi" ? "hi-IN" : uiLanguage === "te" ? "te-IN" : "en-IN";
    let audioOut: string | null = null;
    const ttsRes = MOCK ? null : await fetch(`${SARVAM}/text-to-speech`, {
      method: "POST",
      headers: { "api-subscription-key": sarvamKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: anna.reply.slice(0, 1500),
        target_language_code: ttsLang,
        model: "bulbul:v3",
      }),
    });
    if (ttsRes?.ok) {
      const tts = (await ttsRes.json()) as { audios?: string[] };
      audioOut = tts.audios?.[0] ?? null;
    } else if (ttsRes) {
      console.error("sarvam tts", ttsRes.status, (await ttsRes.text()).slice(0, 300));
    }

    return NextResponse.json({
      transcript: greet ? "" : transcript,
      detectedLanguage: detected,
      uiLanguage,
      reply: anna.reply,
      actions: anna.actions,
      suggestCheckout: anna.suggestCheckout,
      showItems: anna.showItems ?? [],
      quickReplies: anna.quickReplies ?? [],
      audio: audioOut,
    });
  } catch (e) {
    console.error("voice route:", e);
    return NextResponse.json({ error: "voice failed" }, { status: 500 });
  }
}
