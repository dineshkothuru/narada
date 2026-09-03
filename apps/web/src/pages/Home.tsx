import { LANGS } from "@narada/shared";
import { Button } from "@/components/ui/button";
import { useHealth } from "@/api/hooks";

export function HomePage() {
  const health = useHealth();

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8">
      <Button>Narada</Button>
      <p className="text-sm text-muted-foreground">
        Languages: {LANGS.map((l) => l.label).join(" · ")}
      </p>
      <p className="text-sm text-muted-foreground">
        API health:{" "}
        {health.isLoading ? "checking…" : health.isError ? "unreachable" : String(health.data?.ok)}
      </p>
    </main>
  );
}
