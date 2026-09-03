import { Navigate, useParams } from "react-router";
import OrderExperience from "@/components/order/OrderExperience";
import { useLegacyTable, useMenu } from "@/api/hooks";

// The customer experience behind a table's QR code. The legacy Next route
// resolved the menu on the server before rendering; the SPA fetches it, so the
// page owns the loading and unknown-table states the server used to handle.
export default function TablePage({ legacy = false }: { legacy?: boolean }) {
  const { code = "", slug, tableCode: routeTableCode } = useParams();
  const legacyLookup = useLegacyTable(code, legacy);
  const outletSlug = legacy ? (legacyLookup.data?.outletSlug ?? "") : (slug ?? "");
  const tableCode = legacy ? (legacyLookup.data?.tableCode ?? code) : routeTableCode;
  const { data: menu, isPending, isError } = useMenu({ outletSlug, tableCode });

  if (legacy && legacyLookup.isPending) {
    return <Loading text="Finding this table…" />;
  }

  if (legacy && !legacyLookup.data?.outletSlug) {
    return <ErrorState table />;
  }

  if (legacy && legacyLookup.data && outletSlug) {
    return (
      <Navigate
        to={`/outlet/${encodeURIComponent(outletSlug)}/table/${encodeURIComponent(tableCode ?? code)}`}
        replace
      />
    );
  }

  if (isPending) {
    return <Loading text="Loading the menu…" />;
  }

  if (isError || !menu) {
    return <ErrorState table={Boolean(tableCode)} />;
  }

  return <OrderExperience outletSlug={outletSlug} tableCode={tableCode} menu={menu} />;
}

function Loading({ text }: { text: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-100 p-6 text-center">
      <p className="text-sm text-stone-500">{text}</p>
    </main>
  );
}

function ErrorState({ table }: { table: boolean }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-stone-100 p-6 text-center">
      <div>
        <p className="text-sm font-semibold text-stone-700">
          {table ? "We could not load this table." : "We could not load this outlet."}
        </p>
        <p className="mt-1 text-xs text-stone-500">
          Scan the QR code again, or ask a member of staff for help.
        </p>
      </div>
    </main>
  );
}
