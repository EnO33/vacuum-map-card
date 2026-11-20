// PreToolUse(Bash): blocks the commands CLAUDE.md reserves to the owner. Exit 2 = blocked.
import { block, ownerMode, readPayload, runProgram } from "./lib.mjs";
import { checkBash } from "./rules.mjs";

const payload = readPayload();
const command = String(payload?.tool_input?.command ?? "");
const cwd = typeof payload?.cwd === "string" ? payload.cwd : process.cwd();

const reason = checkBash(command, {
  owner: ownerMode(payload),
  currentBranch: () => {
    const r = runProgram("git", ["branch", "--show-current"], { cwd });
    return r.ok && r.stdout !== "" ? r.stdout : null;
  },
});
if (reason !== null) block(reason);
process.exit(0);
