(() => {
	const { h, storage, seventv, i18n } = YTSE;
	const t = (key, vars) => i18n.t(key, vars);

	const lastMsgs = new Map();

	function setMsg(el, text, kind = "") {
		const key = el.dataset.key;
		const targets = new Set([el]);
		if (key) {
			lastMsgs.set(key, { text, kind });
			for (const m of el.getRootNode().querySelectorAll?.(".msg") ?? []) if (m.dataset.key === key) targets.add(m);
		}
		for (const target of targets) {
			target.textContent = text;
			target.className = "msg" + (kind ? " " + kind : "");
		}
	}

	async function verifyAndSave(yt, rawUrl, msgEl, buttons) {
		const parsed = storage.parseTwitchUrl(rawUrl);
		if (!parsed.ok) {
			setMsg(msgEl, t("err" + parsed.code), "err");
			return null;
		}
		buttons.forEach((b) => (b.disabled = true));
		setMsg(msgEl, t("verifying"));
		try {
			const res = await seventv.fetchTwitchChannel(parsed.login);
			await storage.saveChannel(yt, storage.mappingFromResult(res));
			setMsg(msgEl, t("savedOk", { set: res.set.name, count: i18n.num(res.set.emotes.length) }), "ok");
			return res;
		} catch (e) {
			setMsg(msgEl, seventv.errorMessage(e), "err");
			return null;
		} finally {
			buttons.forEach((b) => (b.disabled = false));
		}
	}

	function statusLine(s) {
		switch (s.status) {
			case "ready": {
				let text = t("stChannel", { count: i18n.num(s.channelEmotes) });
				if (s.setName) text += ` · ${t("stSet", { set: s.setName })}`;
				if (s.globalEmotes) text += ` · ${t("stGlobal", { count: i18n.num(s.globalEmotes) })}`;
				if (s.stale) text += ` · ${t("stCached")}`;
				return s.live ? [h("span", { class: "dot on" }), `${t("stLive")} · ${text}`] : [h("span", { class: "dot" }), text];
			}
			case "loading":
				return [t("stLoading")];
			case "starting":
			case "resolving":
				return [t("stResolving")];
			case "unmapped":
				return [t("stUnmapped")];
			case "skipped":
				return [t("stSkipped")];
			case "no-video":
				return [t("stNoVideo")];
			case "error":
				return [s.error || t("stError")];
			default:
				return [String(s.status || "")];
		}
	}

	function urlField() {
		return h("input", {
			class: "field",
			type: "text",
			dir: "ltr",
			placeholder: t("urlPlaceholder"),
			spellcheck: "false",
			autocomplete: "off",
		});
	}

	function createCurrent({ onReload, emptyText } = {}) {
		const root = h("div", { class: "current" });
		let shownKey = null;
		let parts = null;

		function build(s) {
			const yt = s.channel;
			const input = urlField();
			const msg = h("div", { class: "msg" });
			msg.dataset.key = storage.channelKey(yt);
			const save = h("button", { class: "btn primary", type: "button", text: t("save") });
			const reload = h("button", { class: "btn", type: "button", text: t("reloadEmotes") });
			const stat = h("div", { class: "stat" });
			parts = { input, msg, save, reload, stat, dirty: false };

			input.addEventListener("input", () => (parts.dirty = true));
			input.addEventListener("keydown", (ev) => {
				if (ev.key === "Enter") save.click();
			});
			save.addEventListener("click", async () => {
				const res = await verifyAndSave(yt, input.value, msg, [save, reload]);
				if (res) parts.dirty = false;
			});
			reload.addEventListener("click", async () => {
				if (!onReload) return;
				reload.disabled = true;
				setMsg(msg, t("reloading"));
				try {
					const next = await onReload();
					setMsg(msg, "");
					update(next);
				} catch {
					setMsg(msg, t("cantReachChat"), "err");
				} finally {
					reload.disabled = false;
				}
			});

			const last = lastMsgs.get(msg.dataset.key);
			if (last) setMsg(msg, last.text, last.kind);

			const name = h("div", { class: "channel-name" }, h("bdi", { text: yt.name || yt.handle }));
			if (yt.handle && yt.handle !== yt.name) name.append(h("bdi", { class: "handle", dir: "ltr", text: yt.handle }));
			root.replaceChildren(name, stat, input, h("div", { class: "actions" }, save, onReload ? reload : null), msg);
		}

		function update(s) {
			if (!s || !s.ok) {
				shownKey = null;
				parts = null;
				root.replaceChildren(h("div", { class: "muted", text: emptyText || t("openLive") }));
				return;
			}
			if (!s.channel) {
				shownKey = null;
				parts = null;
				root.replaceChildren(h("div", { class: "stat" }, ...statusLine(s)));
				return;
			}
			const key = storage.channelKey(s.channel);
			if (key !== shownKey || !parts) {
				build(s);
				shownKey = key;
			}
			parts.stat.replaceChildren(...statusLine(s));
			parts.reload.hidden = !(s.mapping && !s.mapping.skipped);
			const focused = root.getRootNode().activeElement === parts.input;
			if (!focused && !parts.dirty) parts.input.value = s.mapping?.twitchUrl || "";
		}

		return { el: root, update };
	}

	function channelsList(list) {
		if (!list.length) return h("div", { class: "muted", text: t("noChannels") });
		return h(
			"div",
			{ class: "channels" },
			list.map((c) => {
				const yt = { id: c.ytChannelId, handle: c.ytHandle, name: c.ytName };
				const input = urlField();
				input.value = c.twitchUrl || "";
				const msg = h("div", { class: "msg" });
				msg.dataset.key = c.key;
				const last = lastMsgs.get(c.key);
				if (last) setMsg(msg, last.text, last.kind);
				const save = h("button", { class: "btn small primary", type: "button", text: t("save") });
				const remove = h("button", { class: "btn small danger", type: "button", text: t("remove") });
				const actions = h("div", { class: "actions" }, save, remove);
				const label = c.ytName || c.ytHandle || c.ytChannelId;

				save.addEventListener("click", () => verifyAndSave(yt, input.value, msg, [save, remove]));
				input.addEventListener("keydown", (ev) => {
					if (ev.key === "Enter") save.click();
				});
				remove.addEventListener("click", () => {
					const yes = h("button", { class: "btn small danger", type: "button", text: t("remove") });
					const no = h("button", { class: "btn small", type: "button", text: t("cancel") });
					const ask = h("div", { class: "confirm" }, h("div", { class: "muted", text: t("removeConfirm", { name: label }) }), h("div", { class: "actions" }, no, yes));
					actions.replaceWith(ask);
					no.addEventListener("click", () => ask.replaceWith(actions));
					yes.addEventListener("click", () => storage.removeChannel(c.key));
				});

				return h(
					"div",
					{ class: "channel" },
					h(
						"div",
						{ class: "channel-head" },
						h("bdi", { class: "channel-title", text: label }),
						c.skipped ? h("span", { class: "tag", text: t("disabledTag") }) : h("bdi", { class: "muted small", dir: "ltr", text: c.ytHandle || "" }),
					),
					input,
					actions,
					msg,
				);
			}),
		);
	}

	const DEFS = [
		{ key: "language", type: "language" },
		{ key: "emoteMenu" },
		{ key: "tabCompletion" },
		{ key: "tabMode", options: [["modeStarts", 0], ["modeContains", 1]], disabledIf: (s) => !s.tabCompletion },
		{ key: "carousel", disabledIf: (s) => !s.tabCompletion },
		{ key: "carouselArrowKeys", disabledIf: (s) => !s.tabCompletion || !s.carousel },
		{ key: "chatters" },
		{ key: "globalEmotes" },
		{ key: "tooltips" },
		{ key: "liveUpdates" },
		{ key: "allMessages" },
		{ key: "sendGuard" },
		{ key: "askNewChannels" },
	];

	function settingsList(s) {
		const rows = DEFS.map((def) => {
			const disabled = def.disabledIf?.(s) ?? false;
			let control;
			let label = t("set_" + def.key);
			let hint = t("hint_" + def.key);
			if (def.type === "language") {
				label = t("language");
				hint = t("languageHint");
				const options = [["auto", t("langAuto", { lang: i18n.nameOf(i18n.detect()) })], ...i18n.LANGS];
				control = h(
					"select",
					{ class: "field", "aria-label": label },
					options.map(([value, text]) => h("option", { value, selected: s.language === value, text })),
				);
				control.addEventListener("change", () => storage.setSettings({ language: control.value }));
			} else if (def.options) {
				control = h(
					"select",
					{ class: "field", disabled, "aria-label": label },
					def.options.map(([key, value]) => h("option", { value: String(value), selected: s[def.key] === value, text: t(key) })),
				);
				control.addEventListener("change", () => storage.setSettings({ [def.key]: Number(control.value) }));
			} else {
				const cb = h("input", { type: "checkbox", checked: !!s[def.key], disabled, "aria-label": label });
				cb.addEventListener("change", () => storage.setSettings({ [def.key]: cb.checked }));
				control = h("label", { class: "switch" }, cb, h("span", { class: "bar" }), h("span", { class: "knob" }));
			}
			return h(
				"div",
				{ class: "setting" + (disabled ? " disabled" : "") },
				h("div", null, h("div", { class: "label", text: label }), h("div", { class: "hint", text: hint })),
				control,
			);
		});
		return h("div", { class: "settings" }, rows);
	}

	function footer() {
		const link = h("a", { href: "https://7tv.app", target: "_blank", rel: "noreferrer", text: "7TV" });
		return h("div", { class: "foot muted" }, i18n.rich("footer", { link }));
	}

	YTSE.settingsUI = { setMsg, verifyAndSave, statusLine, createCurrent, channelsList, settingsList, footer };
})();
