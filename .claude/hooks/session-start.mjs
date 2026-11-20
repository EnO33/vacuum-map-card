// SessionStart: one-screen status (branch, uncommitted files, ready issues, open PRs) so no
// turn is spent discovering it. Every read is bounded; a missing git or gh just skips a line.
import { existsSync } from "node:fs";
import path from "node:path";
import { projectRoot, runProgram } from "./lib.mjs";

const root = projectRoot();
const lines = ["Vacuum Map Card"];

if (!existsSync(path.join(root, ".git"))) {
  lines.push("- Git: not initialised yet (bootstrap issue, owner creates the GitHub repository)");
} else {
  const branch = runProgram("git", ["branch", "--show-current"], { cwd: root });
  const dirty = runProgram("git", ["status", "--porcelain"], { cwd: root });
  const count = dirty.ok ? dirty.stdout.split("\n").filter(Boolean).length : "?";
  lines.push(`- Branch: ${branch.ok ? branch.stdout || "(detached)" : "?"}, ${count} uncommitted`);
  const issues = runProgram("gh", ["issue", "list", "--label", "status:ready", "--state", "open", "--json", "number,title", "--jq", ".[] | \"#\\(.number) \\(.title)\""], { cwd: root, timeoutMs: 8000 });
  if (issues.ok) lines.push(`- Ready issues: ${issues.stdout ? issues.stdout.split("\n").slice(0, 5).join(" | ") : "none"}`);
  const prs = runProgram("gh", ["pr", "list", "--state", "open", "--json", "number,title", "--jq", ".[] | \"#\\(.number) \\(.title)\""], { cwd: root, timeoutMs: 8000 });
  if (prs.ok) lines.push(`- Open PRs: ${prs.stdout ? prs.stdout.split("\n").slice(0, 5).join(" | ") : "none"}`);
}
if (!existsSync(path.join(root, "CLAUDE.local.md"))) lines.push("- CLAUDE.local.md missing: ask the owner for the local test setup");
if (!existsSync(path.join(root, ".claude", "private-patterns.local.txt"))) lines.push("- .claude/private-patterns.local.txt missing: private-data guard inactive");

process.stdout.write(`${lines.join("\n")}\n`);
