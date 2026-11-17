(() => {
	const { h, ui, i18n, life } = YTSE;

	const MESSAGE_SELECTOR = "#message";
	const AUTHOR_RENDERERS = "yt-live-chat-text-message-renderer, yt-live-chat-paid-message-renderer";
	const MAX_CHATTERS = 1500;

	let emotes = new Map();
	let generation = 0;
	let observer = null;
	let root = null;
	let pending = new Set();
	let flushScheduled = false;
	let settings = {};
	let armed = false;
	const genTag = () => `${life.id}:${generation}`;

	const chatters = new Map();

	function isMessageEl(el) {
		return el.id === "message" && el.closest("yt-live-chat-app") && !el.closest("[contenteditable]");
	}

	function createEmoteImg(e, zeroWidth) {
		const img = h("img", {
			class: zeroWidth ? "ytse-emote ytse-emote-zw" : "ytse-emote",
			src: e.src,
			srcset: e.srcset,
			alt: e.name,
			draggable: "false",
			decoding: "async",
		});
		if (e.width && e.height) {
			img.width = e.width;
			img.height = e.height;
		}
		img.dataset.ytseName = e.name;
		return img;
	}

	function createBox(e) {
		const box = h("span", { class: "ytse-emote-box" }, createEmoteImg(e, false));
		box.dataset.ytseText = e.name;
		return box;
	}

	function trackChatter(msgEl) {
		const renderer = msgEl.closest(AUTHOR_RENDERERS);
		if (!renderer) return;
		const nameEl = renderer.querySelector("#author-name");
		if (!nameEl) return;
		let raw = "";
		for (const n of nameEl.childNodes) {
			if (n.nodeType === Node.TEXT_NODE) raw += n.data;
		}
		raw = raw.trim().replace(/^@/, "");
		if (!raw) return;
		const key = raw.toLowerCase();
		chatters.delete(key);
		chatters.set(key, { username: raw, displayName: raw });
		if (chatters.size > MAX_CHATTERS) chatters.delete(chatters.keys().next().value);
	}

	function revert(msgEl) {
		const boxes = msgEl.querySelectorAll(".ytse-emote-box");
		if (!boxes.length) return;
		for (const b of boxes) b.replaceWith(document.createTextNode(b.dataset.ytseText || ""));
		msgEl.normalize();
	}

	function processTextNode(node) {
		const text = node.data;
		if (!text || !/\S/.test(text)) return;
		const parts = text.split(/(\s+)/);
		let found = false;
		for (const p of parts) {
			if (p && emotes.has(p)) {
				found = true;
				break;
			}
		}
		if (!found) return;

		const frag = document.createDocumentFragment();
		let lastBox = null;
		let pendingSpace = "";
		for (const p of parts) {
			if (!p) continue;
			if (/^\s+$/.test(p)) {
				pendingSpace += p;
				continue;
			}
			const e = emotes.get(p);
			if (e && e.zeroWidth && lastBox) {
				lastBox.append(createEmoteImg(e, true));
				lastBox.dataset.ytseText += " " + e.name;
				pendingSpace = "";
				continue;
			}
			if (pendingSpace) {
				frag.append(document.createTextNode(pendingSpace));
				pendingSpace = "";
			}
			if (e) {
				lastBox = createBox(e);
				frag.append(lastBox);
			} else {
				lastBox = null;
				frag.append(document.createTextNode(p));
			}
		}
		if (pendingSpace) frag.append(document.createTextNode(pendingSpace));
		node.replaceWith(frag);
	}

	function processMessage(msgEl) {
		if (!msgEl.isConnected) return;
		if (msgEl.dataset.ytseGen === genTag()) return;
		trackChatter(msgEl);
		revert(msgEl);
		if (emotes.size) {
			const walker = document.createTreeWalker(msgEl, NodeFilter.SHOW_TEXT, {
				acceptNode(n) {
					const p = n.parentElement;
					if (p && (p.closest("a") || p.closest(".ytse-emote-box"))) return NodeFilter.FILTER_REJECT;
					return NodeFilter.FILTER_ACCEPT;
				},
			});
			const nodes = [];
			while (walker.nextNode()) nodes.push(walker.currentNode);
			for (const n of nodes) processTextNode(n);
		}
		msgEl.dataset.ytseGen = genTag();
	}

	function queue(el) {
		pending.add(el);
		if (!flushScheduled) {
			flushScheduled = true;
			queueMicrotask(flush);
		}
	}

	function flush() {
		flushScheduled = false;
		if (!life.alive || !armed) return;
		const list = pending;
		pending = new Set();
		for (const el of list) processMessage(el);
		observer?.takeRecords();
	}

	function scan(node) {
		if (node.nodeType === Node.TEXT_NODE) {
			const m = node.parentElement?.closest(MESSAGE_SELECTOR);
			if (m && isMessageEl(m)) {
				delete m.dataset.ytseGen;
				queue(m);
			}
			return;
		}
		if (node.nodeType !== Node.ELEMENT_NODE) return;
		if (node.classList?.contains("ytse-emote-box") || node.classList?.contains("ytse-emote")) return;
		if (node.id === "message" && isMessageEl(node)) {
			queue(node);
			return;
		}
		const inside = node.closest?.(MESSAGE_SELECTOR);
		if (inside && isMessageEl(inside)) {
			delete inside.dataset.ytseGen;
			queue(inside);
			return;
		}
		for (const m of node.querySelectorAll(MESSAGE_SELECTOR)) if (isMessageEl(m)) queue(m);
	}

	function rerenderAll() {
		generation++;
		const app = document.querySelector("yt-live-chat-app") || document.body;
		for (const m of app.querySelectorAll(MESSAGE_SELECTOR)) if (isMessageEl(m)) queue(m);
	}

	function revertAll() {
		const app = document.querySelector("yt-live-chat-app") || document.body;
		for (const m of app.querySelectorAll(MESSAGE_SELECTOR)) {
			revert(m);
			delete m.dataset.ytseGen;
		}
	}

	function start() {
		if (observer) return;
		root = document.querySelector("yt-live-chat-app") || document.body;
		observer = life.observer((records) => {
			for (const r of records) {
				for (const n of r.addedNodes) scan(n);
			}
		});
		observer.observe(root, { childList: true, subtree: true });
		initTooltip();
		life.add((why) => {
			pending.clear();
			tipHost?.remove();
			if (why !== "orphaned") return;
			const me = life.id;
			setTimeout(() => {
				if (document.documentElement.dataset.ytseInstance === me) revertAll();
			}, 4000);
		});
	}

	function setEmotes(map) {
		emotes = map || new Map();
		armed = true;
		rerenderAll();
	}

	function arm() {
		if (armed) return;
		armed = true;
		rerenderAll();
	}

	function setSettings(s) {
		settings = s;
		if (!settings.tooltips) hideTooltip();
	}

	let tipHost = null;
	let tipEls = null;
	let tipTarget = null;

	const TIP_CSS = `
		:host { all: initial; }
		.tip {
			position: fixed; z-index: 100001; pointer-events: none;
			display: flex; flex-direction: column; align-items: center; gap: 2px;
			min-width: 96px; max-width: 220px; padding: 10px 12px;
			background: var(--ytse-menu); color: var(--ytse-text);
			border-radius: 8px; box-shadow: var(--ytse-shadow); outline: 1px solid var(--ytse-outline);
			font-size: 12px; line-height: 16px; text-align: center;
			transform: translate(-50%, calc(-100% - 8px));
		}
		.tip[hidden] { display: none; }
		.imgs { display: grid; place-items: center; min-height: 32px; margin-bottom: 4px; }
		.imgs img { grid-area: 1 / 1; max-height: 112px; max-width: 196px; object-fit: contain; }
		.name { font-size: 14px; line-height: 20px; font-weight: 500; word-break: break-all; }
		.scope, .owner { color: var(--ytse-text-2); }
		.zw { color: var(--ytse-accent); }
	`;

	function initTooltip() {
		if (tipHost) return;
		tipHost = h("div", { id: "ytse-tooltip-host", [YTSE.OWNED]: "" });
		const shadow = tipHost.attachShadow({ mode: "open" });
		const style = ui.style(ui.PALETTE, ui.BASE, TIP_CSS);
		const tip = ui.bindTheme(h("div", { class: "tip", hidden: true }));
		const imgs = h("div", { class: "imgs" });
		const name = h("div", { class: "name" });
		const scope = h("div", { class: "scope" });
		const owner = h("div", { class: "owner" });
		const zw = h("div", { class: "zw" });
		tip.append(imgs, name, scope, owner, zw);
		shadow.append(style, tip);
		document.body.append(tipHost);
		tipEls = { tip, imgs, name, scope, owner, zw };

		life.on(document, "mouseover", (ev) => {
			const img = ev.target instanceof Element ? ev.target.closest(".ytse-emote-box") : null;
			if (!img) return;
			if (img !== tipTarget) showTooltip(img);
		});
		life.on(document, "mouseout", (ev) => {
			if (!tipTarget) return;
			const to = ev.relatedTarget;
			if (to instanceof Node && tipTarget.contains(to)) return;
			hideTooltip();
		});
		life.on(document, "scroll", () => {
			if (!tipTarget) return;
			if (tipTarget.isConnected) positionTooltip(tipTarget);
			else hideTooltip();
		}, true);
	}

	function scopeLabel(e) {
		return i18n.t(e.scope === "GLOBAL" ? "tipGlobal" : "tipChannel");
	}

	function showTooltip(box) {
		if (!settings.tooltips || !tipEls) return;
		const names = (box.dataset.ytseText || "").split(" ").filter(Boolean);
		const list = names.map((n) => emotes.get(n)).filter(Boolean);
		if (!list.length) return;
		tipTarget = box;
		const [base, ...overlays] = list;
		tipEls.imgs.replaceChildren(...list.map((e) => h("img", { src: e.big, alt: e.name })));
		tipEls.name.textContent = base.name;
		tipEls.scope.textContent = scopeLabel(base) + (base.originalName ? ` · ${i18n.t("tipAlias", { name: base.originalName })}` : "");
		tipEls.owner.textContent = base.owner ? i18n.t("tipBy", { name: base.owner }) : "";
		tipEls.zw.textContent = overlays.length ? `+ ${overlays.map((e) => e.name).join(", ")}` : "";
		tipEls.tip.hidden = false;
		positionTooltip(box);
	}

	function positionTooltip(box) {
		const r = box.getBoundingClientRect();
		if (r.bottom < 0 || r.top > window.innerHeight) {
			hideTooltip();
			return;
		}
		const tw = tipEls.tip.offsetWidth;
		const half = tw / 2;
		let x = r.left + r.width / 2;
		x = Math.max(half + 4, Math.min(window.innerWidth - half - 4, x));
		tipEls.tip.style.left = `${x}px`;
		const th = tipEls.tip.offsetHeight;
		if (r.top - th - 8 < 0) {
			tipEls.tip.style.top = `${r.bottom + th + 16}px`;
		} else {
			tipEls.tip.style.top = `${r.top}px`;
		}
	}

	function hideTooltip() {
		tipTarget = null;
		if (tipEls) tipEls.tip.hidden = true;
	}

	function getChatters() {
		return [...chatters.values()];
	}

	YTSE.render = { start, arm, setEmotes, setSettings, getChatters, rerenderAll, revertAll };
})();
