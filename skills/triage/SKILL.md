---
name: triage
description: Use when a family member has new or changed symptoms, to run the triage panel and decide what to ask next or how urgent it is.
---

# Triage panel

Three specialists judge the episode independently. They see the files, not the chat, so the facts must be in the episode first.

1. **Record.** Write the parent's new facts into the episode `## Timeline`.
2. **Run the panel.** In one step, call all three with the episode path, in parallel:
   - `task(assess, "<episode path>")`: updated probabilities for home, doctor and emergency (from the last note), what moved them, the leading concern and reason
   - `task(challenge, "<episode path>")`: the case for more urgent and for less urgent, and which unknowns would change the level
   - `task(ask, "<episode path>")`: up to 3 questions that would most change the level
3. **Combine.**
   - **Emergency now** if assess finds a red flag (`emergency` is the top level), or challenge's "more urgent" case is a red flag the facts support.
   - **Conclude** when one level is at least 0.8, no red-flag question is open, and none of challenge's unknowns would change it.
   - **Otherwise ask** the most decisive questions (at most 3, merging ask's list with challenge's unknowns), then run the panel again on the next reply.
   - Keep to about 6 questions per episode; after that, decide on what you have and say what's still unknown.
4. **Note.** Keep a `## Triage` section in the episode, updated in place: the latest probabilities and what moved them, questions asked so far, and the decision with its reason. The next `assess` starts from these. Update `outcome` in the frontmatter when you conclude.
