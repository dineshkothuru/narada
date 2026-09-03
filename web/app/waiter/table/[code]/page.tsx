import AdminShell from "@/components/AdminShell";
import TableView from "@/components/TableView";
import { sbFetch } from "@/lib/supabase-server";

// A table's own page: everything it has ordered, what it owes, and the menu to
// add another round — with room to read a dish name without truncating it,
// which a popup never had.
export default async function TablePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const tables = await sbFetch<{ id: string; label: string }[]>(
    `tables?select=id,label&code=eq.${encodeURIComponent(code)}&limit=1`,
  );
  const table = tables[0];
  const sessions = table
    ? await sbFetch<{ id: string }[]>(
        `sessions?select=id&table_id=eq.${table.id}&status=eq.active&limit=1`,
      )
    : [];

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        {!table ? (
          <p className="panel max-w-3xl p-8 text-center text-xs text-slate-400">
            No table with that code.
          </p>
        ) : sessions.length === 0 ? (
          <p className="panel max-w-3xl p-8 text-center text-xs text-slate-400">
            {table.label} has no open tab. Seat guests from the floor first.
          </p>
        ) : (
          <TableView sessionId={sessions[0].id} label={table.label} code={code} />
        )}
      </main>
    </AdminShell>
  );
}
