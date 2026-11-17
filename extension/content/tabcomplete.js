(() => {
	const { h, ui, life } = YTSE;

	const TAB_AROUND_MATCH_COUNT = 3;
	const TAB_MATCH_LIMIT = 25;

	let emotes = new Map();
	let settings = {};
	let getChatters = () => [];
	let getBroadcaster = () => null;

	let state = null;
	let applying = false;
	let inputObserver = null;
	let observedInput = null;

	const isSpace = (c) => c === " " || c === " ";
	const norm = (s) => s.replace(/ /g, " ");

	function getSearchRange(text, position) {
		let start = position;
		while (start > 0 && !(isSpace(text.charAt(start - 1)) && start !== position)) start--;
		let end = position;
		while (end < text.length && !isSpace(text.charAt(end))) end++;
		return [start, end];
	}

	function matchPriority(token, search) {
		const n = token.toLowerCase().indexOf(search);
		return n === -1 ? Number.MAX_SAFE_INTEGER : n === 0 ? 0 : 1000 + n;
	}

	function compareTokens(a, b) {
		if (a.item && !b.item) return -1;
		if (!a.item && b.item) return 1;
		if (a.priority !== b.priority) return a.priority - b.priority;
		return a.token.localeCompare(b.token);
	}

	function findMatchingTokens(str, limit = TAB_MATCH_LIMIT) {
		const usedTokens = new Set();
		const usedIds = new Set();
		const matches = [];
		const mode = Number(settings.tabMode) || 0;
		const prefix = str.toLowerCase();
		const search = prefix.startsWith(":") ? prefix.slice(1) : prefix;
		const isMention = prefix.startsWith("@");
		const test = (t) => (mode === 0 ? t.toLowerCase().startsWith(search) : t.toLowerCase().includes(search));

		if (!isMention) {
			for (const [token, emote] of emotes) {
				if (!test(token) || usedIds.has(emote.id) || usedTokens.has(token)) continue;
				usedTokens.add(token);
				usedIds.add(emote.id);
				matches.push({ token, priority: matchPriority(token, search), item: emote });
			}
		}

		if (settings.chatters && !prefix.startsWith(":")) {
			const at = prefix.startsWith("@");
			const lPrefix = at ? prefix.slice(1) : prefix;
			const broadcaster = (getBroadcaster() || "").replace(/^@/, "").trim().toLowerCase();
			const list = getChatters().slice();
			if (broadcaster) list.push({ username: broadcaster, displayName: getBroadcasterDisplay() });
			for (const c of list) {
				const display = (c.displayName || "").trim();
				const user = c.username || "";
				if (!display && !user) continue;
				if (!display.toLowerCase().startsWith(lPrefix) && !user.toLowerCase().startsWith(lPrefix)) continue;
				const u = display || user;
				if (usedTokens.has(u)) continue;
				usedTokens.add(u);
				const isBroadcaster = user.toLowerCase() === broadcaster;
				matches.push({ token: at ? `@${u}` : u, priority: at && isBroadcaster ? 0 : 10 });
			}
		}

		matches.sort(compareTokens);
		if (matches.length > limit) matches.length = limit;
		return matches;
	}

	function getBroadcasterDisplay() {
		return (getBroadcaster() || "").replace(/^@/, "");
	}

	function around(matches, index, direction) {
		const out = [];
		const seen = new Set();
		const current = matches[index]?.token;
		if (!current || matches.length <= 1) return out;
		for (let o = 1; o < matches.length && out.length < TAB_AROUND_MATCH_COUNT; o++) {
			const m =
				matches[direction === "forward" ? (index + o) % matches.length : (index - o + matches.length) % matches.length];
			if (!m || m.token === current || seen.has(m.token)) continue;
			seen.add(m.token);
			if (direction === "forward") out.push(m);
			else out.unshift(m);
		}
		return out;
	}

	const findInput = (from) => YTSE.input.findInput(from);
	const activeInput = () => YTSE.input.activeInput();

	function getCaret(input) {
		const sel = input.ownerDocument.getSelection();
		if (!sel || sel.rangeCount === 0) return null;
		let node = sel.anchorNode;
		let offset = sel.anchorOffset;
		if (!node || !input.contains(node)) return null;
		if (node.nodeType !== Node.TEXT_NODE) {
			const prev = node.childNodes[offset - 1];
			const next = node.childNodes[offset];
			if (prev && prev.nodeType === Node.TEXT_NODE) {
				node = prev;
				offset = prev.data.length;
			} else if (next && next.nodeType === Node.TEXT_NODE) {
				node = next;
				offset = 0;
			} else {
				return { node: null, offset: 0 };
			}
		}
		return { node, offset };
	}

	function replaceText(input, node, start, length, text) {
		const doc = input.ownerDocument;
		const sel = doc.getSelection();
		const range = doc.createRange();
		range.setStart(node, start);
		range.setEnd(node, Math.min(start + length, node.data.length));
		sel.removeAllRanges();
		sel.addRange(range);
		let ok = false;
		try {
			ok = doc.execCommand("insertText", false, text);
		} catch {
			ok = false;
		}
		if (!ok) {
			node.replaceData(start, length, text);
			const r = doc.createRange();
			r.setStart(node, start + text.length);
			r.collapse(true);
			sel.removeAllRanges();
			sel.addRange(r);
			input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
		}
		return true;
	}

	function getContext(input) {
		const caret = getCaret(input);
		if (!caret) return null;
		const { node, offset } = caret;
		const text = node ? node.data : null;

		if (state && text == null) {
			reset();
			return null;
		}

		let currentWord = null;
		let wordStart = 0;
		if (text != null) {
			const [s, e] = getSearchRange(text, offset);
			wordStart = s;
			if (offset !== s) currentWord = text.substring(s, e);
		}

		const atExpected = !!state && state.expectedNode === node && state.expectedOffset === offset;

		if (state && atExpected && text != null) {
			const w = state.expectedWord;
			const start = state.expectedOffset - w.length;
			if (start < 0 || state.expectedOffset > text.length || w.trim().length === 0) {
				reset();
				return null;
			}
			const live = text.slice(start, state.expectedOffset);
			if (live.trim().length === 0 || norm(live) !== norm(w)) {
				reset();
				return null;
			}
		}

		if (!atExpected && (!currentWord || currentWord === " ")) return null;

		let replaceStart = wordStart;
		let textToRemove;
		let searchWord;
		if (atExpected && state.expectedWord != null) {
			searchWord = state.expectedWord.trimEnd();
			replaceStart = state.expectedOffset - state.expectedWord.length;
			textToRemove = state.expectedWord;
		} else {
			const w = currentWord ?? "";
			searchWord = w.length && isSpace(w.charAt(w.length - 1)) ? w.slice(0, -1) : w;
			textToRemove = w;
		}

		const matches = atExpected && state ? state.matches : findMatchingTokens(searchWord, TAB_MATCH_LIMIT);
		return { node, offset, replaceStart, textToRemove, searchWord, matches, atExpected };
	}

	function applyMatch(ev, input, ctx, backwards) {
		const { node, replaceStart, textToRemove, matches, atExpected } = ctx;
		if (!matches.length) {
			reset();
			return false;
		}
		let index;
		if (!atExpected || !state) {
			index = 0;
		} else {
			index = backwards ? state.index - 1 : state.index + 1;
			index = ((index % matches.length) + matches.length) % matches.length;
		}
		const match = matches[index];
		if (!match) {
			reset();
			return false;
		}

		const replacement = `${match.token} `;
		if (!YTSE.guard.allows(replacement.length - textToRemove.length, input)) {
			if (ev) consume(ev);
			return true;
		}
		applying = true;
		try {
			replaceText(input, node, replaceStart, textToRemove.length, replacement);
		} catch (e) {
			YTSE.warn("Tab completion failed", e);
			applying = false;
			reset();
			return false;
		}
		applying = false;
		inputObserver?.takeRecords();

		if (ev) consume(ev);

		const caret = getCaret(input);
		let expectedNode = caret?.node ?? null;
		let expectedOffset = caret?.offset ?? replaceStart + replacement.length;
		let expectedWord = replacement;
		if (expectedNode) {
			const live = expectedNode.data.slice(expectedOffset - replacement.length, expectedOffset);
			if (norm(live) !== replacement) expectedNode = null;
			else expectedWord = live;
		}

		state = {
			index,
			matches,
			currentMatch: match,
			backwardsMatches: around(matches, index, "backward"),
			forwardsMatches: around(matches, index, "forward"),
			expectedNode,
			expectedOffset,
			expectedWord,
		};
		renderCarousel();
		return true;
	}

	function consume(ev) {
		ev.preventDefault();
		ev.stopPropagation();
		ev.stopImmediatePropagation();
	}

	function reset() {
		state = null;
		renderCarousel();
	}

	function handleTab(ev) {
		if (ev.isComposing || ev.key !== "Tab") return false;
		if (!settings.tabCompletion) return false;
		if (ev.ctrlKey || ev.altKey || ev.metaKey) return false;
		const input = activeInput();
		if (!input) return false;
		watchInput(input);
		const ctx = getContext(input);
		if (!ctx) {
			consume(ev);
			reset();
			return true;
		}
		if (ctx.searchWord.startsWith(":")) return false;
		if (ctx.matches.length === 0) {
			consume(ev);
			reset();
			return true;
		}
		return applyMatch(ev, input, ctx, ev.shiftKey);
	}

	function cycle(backwards) {
		const input = activeInput();
		if (!input) return false;
		const ctx = getContext(input);
		if (!ctx) return false;
		return applyMatch(null, input, ctx, backwards);
	}

	function onKeyDown(ev) {
		if (ev.isComposing) return;
		if (ev.key === "Tab") {
			handleTab(ev);
			return;
		}
		if (ev.key === "Escape" && state) {
			if (activeInput()) {
				reset();
				ev.preventDefault();
			}
			return;
		}
		if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && carouselVisible() && settings.carouselArrowKeys) {
			if (!activeInput()) return;
			if (ev.key === "ArrowLeft") cycle(true);
			else cycle(false);
			ev.preventDefault();
			ev.stopPropagation();
			return;
		}
		if (ev.key === "Enter" && state) {
			life.after(reset, 0);
		}
	}

	function watchInput(input) {
		if (observedInput === input) return;
		inputObserver?.disconnect();
		observedInput = input;
		inputObserver = new MutationObserver(
			life.guard(() => {
				if (!applying && state) reset();
			}),
		);
		inputObserver.observe(input, { childList: true, characterData: true, subtree: true });
	}

	function onInput(ev) {
		if (applying) return;
		if (!(ev.target instanceof Element) || !findInput(ev.target)) return;
		if (state) reset();
	}

	function onFocusOut() {
		requestAnimationFrame(
			life.guard(() => {
				if (state && !activeInput()) reset();
			}),
		);
	}

	let floaterHost = null;
	let floater = null;
	let rafId = null;

	const FLOATER_CSS = `
		:host { all: initial; }
		.floater {
			position: fixed; z-index: 100000; pointer-events: none;
			transform: translate(-50%, -100%);
			direction: ltr;
		}
		.grid {
			display: grid; grid-template-columns: repeat(3, auto);
			border-radius: 8px; overflow: hidden;
			background: var(--ytse-menu); box-shadow: var(--ytse-shadow);
			outline: 1px solid var(--ytse-outline);
		}
		.list {
			display: flex; align-items: center; column-gap: 6px;
			min-height: 48px; padding: 8px 10px;
		}
		.list[data-direction="current"] { background: var(--ytse-chip-hover); }
		.list[data-direction="forwards"] { justify-content: flex-end; }
		.caret { display: inline-flex; align-items: center; color: var(--ytse-text-2); }
		.caret svg { width: 12px; height: 12px; }
		.list[data-direction="backwards"] .caret { margin-left: -4px; }
		.list[data-direction="forwards"] .caret { margin-right: -4px; }
		img { object-fit: contain; max-width: 30px; max-height: 30px; }
		.list[data-direction="current"] img { max-width: 32px; max-height: 32px; }
	`;

	function carouselVisible() {
		return !!(settings.tabCompletion && settings.carousel && state && state.currentMatch && state.currentMatch.item);
	}

	function ensureFloater() {
		if (floaterHost) return;
		floaterHost = h("div", { id: "ytse-carousel-host", [YTSE.OWNED]: "" });
		const shadow = floaterHost.attachShadow({ mode: "open" });
		const style = ui.style(ui.PALETTE, FLOATER_CSS);
		floater = ui.bindTheme(h("div", { class: "floater", hidden: true, "data-fixed-dir": "" }));
		shadow.append(style, floater);
		document.body.append(floaterHost);
	}

	function emoteImg(tok) {
		if (!tok.item) return null;
		return h("img", { srcset: tok.item.srcset, src: tok.item.src, alt: tok.token, width: "32", height: "32" });
	}

	function renderCarousel() {
		if (!carouselVisible()) {
			if (floater) floater.hidden = true;
			if (rafId) cancelAnimationFrame(rafId);
			rafId = null;
			return;
		}
		ensureFloater();
		const grid = h("div", { class: "grid" });
		if (state.backwardsMatches.length > 0) {
			grid.append(
				h(
					"div",
					{ class: "list", "data-direction": "backwards" },
					h("span", { class: "caret" }, YTSE.svg(YTSE.icons.caretLeft)),
					state.backwardsMatches.map(emoteImg),
				),
			);
		}
		grid.append(h("div", { class: "list", "data-direction": "current" }, emoteImg(state.currentMatch)));
		if (state.forwardsMatches.length > 0) {
			grid.append(
				h(
					"div",
					{ class: "list", "data-direction": "forwards" },
					state.forwardsMatches.map(emoteImg),
					h("span", { class: "caret" }, YTSE.svg(YTSE.icons.caretRight)),
				),
			);
		}
		floater.replaceChildren(grid);
		floater.hidden = false;
		if (!rafId) positionLoop();
	}

	function anchorRect() {
		const selectors = ["yt-live-chat-message-input-renderer", "#input-panel", "yt-live-chat-text-input-field-renderer"];
		for (const s of selectors) {
			const el = document.querySelector(s);
			if (el) {
				const r = el.getBoundingClientRect();
				if (r.width > 0 && r.height > 0) return r;
			}
		}
		return observedInput?.getBoundingClientRect() ?? null;
	}

	function positionLoop() {
		if (!life.alive) return;
		rafId = requestAnimationFrame(positionLoop);
		if (!floater || floater.hidden) return;
		const r = anchorRect();
		if (!r) return;
		const w = floater.offsetWidth;
		let x = r.left + r.width / 2;
		if (w < window.innerWidth - 8) x = Math.max(w / 2 + 4, Math.min(window.innerWidth - w / 2 - 4, x));
		floater.style.left = `${x}px`;
		floater.style.top = `${Math.max(8, r.top - 8)}px`;
	}

	function init(opts) {
		getChatters = opts.getChatters || getChatters;
		getBroadcaster = opts.getBroadcaster || getBroadcaster;
		life.on(window, "keydown", onKeyDown, { capture: true });
		life.on(document, "input", onInput, true);
		life.on(document, "focusout", onFocusOut, true);
		life.add(() => {
			inputObserver?.disconnect();
			if (rafId) cancelAnimationFrame(rafId);
			rafId = null;
			floaterHost?.remove();
		});
	}

	function setEmotes(map) {
		emotes = map || new Map();
		reset();
	}

	function setSettings(s) {
		settings = s;
		renderCarousel();
	}

	function carouselRect() {
		return floater && !floater.hidden ? floater.getBoundingClientRect() : null;
	}

	YTSE.tab = { init, setEmotes, setSettings, findMatchingTokens, getSearchRange, around, carouselRect };
})();
