# Agent plugins

Aaron's personal skills, packaged as a plugin marketplace that both Claude Code and Codex can install from. Each plugin is installed on its own, so each harness gets only the plugins you pick for it.

Current plugins:

- `artifact-design` (`artifact-design`, `artifact-diagramming` and, in Codex, `dataviz`, plus an `artifact` MCP server and the Sketchbook design system)
- `auto-memory` (Claude Code's auto memory for Codex, sharing one store with Claude Code, and a dream for both that fixes the memory from recent sessions, see [Auto memory](#auto-memory))
- `create-skill`
- `deeper-task` (Felix Rieseberg's prompt, see [Credits](#credits))
- `dj-fetch` (needs `uv` and `ffprobe`; `setup_slskd.py` installs slskd)
- `eli5`
- `evals` (`build-eval`, `run-eval`, `hillclimb`, `save-trace`, with its own eval runner for Claude Code and Codex)
- `frontend-skill`
- `implement-with-notes`
- `learn-how-i-write` (Claude Duet's skill, adapted, see [Credits](#credits))
- `mac-computer-use` (Grok Bot only, see [Grok Bot](#grok-bot))
- `pakstack` (`interview`, `catchup`, `principle-give-the-goal-not-the-how`, `principle-own-the-codebase`)
- `session-band` (a Claude Code mod, see [Mods](#mods))
- `show-me`

This repository is published from Aaron's private monorepo, so changes arrive as commits rather than pull requests. It holds only what installing a plugin needs. An MCP server or hook written in TypeScript arrives as the one bundled `.mjs` file the plugin runs, and the sources, tests and tooling stay in that repository, which is where `src/` and `tests/` in a plugin's notes are.

## Install a plugin

Claude Code:

```sh
claude plugin marketplace add aaron-pak/pak-plugins
claude plugin install eli5@pak-plugins --scope user   # or --scope project / local
```

Skills appear as `/<plugin>:<skill>`, for example `/eli5:eli5` or `/artifact-design:artifact-diagramming`. Pull new commits with `claude plugin marketplace update pak-plugins` and then `claude plugin update eli5@pak-plugins`, or turn on auto-update for this marketplace in `/plugin` → Marketplaces.

Codex:

```sh
codex plugin marketplace add aaron-pak/pak-plugins
codex plugin add eli5@pak-plugins
```

Codex installs plugins for the user and records them in `~/.codex/config.toml`. Pull new commits with `codex plugin marketplace upgrade pak-plugins`, which also refreshes installed plugins. Codex shows a plugin without a version as `1.0.0` or `local` and has no auto-update. Remove one with `codex plugin remove eli5@pak-plugins`.

### Grok Bot

Grok Bot installs plugins from Cursor's marketplaces. Cursor reads `.cursor-plugin/marketplace.json` for multi-plugin repos ([Plugins reference](https://cursor.com/docs/reference/plugins)), so this file lists every plugin meant for Cursor and Grok Bot: the Claude Code catalog, except plugins whose description says Claude Code only (`session-band`) or Codex only (`auto-memory`). `mac-computer-use` is the one entry with `minClientVersions.cursor` set to `never`, which hides it from Cursor.

Team marketplaces are available on Teams and Enterprise plans. Add one from Dashboard → Plugins & MCPs → Team Marketplaces → Add Marketplace, using Import from Repo. Auto Refresh is a Marketplace Setting there: on a GitHub import it re-indexes when commits are pushed to the tracked branch, which requires the Cursor GitHub App, and Cursor re-indexes at most once every 10 minutes. On a marketplace created with Import from Repo, Auto Refresh re-reads the full manifest on each push. See [Plugins](https://cursor.com/docs/plugins). Aaron is on Pro, so this repository is a personal marketplace, and Cursor's docs describe no refresh for those.

### The `artifact` server

`artifact-design` runs its `artifact` MCP server with `node` (22.19 or later), so that command must be on `PATH`. The server is one bundled file, so there is nothing to install. The server reads these environment variables:

- `ARTIFACTS_DIR`: where published artifacts go, one folder each (default `~/artifacts`). A relative path is taken from the folder the server starts in.
- `ARTIFACT_OPEN=0`: don't open a first publish in the browser; the publish result then says the page was not opened.
- `ARTIFACT_PREVIEW=0`: leave out the `ArtifactCheck` tool, which previews a page before publishing. Without it, `ArtifactCheck` is offered only when Playwright and a Chromium are found: Playwright's own, or an installed Chrome or Chromium (also Edge on macOS and Windows, and Brave on macOS). Playwright isn't bundled, so install it once, globally: with Chrome installed, `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install -g playwright` is enough. Each start lists the answer its last start found and checks again for the next one, and when preview is off the server says why on its stderr, which Claude Code keeps in its MCP logs (`claude --debug`).
- `ARTIFACT_IMAGES=0`: for a session whose model can't see images. `ArtifactCheck` then returns no captures and describes each render in words instead: its size, colours, fonts and a map of its blocks. Its checklist of problems is the same either way.
- `ARTIFACT_PREVIEW_CA`: a PEM CA certificate for previews behind a TLS-inspecting proxy.
- `ARTIFACT_DESIGN_SYSTEM`: the folder of another design system for pages to use in place of Sketchbook, the one the plugin ships in its `design-system/` folder. It is laid out as a Design System artifact keeps its files (`README.md`, `tokens.json`, `components/bundle.css`, `components/bundle.js`, a `README.md` and `preview.html` per component), with an optional `checks/` folder of scripts for `ArtifactCheck` to run. `quickstart` says how a page asks for the system, the `guide` action returns its docs and examples, and publishing adds its styles and scripts to a page that asks. `0` turns design systems off: pages are then designed from general guidance, each with its own look.

Claude Code passes its own environment to the server, so set them in your shell or in Claude Code's `env` setting. Codex starts plugin MCP servers with only a fixed list of variables (`HOME`, `PATH`, `TMPDIR`, `LANG` and a few others) plus those the plugin names, and `artifact-design` names these six, `PLAYWRIGHT_BROWSERS_PATH` and the desktop variables a browser needs on Linux (`DISPLAY`, `WAYLAND_DISPLAY`, `XAUTHORITY`, `XDG_RUNTIME_DIR` and a few more), so set them in the shell you start Codex from. Page files the model writes go to a private folder of the session's own under `artifact-drafts-<uid>` in the system temp directory (`artifact-drafts` on Windows), so they stay out of your project. That folder is outside the project, so writing there gets Claude Code's usual check: auto mode's reviewer approves it without asking, while the other permission modes ask before each page. Codex's sandbox already lets it write to the temp directory in a project you've trusted.

In a Claude Code session that has its own Artifact tool (signed in to claude.ai, where artifacts are on), that tool publishes to claude.ai and the plugin's adds nothing: Claude Code then lists two `Artifact` tools and both sets of skills, while the plugin's text assumes its tool is the only one. Turn the plugin off there, or start Claude Code with `CLAUDE_CODE_ARTIFACT=0` to keep pages local with the plugin.

Codex keeps plugin MCP tools out of the model's sight until it searches for them, so it wouldn't think of the `Artifact` tool unless you named the plugin. `artifact-design` asks Codex to load the tool up front instead (`omit_tools_from` in its `.codex-plugin/plugin.json`). If a Codex release stops honoring that, this line in `~/.codex/config.toml` does the same:

```toml
[features.code_mode]
direct_only_tool_namespaces = ["mcp__artifact"]
```

Publishing asks too. Claude Code asks before the plugin's `Artifact` and `ArtifactCheck` tools run, and its "don't ask again" lasts for the project. Codex asks before every call until you answer "always", and `codex exec` refuses the call until then.

### Auto memory

`auto-memory` gives Codex Claude Code's auto memory (as of Claude Code 2.1.318), and puts both harnesses' memories in one store, `~/.agents/memory` (or `AGENT_MEMORY_DIR`), laid out as Claude Code lays out its own: `projects/<project>/memory/`, with `MEMORY.md` as the index. A project is the main working tree of the Git repository a session starts in (its subfolders and worktrees share it), or the folder itself outside a repository, named the way Claude Code names it, so a Codex session and a Claude Code session in the same project read and write the same memories.

In Codex, a `SessionStart` hook starts each session with Claude Code's memory section and the project's `MEMORY.md`, cut at 200 lines or 25,000 bytes as Claude Code cuts it, and the `memory` MCP server gives the model Claude Code's `memory_list`, `memory_read` and `memory_write` tools over the project's memory as the store `personal`. Install it and trust its hook once:

```sh
codex plugin marketplace add aaron-pak/pak-plugins
codex plugin add auto-memory@pak-plugins
```

At its next start Codex says the plugin's hook needs review: choose "Trust all and continue", or trust it later in `/hooks` (press `t` there to trust all). Codex keeps the trust in `~/.codex/config.toml`, for the plugin's files as they were, so it asks again after every update of the plugin, not only one that changes the hook. The Codex app and other clients may never ask, so trust it in the Codex CLI. Until it's trusted, Codex skips the hook without a word. The plugin covers for that: the server tells the model to read `/MEMORY.md` before its first reply when a session has no memory section, and the first memory tool result of such a session starts with the section, the index, and a note asking the model to tell you that the hook isn't trusted. The server and the hook run with `node` (22.19 or later).

A Codex that added this marketplace as `agent-plugins`, its name before it was renamed, refuses to upgrade it ("upgraded marketplace name `pak-plugins` does not match configured marketplace `agent-plugins`"). List what you installed from it, remove each plugin and the marketplace, then add them back under the new name, and trust the hook again, since its trust is kept under the marketplace's name:

```sh
codex plugin list
codex plugin remove auto-memory@agent-plugins   # and each other plugin installed from it
codex plugin marketplace remove agent-plugins
codex plugin marketplace add aaron-pak/pak-plugins
codex plugin add auto-memory@pak-plugins
```

Codex starts the server with only the variables the plugin names: `AGENT_MEMORY_DIR` (a relative path is read from your home folder), and `CODEX_HOME` and `CLAUDE_CONFIG_DIR`, where a dream finds Codex's and Claude Code's sessions. Set them, if you use them, in the shell you start Codex from; Codex's background server keeps the environment it started with, so restart it with `/daemon` after a change.

Claude Code keeps its own auto memory, which this plugin doesn't replace; point it at the shared store in `~/.claude/settings.json` (use your home folder's full path):

```json
{ "env": { "CLAUDE_CODE_REMOTE_MEMORY_DIR": "/Users/you/.agents/memory" } }
```

To keep what Claude Code already remembers, move `~/.claude/projects/<project>/memory/` folders to `~/.agents/memory/projects/<project>/memory/` first. Put the setting in your user settings, not a project's `.claude/settings.json`, where Claude Code ignores it. `CLAUDE_CODE_REMOTE_MEMORY_DIR` isn't a documented setting, and it moves Claude Code's subagent memory (`agent-memory/`) into the shared folder too, so a Claude Code release could change what it does. Installed in Claude Code too, the plugin adds only a `SessionStart` check that warns when Claude Code's memory isn't in the shared store.

Left out for now: Claude Code's background extraction of memories at the end of a turn and its recall of relevant memories into a turn, which are off in Claude Code unless a flag turns them on. [`UPSTREAM.md`](plugins/auto-memory/UPSTREAM.md) lists every change from Claude Code's text.

The plugin's `dream` skill works in both harnesses. A dream reads the project's sessions since the last dream, from Claude Code (`~/.claude/projects`, or under `CLAUDE_CONFIG_DIR`) and Codex (`~/.codex/sessions`, or under `CODEX_HOME`). It checks each note against them and against the repository, fixes or downgrades a wrong note, merges duplicates, saves corrections the sessions missed in the user's own words, and tidies `MEMORY.md`. Ask for it ("dream", or `/auto-memory:dream` in Claude Code). Its helper, `skills/dream/scripts/dream.mjs`, shows each session as pages of text with long tool output cut, and keeps the run safe. A dream reads the oldest sessions first, up to 10 pages of about 10,000 tokens each; the newer ones wait for the next dream, which starts with them. It leaves out its own session and the part of any session where an earlier dream ran, to that dream's end (or to the user's next words, for a dream that never ended), keeping what the user said in it. A session it can't read is named, and the next dream tries it once more; if that one can't read it either, it is passed over.

The memory root becomes a Git repository, and each dream is one commit by "auto-memory dream", so `git -C ~/.agents/memory log` lists the dreams and `git revert` undoes one. Before a dream edits anything, a snapshot commit saves what changed in that project's memory since the last commit; the helper refuses to commit a file that seems to hold a credential, and names it. Git's own `index.lock`, left by a Git that was killed, stops a step with the file's name: delete it once no Git is running in the memory root. The dream's commit holds every change in the project's memory folder since the snapshot, so it also holds a note another session saved there while the dream ran: finish lists the files, and reverting the dream reverts those notes too. A note is retired only by a file that starts with `Obsolete:`, and finish deletes it only when Git holds an earlier version. `.dream-lock` in the project's memory folder keeps two dreams from running at once. The session that began a dream owns it, and only that session can finish or abort it (where no session id is known, begin prints a token that every later command carries as `--token`); `abort --force` removes another session's lock, for you to use when you know that dream died, and a lock nobody touched for two hours is taken over. `.consolidate-lock` beside it, which Claude Code's own dream also uses, records when the last dream started: a dream doesn't begin while Claude Code's holds it, and moves its time forward, never back. A dream works on one machine's sessions, so if the memory root is synced between machines, dream on one of them only: two machines dreaming over one root would each commit and lock on their own. The helper sends nothing anywhere: sessions reach only the model that runs the dream. In Codex, whose sandbox keeps the memory folder and any `.git` folder read-only, the memory server's `memory_dream` tool takes the steps that write. To dream between sessions without a person, run one of these from the project's folder, from launchd or cron (the first needs Claude Code's memory in the shared store, as above, so that it may write there):

```sh
claude -p "/auto-memory:dream" --allowedTools "Bash(node:*)" Read Write Edit Glob Grep
codex exec "Use the auto-memory dream skill."
```

## Global instructions

`instructions/AGENTS.md` holds the shared global instructions and `instructions/CLAUDE.md` imports them for Claude. Link them manually:

```sh
ln -s ~/projects/pak-plugins/instructions/AGENTS.md ~/.codex/AGENTS.md
ln -s ~/projects/pak-plugins/instructions/CLAUDE.md ~/.claude/CLAUDE.md
```

`CLAUDE.md` imports `~/.codex/AGENTS.md`, so both links are needed for Claude to see the shared text.

## Mods

A mod is a Claude Code plugin of function hooks: one TypeScript module that hooks the session's events and draws into its interface (status line, toasts, a band above the prompt, panes, slash commands) or adds tools. Mods are Claude Code only. They are listed in `.claude-plugin/marketplace.json` so Claude Code can install them like any other plugin, and their descriptions say Claude Code only for Codex, which reads the same catalog. The Cursor catalog leaves out a plugin whose description says that.

A mod folder holds `.claude-plugin/plugin.json` (with `version` unset, as for every plugin here), `hooks/hooks.json` naming the module (`{ "modules": ["./register.tsx"] }`), and the module itself. A mod that keeps values in `$.state` also has `types/index.d.ts` declaring them. Claude Code lays the API types into `.claude-plugin/types/` when it loads the mod (ignored there by its own `.gitignore`). A mod's tests stay in the source repository.

Current mods:

- `session-band`: Clawd and your session at a glance in the band above the prompt, in two looks. `tide`, the default, puts him on a little beach where the tide comes in as your context fills, beside three short lines: what Claude is doing, how full the context is (with the cost and whichever usage limit is closest to running out), and where you are (project, branch, uncommitted changes, model). `hearth` sets him beside three calm lines instead, with context and limit meters. Pick the look in the "Band look" row of `/config`, or with `/band tide` and `/band hearth`. On the terminal he is Claude Code's own Clawd in the theme's colors, and on the desktop a vector Clawd. He strolls the sand or blinks at rest, reads along while Claude works, cheers when a turn lands, gets splashed by a wave (or flinches, by the hearth) when a tool fails, sweats by the hearth as the context runs high, naps when you're away and shows a heart when you pet him. On the beach the stars come out at night, by your own clock, and a compaction leaves a starfish on the sand where the tide stood. A toast says when the context passes 80% (the `warnAt` option in `/config`). `/band still` keeps either look still, as reduced motion does, and `/band lively` brings the motion back. In the terminal's fullscreen layout the band gives up its rows while a `/` command or `@` file menu is up, so the menu sits right above the prompt, and takes one row whenever a tall draft leaves it less room; "Band size" in `/config` can keep it to one row, with no pet. `DESIGN.md` explains both looks.

Install a mod for your user, so every session loads it:

```sh
claude plugin install session-band@pak-plugins --scope user
```

To try a mod from a checkout in one session and check it:

```sh
claude --plugin-dir ~/projects/pak-plugins/plugins/session-band
claude plugin validate plugins/session-band
```

The session reloads the mod when its files change, so edits show up without a restart.

## Credits

The `artifact-design` plugin began as a copy of Anthropic's built-in Claude Code `artifact-design`, `artifact-diagramming` and `dataviz` skills (2.1.304), with an `artifact` MCP server standing in for Claude Code's Artifact tool and `ArtifactCheck`. It now goes its own way around a design system, Sketchbook, which is drawn from Anthropic's public look. `artifact-diagramming` and `dataviz` are still Anthropic's text, unchanged except for one sentence each about claude.ai-only features, and only Codex gets `dataviz` (from `codex-skills/`), since Claude Code always has its own; the design guidance used where no design system is installed is Anthropic's too. [`UPSTREAM.md`](plugins/artifact-design/UPSTREAM.md) says what is whose. The server's bundle includes [Effect](https://github.com/Effect-TS/effect), under the MIT license, and Sketchbook's pages load Bricolage Grotesque, Literata, JetBrains Mono and Kalam from Google Fonts.

`auto-memory` carries Claude Code 2.1.318's auto memory text, its memory section and the `memory_list`, `memory_read` and `memory_write` tool descriptions, with the edits [`UPSTREAM.md`](plugins/auto-memory/UPSTREAM.md) lists, and ports its project keys, index truncation and tool behavior. Its bundles include [Effect](https://github.com/Effect-TS/effect), under the MIT license.

The `auto-memory` dream's instructions are Claude Code 2.1.325's dream prompt, with rules for reading sessions taken from the memory distillation prompts in Anthropic's [claude-cookbooks](https://github.com/anthropics/claude-cookbooks/tree/ce8b2629efe8b24048b127b4c79af1e9cbab93d4/managed_agents/example_data/memory_distill/prompts) (ce8b262), under the MIT license in the skill's directory. [`UPSTREAM.md`](plugins/auto-memory/UPSTREAM.md) lists every change.

`deeper-task` is the depth prompt from Felix Rieseberg's post [How to be more ambitious](https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/), word for word as the skill's body. The post gives no license.

`frontend-skill` is OpenAI's frontend design skill, originally installed through Codex's skill installer, under the Apache 2.0 license in its directory.

`show-me` is HumanLayer's visual explanation skill, under the MIT license in its directory.

`learn-how-i-write` starts from the `learn-how-i-write` skill in Anthropic's Claude Duet (its default skills plugin, version 0.8.63). It's adapted to work outside Claude Duet, to learn from files and pasted text as well as connected mail, Slack and Drive, to handle long-form writing such as papers, and to restyle a piece in a learned voice; [`UPSTREAM.md`](plugins/learn-how-i-write/UPSTREAM.md) lists every change.
