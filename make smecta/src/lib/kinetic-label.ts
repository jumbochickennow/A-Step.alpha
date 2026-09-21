export type KineticLabelSegment = {
  text: string;
  isSpace: boolean;
};

const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const WHITESPACE = /^\s+$/u;

/**
 * Latin labels animate by grapheme-like code point. Arabic stays word-based so
 * splitting does not break contextual letter shaping.
 */
export function createKineticLabelSegments(label: string): KineticLabelSegment[] {
  const parts = ARABIC_SCRIPT.test(label) ? label.split(/(\s+)/u) : Array.from(label);

  return parts.filter(Boolean).map((text) => ({
    text,
    isSpace: WHITESPACE.test(text),
  }));
}
