/** Utbytbart gränssnitt för taltranskribering. */
export interface AudioInput {
  data: Uint8Array;
  filename: string;
  mimeType: string;
}

export interface Transcriber {
  readonly name: string;
  /** Returnerar transkriberad text på svenska. Kastar AppError med svenskt meddelande vid fel. */
  transcribe(audio: AudioInput): Promise<string>;
}
