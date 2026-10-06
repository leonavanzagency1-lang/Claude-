import type { AiInterpretation } from "./schema";
import type { CallModel } from "./interpret";

/** Exempeltranskribering som används i mock-läget (MOCK_AI=true). */
export const MOCK_TRANSCRIPT = `Okej, platsbesök hos familjen Andersson. Dom vill ha en ny altan på baksidan, ungefär fyra gånger sex meter, alltså 24 kvadrat. Den gamla altanen ska rivas, den är cirka 15 kvadratmeter. Vi kör tryckimpregnerad trall 28 gånger 120. Grunden blir plintar, jag räknar med 12 plintar. Det ska vara räcke längs långsidan, sex meter, och en trappa ner mot gräsmattan. Dom funderar på komposit i stället men vill ha pris på trä först. Belysning ingår inte, det fixar dom själva med elektriker. Bortforsling av gamla altanen behövs. Marken lutar lite åt höger, oklart hur mycket. Arbetstid uppskattar jag till ungefär 60 timmar.`;

/** Exempelsvar från AI:n i mock-läget. Går igenom samma Zod-validering som ett riktigt svar. */
export const MOCK_INTERPRETATION: AiInterpretation = {
  summary:
    "Rivning av befintlig altan (ca 15 m²) och byggnation av ny altan om ca 24 m² (4 × 6 m) i tryckimpregnerat trä på plintgrund, med räcke längs långsidan och en trappa ner mot gräsmattan. Bortforsling av rivningsmaterial ingår.",
  lines: [
    {
      articleNumber: "A-103",
      description: "Rivning av befintlig altan",
      quantity: 15,
      unit: "m²",
      type: "arbete",
      source: "Den gamla altanen ska rivas, den är cirka 15 kvadratmeter",
      confidence: "medel",
    },
    {
      articleNumber: "A-105",
      description: "Bortforsling av rivningsmaterial",
      quantity: 1,
      unit: "paket",
      type: "övrigt",
      source: "Bortforsling av gamla altanen behövs",
      confidence: "hög",
    },
    {
      articleNumber: "M-201",
      description: "Plintfundament i betong",
      quantity: 12,
      unit: "st",
      type: "material",
      source: "Grunden blir plintar, jag räknar med 12 plintar",
      confidence: "hög",
    },
    {
      articleNumber: "M-203",
      description: "Bärlina/regel 45×195 tryckimpregnerad",
      quantity: null,
      unit: "m",
      type: "material",
      source: "Grunden blir plintar",
      confidence: "låg",
    },
    {
      articleNumber: "M-205",
      description: "Trall tryckimpregnerad 28×120",
      quantity: 210,
      unit: "m",
      type: "material",
      source: "Vi kör tryckimpregnerad trall 28 gånger 120",
      confidence: "medel",
    },
    {
      articleNumber: "M-209",
      description: "Räcke i trä längs långsidan",
      quantity: 6,
      unit: "m",
      type: "material",
      source: "Det ska vara räcke längs långsidan, sex meter",
      confidence: "hög",
    },
    {
      articleNumber: "M-210",
      description: "Trappa ner mot gräsmattan",
      quantity: 1,
      unit: "st",
      type: "material",
      source: "en trappa ner mot gräsmattan",
      confidence: "hög",
    },
    {
      articleNumber: "A-101",
      description: "Snickeriarbete altan",
      quantity: 60,
      unit: "tim",
      type: "arbete",
      source: "Arbetstid uppskattar jag till ungefär 60 timmar",
      confidence: "medel",
    },
    {
      articleNumber: null,
      description: "Anpassning av grund för lutande mark",
      quantity: null,
      unit: "paket",
      type: "övrigt",
      source: "Marken lutar lite åt höger, oklart hur mycket",
      confidence: "låg",
    },
  ],
  assumptions: [
    "Trallmängden är beräknad som 24 m² / 0,12 m bräddbredd ≈ 200 m plus ca 5 % spill.",
    "Altanen byggs i samma läge som den befintliga.",
    "Fri framkomlighet för material och bortforsling.",
  ],
  uncertainties: [
    "Mängden bärlinor/reglar framgår inte av underlaget.",
    "Marklutningen är inte uppmätt.",
  ],
  customerQuestions: [
    "Hur stor är höjdskillnaden i marken längs altanen?",
    "Vill ni även ha pris på komposittrall som alternativ?",
  ],
  exclusions: ["Belysning och elarbeten (utförs av kundens elektriker)."],
};

export function createMockCaller(): CallModel {
  return async () => {
    const text = JSON.stringify(MOCK_INTERPRETATION);
    return { text, assistantContent: [{ type: "text", text }] };
  };
}
