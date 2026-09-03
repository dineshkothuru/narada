"use client";

import { useRouter } from "next/navigation";
import TableSheet, { shareBillOnWhatsApp } from "./TableSheet";
import { ask } from "./Dialogs";

// The page wrapper: the same view the counter opens in a popup, given room.
export default function TableView({
  sessionId,
  label,
  code,
}: {
  sessionId: string;
  label: string;
  code: string;
}) {
  const router = useRouter();

  const cancelItem = async (itemId: string, name: string) => {
    const yes = await ask.confirm({
      title: `Remove ${name}?`,
      message: "It comes off the bill. This is recorded against your name.",
      confirmLabel: "Remove it",
      danger: true,
    });
    if (!yes) return;
    await fetch("/api/waiter", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_item", itemId }),
    });
    router.refresh();
  };

  return (
    <TableSheet
      page
      sessionId={sessionId}
      label={label}
      tableCode={code}
      onClose={() => router.push("/waiter")}
      onCancelItem={cancelItem}
      onShare={(net) => shareBillOnWhatsApp({ sessionId, label, net })}
    />
  );
}
