var YTSE = (() => {
	const inPage = typeof document !== "undefined" && typeof location !== "undefined" && /^https?:$/.test(location.protocol);
	if (inPage) document.dispatchEvent(new CustomEvent("ytse:takeover"));
	return (globalThis.YTSE = { inPage });
})();

YTSE.api = globalThis.browser ?? globalThis.chrome;

YTSE.log = (...args) => console.debug("[YT 7TV]", ...args);
YTSE.warn = (...args) => console.warn("[YT 7TV]", ...args);

YTSE.version = (() => {
	try {
		return YTSE.api?.runtime?.getManifest?.().version || "";
	} catch {
		return "";
	}
})();

YTSE.extAlive = () => {
	try {
		return !!YTSE.api?.runtime?.id;
	} catch {
		return false;
	}
};

YTSE.isContextError = (e) => /context invalidated|extension context|dead object/i.test(String(e?.message || e));

YTSE.life = (() => {
	const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	const cleanups = [];
	let alive = true;
	let reason = null;

	function guard(fn, label = "Handler failed") {
		return function (...args) {
			if (!alive) return undefined;
			try {
				return fn.apply(this, args);
			} catch (e) {
				YTSE.warn(label, e);
				return undefined;
			}
		};
	}

	function add(fn) {
		if (alive) cleanups.push(fn);
		else {
			try {
				fn(reason);
			} catch {}
		}
	}

	function on(target, type, fn, opts) {
		const g = guard(fn);
		target.addEventListener(type, g, opts);
		add(() => target.removeEventListener(type, g, opts));
		return g;
	}

	function every(fn, ms) {
		const t = setInterval(guard(fn), ms);
		add(() => clearInterval(t));
		return t;
	}

	function after(fn, ms) {
		return setTimeout(guard(fn), ms);
	}

	function observer(cb) {
		const mo = new MutationObserver(guard(cb));
		add(() => mo.disconnect());
		return mo;
	}

	function teardown(why) {
		if (!alive) return false;
		alive = false;
		reason = why;
		YTSE.log(`Stopped (${why})`);
		for (const fn of cleanups.splice(0).reverse()) {
			try {
				fn(why);
			} catch (e) {
				YTSE.warn("Cleanup failed", e);
			}
		}
		return true;
	}

	return {
		id,
		guard,
		add,
		on,
		every,
		after,
		observer,
		teardown,
		get alive() {
			return alive;
		},
		get reason() {
			return reason;
		},
	};
})();

if (YTSE.inPage) {
	YTSE.life.on(document, "ytse:takeover", () => YTSE.life.teardown("takeover"));
	YTSE.life.on(document, "ytse:ping", () => {
		if (YTSE.extAlive()) document.documentElement.setAttribute("data-ytse-pong", YTSE.life.id);
	});
}

YTSE.OWNED = "data-ytse";

YTSE.STALE = [
	"[data-ytse]",
	"#ytse-tooltip-host",
	"#ytse-carousel-host",
	"#ytse-prompt-host",
	"#ytse-panel-host",
	"#ytse-guard-host",
	".ytse-picker-tab",
	".ytse-emote-menu-host",
	".ytse-unconfirmed",
].join(",");

YTSE.cleanStale = () => {
	for (const el of document.querySelectorAll(YTSE.STALE)) el.remove();
	for (const el of document.querySelectorAll(".ytse-7tv-on")) el.classList.remove("ytse-7tv-on");
};

YTSE.h = function h(tag, attrs, ...children) {
	const el = document.createElement(tag);
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			if (v == null || v === false) continue;
			if (k === "class") el.className = v;
			else if (k === "text") el.textContent = v;
			else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
			else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
			else if (k in el && typeof v !== "string") el[k] = v;
			else el.setAttribute(k, v === true ? "" : String(v));
		}
	}
	for (const c of children.flat()) {
		if (c == null || c === false) continue;
		el.append(c instanceof Node ? c : document.createTextNode(String(c)));
	}
	return el;
};

YTSE.svg = function svg(icon, size = "1.2em") {
	const NS = "http://www.w3.org/2000/svg";
	const s = document.createElementNS(NS, "svg");
	s.setAttribute("viewBox", icon.viewBox);
	s.setAttribute("width", size);
	s.setAttribute("height", size);
	s.setAttribute("aria-hidden", "true");
	s.setAttribute("focusable", "false");
	const p = document.createElementNS(NS, "path");
	p.setAttribute("fill", "currentColor");
	p.setAttribute("d", icon.d);
	s.append(p);
	return s;
};

YTSE.icons = {
	caretLeft: {
		viewBox: "0 0 256 256",
		d: "M165.66 202.34a8 8 0 0 1-11.32 11.32l-80-80a8 8 0 0 1 0-11.32l80-80a8 8 0 0 1 11.32 11.32L91.31 128Z",
	},
	caretRight: {
		viewBox: "0 0 256 256",
		d: "m181.66 133.66l-80 80a8 8 0 0 1-11.32-11.32L164.69 128L90.34 53.66a8 8 0 0 1 11.32-11.32l80 80a8 8 0 0 1 0 11.32",
	},
	logo7tv: {
		viewBox: "0 0 33 23.551",
		d: "M2.383,0,0,4.127,1.473,6.676H11.7L3.426,21,4.9,23.551H9.66Q14.532,15.113,19.4,6.676L15.549,0ZM18.492,0l3.856,6.676h2.945l2.381-4.125L26.2,0Zm2.383,9.225L17.021,15.9l4.417,7.649H26.2L33,11.775l-1.473-2.55H26.764l-2.944,5.1Z",
	},
	settings: {
		viewBox: "0 0 24 24",
		d: "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z",
	},
	close: {
		viewBox: "0 0 24 24",
		d: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
	},
	search: {
		viewBox: "0 0 24 24",
		d: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
	},
	warning: {
		viewBox: "0 0 24 24",
		d: "M1 21h22L12 2zm12-3h-2v-2h2zm0-4h-2v-4h2z",
	},
};
