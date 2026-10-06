"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUOTE_STATUSES, STATUS_LABELS, type QuoteStatus } from "@/lib/domain";
import { api, errorText } from "@/lib/client/api";
import type { QuoteDto } from "@/lib/dto";
import { Select } from "./ui";

/** Manuell statusändring. Systemet skickar aldrig något till kunden. */
export function StatusSelect({
  quoteId,
  status,
  onChanged,
}: {
  quoteId: number;
  status: string;
  onChanged?: (quote: QuoteDto) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: QuoteStatus) {
    setBusy(true);
    setError(null);
    try {
      const quote = await api<QuoteDto>(`/api/quotes/${quoteId}/status`, { method: "POST", json: { status: next } });
      onChanged?.(quote);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Select
        aria-label="Status"
        value={status}
        disabled={busy}
        onChange={(e) => change(e.target.value as QuoteStatus)}
        className="py-1"
      >
        {QUOTE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </Select>
      {error && <p className="mt-1 max-w-xs text-xs text-red-700">{error}</p>}
    </div>
  );
}
