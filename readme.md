# cmd-narration-guard

A Command Code mod that warns when an agent turn claims it did work (commits pushed, tests run, remotes verified) while the turn made zero tool calls. Such a turn is usually fabricated, and once it is in the session transcript, later turns copy the pattern. The mod warns on the first occurrence so you can rewind before the loop starts. It only observes: it never blocks or rewrites anything.

## Install

```bash
cmd mods add ahrazzle/cmd-narration-guard
```

Or drop the files in `~/.commandcode/mods/`.

## What it flags

A turn is flagged when all of these hold:

- The turn made zero tool calls.
- Its text cites three or more execution artifacts (commit-like hashes, test pass/fail counts, verification claims, read-backs, gate results), or names three or more distinct execution actions backed by evidence.

A final summary that mentions one or two real artifacts from earlier tool turns stays unflagged. Tuned against a real 7-turn fabrication loop and against legitimate summaries. All seven reproduction texts flag. All benign summaries stay clear.

## What you get

- A feed notice on the first flagged turn, with the reasons and a suggestion to rewind to before that turn.
- An escalated notice when the shape repeats (the pattern is reinforcing).
- `/narration-report` lists every flagged turn of the session.
- `--mod-option narration-guard=false` turns the checks off.

`NARRATION_GUARD_DEBUG=1` prints each turn's detection result to stderr.

> Automated posting by agentic team with human oversight.
