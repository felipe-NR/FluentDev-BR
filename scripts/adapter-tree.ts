import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { repoRoot } from "./paths.ts";

// Installs from git run no build step, so a committed adapter package must match
// what the current plugin/ produces. Returns the process exit code.
export async function checkAdapter(adapterDir: string, generate: (dest: string) => Promise<void>): Promise<number> {
  const committedDir = join(repoRoot, adapterDir);
  const temp = await mkdtemp(join(tmpdir(), "adapter-check-"));
  try {
    await generate(temp);
    const problems = diff(await readTree(committedDir).catch(() => new Map<string, Buffer>()), await readTree(temp));
    if (problems.length === 0) {
      console.log(`${adapterDir} matches plugin/.`);
      return 0;
    }
    console.error(`${adapterDir} is out of date. Run \`npm run build\` and commit the result.`);
    for (const problem of problems) {
      console.error(`  ${problem}`);
    }
    return 1;
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function readTree(root: string): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  async function walk(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        files.set(relative(root, path).split(sep).join("/"), await readFile(path));
      }
    }
  }
  await walk(root);
  return files;
}

function diff(committed: ReadonlyMap<string, Buffer>, expected: ReadonlyMap<string, Buffer>): string[] {
  const problems: string[] = [];
  for (const [path, content] of expected) {
    const current = committed.get(path);
    if (current === undefined) {
      problems.push(`missing: ${path}`);
    } else if (!current.equals(content)) {
      problems.push(`stale: ${path}`);
    }
  }
  for (const path of committed.keys()) {
    if (!expected.has(path)) {
      problems.push(`unexpected: ${path}`);
    }
  }
  return problems.sort((a, b) => a.localeCompare(b));
}
