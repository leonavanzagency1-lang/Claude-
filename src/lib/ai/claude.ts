import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { AiInterpretationSchema } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";
import type { CallModel } from "./interpret";

/** Översätter fel från Anthropic-SDK:t till begripliga svenska meddelanden. */
export function translateAnthropicError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AppError("AI-tjänsten nekade åtkomst. Kontrollera ANTHROPIC_API_KEY i .env.", 502, { cause: error });
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new AppError(
      "AI-modellen hittades inte. Kontrollera ANTHROPIC_MODEL i .env.",
      502,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AppError("AI-tjänsten är tillfälligt överbelastad. Vänta en stund och försök igen.", 503, { cause: error });
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AppError(
      "AI-tjänsten kunde inte ta emot underlaget (t.ex. för stora eller för många bilder). Försök med färre foton.",
      502,
      { cause: error },
    );
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AppError("AI-tjänsten svarade inte i tid. Försök igen.", 504, { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AppError("Kunde inte nå AI-tjänsten. Kontrollera internetanslutningen och försök igen.", 503, { cause: error });
  }
  if (error instanceof Anthropic.APIError) {
    return new AppError("AI-tjänsten svarade med ett fel. Försök igen om en stund.", 502, { cause: error });
  }
  return new AppError("Ett oväntat fel inträffade vid AI-tolkningen.", 500, { cause: error });
}

export function createClaudeCaller(): CallModel {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AppError("ANTHROPIC_API_KEY saknas i .env. Lägg in nyckeln eller kör med MOCK_AI=true.", 500);
  }
  const model = config.anthropicModel;
  if (!model) {
    throw new AppError("ANTHROPIC_MODEL saknas i .env. Se .env.example för ett aktuellt modellnamn.", 500);
  }
  const client = new Anthropic({ timeout: 5 * 60 * 1000, maxRetries: 2 });
  const effort = config.anthropicEffort;
  const format = zodOutputFormat(AiInterpretationSchema);

  return async (messages) => {
    let response: Anthropic.Message;
    try {
      const stream = client.messages.stream({
        model,
        max_tokens: 32000,
        system: SYSTEM_PROMPT,
        messages: messages as Anthropic.MessageParam[],
        output_config: { format, ...(effort ? { effort } : {}) },
      });
      response = await stream.finalMessage();
    } catch (error) {
      throw translateAnthropicError(error);
    }

    if (response.stop_reason === "refusal") {
      throw new AppError("AI-tjänsten avböjde att tolka underlaget. Lägg in raderna manuellt.", 502);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AppError("AI-svaret blev för långt och avbröts. Försök korta ned underlaget.", 502);
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, assistantContent: response.content };
  };
}
