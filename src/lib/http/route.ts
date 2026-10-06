import "server-only";
import { NextResponse } from "next/server";
import { AppError, userMessageFor } from "@/lib/errors";

/** Kör en route handler och gör om alla fel till JSON med ett svenskt felmeddelande. */
export async function handle(fn: () => Promise<Response | unknown>): Promise<Response> {
  try {
    const result = await fn();
    if (result instanceof Response) return result;
    return NextResponse.json(result ?? { ok: true });
  } catch (error) {
    const status = error instanceof AppError ? error.status : 500;
    // Logga orsaken lokalt för felsökning, men skicka bara det svenska meddelandet till klienten.
    console.error("[api]", error instanceof AppError ? `${error.userMessage} – ${String(error.cause ?? "")}` : error);
    return NextResponse.json({ error: userMessageFor(error) }, { status });
  }
}

export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new AppError("Ogiltigt id.", 400);
  return id;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("Ogiltig förfrågan (JSON kunde inte läsas).", 400);
  }
}

export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new AppError("Uppladdningen kunde inte läsas. Försök igen.", 400);
  }
}

export function filesFrom(form: FormData, field: string): File[] {
  return form.getAll(field).filter((v): v is File => typeof v !== "string" && v.size >= 0);
}
