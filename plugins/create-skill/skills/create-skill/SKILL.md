---
name: create-skill
description: Write or revise an agent skill so it gives the model only the guidance it needs. Use when the user asks to "create a skill", "write a skill", "make this a skill", or to revise, improve, flesh out, rework or trim an existing skill or SKILL.md.
---

# Create a skill

Write the skill so it gives the model only the guidance it needs. A capable model already does
most things well: extra guidance does nothing at best and limits the model at worst, and
guidance in a slightly wrong direction is worse than none.

Write for the user's intent: the outcome they want, at the scope they mean it, not only the case
they described. You don't have to use their phrasing; write what works best. An example the user
gives is usually there to help you understand them. Put into the skill, it becomes the rule,
because the model treats the one case as the general one.

Start thin. The draft holds only what has a basis: something the user asked for, or a mistake
models really make. List your own ideas, including mistakes you expect models might make,
separately as proposals, each with whether you'd add it and a one-line reason, and let the user
choose.

A skill is more than a list of commands. Often the better sentence describes the situation, the
outcome the user wants or the reason for it, and leaves the call to the model. That is what lets
the model act well in cases the skill never names. Give a direct instruction where an action
really is required.

Read each sentence for which way it pushes the model. Where the skill leaves a call to the
model, a reason or example attached to one answer tilts the model toward it, and so does
describing one answer more fully than the others. If the skill favors one answer, that should be
because the user does.

A number is a tool. A model treats it as a target, so choose it on purpose: weigh what it will
push the model to do, and tell the user why that number.

The skill must work on any machine and in any harness, so don't count on the user's own
instruction files to supply what it needs. The body must stand on its own, since a client may
load it without the frontmatter: open with the instruction itself, not a description of it. The
description is one concise line saying what the skill does, then "Use when" with the specific
phrases that should trigger it. Leave out the /<skill> command; it loads the skill anyway.

Write plainly: a sentence the user can't follow on the first read is unclear to the model too.

When you show the draft, give each sentence's basis in a few words, so the user can cut what
they disagree with.

## Revising a skill

This applies to your own draft as much as to a skill that already exists. The text is one
attempt at what the user wants, so judge it against that.

The user's feedback shows you more of what they want. It isn't a rule to apply as hard as you
can, because a correction pushed to its limit becomes the next fault. Fix what they pointed at,
look for the same fault elsewhere, and leave what works.

New guidance still needs a basis. To find the mistakes a model really makes, read the skill as
the model that must act on it, in a few situations that differ from each other. A fresh agent
can do that reading without your assumptions; give it the user's own words and ask what to leave
alone as well as what to change.

When you show the revision, give the basis only for the sentences you changed, and say what you
left alone.
