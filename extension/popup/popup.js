(async () => {
	const { api, h, storage, i18n, ui, settingsUI } = YTSE;
	const t = (key, vars) => i18n.t(key, vars);
	const isOptions = document.body.dataset.view === "options";
	const app = document.getElementById("app");
	const darkQuery = matchMedia("(prefers-color-scheme: dark)");

	document.head.append(ui.style(ui.PALETTE, ui.BASE));

	await storage.migrate().catch((e) => YTSE.warn("Storage migration failed", e));
	let settings = await storage.getSettings();
	let storedTheme = await storage.getTheme();
	let tabId = null;
	let state = null;
	let current = null;
	let channelsWrap = null;
	let settingsWrap = null;
	let permBanner = null;

	i18n.setLang(settings.language);
	ui.bindTheme(document.documentElement);
	applyTheme();

	function applyTheme() {
		if (typeof state?.dark === "boolean") ui.setDark(state.dark);
		else if (storedTheme) ui.setDark(storedTheme === "dark");
		else ui.setDark(darkQuery.matches);
	}

	async function sendToTab(msg) {
		if (tabId == null) throw new Error("no tab");
		return api.tabs.sendMessage(tabId, msg);
	}

	async function reload() {
		state = await sendToTab({ type: "ytse:reload" });
		return state;
	}

	async function loadCurrent() {
		if (isOptions || !current) return;
		try {
			const [tab] = await api.tabs.query({ active: true, currentWindow: true });
			tabId = tab?.id ?? null;
			state = await sendToTab({ type: "ytse:getState" });
		} catch {
			state = null;
		}
		applyTheme();
		current.update(state);
	}

	async function renderChannels() {
		if (!channelsWrap) return;
		channelsWrap.replaceChildren(settingsUI.channelsList(await storage.getAllChannels()));
	}

	function renderSettings() {
		settingsWrap?.replaceChildren(settingsUI.settingsList(settings));
	}

	async function checkPermissions() {
		const origins = api.runtime.getManifest().host_permissions || [];
		try {
			permBanner.hidden = await api.permissions.contains({ origins });
		} catch {
			permBanner.hidden = true;
		}
	}

	function section(title, body) {
		return h("section", { class: "section" }, h("h2", { class: "section-title", text: title }), body);
	}

	function build() {
		const grant = h("button", { class: "btn primary", type: "button", text: t("permGrant") });
		grant.addEventListener("click", async () => {
			try {
				const origins = api.runtime.getManifest().host_permissions || [];
				if (await api.permissions.request({ origins })) location.reload();
			} catch (e) {
				console.error(e);
			}
		});
		permBanner = h("section", { class: "banner", hidden: true }, h("p", { text: t("permBanner") }), grant);
		current = isOptions ? null : settingsUI.createCurrent({ onReload: reload, emptyText: t("openLive") });
		channelsWrap = h("div");
		settingsWrap = h("div");

		app.replaceChildren(
			h(
				"header",
				{ class: "top" },
				h("div", { class: "brand" }, h("img", { src: "../icons/32.png", alt: "" }), "YT 7TV Client"),
				h("span", { class: "version", text: "v" + api.runtime.getManifest().version }),
			),
			permBanner,
			current ? section(t("currentLive"), current.el) : null,
			section(t("savedChannels"), channelsWrap),
			section(t("settings"), settingsWrap),
			settingsUI.footer(),
		);

		if (current) {
			if (state) current.update(state);
			else current.el.replaceChildren(h("div", { class: "muted", text: t("searchingChat") }));
		}
		checkPermissions();
		renderChannels();
		renderSettings();
	}

	api.storage.onChanged.addListener((changes, area) => {
		if (area !== "local") return;
		if (changes.settings) {
			const next = storage.sanitizeSettings(changes.settings.newValue);
			const languageChanged = next.language !== settings.language;
			settings = next;
			if (languageChanged) {
				i18n.setLang(settings.language);
				ui.refresh();
				build();
			} else {
				renderSettings();
			}
		}
		if (changes[storage.THEME_KEY]) {
			storedTheme = changes[storage.THEME_KEY].newValue || null;
			applyTheme();
		}
		if (Object.keys(changes).some((k) => k.startsWith(storage.CHANNEL_PREFIX))) {
			renderChannels();
			if (!isOptions) setTimeout(loadCurrent, 1200);
		}
	});

	darkQuery.addEventListener("change", applyTheme);

	build();
	loadCurrent();
})();
