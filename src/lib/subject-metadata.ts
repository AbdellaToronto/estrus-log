export const SUBJECT_COAT_COLOURS = [
  "white",
  "black",
  "brown_agouti",
  "grey_blue",
  "mixed_patched",
  "other",
  "unknown",
] as const;

export type SubjectCoatColour = (typeof SUBJECT_COAT_COLOURS)[number];

export const SUBJECT_COAT_COLOUR_LABELS: Record<SubjectCoatColour, string> = {
  white: "White",
  black: "Black",
  brown_agouti: "Brown / agouti",
  grey_blue: "Grey / blue",
  mixed_patched: "Mixed / patched",
  other: "Other",
  unknown: "Unknown",
};

export const isSubjectCoatColour = (
  value: unknown
): value is SubjectCoatColour =>
  typeof value === "string" &&
  (SUBJECT_COAT_COLOURS as readonly string[]).includes(value);

export const normalizeSubjectCoatColour = (
  value: unknown
): SubjectCoatColour | null => {
  if (isSubjectCoatColour(value)) return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  const aliases: Record<string, SubjectCoatColour> = {
    white: "white",
    black: "black",
    brown_agouti: "brown_agouti",
    grey_blue: "grey_blue",
    gray_blue: "grey_blue",
    mixed_patched: "mixed_patched",
    other: "other",
    unknown: "unknown",
  };
  return aliases[normalized] || null;
};
