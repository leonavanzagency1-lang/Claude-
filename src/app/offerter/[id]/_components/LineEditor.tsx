"use client";

import { formatBp, formatOre } from "@/lib/calc/money";
import { CONFIDENCES, LINE_TYPES, TYPE_LABELS, UNITS, type LineType, type Unit } from "@/lib/domain";
import type { ArticleDto } from "@/lib/dto";
import { Button, Input, Select, cx } from "@/components/ui";
import { priceToText, type LineState } from "./lineState";

const CONF_STYLE = {
  hög: "bg-green-100 text-green-800",
  medel: "bg-amber-100 text-amber-900",
  låg: "bg-red-100 text-red-800",
} as const;

const PRICE_SOURCE_LABEL = { prislista: "pris från prislistan", timpris: "firmans timpris", manuell: "manuellt pris" } as const;

export function LineEditor({
  line,
  index,
  count,
  articles,
  issues,
  parseErrors,
  amountOre,
  disabled,
  onChange,
  onMove,
  onRemove,
}: {
  line: LineState;
  index: number;
  count: number;
  articles: ArticleDto[];
  issues: string[];
  parseErrors: string[];
  amountOre: number;
  disabled: boolean;
  onChange: (next: LineState) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const flagged = issues.length > 0 || parseErrors.length > 0;

  function pickArticle(value: string) {
    if (value === "") {
      onChange({ ...line, articleId: null, articleNumber: null });
      return;
    }
    const a = articles.find((x) => x.id === Number(value));
    if (!a) return;
    onChange({
      ...line,
      articleId: a.id,
      articleNumber: a.number,
      description: line.description.trim() === "" ? a.name : line.description,
      unit: a.unit as Unit,
      type: a.type as LineType,
      unitPriceOre: a.unitPriceOre,
      priceText: priceToText(a.unitPriceOre),
      markupBp: a.markupBp,
      markupText: formatBp(a.markupBp).replace(/\u00a0/g, ""),
      priceSource: "prislista",
    });
  }

  return (
    <li
      className={cx(
        "rounded-lg border p-3",
        flagged ? "border-red-300 bg-red-50/60" : line.confidence === "medel" && !line.confirmed ? "border-amber-200 bg-amber-50/40" : "border-stone-200 bg-white",
      )}
      data-testid="quote-line"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-stone-500">#{index + 1}</span>
        <span className={cx("rounded-full px-2 py-0.5 font-medium", CONF_STYLE[line.confidence])}>Säkerhet: {line.confidence}</span>
        {line.articleId === null && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">Ingen artikel</span>}
        {line.unitPriceOre === null && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-800">Pris saknas</span>}
        {line.origin === "ai" && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-stone-700">AI-förslag</span>}
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" className="min-h-8 px-2 py-1" disabled={disabled || index === 0} onClick={() => onMove(-1)} aria-label="Flytta upp">
            ↑
          </Button>
          <Button variant="ghost" className="min-h-8 px-2 py-1" disabled={disabled || index === count - 1} onClick={() => onMove(1)} aria-label="Flytta ned">
            ↓
          </Button>
          <Button variant="ghost" className="min-h-8 px-2 py-1 text-red-700" disabled={disabled} onClick={onRemove} aria-label="Ta bort rad">
            ✕
          </Button>
        </span>
      </div>

      <div className="grid grid-cols-6 gap-2">
        <label className="col-span-6 md:col-span-2">
          <span className="text-xs text-stone-600">Artikel</span>
          <Select value={line.articleId ?? ""} onChange={(e) => pickArticle(e.target.value)} disabled={disabled}>
            <option value="">– Ingen artikel –</option>
            {articles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.number} {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="col-span-6 md:col-span-4">
          <span className="text-xs text-stone-600">Beskrivning</span>
          <Input value={line.description} onChange={(e) => onChange({ ...line, description: e.target.value })} disabled={disabled} />
        </label>
        <label className="col-span-2 md:col-span-1">
          <span className="text-xs text-stone-600">Mängd</span>
          <Input inputMode="decimal" value={line.qtyText} onChange={(e) => onChange({ ...line, qtyText: e.target.value })} disabled={disabled} />
        </label>
        <label className="col-span-2 md:col-span-1">
          <span className="text-xs text-stone-600">Enhet</span>
          <Select value={line.unit} onChange={(e) => onChange({ ...line, unit: e.target.value as Unit })} disabled={disabled}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </Select>
        </label>
        <label className="col-span-2 md:col-span-1">
          <span className="text-xs text-stone-600">Typ</span>
          <Select value={line.type} onChange={(e) => onChange({ ...line, type: e.target.value as LineType })} disabled={disabled}>
            {LINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </label>
        <label className="col-span-3 md:col-span-1">
          <span className="text-xs text-stone-600">À-pris kr</span>
          <Input
            inputMode="decimal"
            value={line.priceText}
            placeholder="saknas"
            onChange={(e) => onChange({ ...line, priceText: e.target.value, priceSource: "manuell" })}
            disabled={disabled}
            className={line.priceText.trim() === "" ? "border-red-400" : undefined}
          />
        </label>
        <label className="col-span-3 md:col-span-1">
          <span className="text-xs text-stone-600">Påslag %</span>
          <Input inputMode="decimal" value={line.markupText} onChange={(e) => onChange({ ...line, markupText: e.target.value })} disabled={disabled} />
        </label>
        <div className="col-span-6 flex items-end justify-end md:col-span-1">
          <span className="pb-2 font-medium tabular-nums">{formatOre(amountOre)}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600">
        {line.source && <span className="italic">Källa: ”{line.source}”</span>}
        {line.priceSource && <span>({PRICE_SOURCE_LABEL[line.priceSource]})</span>}
        <label className="flex items-center gap-1">
          <span>Säkerhet</span>
          <select
            value={line.confidence}
            onChange={(e) => onChange({ ...line, confidence: e.target.value as LineState["confidence"] })}
            disabled={disabled}
            className="rounded border border-stone-300 bg-white px-1 py-0.5 text-xs"
          >
            {CONFIDENCES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="ml-auto flex items-center gap-2 text-sm font-medium text-stone-800">
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={line.confirmed}
            onChange={(e) => onChange({ ...line, confirmed: e.target.checked })}
            disabled={disabled}
          />
          Bekräftad
        </label>
      </div>

      {(issues.length > 0 || parseErrors.length > 0) && (
        <ul className="mt-2 list-disc pl-5 text-sm text-red-800">
          {[...parseErrors, ...issues].map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
