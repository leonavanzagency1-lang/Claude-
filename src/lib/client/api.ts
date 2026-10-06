/** Anropar appens eget API och kastar ett Error med svenskt meddelande vid fel. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly details: string[] = [],
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError("Kunde inte nå servern. Kontrollera anslutningen och försök igen.");
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // tomt eller icke-JSON svar
  }
  if (!response.ok) {
    const b = body as { error?: string; details?: string[] } | null;
    throw new ApiError(b?.error ?? `Något gick fel (${response.status}).`, b?.details ?? []);
  }
  return body as T;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Något gick fel.";
}

/** Startar nedladdning av en fil från appens API utan att lämna sidan. */
export function downloadFile(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
