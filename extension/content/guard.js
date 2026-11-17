(() => {
	const { h, i18n, ui, life } = YTSE;
	const chat = YTSE.input;

	const CONFIRM_MS = 20000;
	const TRACK_WINDOW_MS = 10000;
	const FORGET_MS = 10 * 60000;
	const VIEW_SWITCH_MS = 30000;

	let settings = {};
	let sentAt = 0;
	const tracked = new Map();
	let viewSwitched = false;
	let viewDeadline = 0;
	let getCarouselRect = () => null;

	let warnHost = null;
	let warnBox = null;
	let warnText = null;
	let flashUntil = 0;
	let rafId = null;

	const WARN_CSS = `
		:host { all: initial; }
		.warn {
			position: fixed; z-index: 100001; pointer-events: none;
			display: flex; align-items: center; gap: 4px; max-width: calc(100vw - 16px);
			padding: 2px 8px; border-radius: 4px;
			background: var(--ytse-menu); box-shadow: var(--ytse-shadow);
			color: var(--ytse-error); font-size: 11px; line-height: 16px; font-weight: 500;
			transform: translateY(-100%);
		}
		.warn[hidden] { display: none; }
		.warn svg { flex: 0 0 auto; width: 12px; height: 12px; }
	`;

	function ensureWarn() {
		if (warnHost) return;
		warnHost = h("div", { id: "ytse-guard-host", [YTSE.OWNED]: "" });
		const shadow = warnHost.attachShadow({ mode: "open" });
		warnText = h("span");
		warnBox = ui.bindTheme(h("div", { class: "warn", hidden: true, role: "status" }, YTSE.svg(YTSE.icons.warning, "12"), warnText));
		shadow.append(ui.style(ui.PALETTE, ui.BASE, WARN_CSS), warnBox);
		document.body.append(warnHost);
	}

	function anchorRect() {
		for (const s of ["yt-live-chat-message-input-renderer", "#input-panel", "yt-live-chat-text-input-field-renderer"]) {
			const el = document.querySelector(s);
			if (!el) continue;
			const r = el.getBoundingClientRect();
			if (r.width > 0 && r.height > 0) return r;
		}
		return null;
	}

	function position() {
		const r = anchorRect();
		if (!r || !warnBox) return;
		const carousel = getCarouselRect();
		const top = carousel && carousel.height > 0 ? Math.min(carousel.top, r.top) : r.top;
		warnBox.style.left = `${Math.max(8, r.left + 12)}px`;
		warnBox.style.top = `${Math.max(24, top - 4)}px`;
	}

	function loop() {
		if (!life.alive) return;
		rafId = requestAnimationFrame(loop);
		if (!warnBox || warnBox.hidden) return;
		if (flashUntil && Date.now() > flashUntil) {
			flashUntil = 0;
			refreshWarn();
			return;
		}
		position();
	}

	function refreshWarn() {
		const input = chat.field();
		const show = settings.sendGuard && (Date.now() < flashUntil || (input && chat.isOver(input)));
		if (!show) {
			if (warnBox) warnBox.hidden = true;
			if (rafId) cancelAnimationFrame(rafId);
			rafId = null;
			return;
		}
		ensureWarn();
		warnText.textContent = i18n.t("limitChars", { max: i18n.num(chat.MAX_CHARS) });
		warnBox.hidden = false;
		position();
		if (!rafId) loop();
	}

	function flash() {
		flashUntil = Date.now() + 3500;
		refreshWarn();
	}

	function allows(delta, input = chat.field()) {
		if (!settings.sendGuard || !input) return true;
		if (chat.count(input) + delta <= chat.MAX_CHARS) return true;
		flash();
		return false;
	}

	function markSend(input) {
		if (!input || chat.count(input) === 0) return;
		if (settings.sendGuard && chat.isOver(input)) {
			flash();
			return;
		}
		sentAt = Date.now();
	}

	function onKeyDown(ev) {
		if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing) return;
		const input = chat.activeInput();
		if (input) markSend(input);
	}

	function onClick(ev) {
		if (!(ev.target instanceof Element) || !ev.target.closest("#send-button")) return;
		markSend(chat.field());
	}

	function onInput(ev) {
		if (chat.findInput(ev.target)) refreshWarn();
	}

	function directText(el) {
		if (!el) return "";
		let s = "";
		for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) s += n.data;
		return s.trim().replace(/^@/, "");
	}

	function ownName() {
		const el = document.querySelector("yt-live-chat-message-input-renderer #author-name");
		return directText(el) || (el?.textContent || "").trim().replace(/^@/, "");
	}

	function isMine(el) {
		if (!/^Ch/.test(el.id || "")) return true;
		const me = ownName();
		return !!me && directText(el.querySelector("#author-name")) === me;
	}

	function consider(el) {
		if (tracked.has(el) || !isMine(el)) return;
		tracked.set(el, { id: el.id, at: Date.now(), marked: false });
	}

	function watchItems() {
		const root = document.querySelector("yt-live-chat-app") || document.body;
		life.observer((records) => {
			if (!settings.sendGuard || Date.now() - sentAt > TRACK_WINDOW_MS) return;
			for (const r of records) {
				for (const n of r.addedNodes) {
					if (n.nodeType !== Node.ELEMENT_NODE) continue;
					if (n.localName === "yt-live-chat-text-message-renderer") consider(n);
					else if (n.firstElementChild) n.querySelectorAll("yt-live-chat-text-message-renderer").forEach(consider);
				}
			}
		}).observe(root, { childList: true, subtree: true });
	}

	function mark(el) {
		if (el.querySelector(".ytse-unconfirmed")) return;
		const text = i18n.t("notConfirmed");
		const note = h("div", { class: "ytse-unconfirmed", title: text, [YTSE.OWNED]: "" }, YTSE.svg(YTSE.icons.warning, "12"), h("span", { text }));
		(el.querySelector("#content") || el).append(note);
	}

	function unmark(el) {
		el.querySelectorAll(".ytse-unconfirmed").forEach((n) => n.remove());
	}

	function clearMarkers() {
		for (const el of tracked.keys()) unmark(el);
		tracked.clear();
	}

	function checkTracked() {
		const now = Date.now();
		for (const [el, rec] of tracked) {
			if (!el.isConnected) {
				tracked.delete(el);
			} else if (el.id !== rec.id) {
				unmark(el);
				tracked.delete(el);
			} else if (!rec.marked && now - rec.at > CONFIRM_MS) {
				mark(el);
				rec.marked = true;
			} else if (now - rec.at > FORGET_MS) {
				tracked.delete(el);
			}
		}
	}

	const VIEW_FLAG = "ytseView";

	function ensureLiveChat() {
		if (!settings.allMessages || viewSwitched) return;
		if (document.documentElement.dataset[VIEW_FLAG]) {
			viewSwitched = true;
			return;
		}
		if (Date.now() > viewDeadline) {
			viewSwitched = true;
			return;
		}
		const items = document.querySelectorAll("yt-sort-filter-sub-menu-renderer tp-yt-paper-listbox a.yt-simple-endpoint");
		if (items.length < 2) return;
		viewSwitched = true;
		document.documentElement.dataset[VIEW_FLAG] = "1";
		const live = items[1];
		if (live.getAttribute("aria-selected") === "true" || live.classList.contains("iron-selected")) return;
		live.click();
	}

	function tick() {
		ensureLiveChat();
		if (settings.sendGuard) checkTracked();
	}

	function init(opts = {}) {
		getCarouselRect = opts.getCarouselRect || getCarouselRect;
		viewDeadline = Date.now() + VIEW_SWITCH_MS;
		life.on(window, "keydown", onKeyDown, true);
		life.on(document, "click", onClick, true);
		life.on(document, "input", onInput, true);
		watchItems();
		life.every(tick, 1000);
		life.add(() => {
			if (rafId) cancelAnimationFrame(rafId);
			rafId = null;
			warnHost?.remove();
			clearMarkers();
		});
		tick();
	}

	function setSettings(s) {
		const turnedOn = s.allMessages && settings.allMessages === false;
		settings = s;
		if (turnedOn) {
			viewSwitched = false;
			delete document.documentElement.dataset[VIEW_FLAG];
			viewDeadline = Date.now() + VIEW_SWITCH_MS;
			ensureLiveChat();
		}
		if (!s.sendGuard) clearMarkers();
		refreshWarn();
	}

	function relabel() {
		const text = i18n.t("notConfirmed");
		for (const n of document.querySelectorAll(".ytse-unconfirmed")) {
			n.title = text;
			const span = n.querySelector("span");
			if (span) span.textContent = text;
		}
		refreshWarn();
	}

	YTSE.guard = { init, setSettings, allows, flash, relabel };
})();
