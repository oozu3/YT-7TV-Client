(() => {
	const { h, ui, i18n, life } = YTSE;

	const openDialogs = new Set();
	life.add(() => {
		for (const close of [...openDialogs]) close();
	});

	const CSS = `
		:host { all: initial; }
		.backdrop {
			position: fixed; inset: 0; z-index: 100002;
			display: flex; align-items: center; justify-content: center; padding: 12px;
			background: var(--ytse-scrim);
		}
		.card {
			display: flex; flex-direction: column;
			width: 100%; max-width: 380px; max-height: calc(100vh - 24px);
			background: var(--ytse-menu); color: var(--ytse-text);
			border-radius: 12px; box-shadow: var(--ytse-shadow); overflow: hidden;
		}
		.head { display: flex; align-items: center; gap: 10px; min-height: 52px; padding-block: 6px; padding-inline: 16px 6px; }
		.logo { display: inline-flex; flex: 0 0 auto; color: var(--ytse-text); }
		.logo svg { width: 26px; height: 19px; }
		.title { flex: 1; min-width: 0; font-size: 16px; line-height: 22px; font-weight: 500; }
		.body { padding: 4px 16px 16px; overflow-y: auto; scrollbar-width: thin; }
		a { color: var(--ytse-accent); text-decoration: none; }
		a:hover { text-decoration: underline; }
	`;

	function open({ id, title, css = "", closable = true, onEscape, onClose }) {
		const host = h("div", { id, class: "ytse-host", [YTSE.OWNED]: "" });
		const shadow = host.attachShadow({ mode: "open" });
		const titleEl = h("div", { class: "title", id: "ytse-dialog-title", text: title });
		const closeBtn = closable
			? h("button", { class: "icon-btn", type: "button", "aria-label": i18n.t("close"), title: i18n.t("close") }, YTSE.svg(YTSE.icons.close, "24"))
			: null;
		const body = h("div", { class: "body" });
		const card = h(
			"div",
			{ class: "card", role: "dialog", "aria-modal": "true", "aria-labelledby": "ytse-dialog-title" },
			h("div", { class: "head" }, h("span", { class: "logo" }, YTSE.svg(YTSE.icons.logo7tv, "26")), titleEl, closeBtn),
			body,
		);
		const backdrop = ui.bindTheme(h("div", { class: "backdrop" }, card));
		shadow.append(ui.style(ui.PALETTE, ui.BASE, CSS, css), backdrop);
		document.body.append(host);

		let closed = false;
		function close() {
			if (closed) return;
			closed = true;
			openDialogs.delete(close);
			host.remove();
			onClose?.();
		}
		openDialogs.add(close);

		for (const type of ["keydown", "keyup", "keypress"]) {
			card.addEventListener(type, (ev) => {
				ev.stopPropagation();
				if (type !== "keydown" || ev.key !== "Escape") return;
				ev.preventDefault();
				if (onEscape) onEscape();
				else if (closable) close();
			});
		}
		closeBtn?.addEventListener("click", close);
		backdrop.addEventListener("mousedown", (ev) => {
			if (closable && ev.target === backdrop) close();
		});

		return { host, shadow, card, body, titleEl, close, isOpen: () => !closed };
	}

	YTSE.modal = { open };
})();
