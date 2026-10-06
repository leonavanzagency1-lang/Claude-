/**
 * PDF:ens standardtypsnitt (Helvetica) använder teckenkodningen WinAnsi. Tecken
 * utanför den (t.ex. ≈ eller −) skulle bli fel, så de ersätts med närliggande tecken.
 */
const REPLACEMENTS: Record<string, string> = {
  "−": "-",
  "≈": "ca ",
  "≤": "<=",
  "≥": ">=",
  "→": "->",
  "←": "<-",
  "✓": "OK",
  "✔": "OK",
  " ": " ",
  " ": " ",
  "‑": "-",
  "′": "'",
  "″": '"',
};

const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

function isWinAnsi(ch: string): boolean {
  const code = ch.codePointAt(0)!;
  return (
    ch === "\n" ||
    ch === "\t" ||
    (code >= 0x20 && code <= 0x7e) ||
    (code >= 0xa0 && code <= 0xff) ||
    WIN_ANSI_EXTRA.has(ch)
  );
}

export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of text) {
    if (isWinAnsi(ch)) out += ch;
    else out += REPLACEMENTS[ch] ?? "?";
  }
  return out;
}

/** Tillämpar pdfSafe på alla strängar i ett objekt (rekursivt). */
export function pdfSafeDeep<T>(value: T): T {
  if (typeof value === "string") return pdfSafe(value) as T;
  if (Array.isArray(value)) return value.map(pdfSafeDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, pdfSafeDeep(v)])) as T;
  }
  return value;
}
