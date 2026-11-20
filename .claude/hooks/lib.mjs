// Shared helpers for the project hooks. Node.js standard library only, no dependency.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Reads the hook payload Claude Code sends on stdin. */
export function readPayload() {
  const raw = readFileSync(0, "utf8");
  if (raw.trim() === "") return {};
  return JSON.parse(raw);
}

/** Blocks the tool call: exit code 2 sends the reason back to Claude. */
export function block(reason) {
  process.stderr.write(`[vacuum-map-card guard] ${reason}\n`);
  process.exit(2);
}

/**
 * Owner mode: the owner starts Claude Code with VMC_OWNER_MODE=1 (an agent cannot set it).
 * Never inherited by a subagent: any `agent_type` field in the payload turns it off.
 */
export function ownerMode(payload) {
  if (payload !== null && typeof payload === "object" && Object.hasOwn(payload, "agent_type")) return false;
  return process.env.VMC_OWNER_MODE === "1";
}

/**
 * Normalises a path to forward slashes and a lower-case drive letter. On Windows, Git Bash and
 * MSYS paths (`/d/projects/x`) are read as drive paths (`d:/projects/x`).
 */
export function normalise(p) {
  if (typeof p !== "string" || p === "") return "";
  let raw = p;
  if (process.platform === "win32") {
    const msys = /^\/([a-zA-Z])(\/|$)(.*)$/.exec(raw);
    if (msys) raw = `${msys[1]}:/${msys[3]}`;
  }
  return path.resolve(raw).replaceAll("\\", "/").replace(/^([A-Z]):/, (_, d) => `${d.toLowerCase()}:`);
}

/** Project root, from CLAUDE_PROJECT_DIR or the hook location. */
export function projectRoot() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv) return normalise(fromEnv);
  return normalise(path.join(import.meta.dirname, "..", ".."));
}

/** Runs a program without a shell, bounded in time; never throws. */
export function runProgram(file, args, { cwd, timeoutMs = 5000 } = {}) {
  const r = spawnSync(file, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    env: { ...process.env, GH_PROMPT_DISABLED: "1", GIT_TERMINAL_PROMPT: "0" },
  });
  return { ok: !r.error && r.status === 0, stdout: typeof r.stdout === "string" ? r.stdout.trim() : "" };
}

/**
 * Private patterns: one literal string per line in `.claude/private-patterns.local.txt`
 * (Git-ignored). Lines starting with `#` and blank lines are skipped. Missing file: none.
 */
export function readPrivatePatterns(root) {
  try {
    return readFileSync(path.join(root, ".claude", "private-patterns.local.txt"), "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("#"));
  } catch {
    return [];
  }
}
