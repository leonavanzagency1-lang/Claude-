import { handle } from "@/lib/http/route";
import { readUpload } from "@/lib/storage";

type Ctx = { params: Promise<{ path: string[] }> };

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webm: "audio/webm",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  flac: "audio/flac",
};

/** Serverar uppladdade filer lokalt. Sökvägen kontrolleras så att den inte lämnar uppladdningsmappen. */
export async function GET(_request: Request, { params }: Ctx) {
  return handle(async () => {
    const rel = (await params).path.join("/");
    const data = await readUpload(rel);
    const ext = rel.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
