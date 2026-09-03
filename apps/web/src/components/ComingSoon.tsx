// Placeholder for a route not yet ported from the legacy Next.js app. A
// later batch replaces the page component this renders, not the route table.
export default function ComingSoon({ name }: { name: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-4xl">🪈</p>
      <h1 className="font-display text-xl font-semibold text-stone-900">{name}</h1>
      <p className="text-sm text-stone-500">This screen isn't ported yet.</p>
    </main>
  );
}
