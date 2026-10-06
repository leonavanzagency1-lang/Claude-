"use client";

import { Field, Textarea } from "@/components/ui";

/** Redigerar en lista med en punkt per rad. */
export function ListEditor({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label} hint={hint ?? "En punkt per rad."}>
      <Textarea rows={Math.min(8, Math.max(3, value.split("\n").length + 1))} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
    </Field>
  );
}

export const listToText = (list: string[]) => list.join("\n");
export const textToList = (text: string) =>
  text
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
