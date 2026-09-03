import { useEffect, useRef } from "react";
import { inr, type ChatMessage, type STRINGS } from "@narada/shared";

type Strings = (typeof STRINGS)["en"];

// Narada's text chat. The orchestrator owns the transcript and the request, so
// this sheet only renders it and reports what the guest typed or tapped.
export default function Chat({
  messages,
  draft,
  chips,
  thinking,
  itemCount,
  total,
  t,
  onDraft,
  onSend,
  onReviewOrder,
  onSwitchToVoice,
  onClose,
}: {
  messages: ChatMessage[];
  draft: string;
  chips: string[];
  thinking: boolean;
  itemCount: number;
  total: number;
  t: Strings;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
  onReviewOrder: () => void;
  onSwitchToVoice: () => void;
  onClose: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="animate-fade-in absolute inset-0 bg-stone-950/50" onClick={onClose} />
      <div className="animate-sheet-up relative flex h-[80dvh] flex-col rounded-t-[2rem] bg-white">
        <div className="flex items-center gap-3 rounded-t-[2rem] bg-stone-900 px-5 py-4 text-white">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-rose-600 text-xl">
            🎙️
          </span>
          <div className="flex-1">
            <p className="text-sm font-bold">Narada</p>
            <p className="text-[11px] text-stone-400">{t.annaRole}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="close chat"
            className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-4xl">🙏</p>
              <p className="max-w-60 text-sm text-stone-500">{t.annaGreeting}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {t.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => onSend(s)}
                    className="rounded-full bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 ring-1 ring-rose-100 transition active:scale-95"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "self-end rounded-br-md bg-stone-900 text-white"
                    : "self-start rounded-bl-md bg-stone-100 text-stone-800"
                }`}
              >
                {m.text}
              </div>
            ))}
            {thinking && (
              <div className="flex gap-1.5 self-start rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-stone-400" />
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {itemCount > 0 && (
          <button
            onClick={onReviewOrder}
            className="mx-4 mb-2 flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 ring-1 ring-stone-200"
          >
            <span>
              🛒 {t.items(itemCount)} · {inr(total)}
            </span>
            <span className="text-rose-600">{t.reviewOrder}</span>
          </button>
        )}

        {chips.length > 0 && (
          <div className="no-scrollbar mx-4 mb-1 flex gap-2 overflow-x-auto">
            {chips.map((chip) => (
              <button
                key={chip}
                onClick={() => onSend(chip)}
                disabled={thinking}
                className="animate-pop shrink-0 rounded-full bg-rose-50 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap text-rose-700 ring-1 ring-rose-100 transition active:scale-95 disabled:opacity-40"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend(draft);
          }}
          className="flex items-center gap-2 border-t border-stone-100 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={onSwitchToVoice}
            aria-label="speak to Narada"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-100 text-lg text-stone-700 transition active:scale-90"
          >
            🎙️
          </button>
          <input
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            placeholder={t.askAnna}
            className="flex-1 rounded-full bg-stone-100 px-4 py-3 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-rose-400"
          />
          <button
            type="submit"
            disabled={thinking || !draft.trim()}
            aria-label="send"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-600 text-lg text-white shadow transition active:scale-90 disabled:opacity-40"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
