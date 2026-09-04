import { useCallback, useEffect, useRef, useState } from "react";
import { blobToWavBase64 } from "@/lib/audio";
import { VAD, levelFromRms, rmsOf, stepVad, turnEnded, type VadState } from "@/lib/vad";
import { Button } from "@/components/ui/button";

export type VoiceTurnResult = {
  transcript: string;
  reply: string;
  audio: string | null;
  endConversation?: boolean;
  quickReplies: string[];
} | null;

type Status = "listening" | "thinking" | "speaking" | "idle";

// Compact voice dock: Narada talks while the customer keeps browsing the menu.
// The parent scrolls/highlights menu items he mentions; this dock shows state,
// the last exchange, and tappable quick replies. VAD keeps it hands-free.
export default function VoiceMode({
  onGreet,
  onTurn,
  onTextTurn,
  onClose,
  minimal = false,
  strings,
}: {
  onGreet: () => Promise<VoiceTurnResult>;
  onTurn: (wavBase64: string) => Promise<VoiceTurnResult>;
  onTextTurn: (text: string) => Promise<VoiceTurnResult>;
  onClose: () => void;
  minimal?: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [lastAnna, setLastAnna] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [level, setLevel] = useState(0);
  const closedRef = useRef(false);
  const discardRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const vadIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startListeningRef = useRef<() => void>(() => {});

  const cleanupListening = useCallback(() => {
    if (vadIvRef.current) clearInterval(vadIvRef.current);
    vadIvRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const handleResult = useCallback(
    (res: VoiceTurnResult, startListening: () => void) => {
      if (closedRef.current) return;
      if (!res) {
        setError("Couldn't reach the waiter service — try again.");
        setStatus("idle");
        return;
      }
      setLastAnna(res.reply);
      setChips(res.quickReplies);
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
    },
    [onClose],
  );

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
      discardRef.current = false;
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      let vad: VadState = { spoke: false, silentMs: 0, totalMs: 0 };
      vadIvRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        const rms = rmsOf(data);
        setLevel(levelFromRms(rms));
        vad = stepVad(vad, rms);
        if (turnEnded(vad) && recorder.state !== "inactive") recorder.stop();
      }, VAD.tickMs);

      recorder.onstop = async () => {
        const hadSpeech = vad.spoke;
        const discarded = discardRef.current;
        cleanupListening();
        if (closedRef.current || discarded) return;
        if (!hadSpeech) {
          closedRef.current = true;
          onClose();
          return;
        }
        setStatus("thinking");
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const wav = await blobToWavBase64(blob);
          handleResult(await onTurn(wav), () => startListeningRef.current());
        } catch {
          if (!closedRef.current) startListeningRef.current();
        }
      };
      recorder.start();
    } catch {
      setError("Microphone unavailable — allow mic access for this site, then try again.");
      setStatus("idle");
    }
  }, [cleanupListening, handleResult, onClose, onTurn]);
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const stopListeningSilently = useCallback(() => {
    discardRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    cleanupListening();
  }, [cleanupListening]);

  const sendText = useCallback(
    async (text: string) => {
      if (status === "thinking" || status === "speaking") return;
      stopListeningSilently();
      setStatus("thinking");
      handleResult(await onTextTurn(text), startListening);
    },
    [handleResult, onTextTurn, startListening, status, stopListeningSilently],
  );

  useEffect(() => {
    // reset for StrictMode remounts — cleanup below marks the ref closed
    closedRef.current = false;
    discardRef.current = false;
    (async () => {
      setStatus("thinking");
      handleResult(await onGreet(), startListening);
    })();
    return () => {
      closedRef.current = true;
      cleanupListening();
      playerRef.current?.pause();
    };
    // mount-only: the greeting must play exactly once per opened dock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const end = () => {
    closedRef.current = true;
    stopListeningSilently();
    playerRef.current?.pause();
    onClose();
  };

  const statusText =
    status === "listening"
      ? strings.listening
      : status === "thinking"
        ? strings.thinking
        : strings.speaking;

  if (minimal) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 mx-auto flex max-w-md flex-col items-center gap-2 px-4">
        {error && (
          <Button
            variant="outline"
            onClick={() => {
              setError(null);
              startListening();
            }}
            className="pointer-events-auto rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-900 shadow-xl"
          >
            ⚠️ {error.slice(0, 60)} — tap to retry
          </Button>
        )}
        {chips.length > 0 && !error && (
          <div className="pointer-events-auto flex max-w-full gap-2 overflow-x-auto">
            {chips.map((chip) => (
              <Button
                variant="outline"
                key={chip}
                onClick={() => sendText(chip)}
                disabled={status === "thinking"}
                className="animate-pop shrink-0 rounded-full bg-black/60 px-4 py-2 text-xs font-bold whitespace-nowrap text-white ring-1 ring-white/30 backdrop-blur transition active:scale-95 disabled:opacity-40"
              >
                {chip}
              </Button>
            ))}
          </div>
        )}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          <Button
            variant="ghost"
            onClick={() => {
              if (status === "listening" && recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
              }
            }}
            aria-label="narada voice orb"
            className="relative grid h-24 w-24 place-items-center rounded-full"
          >
            <span
              className={`absolute inset-0 rounded-full transition-transform duration-150 ${
                status === "listening"
                  ? "bg-rose-600/35"
                  : status === "speaking"
                    ? "animate-pulse bg-sky-500/35"
                    : "bg-stone-500/35"
              }`}
              style={
                status === "listening" ? { transform: `scale(${1 + level * 0.55})` } : undefined
              }
            />
            <span
              className={`relative grid h-18 w-18 place-items-center rounded-full text-3xl shadow-2xl ${
                status === "listening"
                  ? "bg-rose-600 shadow-rose-600/50"
                  : status === "speaking"
                    ? "bg-sky-600 shadow-sky-600/50"
                    : "bg-stone-800"
              }`}
              style={{ height: "4.5rem", width: "4.5rem" }}
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
          </Button>
          <p className="text-xs font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,.9)]">
            {status === "listening"
              ? strings.listening
              : status === "thinking"
                ? strings.thinking
                : strings.speaking}
          </p>
          <Button
            variant="ghost"
            onClick={end}
            aria-label={strings.endVoice}
            className="mt-0.5 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur transition active:scale-95"
          >
            ✕
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md px-3 pb-3">
      <div className="rounded-3xl bg-stone-950/95 p-3 shadow-2xl shadow-stone-950/50 ring-1 ring-white/10 backdrop-blur">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              if (status === "listening" && recorderRef.current?.state === "recording") {
                recorderRef.current.stop();
              }
            }}
            className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full"
            aria-label="narada voice orb"
          >
            <span
              className={`absolute inset-0 rounded-full transition-transform duration-150 ${
                status === "listening"
                  ? "bg-rose-600/40"
                  : status === "speaking"
                    ? "animate-pulse bg-sky-500/40"
                    : "bg-stone-500/30"
              }`}
              style={
                status === "listening" ? { transform: `scale(${1 + level * 0.6})` } : undefined
              }
            />
            <span
              className={`relative grid h-9 w-9 place-items-center rounded-full text-lg ${
                status === "listening"
                  ? "bg-rose-600"
                  : status === "speaking"
                    ? "bg-sky-600"
                    : "bg-stone-700"
              }`}
            >
              {status === "thinking" ? (
                <span className="flex gap-0.5">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              ) : (
                "🎙️"
              )}
            </span>
          </Button>

          <div className="min-w-0 flex-1 text-left">
            <p className="text-[11px] font-bold text-white">
              Narada ·{" "}
              <span className="font-medium text-stone-400">{error ? "⚠️" : statusText}</span>
            </p>
            <p className="line-clamp-2 text-xs leading-snug text-stone-300">
              {error ?? (lastAnna || strings.voiceHint)}
            </p>
          </div>

          <Button
            variant="secondary"
            onClick={end}
            aria-label={strings.endVoice}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold text-white transition active:scale-95"
          >
            ✕
          </Button>
        </div>

        {error && (
          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              startListening();
            }}
            className="mt-2 w-full rounded-xl bg-white px-4 py-2 text-xs font-bold text-stone-900 transition active:scale-[0.98]"
          >
            Try again
          </Button>
        )}

        {chips.length > 0 && !error && (
          <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
            {chips.map((chip) => (
              <Button
                variant="ghost"
                key={chip}
                onClick={() => sendText(chip)}
                disabled={status === "thinking"}
                className="animate-pop shrink-0 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold whitespace-nowrap text-white ring-1 ring-white/25 transition active:scale-95 disabled:opacity-40"
              >
                {chip}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
