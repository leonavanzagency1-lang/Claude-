/** Fel med ett begripligt svenskt meddelande som kan visas för användaren. */
export class AppError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly status = 400,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AppError";
  }
}

export function userMessageFor(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  return "Ett oväntat fel inträffade. Försök igen.";
}
