import AdminShell from "@/components/AdminShell";
import OrderPad from "@/components/OrderPad";
import { fetchMenu } from "@/lib/menu";

// The waiter's own way in. Same record as a guest order — same rounds, same
// kitchen tickets, same bill — but a different experience: no photos, no games,
// no conversation. A waiter standing at a table wants the whole menu on one
// screen, searchable, and a way to say what was asked for out loud.
export default async function WaiterOrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const menu = await fetchMenu(code);

  return (
    <AdminShell>
      <main className="console min-h-dvh p-4 sm:p-6">
        <OrderPad
          tableCode={code}
          tableLabel={menu.tableLabel}
          categories={menu.categories.map((c) => ({
            id: c.id,
            name: c.name.en,
            emoji: c.emoji,
          }))}
          items={menu.items.map((m) => ({
            id: m.id,
            categoryId: m.categoryId,
            name: m.name.en,
            priceInr: m.priceInr,
            isVeg: m.isVeg,
            isAvailable: m.isAvailable,
            emoji: m.emoji,
          }))}
        />
      </main>
    </AdminShell>
  );
}
