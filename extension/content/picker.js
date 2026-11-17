(() => {
	const { h, ui, i18n, life } = YTSE;

	const PICKER = "yt-emoji-picker-renderer";
	const EMOJI_BUTTON = "#emoji-picker-button, yt-live-chat-icon-toggle-button-renderer#emoji";
	const HIDDEN_PARTS = ["#search-panel", "#categories-wrapper"];

	const PANEL_CSS = `
		:host { all: initial; }
		.panel { display: flex; flex-direction: column; height: 100%; color: var(--ytse-text); }
		.top { display: flex; align-items: center; gap: 4px; padding-block: 4px; padding-inline: 12px 4px; }
		.search {
			flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; height: 32px;
			border-bottom: 1px solid var(--ytse-outline); color: var(--ytse-text-2);
		}
		.search:focus-within { border-bottom: 2px solid var(--ytse-accent); }
		.search svg { flex: 0 0 auto; width: 20px; height: 20px; }
		.search input {
			flex: 1; min-width: 0; height: 100%; padding: 0; border: 0; outline: none; background: transparent;
			color: var(--ytse-text); font-family: var(--ytse-font); font-size: 14px;
		}
		.search input::placeholder { color: var(--ytse-text-2); }
		.top .icon-btn { width: 36px; height: 36px; color: var(--ytse-text-2); }
		.top .icon-btn:hover { color: var(--ytse-text); }
		.top .icon-btn svg { width: 20px; height: 20px; }
		.scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; scrollbar-width: thin; }
		.section-head {
			position: sticky; top: 0; z-index: 1; padding: 8px 4px 4px;
			background: var(--ytse-panel-bg, var(--ytse-menu));
			font-size: 12px; line-height: 16px; font-weight: 500; color: var(--ytse-text-2);
			white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
		}
		.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(40px, 1fr)); gap: 2px; }
		.emote {
			display: flex; align-items: center; justify-content: center; height: 40px; padding: 2px;
			border: 0; border-radius: 4px; background: transparent; cursor: pointer;
		}
		.emote:hover, .emote:focus-visible { background: var(--ytse-chip-hover); outline: none; }
		.emote img { max-width: 100%; max-height: 32px; object-fit: contain; pointer-events: none; }
		.empty {
			display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
			height: 100%; padding: 16px; text-align: center; font-size: 13px; line-height: 18px; color: var(--ytse-text-2);
		}
	`;

	let settings = {};
	let opts = {};
	let data = { channel: null, global: [] };
	const pickers = new Map();
	const gears = new Map();
	const listened = new WeakSet();

	function backgroundOf(el) {
		for (let n = el; n && n.nodeType === Node.ELEMENT_NODE; n = n.parentElement) {
			const bg = getComputedStyle(n).backgroundColor;
			if (bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg)) return bg;
		}
		return "";
	}

	function makeTab(picker) {
		const label = i18n.t("menuTab");
		const tab = h(
			"button",
			{ class: "ytse-picker-tab", type: "button", "aria-label": label, title: label, "aria-pressed": "false", [YTSE.OWNED]: "" },
			YTSE.svg(YTSE.icons.logo7tv, "16"),
		);
		tab.addEventListener("mousedown", (ev) => ev.preventDefault());
		tab.addEventListener("click", (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			activate(picker);
		});
		return tab;
	}

	function makeGear() {
		const label = i18n.t("menuSettingsTab");
		const gear = h(
			"button",
			{ class: "ytse-picker-tab ytse-picker-gear", type: "button", "aria-label": label, title: label, [YTSE.OWNED]: "" },
			YTSE.svg(YTSE.icons.settings, "18"),
		);
		gear.addEventListener("mousedown", (ev) => ev.preventDefault());
		gear.addEventListener("click", (ev) => {
			ev.preventDefault();
			ev.stopPropagation();
			opts.openSettings?.();
		});
		return gear;
	}

	function attachGear(picker) {
		const buttons = picker.querySelector("#category-buttons");
		if (!buttons) return;
		let gear = gears.get(picker);
		if (!gear) {
			gear = makeGear();
			gears.set(picker, gear);
		}
		if (buttons.lastElementChild !== gear) buttons.append(gear);
	}

	function detachGear(picker) {
		gears.get(picker)?.remove();
		gears.delete(picker);
	}

	function attach(picker) {
		const buttons = picker.querySelector("#category-buttons");
		if (!buttons) return null;
		let p = pickers.get(picker);
		if (!p) {
			const host = h("div", { class: "ytse-emote-menu-host", [YTSE.OWNED]: "" });
			const shadow = host.attachShadow({ mode: "open" });
			const panel = ui.bindTheme(h("div", { class: "panel" }));
			shadow.append(ui.style(ui.PALETTE, ui.BASE, PANEL_CSS), panel);
			for (const type of ["keydown", "keyup", "keypress"]) {
				panel.addEventListener(type, (ev) => {
					if (ev.key !== "Escape") ev.stopPropagation();
				});
			}
			panel.addEventListener("mousedown", (ev) => {
				if (!(ev.target instanceof HTMLInputElement)) ev.preventDefault();
			});
			p = { picker, host, panel, tab: makeTab(picker), dirty: true, query: "", height: 0, search: null, list: null, io: null };
			pickers.set(picker, p);
			if (!listened.has(picker)) {
				listened.add(picker);
				life.on(
					picker,
					"click",
					(ev) => {
						const target = ev.target instanceof Element ? ev.target : null;
						if (target?.closest("#category-buttons") && !target.closest(".ytse-picker-tab")) deactivate(picker);
					},
					true,
				);
			}
		}
		if (buttons.firstElementChild !== p.tab) buttons.prepend(p.tab);
		if (p.host.previousElementSibling !== buttons) buttons.after(p.host);
		return p;
	}

	function detach(picker) {
		const p = pickers.get(picker);
		if (!p) return;
		deactivate(picker);
		p.io?.disconnect();
		p.tab.remove();
		p.host.remove();
		pickers.delete(picker);
	}

	function measure(p) {
		if (p.height) return p.height;
		const total = HIDDEN_PARTS.reduce((sum, s) => sum + (p.picker.querySelector(s)?.offsetHeight || 0), 0);
		if (total > 0) p.height = Math.max(180, total);
		return p.height || 260;
	}

	function activate(picker) {
		const p = attach(picker);
		if (!p) return;
		const height = measure(p);
		p.host.style.height = `${height}px`;
		const bg = backgroundOf(picker);
		if (bg) p.panel.style.setProperty("--ytse-panel-bg", bg);
		picker.classList.add("ytse-7tv-on");
		p.tab.classList.add("active");
		p.tab.setAttribute("aria-pressed", "true");
		if (p.dirty) render(p);
	}

	function deactivate(picker) {
		picker.classList.remove("ytse-7tv-on");
		const p = pickers.get(picker);
		if (!p) return;
		p.tab.classList.remove("active");
		p.tab.setAttribute("aria-pressed", "false");
	}

	function isActive(p) {
		return p.picker.classList.contains("ytse-7tv-on");
	}

	function sections(query) {
		const q = query.trim().toLowerCase();
		const out = [];
		if (data.channel?.emotes.length) {
			const title = [data.channel.setName, data.channel.owner].filter(Boolean).join(" · ");
			out.push({ title, emotes: data.channel.emotes });
		}
		if (data.global.length) out.push({ title: i18n.t("menuGlobal"), emotes: data.global });
		return out
			.map((s) => ({ ...s, emotes: q ? s.emotes.filter((e) => e.name.toLowerCase().includes(q)) : s.emotes }))
			.filter((s) => s.emotes.length);
	}

	const EAGER_COUNT = 120;

	function emoteButton(e, p, eager) {
		const img = h("img", { alt: e.name, decoding: "async", draggable: "false" });
		if (eager) {
			img.srcset = e.srcset;
			img.src = e.src;
		} else {
			img.dataset.src = e.src;
			img.dataset.srcset = e.srcset;
			p.io?.observe(img);
		}
		const btn = h("button", { class: "emote", type: "button", title: e.name, "aria-label": e.name }, img);
		btn.addEventListener("click", () => opts.insert?.(e.name));
		btn.addEventListener("mouseenter", () => {
			if (p.search) p.search.placeholder = e.name;
		});
		return btn;
	}

	function renderList(p) {
		if (!p.list) return;
		const list = sections(p.query);
		if (!list.length) {
			p.list.replaceChildren(h("div", { class: "empty", text: i18n.t("menuNoResults") }));
			return;
		}
		p.io?.disconnect();
		p.io = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const img = entry.target;
					p.io.unobserve(img);
					img.srcset = img.dataset.srcset;
					img.src = img.dataset.src;
				}
			},
			{ root: p.list, rootMargin: "200px 0px" },
		);
		const frag = document.createDocumentFragment();
		let n = 0;
		for (const s of list) {
			frag.append(h("div", { class: "section-head", text: s.title }), h("div", { class: "grid" }, s.emotes.map((e) => emoteButton(e, p, n++ < EAGER_COUNT))));
		}
		p.list.replaceChildren(frag);
		p.list.scrollTop = 0;
	}

	function emptyState() {
		const st = opts.getState?.() || {};
		switch (st.status) {
			case "ready":
				return null;
			case "unmapped":
				return { text: i18n.t("stUnmapped"), action: true };
			case "skipped":
				return { text: i18n.t("stSkipped"), action: true };
			case "error":
				return { text: st.error || i18n.t("stError"), action: !!st.channel };
			case "loading":
				return { text: i18n.t("stLoading") };
			default:
				return { text: i18n.t("stResolving") };
		}
	}

	function render(p) {
		p.dirty = false;
		const settingsBtn = h(
			"button",
			{ class: "icon-btn", type: "button", "aria-label": i18n.t("settings"), title: i18n.t("settings") },
			YTSE.svg(YTSE.icons.settings, "20"),
		);
		settingsBtn.addEventListener("click", () => opts.openSettings?.());

		const empty = emptyState() || (!data.channel?.emotes.length && !data.global.length ? { text: i18n.t("menuNoResults") } : null);
		const search = h("input", { type: "text", placeholder: i18n.t("menuSearch"), "aria-label": i18n.t("menuSearch"), spellcheck: "false", autocomplete: "off" });
		search.value = p.query;
		search.disabled = !!empty;
		const list = h("div", { class: "scroll" });
		p.search = search;
		p.list = list;

		search.addEventListener("input", () => {
			p.query = search.value;
			renderList(p);
		});
		search.addEventListener("keydown", (ev) => {
			if (ev.key !== "Enter") return;
			ev.preventDefault();
			const first = sections(p.query)[0]?.emotes[0];
			if (first) opts.insert?.(first.name);
		});
		list.addEventListener("mouseleave", () => (search.placeholder = i18n.t("menuSearch")));

		p.panel.replaceChildren(
			h("div", { class: "top" }, h("label", { class: "search" }, YTSE.svg(YTSE.icons.search, "20"), search), settingsBtn),
			list,
		);

		if (empty) {
			const box = h("div", { class: "empty" }, h("div", { text: empty.text }));
			if (empty.action) {
				const choose = h("button", { class: "btn small primary", type: "button", text: i18n.t("menuChoose") });
				choose.addEventListener("click", () => opts.openPrompt?.());
				box.append(choose);
			}
			list.replaceChildren(box);
			return;
		}
		renderList(p);
	}

	function refresh() {
		for (const p of pickers.values()) {
			p.dirty = true;
			if (isActive(p)) render(p);
		}
	}

	function visiblePicker() {
		for (const picker of document.querySelectorAll(PICKER)) {
			if (picker.getClientRects().length) return picker;
		}
		return null;
	}

	function onDocumentClick(ev) {
		if (!settings.emoteMenu) return;
		if (!(ev.target instanceof Element) || !ev.target.closest(EMOJI_BUTTON)) return;
		const until = Date.now() + 2000;
		const step = () => {
			const picker = visiblePicker();
			if (picker) activate(picker);
			else if (Date.now() < until) life.after(step, 40);
		};
		life.after(step, 0);
	}

	function maintain() {
		for (const picker of [...pickers.keys()]) if (!picker.isConnected) pickers.delete(picker);
		for (const picker of [...gears.keys()]) if (!picker.isConnected) gears.delete(picker);
		const all = document.querySelectorAll(PICKER);
		for (const picker of all) {
			if (settings.emoteMenu) {
				detachGear(picker);
				attach(picker);
			} else {
				detach(picker);
				attachGear(picker);
			}
		}
	}

	function onDocumentClickBubble(ev) {
		if (!settings.emoteMenu) return;
		if (!(ev.target instanceof Element) || !ev.target.closest(EMOJI_BUTTON)) return;
		const picker = visiblePicker();
		if (picker) activate(picker);
	}

	function init(o) {
		opts = o;
		life.on(document, "click", onDocumentClick, true);
		life.on(document, "click", onDocumentClickBubble);
		life.every(maintain, 1500);
		life.add(() => {
			for (const picker of [...pickers.keys()]) detach(picker);
			for (const picker of [...gears.keys()]) detachGear(picker);
		});
		maintain();
	}

	function setSettings(s) {
		settings = s;
		maintain();
	}

	function setEmotes(next) {
		data = next;
		refresh();
	}

	function relabel() {
		for (const p of pickers.values()) {
			const label = i18n.t("menuTab");
			p.tab.title = label;
			p.tab.setAttribute("aria-label", label);
		}
		for (const gear of gears.values()) {
			const label = i18n.t("menuSettingsTab");
			gear.title = label;
			gear.setAttribute("aria-label", label);
		}
		refresh();
	}

	YTSE.picker = { init, setSettings, setEmotes, refresh, relabel, activate, deactivate };
})();
