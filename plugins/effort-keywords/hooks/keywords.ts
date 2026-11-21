// What the keywords are and how a prompt names one: plain functions, so the tests can hold them to
// every case without a session.

export type Level = "low" | "medium" | "high" | "xhigh" | "max";

/** The effort levels, lowest first, as Claude Code spells them. */
export const LEVELS: readonly Level[] = ["low", "medium", "high", "xhigh", "max"];

/** The manifest's default for the `keywords` option. */
export const DEFAULT_KEYWORDS = "superthink=high, midthink=medium, hthink=high, mthink=medium, xthink=xhigh";

/** Claude Code's own keywords: they change how a turn runs, so none can be taken here. */
const BUILT_IN = new Set(["ultrathink", "ultracode", "ultraplan", "ultrareview"]);

/** A keyword found in a prompt: the word as configured and the level it sets. */
export type Found = { word: string; level: Level };

/** Parses the `keywords` option: `word=level` pairs separated by commas, semicolons or lines. */
export function parseKeywords(option: string): { keywords: ReadonlyMap<string, Level>; problems: string[] } {
  const keywords = new Map<string, Level>();
  const problems: string[] = [];
  for (const raw of option.split(/[,;\n]/)) {
    const pair = raw.trim();
    if (pair === "") continue;
    const match = /^([^=:\s]+)\s*[=:]\s*(\S+)$/.exec(pair);
    if (match === null) {
      problems.push(`"${pair}" is not word=level`);
      continue;
    }
    const word = match[1]!.toLowerCase();
    const level = match[2]!.toLowerCase();
    if (!/^[a-z][a-z0-9]*$/.test(word)) problems.push(`"${match[1]}" is not one word of letters and digits`);
    else if (BUILT_IN.has(word)) problems.push(`"${word}" is Claude Code's own keyword`);
    else if (!isLevel(level)) problems.push(`"${match[2]}" is not a level (${LEVELS.join(", ")})`);
    else keywords.set(word, level);
  }
  return { keywords, problems };
}

function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

/**
 * Whether the prompt may be one that ultrathink raises. Claude Code's own test is this loose one, and
 * it raises a typed prompt that also passes the stricter test `keywordIn` copies, so standing aside
 * whenever this matches never lowers a turn ultrathink raised.
 */
export function mentionsUltrathink(text: string): boolean {
  return /\bultrathink\b/i.test(text);
}

/**
 * The keyword a prompt names, the highest level when it names several; none when it mentions
 * ultrathink, whose own level then stands.
 *
 * A keyword counts as Claude Code counts a typed ultrathink: a whole word in any case, outside code,
 * not part of a path, a flag or a file name (`superthink.ts`, `--superthink`, `superthink-mode`),
 * and not asked about (`superthink?`).
 */
export function keywordIn(text: string, keywords: ReadonlyMap<string, Level>): Found | undefined {
  if (keywords.size === 0 || mentionsUltrathink(text)) return undefined;
  const prose = withoutCode(text);
  let found: Found | undefined;
  for (const word of wordsIn(prose)) {
    const level = keywords.get(word.toLowerCase());
    if (level === undefined) continue;
    if (found === undefined || LEVELS.indexOf(level) > LEVELS.indexOf(found.level))
      found = { word: word.toLowerCase(), level };
  }
  return found;
}

/** The text with fenced blocks and inline code blanked out. */
function withoutCode(text: string): string {
  return text.replace(/```[\s\S]*?(```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
}

/** The words of the text that stand alone: not joined to a path, a flag or a file name. */
function wordsIn(text: string): string[] {
  const words: string[] = [];
  for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9]*\b/g)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = text[start - 1];
    const after = text[end];
    if (before === "/" || before === "\\" || before === "-" || before === "_") continue;
    if (after === "/" || after === "\\" || after === "-" || after === "_" || after === "?") continue;
    if (after === "." && /\w/.test(text[end + 1] ?? "")) continue;
    words.push(match[0]);
  }
  return words;
}
