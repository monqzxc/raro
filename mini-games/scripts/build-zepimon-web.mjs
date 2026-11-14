import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDir, "../..");
const expoRoot = resolve(repositoryRoot, "zepimon-mobile");
const outputDir = resolve(repositoryRoot, "mini-games/public/zepimon-web");
const expoCli = resolve(expoRoot, "node_modules/expo/bin/cli");
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBasePath = process.env.GITHUB_ACTIONS === "true" && repositoryName && repositoryName !== "monqzxc.github.io"
  ? `/${repositoryName}`
  : "";
const baseUrl = `${pagesBasePath}/zepimon-web`;

await access(expoCli);
await mkdir(resolve(outputDir, ".."), { recursive: true });
await rm(outputDir, { recursive: true, force: true });

const result = spawnSync(process.execPath, [expoCli, "export", "--platform", "web", "--output-dir", outputDir], {
  cwd: expoRoot,
  env: { ...process.env, MONGAMES_EXPO_BASE_URL: baseUrl },
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Zepimon web export failed with exit code ${result.status ?? "unknown"}.`);

try {
  await access(resolve(outputDir, "mini-games.html"));
} catch {
  throw new Error("Zepimon export did not produce its individual game launch route.");
}

const raftSpritesDir = resolve(outputDir, "raft-sprites");
await mkdir(raftSpritesDir, { recursive: true });
for (const name of ["pikachu", "gengar", "charizard", "bidoof"]) {
  await copyFile(resolve(expoRoot, "assets/trail", `${name}.png`), resolve(raftSpritesDir, `${name}.png`));
}
