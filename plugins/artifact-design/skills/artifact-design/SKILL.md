---
name: artifact-design
description: How to make an Artifact with this plugin - an HTML page such as a report, explainer, plan, dashboard, tool, mockup or deck. Load before writing one, unless the Artifact tool's quickstart result is already in this conversation.
---

Pages are made with the `Artifact` tool of this plugin's `artifact` MCP server; its listed name carries a server prefix.

1. Call it with `action: "quickstart"` and read the result before writing anything. It holds the page rules, and then the design system installed on this machine with its guide, or general design guidance when there is none. If that result is already in this conversation, don't call it again.
2. When a design system is installed, call `action: "guide"` with the `parts` the page will use: the example closest to the page, and each section or component you haven't seen in full.
3. Write the page to a file, look at it once with `ArtifactCheck` where that tool is listed, and publish the file.

If the `Artifact` tool isn't listed, its server didn't start. Then read [contract.md](contract.md) and [design.md](design.md) beside this file, write the page as a whole HTML document of its own, with the doctype and head that publishing would have added, and give the person the file's path. In contract.md, `{drafts}` and `{check}` are places the tool fills in: write the file in any folder of your own, and leave out the steps that call the tool.
