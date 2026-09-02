import { NextRequest, NextResponse } from "next/server";
import { fetchMenu } from "@/lib/menu";
import { askAnna } from "@/lib/anna";
import { getApiKeys } from "@/lib/keys";
import type { CartLine, ChatMessage } from "@/lib/types";

export const maxDuration = 60;

const SARVAM = "https://api.sarvam.ai";

// Sarvam STT auto-detects the spoken language; we answer (text + speech) in it.
export async function POST(req: NextRequest) {
  const { sarvam: sarvamKey } = await getApiKeys();
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

    if (audio) {
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

    const menu = await fetchMenu(tableCode || "");
    const allMessages: ChatMessage[] = [
      ...(messages ?? []),
      { role: "user", text: transcript },
    ];
    const anna = await askAnna(menu, allMessages, cart ?? [], langName, { voice: true });

    // speak the reply in the same language the customer spoke
    const ttsLang = ["en-IN", "hi-IN", "te-IN", "ta-IN", "kn-IN", "ml-IN", "mr-IN", "bn-IN", "gu-IN", "pa-IN", "od-IN"].includes(detected)
      ? detected
      : "en-IN";
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

    return NextResponse.json({
      transcript: greet ? "" : transcript,
      detectedLanguage: detected,
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
