import { useMemo, useRef, useState } from "react";
import { inr, type CartLine } from "@narada/shared";
import type { WaiterMenuResponse } from "@/api/hooks";
import { usePlaceOrder, useWaiterDictate } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SearchIcon } from "lucide-react";

function audioToBase64(blob: Blob): Promise<string> {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  });
}

export default function StaffOrderPad({
  outletSlug,
  tableCode,
  sessionId,
  menu,
  onPlaced,
}: {
  outletSlug: string;
  tableCode: string;
  sessionId: string;
  menu: WaiterMenuResponse;
  onPlaced: () => void;
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState<string | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [readBack, setReadBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const place = usePlaceOrder();
  const dictate = useWaiterDictate();
  const items = useMemo(
    () =>
      menu.items.filter(
        (item) =>
          (!category || item.categoryId === category) &&
          item.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [menu.items, category, query],
  );
  const count = cart.reduce((total, line) => total + line.qty, 0);
  const total = cart.reduce(
    (sum, line) =>
      sum + (menu.items.find((item) => item.id === line.itemId)?.priceInr ?? 0) * line.qty,
    0,
  );

  const add = (itemId: string, qty = 1) =>
    setCart((current) => {
      const found = current.find((line) => line.itemId === itemId);
      if (!found) return qty > 0 ? [...current, { itemId, qty }] : current;
      const nextQty = found.qty + qty;
      return nextQty > 0
        ? current.map((line) => (line.itemId === itemId ? { ...line, qty: nextQty } : line))
        : current.filter((line) => line.itemId !== itemId);
    });

  const listen = async () => {
    if (listening) {
      recorder.current?.stop();
      return;
    }
    setError(null);
    setHeard(null);
    setUnmatched([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: BlobPart[] = [];
      const next = new MediaRecorder(stream);
      recorder.current = next;
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      next.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setListening(false);
        try {
          const result = await dictate.mutateAsync({
            tableCode,
            audio: await audioToBase64(new Blob(chunks, { type: next.mimeType || "audio/webm" })),
          });
          setHeard(result.transcript);
          setUnmatched(result.unmatched);
          result.lines.forEach((line) => add(line.itemId, line.qty));
          setReadBack(true);
        } catch {
          setError("Could not read that back. Try again or use search.");
        }
      };
      next.start();
      setListening(true);
    } catch {
      setError("Microphone access is unavailable. Use menu search instead.");
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0 || place.isPending) return;
    setError(null);
    try {
      await place.mutateAsync({
        outletSlug,
        tableCode,
        sessionId,
        serviceType: "dine_in",
        cart,
        placedVia: "waiter",
        guestName: "",
        lang: "en",
      });
      setCart([]);
      setHeard(null);
      setUnmatched([]);
      onPlaced();
    } catch {
      setError("Could not send this round. Your cart is still here.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Field className="min-w-0 flex-1 gap-0">
          <FieldLabel htmlFor="staff-menu-search" className="sr-only">
            Search the menu
          </FieldLabel>
          <InputGroup className="h-10 rounded-xl bg-white ring-1 ring-slate-200">
            <InputGroupInput
              id="staff-menu-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the menu…"
            />
            <InputGroupAddon align="inline-end">
              <SearchIcon aria-hidden="true" />
            </InputGroupAddon>
          </InputGroup>
        </Field>
        <Button
          variant={listening ? "default" : "outline"}
          size="icon-lg"
          onClick={listen}
          aria-label={listening ? "Stop dictation" : "Dictate order"}
          className="rounded-full"
        >
          {listening ? "■" : "🎙️"}
        </Button>
      </div>
      {heard && (
        <Alert variant="info">
          <AlertDescription>Heard: “{heard}”</AlertDescription>
        </Alert>
      )}
      {unmatched.length > 0 && (
        <Alert variant="warning">
          <AlertDescription>Not found: {unmatched.join(", ")}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ToggleGroup
        type="single"
        value={category ?? "all"}
        onValueChange={(value) => setCategory(value === "all" ? null : value || null)}
        className="no-scrollbar w-full justify-start overflow-x-auto"
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="all" aria-label="Everything">
          Everything
        </ToggleGroupItem>
        {menu.categories.map((item) => (
          <ToggleGroupItem key={item.id} value={item.id}>
            {item.emoji} {item.name}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center justify-between rounded-xl bg-white px-3 py-3 text-left ring-1 ring-slate-200 ${!item.isAvailable ? "opacity-45" : ""}`}
          >
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                {item.emoji} {item.name}
              </span>
              <span className="text-xs text-slate-500">
                {inr(item.priceInr)}
                {!item.isAvailable && " · sold out"}
              </span>
            </span>
            {item.isAvailable && (cart.find((line) => line.itemId === item.id)?.qty ?? 0) > 0 ? (
              <span className="flex shrink-0 items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => add(item.id, -1)}
                  aria-label={`one less ${item.name}`}
                >
                  −
                </Button>
                <span className="w-5 text-center text-sm font-bold tabular-nums">
                  {cart.find((line) => line.itemId === item.id)?.qty}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => add(item.id)}
                  aria-label={`one more ${item.name}`}
                >
                  +
                </Button>
              </span>
            ) : item.isAvailable ? (
              <Button variant="secondary" size="sm" onClick={() => add(item.id)}>
                Add
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {readBack && cart.length > 0 && (
        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-bold">Round to send</span>
            <Button variant="ghost" size="sm" onClick={() => setReadBack(false)}>
              Hide
            </Button>
          </div>
          <p className="mt-1">
            {cart
              .map(
                (line) =>
                  `${line.qty}× ${menu.items.find((item) => item.id === line.itemId)?.name ?? "item"}`,
              )
              .join(", ")}
          </p>
        </div>
      )}
      {count > 0 && (
        <div className="sticky bottom-0 flex items-center gap-3 border-t border-slate-200 bg-white/95 p-3 backdrop-blur">
          <Button
            variant="link"
            size="sm"
            onClick={() => setReadBack((value) => !value)}
            className="min-w-0 flex-1 justify-start truncate text-left"
          >
            {readBack
              ? "Hide the list"
              : cart
                  .map(
                    (line) =>
                      `${line.qty}× ${menu.items.find((item) => item.id === line.itemId)?.name ?? "item"}`,
                  )
                  .join(", ")}
          </Button>
          <span className="font-display text-lg font-semibold tabular-nums">{inr(total)}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setCart([]);
              setReadBack(false);
            }}
          >
            Clear
          </Button>
          <Button variant="default" size="sm" onClick={placeOrder} disabled={place.isPending}>
            {place.isPending && <Spinner data-icon="inline-start" />}
            {place.isPending ? "Sending…" : "Send to kitchen"}
          </Button>
        </div>
      )}
    </div>
  );
}
