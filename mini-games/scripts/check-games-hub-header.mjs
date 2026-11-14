import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../components/games-hub.tsx", import.meta.url), "utf8");

test("games hub wordmark links to the main site", () => {
  const wordmark = source.match(/<a className="wordmark" href="https:\/\/monqzxc\.github\.io\/">([\s\S]*?)<\/a>/);
  assert.ok(wordmark, "the full wordmark should be an external link");
  assert.match(wordmark[1], /<strong>mon<span>\.<\/span><\/strong>/);
  assert.match(wordmark[1], /<span className="games-wordmark-label">Mini games<\/span>/);
});
