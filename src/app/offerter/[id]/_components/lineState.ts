import { formatBp, formatMilli, parseKronor, parsePercent, parseQuantity } from "@/lib/calc/money";
import type { QuoteLineInput } from "@/lib/domain";

/** En rad i granskningsvyn: värden plus de texter användaren skriver i fälten. */
export interface LineState extends QuoteLineInput {
  key: string;
  qtyText: string;
  priceText: string;
  markupText: string;
}

let counter = 0;
export const newKey = () => `l${Date.now().toString(36)}${(counter++).toString(36)}`;

const priceToText = (ore: number | null) => (ore === null ? "" : (ore / 100).toFixed(2).replace(".", ","));

export function toState(line: QuoteLineInput): LineState {
  return {
    ...line,
    key: newKey(),
    qtyText: formatMilli(line.quantityMilli).replace(/ /g, ""),
    priceText: priceToText(line.unitPriceOre),
    markupText: formatBp(line.markupBp).replace(/ /g, ""),
  };
}

export { priceToText };

export interface ParsedLine {
  line: QuoteLineInput;
  errors: string[];
}

/** Tolkar fälttexterna. Ogiltiga värden ger felmeddelanden (och räknas som 0 i summeringen). */
export function parseState(s: LineState): ParsedLine {
  const errors: string[] = [];
  const qty = parseQuantity(s.qtyText);
  if (qty === null || qty < 0) errors.push("Ogiltig mängd");
  let price: number | null = null;
  if (s.priceText.trim() !== "") {
    price = parseKronor(s.priceText);
    if (price === null || price < 0) {
      errors.push("Ogiltigt pris");
      price = null;
    }
  }
  const markup = s.markupText.trim() === "" ? 0 : parsePercent(s.markupText);
  if (markup === null || markup < 0) errors.push("Ogiltigt påslag");
  const { key: _key, qtyText: _q, priceText: _p, markupText: _m, ...rest } = s;
  return {
    line: {
      ...rest,
      quantityMilli: qty !== null && qty >= 0 ? qty : 0,
      unitPriceOre: price,
      markupBp: markup !== null && markup >= 0 ? markup : 0,
    },
    errors,
  };
}
