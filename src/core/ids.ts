export function slug(text: string, max = 48): string {
  const s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
  return s || "x";
}

/** run-YYYYMMDD-HHMM-<suffix> */
export function runId(date: Date, suffix: string): string {
  const iso = date.toISOString();
  return `run-${iso.slice(0, 10).replace(/-/g, "")}-${iso.slice(11, 16).replace(":", "")}-${slug(suffix, 20)}`;
}
