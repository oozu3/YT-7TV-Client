(() => {
	const { h, storage, seventv, i18n, modal } = YTSE;
	const t = (key, vars) => i18n.t(key, vars);

	const CSS = `
		.question { margin: 0 0 12px; color: var(--ytse-text-2); }
		.question b { color: var(--ytse-text); font-weight: 500; }
		.suggest {
			display: none; align-items: center; justify-content: space-between; gap: 8px;
			margin-top: 8px; padding-block: 2px; padding-inline: 12px 2px; border-radius: 8px;
			background: var(--ytse-chip); color: var(--ytse-text-2); font-size: 12px; line-height: 16px;
		}
		.suggest.show { display: flex; }
		.suggest b { color: var(--ytse-text); font-weight: 500; }
		.status { min-height: 16px; margin-top: 8px; font-size: 12px; line-height: 16px; color: var(--ytse-text-2); }
		.status.err { color: var(--ytse-error); }
		.status.ok { color: var(--ytse-success); }
		.row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
		.note { margin-top: 12px; font-size: 12px; line-height: 16px; color: var(--ytse-text-3); }
	`;

	let dlg = null;
	let last = null;

	function close() {
		dlg?.close();
		dlg = null;
	}

	function isOpen() {
		return !!dlg;
	}

	function show(yt, opts = {}) {
		close();
		const changing = !!opts.current;
		last = { yt, opts, input: null };
		const d = modal.open({
			id: "ytse-prompt-host",
			title: t("promptTitle"),
			css: CSS,
			closable: false,
			onEscape: () => skip(),
			onClose: () => {
				if (dlg === d) dlg = null;
			},
		});
		dlg = d;

		const channelName = h("bdi", null, h("b", { text: yt.name || yt.handle || "" }));
		const handle = yt.handle && yt.name && yt.handle !== yt.name ? h("bdi", { dir: "ltr", text: ` (${yt.handle})` }) : "";
		const question = h("p", { class: "question" }, i18n.rich(changing ? "promptChange" : "promptFirst", { channel: [channelName, handle] }).flat());
		const input = h("input", { class: "field", type: "text", dir: "ltr", placeholder: t("urlPlaceholder"), spellcheck: "false", autocomplete: "off" });
		input.value = opts.value ?? opts.current ?? "";
		last.input = input;
		const status = h("div", { class: "status", role: "status" });
		const saveBtn = h("button", { class: "btn primary", type: "button", text: t("save") });
		const skipBtn = h("button", { class: "btn", type: "button", text: changing ? t("cancel") : t("notNow") });
		const suggestName = h("b");
		const useSuggest = h("button", { class: "btn small text", type: "button", text: t("use") });
		const suggest = h("div", { class: "suggest" }, h("span", null, i18n.rich("suggest", { login: suggestName })), useSuggest);

		d.body.append(question, input, suggest, status, h("div", { class: "row" }, skipBtn, saveBtn), h("div", { class: "note", text: t("promptFoot") }));

		let busy = false;
		function setStatus(text, kind = "") {
			status.textContent = text;
			status.className = "status" + (kind ? " " + kind : "");
		}

		async function save() {
			if (busy) return;
			const parsed = storage.parseTwitchUrl(input.value);
			if (!parsed.ok) {
				setStatus(t("err" + parsed.code), "err");
				input.focus();
				return;
			}
			busy = true;
			saveBtn.disabled = skipBtn.disabled = input.disabled = true;
			setStatus(t("verifying"));
			try {
				const res = await seventv.fetchTwitchChannel(parsed.login);
				setStatus(t("savedSet", { name: res.twitch.displayName, set: res.set.name, count: i18n.num(res.set.emotes.length) }), "ok");
				await storage.saveChannel(yt, storage.mappingFromResult(res));
				setTimeout(() => {
					if (dlg === d) close();
				}, 900);
			} catch (e) {
				setStatus(seventv.errorMessage(e), "err");
				busy = false;
				saveBtn.disabled = skipBtn.disabled = input.disabled = false;
				input.focus();
			}
		}

		async function skip() {
			if (busy) return;
			if (!changing) await storage.saveChannel(yt, { skipped: true, twitchLogin: null, twitchUrl: null });
			if (dlg === d) close();
		}

		input.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				save();
			}
		});
		saveBtn.addEventListener("click", save);
		skipBtn.addEventListener("click", skip);
		useSuggest.addEventListener("click", () => {
			input.value = storage.TWITCH_PREFIX + suggestName.textContent;
			setStatus("");
			input.focus();
		});

		setTimeout(() => input.focus(), 50);

		if (!changing && yt.id) {
			seventv.suggestTwitchForYouTube(yt.id).then((login) => {
				if (!login || dlg !== d) return;
				suggestName.textContent = login;
				suggest.classList.add("show");
				if (!input.value) input.value = storage.TWITCH_PREFIX + login;
			});
		}
	}

	function relabel() {
		if (!dlg || !last) return;
		const { yt, opts, input } = last;
		show(yt, { ...opts, value: input?.value ?? "" });
	}

	YTSE.prompt = { show, close, isOpen, relabel };
})();
