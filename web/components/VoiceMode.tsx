"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWavBase64 } from "@/lib/audio";

export type VoiceTurnResult = {
  transcript: string;
  reply: string;
  audio: string | null;
  endConversation?: boolean;
} | null;

type Status = "listening" | "thinking" | "speaking" | "idle";

// Hands-free conversation: listen (voice-activity detection decides when the
// customer finished a sentence) -> think -> Anna speaks -> listen again.
export default function VoiceMode({
  onTurn,
  onClose,
  onSwitchToChat,
  strings,
}: {
  onTurn: (wavBase64: string) => Promise<VoiceTurnResult>;
  onClose: () => void;
  onSwitchToChat?: () => void;
  strings: {
    listening: string;
    thinking: string;
    speaking: string;
    endVoice: string;
    voiceHint: string;
    annaRole: string;
  };
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [lastUser, setLastUser] = useState("");
  const [lastAnna, setLastAnna] = useState("");
  const [level, setLevel] = useState(0);
  const closedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const vadIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupListening = useCallback(() => {
    if (vadIvRef.current) clearInterval(vadIvRef.current);
    vadIvRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    if (closedRef.current) return;
    setStatus("listening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (closedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      let spoke = false;
      let silentMs = 0;
      let totalMs = 0;
      vadIvRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(Math.min(1, rms * 8));
        totalMs += 100;
        if (rms > 0.02) {
          spoke = true;
          silentMs = 0;
        } else {
          silentMs += 100;
        }
        const doneSpeaking = spoke && silentMs > 1400;
        const tooLong = totalMs > 15000;
        const nothingSaid = !spoke && totalMs > 8000;
        if (doneSpeaking || tooLong || nothingSaid) {
          if (recorder.state !== "inactive") recorder.stop();
        }
      }, 100);

      recorder.onstop = async () => {
        const hadSpeech = spoke;
        cleanupListening();
        if (closedRef.current) return;
        if (!hadSpeech) {
          // silence — end the conversation politely instead of looping forever
          closedRef.current = true;
          onClose();
          return;
        }
        setStatus("thinking");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const wav = await blobToWavBase64(blob);
          const res = await onTurn(wav);
          if (closedRef.current) return;
          if (!res) {
            startListening();
            return;
          }
          setLastUser(res.transcript);
          setLastAnna(res.reply);
          if (res.audio) {
            setStatus("speaking");
            const player = new Audio(`data:audio/wav;base64,${res.audio}`);
            playerRef.current = player;
            player.onended = () => {
              if (closedRef.current) return;
              if (res.endConversation) {
                closedRef.current = true;
                onClose();
              } else {
                startListening();
              }
            };
            player.play().catch(() => startListening());
          } else if (res.endConversation) {
            closedRef.current = true;
            onClose();
          } else {
            startListening();
          }
        } catch {
          if (!closedRef.current) startListening();
        }
      };
      recorder.start();
    } catch {
      closedRef.current = true;
      onClose();
    }
  }, [cleanupListening, onClose, onTurn]);

  useEffect(() => {
    startListening();
    return () => {
      closedRef.current = true;
      cleanupListening();
      playerRef.current?.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = () => {
    closedRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanupListening();
    playerRef.current?.pause();
    onClose();
  };

  const statusText =
    status === "listening"
      ? strings.listening
      : status === "thinking"
        ? strings.thinking
        : strings.speaking;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-between bg-stone-950/95 px-6 py-10 text-center">
      <div className="mt-4">
        <p className="text-sm font-bold text-white">Narada</p>
        <p className="text-[11px] text-stone-400">{strings.annaRole}</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <button
          onClick={() => {
            if (status === "listening" && recorderRef.current?.state === "recording") {
              recorderRef.current.stop();
            }
          }}
          className="relative grid h-36 w-36 place-items-center rounded-full"
          aria-label="narada voice orb"
        >
          <span
            className={`absolute inset-0 rounded-full transition-transform duration-150 ${
              status === "listening"
                ? "bg-rose-600/30"
                : status === "speaking"
                  ? "animate-pulse bg-sky-500/30"
                  : "bg-stone-500/20"
            }`}
            style={
              status === "listening"
                ? { transform: `scale(${1 + level * 0.5})` }
                : undefined
            }
          />
          <span
            className={`relative grid h-24 w-24 place-items-center rounded-full text-4xl shadow-2xl ${
              status === "listening"
                ? "bg-rose-600"
                : status === "speaking"
                  ? "bg-sky-600"
                  : "bg-stone-700"
            }`}
          >
            {status === "thinking" ? (
              <span className="flex gap-1">
                <span className="typing-dot h-2 w-2 rounded-full bg-white" />
                <span className="typing-dot h-2 w-2 rounded-full bg-white" />
                <span className="typing-dot h-2 w-2 rounded-full bg-white" />
              </span>
            ) : (
              "🎙️"
            )}
          </span>
        </button>
        <p className="text-sm font-semibold text-white">{statusText}</p>

        <div className="min-h-20 max-w-sm space-y-2">
          {lastUser && (
            <p className="text-xs text-stone-400">
              🗣️ “{lastUser}”
            </p>
          )}
          {lastAnna && (
            <p className="text-sm leading-relaxed text-stone-100">{lastAnna}</p>
          )}
          {!lastUser && !lastAnna && (
            <p className="text-xs text-stone-400">{strings.voiceHint}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {onSwitchToChat && (
          <button
            onClick={() => {
              closedRef.current = true;
              if (recorderRef.current?.state === "recording") recorderRef.current.stop();
              cleanupListening();
              playerRef.current?.pause();
              onSwitchToChat();
            }}
            aria-label="switch to text chat"
            className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-xl ring-1 ring-white/20 transition active:scale-95"
          >
            ⌨️
          </button>
        )}
        <button
          onClick={end}
          className="rounded-full bg-white/10 px-8 py-3 text-sm font-bold text-white ring-1 ring-white/20 transition active:scale-95"
        >
          ✕ {strings.endVoice}
        </button>
      </div>
    </div>
  );
}
