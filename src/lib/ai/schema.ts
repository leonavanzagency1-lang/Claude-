import { z } from "zod";
import { ConfidenceSchema, LineTypeSchema, UnitSchema } from "@/lib/domain";

/**
 * Schemat som Claude måste följa. Det innehåller medvetet INGA prisfält –
 * alla priser kommer från prislistan eller från användaren. Okända fält
 * (t.ex. ett pris som AI:n ändå skickar med) tas bort vid validering.
 */
export const AiQuoteLineSchema = z.object({
  articleNumber: z
    .string()
    .nullable()
    .describe("Artikelnummer ur prislistan, eller null om ingen artikel passar"),
  description: z.string().min(1).describe("Kort beskrivning av raden på svenska"),
  quantity: z
    .number()
    .nullable()
    .describe("Mängd som går att härleda ur underlaget, annars null"),
  unit: UnitSchema,
  type: LineTypeSchema,
  source: z
    .string()
    .describe('Ordagrant citat ur transkriberingen/anteckningarna som raden bygger på, eller "foto"'),
  confidence: ConfidenceSchema,
});

export const AiInterpretationSchema = z.object({
  summary: z.string().min(1).describe("Sammanfattning av jobbet på svenska"),
  lines: z.array(AiQuoteLineSchema),
  assumptions: z.array(z.string()).describe("Antaganden som gjorts"),
  uncertainties: z.array(z.string()).describe("Oklarheter i underlaget"),
  customerQuestions: z.array(z.string()).describe("Frågor att ställa till kunden"),
  exclusions: z.array(z.string()).describe("Sådant som uttryckligen inte ingår"),
});

export type AiQuoteLine = z.infer<typeof AiQuoteLineSchema>;
export type AiInterpretation = z.infer<typeof AiInterpretationSchema>;

/** Semantiska kontroller som inte går att uttrycka i JSON-schemat. */
const SemanticSchema = AiInterpretationSchema.superRefine((value, ctx) => {
  value.lines.forEach((line, i) => {
    if (line.quantity !== null && (!Number.isFinite(line.quantity) || line.quantity < 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["lines", i, "quantity"],
        message: "Mängden måste vara ett tal ≥ 0 eller null",
      });
    }
    if (line.quantity !== null && line.quantity > 1_000_000) {
      ctx.addIssue({
        code: "custom",
        path: ["lines", i, "quantity"],
        message: "Orimligt stor mängd",
      });
    }
  });
});

export type ParseResult =
  | { success: true; data: AiInterpretation }
  | { success: false; error: string };

/** Tolkar och validerar råtext från Claude. Kastar aldrig. */
export function parseAiResponse(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch (e) {
    return { success: false, error: `Svaret var inte giltig JSON: ${(e as Error).message}` };
  }
  const result = SemanticSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 10)
      .map((i) => `- ${i.path.join(".") || "(rot)"}: ${i.message}`)
      .join("\n");
    return { success: false, error: `Svaret följde inte schemat:\n${issues}` };
  }
  return { success: true, data: result.data };
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fence ? fence[1] : trimmed;
}
