import type { Confidence, LineType, QuoteLineInput, Unit } from "@/lib/domain";
import { LineTypeSchema, UnitSchema } from "@/lib/domain";
import type { AiInterpretation } from "./schema";

export interface PriceListArticle {
  id: number;
  number: string;
  type: string;
  unit: string;
  unitPriceOre: number;
  markupBp: number;
}

const LOWER: Record<Confidence, number> = { hög: 2, medel: 1, låg: 0 };
function minConfidence(a: Confidence, b: Confidence): Confidence {
  return LOWER[a] <= LOWER[b] ? a : b;
}

export interface MappingResult {
  lines: QuoteLineInput[];
  /** Avvikelser som upptäcktes vid kopplingen, läggs till bland oklarheterna. */
  warnings: string[];
}

/**
 * Gör om AI:ns rader till offertrader. Priser hämtas ENBART från prislistan
 * (eller firmans timpris för arbetstimmar utan artikel) – aldrig från AI:n.
 */
export function mapAiLines(
  ai: AiInterpretation,
  articles: PriceListArticle[],
  hourlyRateOre: number | null,
): MappingResult {
  const byNumber = new Map(articles.map((a) => [a.number.trim().toLowerCase(), a]));
  const warnings: string[] = [];

  const lines = ai.lines.map((line): QuoteLineInput => {
    let confidence: Confidence = line.confidence;
    let articleNumber: string | null = line.articleNumber?.trim() || null;
    const article = articleNumber ? byNumber.get(articleNumber.toLowerCase()) : undefined;

    if (articleNumber && !article) {
      warnings.push(`Artikelnummer ${articleNumber} ("${line.description}") finns inte i prislistan.`);
      articleNumber = null;
      confidence = "låg";
    }

    let quantityMilli = 0;
    if (line.quantity === null) {
      confidence = "låg";
    } else {
      quantityMilli = Math.max(0, Math.round(line.quantity * 1000));
    }

    let unit: Unit = line.unit;
    let type: LineType = line.type;
    let unitPriceOre: number | null = null;
    let markupBp = 0;
    let priceSource: QuoteLineInput["priceSource"] = null;

    if (article) {
      const articleUnit = UnitSchema.safeParse(article.unit);
      const articleType = LineTypeSchema.safeParse(article.type);
      if (articleUnit.success && articleUnit.data !== unit) {
        warnings.push(
          `Raden "${line.description}" angavs i ${unit} men artikeln ${article.number} har enheten ${articleUnit.data}. Kontrollera mängden.`,
        );
        unit = articleUnit.data;
        confidence = minConfidence(confidence, "låg");
      }
      if (articleType.success) type = articleType.data;
      unitPriceOre = article.unitPriceOre;
      markupBp = article.markupBp;
      priceSource = "prislista";
      articleNumber = article.number;
    } else if (type === "arbete" && unit === "tim" && hourlyRateOre !== null) {
      unitPriceOre = hourlyRateOre;
      priceSource = "timpris";
    }

    return {
      articleId: article?.id ?? null,
      articleNumber,
      description: line.description.slice(0, 500),
      quantityMilli,
      unit,
      type,
      unitPriceOre,
      markupBp,
      priceSource,
      source: line.source.slice(0, 1000),
      confidence,
      confirmed: false,
      origin: "ai",
    };
  });

  return { lines, warnings };
}
