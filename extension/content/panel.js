(() => {
	const { h, storage, i18n, modal, settingsUI } = YTSE;

	const CSS = `
		.card { max-width: 420px; }
		.section { padding: 12px 0 16px; }
		.section + .section { border-top: 1px solid var(--ytse-outline); }
		.section:first-child { padding-top: 4px; }
		.foot { padding-top: 12px; border-top: 1px solid var(--ytse-outline); font-size: 12px; line-height: 16px; text-align: center; }
	`;

	let dlg = null;
	let current = null;
	let settingsWrap = null;
	let unsubscribe = null;

	function open() {
		if (dlg) return;
		const d = modal.open({
			id: "ytse-panel-host",
			title: i18n.t("settings"),
			css: CSS,
			onClose: () => {
				if (dlg !== d) return;
				dlg = null;
				current = null;
				settingsWrap = null;
				unsubscribe?.();
				unsubscribe = null;
			},
		});
		dlg = d;
		current = settingsUI.createCurrent({ onReload: () => YTSE.app.reload() });
		settingsWrap = h("div");
		d.body.append(
			h("section", { class: "section" }, h("h2", { class: "section-title", text: i18n.t("thisChannel") }), current.el),
			h("section", { class: "section" }, h("h2", { class: "section-title", text: i18n.t("settings") }), settingsWrap),
			settingsUI.footer(),
		);
		current.update(YTSE.app.getState());
		unsubscribe = YTSE.app.onChange(() => current?.update(YTSE.app.getState()));
		storage.getSettings().then(setSettings);
	}

	function close() {
		dlg?.close();
	}

	function setSettings(s) {
		if (!settingsWrap) return;
		const scroller = dlg?.body;
		const top = scroller?.scrollTop ?? 0;
		settingsWrap.replaceChildren(settingsUI.settingsList(s));
		if (scroller) scroller.scrollTop = top;
	}

	function relabel() {
		if (!dlg) return;
		const top = dlg.body.scrollTop;
		close();
		open();
		if (dlg) dlg.body.scrollTop = top;
	}

	YTSE.panel = { open, close, setSettings, relabel, isOpen: () => !!dlg };
})();
