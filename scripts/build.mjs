import { deflateRawSync } from "node:zlib";
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "extension");
const DIST = join(ROOT, "dist");
mkdirSync(DIST, { recursive: true });

function walk(dir) {
	const out = [];
	for (const name of readdirSync(dir).sort()) {
		if (name.startsWith(".")) continue;
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
function crc32(buf) {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function zip(entries) {
	const locals = [];
	const centrals = [];
	let offset = 0;
	const DOS_TIME = 0;
	const DOS_DATE = (2026 - 1980) << 9 | (1 << 5) | 1;
	for (const { name, data } of entries) {
		const nameBuf = Buffer.from(name, "utf8");
		const comp = deflateRawSync(data, { level: 9 });
		const crc = crc32(data);
		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(0x0800, 6);
		local.writeUInt16LE(8, 8);
		local.writeUInt16LE(DOS_TIME, 10);
		local.writeUInt16LE(DOS_DATE, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(comp.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(nameBuf.length, 26);
		local.writeUInt16LE(0, 28);
		locals.push(local, nameBuf, comp);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(0x0800, 8);
		central.writeUInt16LE(8, 10);
		central.writeUInt16LE(DOS_TIME, 12);
		central.writeUInt16LE(DOS_DATE, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(comp.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(nameBuf.length, 28);
		central.writeUInt32LE(offset, 42);
		centrals.push(central, nameBuf);
		offset += 30 + nameBuf.length + comp.length;
	}
	const centralBuf = Buffer.concat(centrals);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(centralBuf.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, centralBuf, end]);
}

const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
const files = walk(SRC).filter((p) => !p.endsWith(`${sep}manifest.json`));

function build(target, transform) {
	const m = transform(structuredClone(manifest));
	const entries = [{ name: "manifest.json", data: Buffer.from(JSON.stringify(m, null, 2)) }];
	for (const p of files) entries.push({ name: relative(SRC, p).split(sep).join("/"), data: readFileSync(p) });
	const out = join(DIST, `yt-7tv-client-${manifest.version}-${target}.zip`);
	writeFileSync(out, zip(entries));
	console.log(relative(ROOT, out), `(${entries.length} arquivos)`);
}

build("chromium", (m) => {
	delete m.browser_specific_settings;
	if (m.background) delete m.background.scripts;
	return m;
});
build("firefox", (m) => {
	if (m.background) delete m.background.service_worker;
	m.permissions = (m.permissions || []).filter((p) => p !== "scripting");
	return m;
});
