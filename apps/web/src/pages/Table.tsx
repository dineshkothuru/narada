import { useParams } from "react-router";
import OrderExperience from "@/components/order/OrderExperience";
import { useMenu } from "@/api/hooks";

// The customer experience behind a table's QR code. The legacy Next route
// resolved the menu on the server before rendering; the SPA fetches it, so the
// page owns the loading and unknown-table states the server used to handle.
export default function TablePage() {
  const { code = "" } = useParams();
  const { data: menu, isPending, isError } = useMenu(code);

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-stone-100 p-6 text-center">
        <p className="text-sm text-stone-500">Loading the menu…</p>
      </main>
    );
  }

  if (isError || !menu) {
    return (
      <main className="grid min-h-dvh place-items-center bg-stone-100 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-stone-700">We could not load this table.</p>
          <p className="mt-1 text-xs text-stone-500">
            Scan the QR code again, or ask a member of staff for help.
          </p>
        </div>
      </main>
    );
  }

  return <OrderExperience tableCode={code} menu={menu} />;
}
