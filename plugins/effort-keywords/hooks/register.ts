import type { PromptOrigin, Register } from "claude-code";

import { DEFAULT_KEYWORDS, keywordIn, mentionsUltrathink, parseKeywords } from "./keywords";
import type { Found } from "./keywords";

// A keyword in a prompt sets the effort of the turn that prompt is part of, the way ultrathink
// does: every model request of that turn on the main loop carries the keyword's level, and the
// turn's end puts nothing back because nothing else changed. The session's effort setting is never
// written, so the next turn runs at whatever the session runs at.
//
// The prompt is read as it joins the conversation (`session.append`): a prompt typed while Claude
// is idle starts a turn, and one delivered into a running turn sets the rest of that turn, as
// ultrathink's does. Subagents keep their own effort.

/** Who may set a turn's effort: the person, at the terminal, the desktop app, a phone, Slack or the SDK. */
const PERSON: ReadonlySet<string> = new Set<PromptOrigin["kind"]>(["composer", "bridge", "sdk", "slack-ping"]);

export const register: Register = (on, options) => {
  const option = typeof options["keywords"] === "string" ? options["keywords"] : DEFAULT_KEYWORDS;
  const { keywords, problems } = parseKeywords(option);

  /** The keyword of the main loop's current or next turn. */
  let turn: Found | undefined;
  /** Whether a main-loop turn is running, between its start and its end. */
  let isRunning = false;

  on("session.start", async ($, e, next) => {
    const started = await next(e);
    if (problems.length > 0) $.ui.toast(`effort-keywords skipped ${problems.join("; ")}. Fix it in /config.`);
    return started;
  });

  on("session.append", ($, e, next) => {
    if (e.agentId !== undefined || e.message.role !== "user" || !isPersons(e.door, e.origin.kind, e.message.isMeta))
      return next(e);
    const text = e.message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n");
    const isUltrathink = mentionsUltrathink(text);
    const found = keywordIn(text, keywords);
    // A new prompt decides its turn alone. One delivered into a running turn can only add a keyword,
    // or leave the rest of the turn to ultrathink, which raised it.
    const decides = found !== undefined || !isRunning || isUltrathink;
    if (found !== undefined) $.ui.status(`${found.word}: ${found.level} effort this turn`);
    else if (decides && turn !== undefined) $.ui.status(undefined);
    if (decides) turn = found;
    return next(e);
  }).catch(($, e, next) => next(e));

  on("turn.start", ($, e, next) => {
    if (e.agentId === undefined) isRunning = true;
    return next(e);
  });

  on("turn.step", async function* ($, e, next) {
    // Left alone: a subagent's step, a turn with no keyword, and a model that takes no effort.
    if (e.agentId !== undefined || turn === undefined || typeof e.effort !== "string") return yield* next(e);
    return yield* next({ ...e, effort: turn.level });
  });

  on("turn.complete", ($, e, next) => {
    if (e.agentId === undefined) {
      isRunning = false;
      if (turn !== undefined) $.ui.status(undefined);
      turn = undefined;
    }
    return next(e);
  });
};

/**
 * Whether a row is a prompt the person sent: typed or delivered, from one of their own channels. A
 * row the engine cannot attest (`unclassified`, which `claude -p` and the Agent SDK's stream send)
 * counts unless it is a notice the engine queued, which it marks `isMeta`.
 */
function isPersons(door: string, origin: string, isMeta: true | undefined): boolean {
  if (door !== "prompt" && door !== "delivery") return false;
  if (origin === "unclassified") return isMeta === undefined;
  return PERSON.has(origin);
}
