// Pure guard rules, tested by scripts/test-hooks.mjs. Each check returns a reason string to
// block, or null to allow. Text rules on the command: they catch honest mistakes and common
// forms, they are not a sandbox (see README.md, « Limits »).

/** Splits a command line into rough steps on shell operators. */
function steps(command) {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const BASH_RULES = [
  [/\bgh\s+pr\s+merge\b/i, "merging is the owner's job (gh pr merge)"],
  [/\bgh\s+repo\s+(create|delete|edit|rename|archive|unarchive|fork)\b/i, "repository changes are owner-only"],
  [/\bgh\s+release\s+(create|delete|edit|upload)\b/i, "releases are owner-only"],
  [/\bgh\s+(secret|variable|ruleset)\b/i, "secrets, variables and rulesets are owner-only"],
  [/\bgh\s+api\b.*(-X|--method)\s*(PUT|DELETE|PATCH)\b/i, "gh api writes other than POST are owner-only"],
  [/\b(npm|pnpm|yarn)\s+publish\b/i, "publishing is owner-only"],
  [/\bnpm\s+(i|install|ci)\b/i, "use pnpm, not npm install"],
  [/\b(curl|wget|iwr|Invoke-WebRequest)\b[^|]*\|\s*(sh|bash|zsh|node|pwsh|iex)\b/i, "piping a download into a shell"],
  [/\bgit\s+filter-(branch|repo)\b/i, "history rewrite"],
  [/\bgit\s+push\b.*\s--mirror\b/i, "mirror push"],
  [/\bgit\s+push\b.*(\s--delete\b|\s-d\b|\s:[\w./-]+)/i, "deleting a remote branch is owner-only"],
  [/\bgit\s+push\b.*(\s--tags\b|\s--follow-tags\b|\srefs\/tags\/|\sv\d+\.\d+\.\d+)/i, "pushing tags is owner-only (release)"],
  [/\bgit\s+push\b.*(\s--force\b|\s--force-with-lease\b|\s-f\b|\s\+[\w./-]+)/i, "force push"],
  [/\bgit\s+push\b.*\s(origin\s+)?(HEAD:)?(refs\/heads\/)?(main|master)\b/i, "push to main"],
  [/\bgit\s+tag\s+(-a|-s|-f|-d|[\w.-]+\s+[0-9a-f]{7,})/i, "tags are created by the owner at release time"],
  [/\bgit\s+tag\s+v?\d+\.\d+\.\d+/i, "tags are created by the owner at release time"],
  [/\bgit\s+(-c\s+\S+\s+)*config\b.*\b(core\.|remote\.|credential\.|url\.|alias\.|include)/i, "git config of core, remote, credential, url, alias or include"],
  [/\bgit\s+-c\s+(core|credential|url|alias)\./i, "git -c on protected keys"],
  [/(^|[\s'"/=])\.env(\.(?!example\b)[\w.-]+)?(?=$|[\s'"/;|&)])/i, "access to .env files"],
  [/\b(printenv|env\s*$|set\s*$|export\s+-p)\b/i, "environment dumps"],
];

const GUARDRAIL = /\.claude[\\/](settings\.json|hooks\b)|scripts[\\/]test-hooks/i;
const WRITE_VERB = /(^|\s)(rm|mv|cp|tee|sed\s+-i|perl\s+-i|truncate|chmod|ln|Set-Content|Out-File|Remove-Item|Move-Item|Copy-Item)\b|>{1,2}/i;
const RM_RF = /\brm\s+(-[a-z]*r[a-z]*f[a-z]*|-[a-z]*f[a-z]*r[a-z]*|-r\s+-f|-f\s+-r|--recursive)\b/i;
const RM_ALLOWED = /^(\.\/)?(dist|coverage|node_modules|\.tmp|\.worktrees\/[\w.-]+)\/?$/;

/** Bash guard: returns a reason to block, or null. `currentBranch` is read lazily. */
export function checkBash(command, { owner = false, currentBranch = () => null } = {}) {
  if (typeof command !== "string" || command.trim() === "") return null;
  for (const [pattern, reason] of BASH_RULES) {
    if (owner && /owner-only|owner's job|release/.test(reason)) continue;
    if (pattern.test(command)) return reason;
  }
  for (const step of steps(command)) {
    if (!owner && GUARDRAIL.test(step) && WRITE_VERB.test(step)) return "guardrails are edited by the owner only";
    if (RM_RF.test(step)) {
      const targets = step.replace(RM_RF, "").replace(/^\s*rm\b/i, "").trim().split(/\s+/).filter((t) => t && !t.startsWith("-"));
      if (targets.length === 0 || targets.some((t) => !RM_ALLOWED.test(t.replaceAll("\\", "/")))) {
        return "recursive delete outside dist, coverage, node_modules, .tmp or a worktree";
      }
    }
    const explicitRefspec = /\sorigin\s+(?!HEAD\s*$)\S/.test(step);
    if (/\bgit\s+push\b/i.test(step) && !explicitRefspec) {
      const branch = currentBranch();
      if (branch === null) return "cannot read the current branch for a bare git push";
      if (/^(main|master)$/.test(branch)) return "push to main";
    }
  }
  return null;
}

const SECRET_FILE = /(^|\/)(\.env(\.(?!example$)[^/]+)?|[^/]+\.(pem|key))$/i;
const PROTECTED_WRITE = /^(\.claude\/settings\.json|\.claude\/hooks\/.*|scripts\/test-hooks.*|\.git\/.*|pnpm-lock\.yaml|CHANGELOG\.md)$/i;
const LOCAL_FILE = /^(CLAUDE\.local\.md|\.claude\/settings\.local\.json|\.claude\/private-patterns\.local\.txt|\.tmp\/.*|\.worktrees\/[^/]+\.tmp\/.*)$/i;
const AI_ATTRIBUTION = /co-authored-by:|generated with \[?claude|🤖|anthropic\.com/i;

/** Path relative to the project root, forward slashes; null when outside the project. */
export function relativeTo(root, file) {
  const r = root.toLowerCase();
  const f = file.toLowerCase();
  if (f === r) return "";
  if (!f.startsWith(`${r}/`)) return null;
  return file.slice(root.length + 1);
}

/**
 * File guard for Read/Edit/Write. `rel` is the path relative to the project root (null when
 * outside), `content` the text being written (empty for Read), `privatePatterns` literal strings
 * that must never reach a tracked file.
 */
export function checkFile({ tool, rel, content = "", owner = false, privatePatterns = [] }) {
  if (rel === null) return null;
  if (SECRET_FILE.test(rel)) return `secret file ${rel}`;
  if (tool === "Read") return null;
  if (PROTECTED_WRITE.test(rel)) return owner ? null : `${rel} is written by the owner or by tooling only`;
  if (AI_ATTRIBUTION.test(content)) return "no Claude or AI attribution in commits, PRs, docs or code";
  if (!LOCAL_FILE.test(rel)) {
    const hit = privatePatterns.find((p) => content.includes(p));
    if (hit !== undefined) return `private data from the owner's home in a tracked file (${rel}); keep it in CLAUDE.local.md`;
  }
  return null;
}
