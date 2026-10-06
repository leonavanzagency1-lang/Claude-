import Link from "next/link";
import { cx } from "./ui";

const STEPS = [
  { key: "underlag", label: "1. Underlag", href: (id: number) => `/offerter/${id}/underlag` },
  { key: "transkribering", label: "2. Transkribering", href: (id: number) => `/offerter/${id}/transkribering` },
  { key: "granskning", label: "3. Granskning & PDF", href: (id: number) => `/offerter/${id}` },
] as const;

export function QuoteSteps({ id, current, number, customer }: { id: number; current: (typeof STEPS)[number]["key"]; number: string; customer: string }) {
  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-2xl font-semibold">{customer}</h1>
        <span className="font-mono text-sm text-stone-500">Offert {number}</span>
      </div>
      <nav className="flex flex-wrap gap-1 text-sm">
        {STEPS.map((s) => (
          <Link
            key={s.key}
            href={s.href(id)}
            className={cx(
              "whitespace-nowrap rounded-md px-3 py-2",
              s.key === current ? "bg-stone-800 text-white" : "bg-white text-stone-700 hover:bg-stone-200",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
