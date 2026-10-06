import { AppError } from "@/lib/errors";
import { parseAiResponse, type AiInterpretation } from "./schema";
import { buildRetryText } from "./prompt";

/**
 * En konversationstur mot modellen. `assistantContent` är det som ska skickas
 * tillbaka som assistent-meddelande vid ett nytt försök (ofta hela content-listan).
 */
export interface ModelTurn {
  text: string;
  assistantContent: unknown;
}

export type ConversationMessage =
  | { role: "user"; content: unknown }
  | { role: "assistant"; content: unknown };

export type CallModel = (messages: ConversationMessage[]) => Promise<ModelTurn>;

/**
 * Anropar modellen, validerar svaret med Zod och gör vid ogiltigt svar
 * exakt ett nytt försök där felmeddelandet skickas med.
 */
export async function interpretWithRetry(
  callModel: CallModel,
  userContent: unknown,
): Promise<AiInterpretation> {
  const messages: ConversationMessage[] = [{ role: "user", content: userContent }];
  const first = await callModel(messages);
  const firstResult = parseAiResponse(first.text);
  if (firstResult.success) return firstResult.data;

  messages.push({ role: "assistant", content: first.assistantContent });
  messages.push({ role: "user", content: buildRetryText(firstResult.error) });
  const second = await callModel(messages);
  const secondResult = parseAiResponse(second.text);
  if (secondResult.success) return secondResult.data;

  throw new AppError(
    "AI-tolkningen gav ett ogiltigt svar två gånger. Försök igen, eller lägg in raderna manuellt i granskningen.",
    502,
    { cause: secondResult.error },
  );
}
