import { MOCK_TRANSCRIPT } from "@/lib/ai/mock";
import type { Transcriber } from "./types";

export class MockTranscriber implements Transcriber {
  readonly name = "mock";
  async transcribe(): Promise<string> {
    return MOCK_TRANSCRIPT;
  }
}
