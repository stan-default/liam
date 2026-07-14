# Liam skills

Portable analysis playbooks that run on top of Liam. Each skill is a `SKILL.md` an
agent (Claude Code personal skills, or anything that reads the same format) can load,
and each encodes a full methodology: what to pull, how to judge it, significance
floors, the caveats to state, and a fixed report format. They work over the Liam MCP
tools when registered, and fall back to the `liam` CLI, so they run anywhere Liam is
installed and authenticated.

All skills are read-only against your ad account (Liam itself only ever creates
drafts; nothing here activates, pauses, or spends).

| Skill | Ask it | What you get |
| --- | --- | --- |
| `liam-spend` | "Analyze my spend" | Where budget goes, concentration, a summed wasted-spend figure, reallocation moves |
| `liam-performance` | "How are my ads doing?" | Full review: scoreboard, winners, losers, fatigue, scale/pause/watch actions |
| `liam-leads` | "Which ads drive leads? Which don't?" | Drivers table, pause list with dollars burned, converting vs dead copy angles |
| `liam-retargeting` | "Is retargeting working?" | Retargeting vs cold comparison, per-campaign ranking, failure diagnoses |
| `liam-weekly` | "Weekly snapshot" | Fixed-format week-over-week snapshot, movers, flags, 3 actions; schedule-friendly |
| `liam-competitors` | "What is <company> running?" | Ad Library teardown: themes, offers, formats, cadence, EU targeting, gaps to exploit |

## Install

Prerequisite: Liam set up and authenticated (see the repo README's Install section).

```bash
./skills/install.sh          # symlinks each skill into ~/.claude/skills
./skills/install.sh --copy   # copies instead, if you prefer no symlinks
```

Symlinking keeps the skills in lockstep with the repo: a `git pull` updates them in
place. Restart your Claude Code session afterwards so it discovers the new skills.
Set `CLAUDE_SKILLS_DIR` to install somewhere other than `~/.claude/skills`.

## Conventions (for adding skills)

- Directory name matches the frontmatter `name`, prefixed `liam-`.
- Frontmatter `description` says what it does and lists the trigger phrases.
- Skills synthesize; they never dump raw report rows back at the user.
- State the judgment floors (impressions, conversion counts) and the conversion-lag
  caveat rather than presenting every number as settled truth.
- Read-only by default; anything that writes (even drafts) requires explicit user
  confirmation inside the skill flow.
