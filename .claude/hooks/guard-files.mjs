// PreToolUse(Read|Edit|Write|MultiEdit|NotebookEdit): secrets, protected files, AI attribution
// and the owner's private data in tracked files. Exit 2 = blocked.
import { block, normalise, ownerMode, projectRoot, readPayload, readPrivatePatterns } from "./lib.mjs";
import { checkFile, relativeTo } from "./rules.mjs";

const payload = readPayload();
const input = payload?.tool_input ?? {};
const tool = String(payload?.tool_name ?? "");
const file = normalise(String(input.file_path ?? input.notebook_path ?? ""));
if (file === "") process.exit(0);

const root = projectRoot();
const edits = Array.isArray(input.edits) ? input.edits.map((e) => String(e?.new_string ?? "")) : [];
const content = [input.content, input.new_string, input.new_source, ...edits].filter((v) => typeof v === "string").join("\n");

const reason = checkFile({
  tool,
  rel: relativeTo(root, file),
  content,
  owner: ownerMode(payload),
  privatePatterns: readPrivatePatterns(root),
});
if (reason !== null) block(reason);
process.exit(0);
