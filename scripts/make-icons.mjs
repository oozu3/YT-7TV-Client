import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "assets", "icon-source.png");
const OUT = join(ROOT, "extension", "icons");
mkdirSync(OUT, { recursive: true });

for (const size of [16, 32, 48, 128]) {
	const out = join(OUT, `${size}.png`);
	execFileSync("magick", [SRC, "-filter", "Lanczos", "-resize", `${size}x${size}`, "-strip", `PNG32:${out}`]);
	console.log(`extension/icons/${size}.png`);
}
