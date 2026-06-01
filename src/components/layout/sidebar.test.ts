import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(new URL("./sidebar.tsx", import.meta.url));
const source = readFileSync(sourcePath, "utf8");

assert.match(source, /href="\/\?stay=1#catalog"/);
assert.match(source, /마을별 둘러보기/);
assert.match(source, /aria-label="마을별 둘러보기"/);
