import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getQuote } from "@/lib/services/quotes";

/** Hämtar en offert för en sida; ger 404-sida om den inte finns. */
export async function loadQuoteForPage(rawId: string) {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  try {
    return await getQuote(prisma, id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
