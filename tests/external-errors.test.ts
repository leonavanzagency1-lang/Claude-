import Anthropic from "@anthropic-ai/sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClaudeCaller, translateAnthropicError } from "@/lib/ai/claude";
import { AppError } from "@/lib/errors";
import { OpenAITranscriber } from "@/lib/transcription/openai";
import { getTranscriber } from "@/lib/transcription";
import { MockTranscriber } from "@/lib/transcription/mock";

const audio = { data: new Uint8Array([1, 2, 3]), filename: "memo.webm", mimeType: "audio/webm" };

describe("transkribering via OpenAI", () => {
  it("skickar svenska som språk och returnerar texten", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ text: "  Hej, en altan.  " }));
    const t = new OpenAITranscriber("nyckel", "gpt-4o-transcribe", fetchMock);
    expect(await t.transcribe(audio)).toBe("Hej, en altan.");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    const form = init!.body as FormData;
    expect(form.get("language")).toBe("sv");
    expect(form.get("model")).toBe("gpt-4o-transcribe");
    expect((init!.headers as Record<string, string>).Authorization).toBe("Bearer nyckel");
  });

  it("ger svenskt fel vid nätverksfel", async () => {
    const t = new OpenAITranscriber("k", "m", vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed")));
    await expect(t.transcribe(audio)).rejects.toThrow(/Kunde inte nå transkriberingstjänsten/);
  });

  it("ger svenskt fel vid timeout", async () => {
    const err = new DOMException("timeout", "TimeoutError");
    const t = new OpenAITranscriber("k", "m", vi.fn<typeof fetch>().mockRejectedValue(err));
    await expect(t.transcribe(audio)).rejects.toThrow(/tog för lång tid/);
  });

  it.each([
    [401, /OPENAI_API_KEY/],
    [400, /giltig ljudfil/],
    [429, /överbelastad/],
    [500, /svarade med ett fel/],
  ])("översätter HTTP %i till begripligt fel", async (status, pattern) => {
    const t = new OpenAITranscriber("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("x", { status })));
    await expect(t.transcribe(audio)).rejects.toThrow(pattern);
  });

  it("hanterar oväntat svar", async () => {
    const t = new OpenAITranscriber("k", "m", vi.fn<typeof fetch>().mockResolvedValue(new Response("inte json")));
    await expect(t.transcribe(audio)).rejects.toThrow(/oläsbart svar/);
  });

  it("stoppar tomma och för stora filer innan anrop", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const t = new OpenAITranscriber("k", "m", fetchMock);
    await expect(t.transcribe({ ...audio, data: new Uint8Array() })).rejects.toThrow(/tom/);
    await expect(t.transcribe({ ...audio, data: new Uint8Array(26 * 1024 * 1024) })).rejects.toThrow(/för stor/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("val av tjänst och nycklar", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("använder mock-transkribering i mock-läge", () => {
    vi.stubEnv("MOCK_AI", "true");
    expect(getTranscriber()).toBeInstanceOf(MockTranscriber);
  });

  it("ger tydligt fel när OPENAI_API_KEY saknas", () => {
    vi.stubEnv("MOCK_AI", "false");
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => getTranscriber()).toThrow(/OPENAI_API_KEY saknas/);
  });

  it("ger tydligt fel när ANTHROPIC_API_KEY eller ANTHROPIC_MODEL saknas", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => createClaudeCaller()).toThrow(/ANTHROPIC_API_KEY saknas/);
    vi.stubEnv("ANTHROPIC_API_KEY", "nyckel");
    vi.stubEnv("ANTHROPIC_MODEL", "");
    expect(() => createClaudeCaller()).toThrow(/ANTHROPIC_MODEL saknas/);
  });
});

describe("fel från Anthropic", () => {
  it("översätter anslutningsfel och okända fel till svenska", () => {
    const conn = translateAnthropicError(new Anthropic.APIConnectionError({ message: "x" }));
    expect(conn).toBeInstanceOf(AppError);
    expect(conn.userMessage).toMatch(/Kunde inte nå AI-tjänsten/);
    expect(translateAnthropicError(new Anthropic.APIConnectionTimeoutError()).userMessage).toMatch(/i tid/);
    expect(translateAnthropicError(new Error("boom")).userMessage).toMatch(/oväntat fel/);
  });
});
