"use client";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-md border border-line bg-surface px-5 py-8 text-center">
      <h1 className="mb-2 text-[16px] font-semibold">No pudimos cargar esta pantalla</h1>
      <p className="mb-5 text-[13px] text-ink-muted">
        {process.env.NODE_ENV === "development" ? error.message : "Probá de nuevo en unos segundos."}
      </p>
      <Button variante="primario" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
