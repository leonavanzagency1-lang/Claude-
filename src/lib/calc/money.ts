/**
 * Heltalsaritmetik för belopp. Alla belopp är i ören, procentsatser i
 * baspunkter (1 % = 100) och mängder i tusendelar (1,5 m = 1500).
 */

/** Beräknar round(a * b / d) med avrundning halva uppåt (bort från noll), endast heltal. */
export function mulDivRound(a: number, b: number, d: number): number {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(d) || d <= 0) {
    throw new Error("mulDivRound kräver heltal och positiv nämnare");
  }
  const product = BigInt(a) * BigInt(b);
  const den = BigInt(d);
  const negative = product < BigInt(0);
  const abs = negative ? -product : product;
  let q = abs / den;
  const r = abs % den;
  if (r * BigInt(2) >= den) q += BigInt(1);
  const result = Number(negative ? -q : q);
  if (!Number.isSafeInteger(result)) throw new Error("Beloppet är för stort");
  return result === 0 ? 0 : result;
}

const nbsp = " ";

/** Formaterar ören som svenskt belopp, t.ex. 123456 -> "1 234,56 kr". */
export function formatOre(ore: number, withCurrency = true): string {
  const negative = ore < 0;
  const abs = Math.abs(ore);
  const kronor = Math.floor(abs / 100);
  const oren = abs % 100;
  const kr = kronor.toString().replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
  const text = `${negative ? "−" : ""}${kr},${oren.toString().padStart(2, "0")}`;
  return withCurrency ? `${text}${nbsp}kr` : text;
}

/** Formaterar mängd i tusendelar, t.ex. 1500 -> "1,5". */
export function formatMilli(milli: number): string {
  const negative = milli < 0;
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / 1000);
  const frac = (abs % 1000).toString().padStart(3, "0").replace(/0+$/, "");
  const w = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
  return `${negative ? "−" : ""}${w}${frac ? "," + frac : ""}`;
}

/** Formaterar baspunkter som procent, t.ex. 2500 -> "25", 1250 -> "12,5". */
export function formatBp(bp: number): string {
  return formatMilli(bp * 10);
}

/**
 * Tolkar ett decimaltal skrivet av en människa ("1 234,5", "1234.50") till ett heltal
 * med `decimals` decimaler. Returnerar null om texten inte är ett giltigt tal.
 */
export function parseDecimal(input: string, decimals: number): number | null {
  const cleaned = input.replace(/[\s ]/g, "").replace(/kr$/i, "").replace(",", ".");
  if (cleaned === "") return null;
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match) return null;
  const [, sign, intPart = "", fracPart = ""] = match;
  if (intPart === "" && fracPart === "") return null;
  const scale = 10 ** decimals;
  const intValue = intPart === "" ? 0 : Number(intPart);
  const fracDigits = (fracPart + "0".repeat(decimals + 1)).slice(0, decimals + 1);
  let fracValue = Number(fracDigits.slice(0, decimals) || "0");
  // Avrunda på första överskjutande decimal.
  if (Number(fracDigits.charAt(decimals)) >= 5) fracValue += 1;
  const value = intValue * scale + fracValue;
  if (!Number.isSafeInteger(value)) return null;
  return sign === "-" ? -value : value;
}

/** "1 234,50" -> 123450 ören */
export const parseKronor = (input: string) => parseDecimal(input, 2);
/** "1,5" -> 1500 tusendelar */
export const parseQuantity = (input: string) => parseDecimal(input, 3);
/** "25" -> 2500 baspunkter */
export const parsePercent = (input: string) => parseDecimal(input, 2);
