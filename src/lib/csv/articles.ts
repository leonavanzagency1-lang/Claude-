import { z } from "zod";
import { LineTypeSchema, UnitSchema } from "@/lib/domain";
import { formatBp, parseKronor, parsePercent } from "@/lib/calc/money";

/** CSV-format för prislistan: semikolonseparerat (som svenska Excel) med decimalkomma. */
export const CSV_HEADER = ["artikelnummer", "namn", "typ", "enhet", "a_pris_exkl_moms", "paslag_procent", "exempelpris"];

export interface CsvArticle {
  number: string;
  name: string;
  type: z.infer<typeof LineTypeSchema>;
  unit: z.infer<typeof UnitSchema>;
  unitPriceOre: number;
  markupBp: number;
  isExamplePrice: boolean;
}

function escapeField(value: string): string {
  if (/[;"\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function oreToCsv(ore: number): string {
  return `${Math.floor(ore / 100)},${(ore % 100).toString().padStart(2, "0")}`;
}

export function articlesToCsv(articles: CsvArticle[]): string {
  const rows = articles.map((a) =>
    [
      a.number,
      a.name,
      a.type,
      a.unit,
      oreToCsv(a.unitPriceOre),
      formatBp(a.markupBp).replace(/ /g, ""),
      a.isExamplePrice ? "ja" : "nej",
    ]
      .map(escapeField)
      .join(";"),
  );
  // BOM gör att Excel öppnar filen som UTF-8 (å, ä, ö).
  return "﻿" + [CSV_HEADER.join(";"), ...rows].join("\r\n") + "\r\n";
}

/** Delar upp CSV-text i rader och fält. Hanterar citattecken och radbrytningar i fält. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

export interface CsvImportResult {
  articles: CsvArticle[];
  errors: string[];
}

const UNIT_ALIASES: Record<string, string> = { m2: "m²", kvm: "m²", m3: "m³", h: "tim", timme: "tim", styck: "st" };

/** Tolkar och validerar en CSV-fil med artiklar. Returnerar fel per rad i stället för att kasta. */
export function parseArticlesCsv(text: string): CsvImportResult {
  const firstLine = text.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
  const rows = parseCsv(text, delimiter);
  const errors: string[] = [];
  if (rows.length === 0) return { articles: [], errors: ["Filen är tom."] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = CSV_HEADER.slice(0, 5);
  const missing = required.filter((h) => idx(h) === -1);
  if (missing.length > 0) {
    return { articles: [], errors: [`Rubrikraden saknar kolumnerna: ${missing.join(", ")}. Förväntat: ${CSV_HEADER.join(";")}`] };
  }

  const articles: CsvArticle[] = [];
  const seen = new Set<string>();
  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 2;
    const get = (name: string) => (idx(name) >= 0 ? (cells[idx(name)] ?? "").trim() : "");
    const rowErrors: string[] = [];

    const number = get("artikelnummer");
    const name = get("namn");
    if (!number) rowErrors.push("artikelnummer saknas");
    if (!name) rowErrors.push("namn saknas");
    if (number && seen.has(number.toLowerCase())) rowErrors.push(`artikelnummer ${number} förekommer flera gånger`);

    const type = LineTypeSchema.safeParse(get("typ").toLowerCase());
    if (!type.success) rowErrors.push(`ogiltig typ "${get("typ")}" (arbete, material eller övrigt)`);

    const rawUnit = get("enhet").toLowerCase();
    const unit = UnitSchema.safeParse(UNIT_ALIASES[rawUnit] ?? rawUnit);
    if (!unit.success) rowErrors.push(`ogiltig enhet "${get("enhet")}" (st, m, m², m³, tim, paket)`);

    const price = parseKronor(get("a_pris_exkl_moms"));
    if (price === null || price < 0) rowErrors.push(`ogiltigt pris "${get("a_pris_exkl_moms")}"`);

    const rawMarkup = get("paslag_procent");
    const markup = rawMarkup === "" ? 0 : parsePercent(rawMarkup);
    if (markup === null || markup < 0) rowErrors.push(`ogiltigt påslag "${rawMarkup}"`);

    const example = ["ja", "j", "1", "true", "x"].includes(get("exempelpris").toLowerCase());

    if (rowErrors.length > 0) {
      errors.push(`Rad ${rowNo}: ${rowErrors.join("; ")}`);
      return;
    }
    seen.add(number.toLowerCase());
    articles.push({
      number,
      name,
      type: type.data!,
      unit: unit.data!,
      unitPriceOre: price!,
      markupBp: markup!,
      isExamplePrice: example,
    });
  });
  return { articles, errors };
}
