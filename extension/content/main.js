(() => {
	const { api, life, storage, seventv, yt, render, tab, prompt, i18n, ui, guard, picker, panel } = YTSE;
	if (!life.alive) return;

	const RETRY_DELAYS = [5000, 15000, 60000, 180000];
	const BUSY = new Set(["starting", "resolving", "loading"]);

	const S = {
		settings: { ...storage.DEFAULT_SETTINGS },
		videoId: null,
		replay: yt.isReplay(),
		channel: null,
		mapping: null,
		status: "starting",
		errorRef: null,
		twitch: null,
		sevenUser: null,
		channelSet: null,
		globalSet: null,
		emoteMap: new Map(),
		loadToken: 0,
		lastLoadedAt: 0,
		stale: false,
	};

	let events = null;
	let retryTimer = null;
	let retryCount = 0;
	let cacheTimer = null;
	const listeners = new Set();

	function safe(label, fn) {
		try {
			return fn();
		} catch (e) {
			YTSE.warn(`${label} failed`, e);
			return undefined;
		}
	}

	function notify() {
		for (const cb of listeners) {
			try {
				cb();
			} catch (e) {
				YTSE.warn("Listener failed", e);
			}
		}
	}

	function setStatus(status, errorRef = null) {
		if (!life.alive) return;
		S.status = status;
		S.errorRef = errorRef;
		if (!BUSY.has(status)) render.arm();
		picker.refresh();
		notify();
	}

	function byName(a, b) {
		return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
	}

	function rebuildMap() {
		if (!life.alive) return;
		const map = new Map();
		for (const ae of S.channelSet?.emotes ?? []) {
			if (ae?.name && !map.has(ae.name)) map.set(ae.name, seventv.normalizeEmote(ae, "CHANNEL"));
		}
		if (S.settings.globalEmotes) {
			for (const ae of S.globalSet?.emotes ?? []) {
				if (ae?.name && !map.has(ae.name)) map.set(ae.name, seventv.normalizeEmote(ae, "GLOBAL"));
			}
		}
		S.emoteMap = map;
		render.setEmotes(map);
		tab.setEmotes(map);
		const all = [...map.values()];
		picker.setEmotes({
			channel: S.channelSet
				? {
						setName: S.channelSet.name,
						owner: S.twitch?.displayName || S.mapping?.twitchLogin || "",
						emotes: all.filter((e) => e.scope === "CHANNEL").sort(byName),
					}
				: null,
			global: all.filter((e) => e.scope === "GLOBAL").sort(byName),
		});
		notify();
	}

	function clearEmotes() {
		S.channelSet = null;
		S.twitch = null;
		S.sevenUser = null;
		events?.unsubscribeAll();
		rebuildMap();
	}

	function stripMeta(m) {
		const { key, updatedAt, ytChannelId, ytHandle, ytName, ...rest } = m;
		return rest;
	}

	function scheduleRetry() {
		clearTimeout(retryTimer);
		const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
		retryCount++;
		retryTimer = life.after(() => loadEmotes({ quiet: true }), delay);
	}

	function retryable(e) {
		return !(e instanceof seventv.SevenTVError) || e.code === "NETWORK";
	}

	function scheduleCacheSave(delay = 1500) {
		clearTimeout(cacheTimer);
		cacheTimer = life.after(saveCache, delay);
	}

	async function saveCache() {
		const login = S.mapping?.twitchLogin;
		try {
			if (login && S.channelSet && S.twitch) {
				await storage.putCache("tw:" + login, { twitch: S.twitch, user: S.sevenUser, set: seventv.trimSet(S.channelSet) });
			}
			if (S.globalSet) await storage.putCache("global", seventv.trimSet(S.globalSet));
		} catch (e) {
			YTSE.warn("Failed to save emote cache", e);
		}
	}

	async function loadFromCache(login, token) {
		const [chan, glob] = await Promise.all([
			storage.getCache("tw:" + login).catch(() => null),
			S.settings.globalEmotes && !S.globalSet ? storage.getCache("global").catch(() => null) : null,
		]);
		if (!life.alive || token !== S.loadToken || !chan?.data?.set?.id) return false;
		S.twitch = chan.data.twitch || null;
		S.sevenUser = chan.data.user || null;
		S.channelSet = { ...chan.data.set, emotes: seventv.validEmotes(chan.data.set.emotes) };
		if (glob?.data?.id) S.globalSet = { ...glob.data, emotes: seventv.validEmotes(glob.data.emotes) };
		S.status = "ready";
		S.errorRef = null;
		rebuildMap();
		YTSE.log(`${S.emoteMap.size} emotes from saved copy (${login})`);
		return true;
	}

	async function loadEmotes({ quiet = false } = {}) {
		const mapping = S.mapping;
		if (!life.alive || !mapping || mapping.skipped || !mapping.twitchLogin) return;
		const token = ++S.loadToken;
		clearTimeout(retryTimer);
		if (!S.channelSet && (await loadFromCache(mapping.twitchLogin, token))) quiet = true;
		if (!life.alive || token !== S.loadToken) return;
		if (!quiet) setStatus("loading");
		try {
			const [chan, glob] = await Promise.all([
				seventv.fetchTwitchChannel(mapping.twitchLogin, mapping.twitchId),
				S.settings.globalEmotes ? seventv.fetchGlobalSet().catch(() => S.globalSet) : Promise.resolve(S.globalSet),
			]);
			if (!life.alive || token !== S.loadToken) return;
			S.twitch = chan.twitch;
			S.sevenUser = chan.user;
			S.channelSet = chan.set;
			S.globalSet = glob;
			S.lastLoadedAt = Date.now();
			S.status = "ready";
			S.errorRef = null;
			S.stale = false;
			retryCount = 0;
			rebuildMap();
			subscribeEvents();
			scheduleCacheSave();
			YTSE.log(`${S.emoteMap.size} emotes (${chan.twitch.login}, set "${chan.set.name}")`);
			if (mapping.twitchId !== chan.twitch.id || mapping.setName !== chan.set.name) {
				S.mapping = await storage.saveChannel(S.channel, { ...stripMeta(mapping), twitchId: chan.twitch.id, setName: chan.set.name });
			}
		} catch (e) {
			if (!life.alive || token !== S.loadToken) return;
			YTSE.warn("Failed to load emotes", e);
			if (S.status === "ready") {
				S.stale = true;
				notify();
			} else {
				setStatus("error", e);
			}
			if (retryable(e)) scheduleRetry();
		}
	}

	function subscribeEvents() {
		if (!S.settings.liveUpdates) {
			events?.close();
			events = null;
			notify();
			return;
		}
		if (!events) {
			events = new seventv.EventClient({
				onDispatch,
				onReconnect: () => loadEmotes({ quiet: true }),
				onStatus: () => notify(),
			});
		}
		events.unsubscribeAll();
		if (S.channelSet?.id) events.subscribe("emote_set.update", { object_id: S.channelSet.id });
		if (S.sevenUser?.id) events.subscribe("user.update", { object_id: S.sevenUser.id });
		if (S.settings.globalEmotes && S.globalSet?.id) events.subscribe("emote_set.update", { object_id: S.globalSet.id });
	}

	function sameEmote(a, b) {
		return a && b && a.id === b.id && a.name === b.name;
	}

	function onDispatch(type, body) {
		if (!body) return;
		if (type === "emote_set.update") {
			const set = body.id === S.channelSet?.id ? S.channelSet : body.id === S.globalSet?.id ? S.globalSet : null;
			if (!set) return;
			let changed = false;
			for (const p of body.pulled ?? []) {
				if (p.key !== "emotes" || !p.old_value) continue;
				let i = set.emotes.findIndex((e) => sameEmote(e, p.old_value));
				if (i < 0) i = set.emotes.findIndex((e) => e.id === p.old_value.id);
				if (i >= 0) {
					set.emotes.splice(i, 1);
					changed = true;
				}
			}
			for (const p of body.pushed ?? []) {
				if (p.key !== "emotes" || !p.value) continue;
				set.emotes = set.emotes.filter((e) => !sameEmote(e, p.value));
				set.emotes.push(p.value);
				changed = true;
			}
			for (const u of body.updated ?? []) {
				if (u.key !== "emotes" || !u.value) continue;
				const i = u.old_value ? set.emotes.findIndex((e) => sameEmote(e, u.old_value)) : -1;
				const value = { ...(i >= 0 ? set.emotes[i] : {}), ...u.value };
				if (!value.data && i >= 0) value.data = set.emotes[i].data;
				if (i >= 0) set.emotes[i] = value;
				else set.emotes.push(value);
				changed = true;
			}
			if (changed) {
				rebuildMap();
				scheduleCacheSave(10000);
			}
		} else if (type === "user.update" && body.id === S.sevenUser?.id) {
			const switched = (body.updated ?? []).some(
				(f) => f.key === "connections" && (Array.isArray(f.value) ? f.value : []).some((n) => n.key === "emote_set"),
			);
			if (switched) loadEmotes({ quiet: true });
		}
	}

	async function applyMapping({ fromStorage = false } = {}) {
		const mapping = S.channel ? await storage.findChannel(S.channel) : null;
		if (!life.alive) return;
		const prev = S.mapping;
		S.mapping = mapping;

		if (!mapping) {
			clearEmotes();
			setStatus("unmapped");
			if (!S.replay && S.settings.askNewChannels && !prompt.isOpen()) prompt.show(S.channel);
			return;
		}
		if (mapping.skipped) {
			clearEmotes();
			setStatus("skipped");
			return;
		}
		if (prompt.isOpen() && !fromStorage) prompt.close();
		const unchanged = fromStorage && prev && prev.twitchLogin === mapping.twitchLogin && !prev.skipped && S.status === "ready";
		if (!unchanged) {
			if (prev && prev.twitchLogin !== mapping.twitchLogin) clearEmotes();
			await loadEmotes();
		} else {
			notify();
		}
	}

	async function setupForVideo() {
		S.videoId = yt.getVideoId();
		S.channel = null;
		S.mapping = null;
		prompt.close();
		if (!S.videoId) {
			clearEmotes();
			setStatus("no-video");
			return;
		}
		setStatus("resolving");
		const vid = S.videoId;
		let ch = null;
		for (let attempt = 0; attempt < 4 && !ch; attempt++) {
			if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
			ch = await yt.resolveChannel(vid);
			if (!life.alive || S.videoId !== vid) return;
		}
		if (!ch) {
			setStatus("error", new seventv.SevenTVError("NO_CHANNEL"));
			return;
		}
		S.channel = ch;
		YTSE.log("YouTube channel:", ch);
		await applyMapping();
	}

	function watchVideoChanges() {
		life.every(() => {
			const v = yt.getVideoId();
			if (v && v !== S.videoId) setupForVideo();
		}, 3000);
	}

	function applySettings() {
		safe("render settings", () => render.setSettings(S.settings));
		safe("tab settings", () => tab.setSettings(S.settings));
		safe("guard settings", () => guard.setSettings(S.settings));
		safe("picker settings", () => picker.setSettings(S.settings));
		safe("panel settings", () => panel.setSettings(S.settings));
	}

	function onSettingsChanged(next) {
		const old = S.settings;
		S.settings = storage.sanitizeSettings(next);
		if (old.language !== S.settings.language) {
			i18n.setLang(S.settings.language);
			safe("relabel", () => {
				ui.refresh();
				picker.relabel();
				guard.relabel();
				prompt.relabel();
				panel.relabel();
			});
		}
		applySettings();
		if (old.globalEmotes !== S.settings.globalEmotes) {
			if (S.settings.globalEmotes && !S.globalSet && S.status === "ready") loadEmotes({ quiet: true });
			else {
				rebuildMap();
				subscribeEvents();
			}
		} else if (old.liveUpdates !== S.settings.liveUpdates && S.status === "ready") {
			subscribeEvents();
			if (S.settings.liveUpdates) loadEmotes({ quiet: true });
		}
	}

	function onStorageChanged(changes, area) {
		if (area !== "local") return;
		if (changes.settings) onSettingsChanged(changes.settings.newValue);
		if (!S.channel) return;
		const myKey = storage.channelKey(S.channel);
		const relevant = Object.keys(changes).some((k) => {
			if (!k.startsWith(storage.CHANNEL_PREFIX)) return false;
			if (k === myKey || k === S.mapping?.key) return true;
			const v = changes[k].newValue || changes[k].oldValue;
			return (
				!!v &&
				((S.channel.id && v.ytChannelId === S.channel.id) ||
					(S.channel.handle && (v.ytHandle || "").toLowerCase() === S.channel.handle.toLowerCase()))
			);
		});
		if (relevant) applyMapping({ fromStorage: true });
	}

	function publicState() {
		return {
			ok: true,
			status: S.status,
			error: S.errorRef ? seventv.errorMessage(S.errorRef) : null,
			replay: S.replay,
			videoId: S.videoId,
			channel: S.channel,
			mapping: S.mapping,
			twitch: S.twitch,
			setName: S.channelSet?.name ?? null,
			channelEmotes: S.channelSet?.emotes?.length ?? 0,
			globalEmotes: S.settings.globalEmotes ? S.globalSet?.emotes?.length ?? 0 : 0,
			totalEmotes: S.emoteMap.size,
			live: !!events?.connected,
			stale: S.stale,
			lastLoadedAt: S.lastLoadedAt,
			dark: ui.isDark(),
			version: YTSE.version,
		};
	}

	async function handleMessage(msg) {
		switch (msg?.type) {
			case "ytse:getState":
				return publicState();
			case "ytse:reload":
				if (S.mapping && !S.mapping.skipped) await loadEmotes();
				else if (!S.channel) await setupForVideo();
				return publicState();
			case "ytse:openPrompt":
				if (S.channel) prompt.show(S.channel, { current: S.mapping?.twitchUrl || "" });
				return publicState();
			default:
				return undefined;
		}
	}

	function onMessage(msg, _sender, sendResponse) {
		if (!msg || typeof msg.type !== "string" || !msg.type.startsWith("ytse:")) return false;
		handleMessage(msg).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e) }));
		return true;
	}

	YTSE.app = {
		getState: publicState,
		reload: () => handleMessage({ type: "ytse:reload" }),
		openPrompt: () => handleMessage({ type: "ytse:openPrompt" }),
		onChange(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		},
	};

	function claimPage() {
		const root = document.documentElement;
		safe("stale cleanup", () => YTSE.cleanStale());
		root.dataset.ytseInstance = life.id;
		root.dataset.ytseVersion = YTSE.version;
		life.every(() => {
			if (!YTSE.extAlive()) life.teardown("orphaned");
		}, 2000);
	}

	function listen() {
		const storageListener = life.guard(onStorageChanged);
		const messageListener = life.guard(onMessage);
		api.storage.onChanged.addListener(storageListener);
		api.runtime.onMessage.addListener(messageListener);
		life.add(() => {
			clearTimeout(retryTimer);
			clearTimeout(cacheTimer);
			events?.close();
			events = null;
			listeners.clear();
			try {
				api.storage.onChanged.removeListener(storageListener);
				api.runtime.onMessage.removeListener(messageListener);
			} catch {}
		});
	}

	async function boot() {
		if (!life.alive) return;
		claimPage();
		try {
			await storage.migrate();
		} catch (e) {
			YTSE.warn("Storage migration failed", e);
		}
		try {
			S.settings = await storage.getSettings();
		} catch (e) {
			YTSE.warn("Failed to read settings", e);
		}
		if (!life.alive) return;
		i18n.setLang(S.settings.language);
		safe("theme", () => ui.watchYouTubeTheme((dark) => storage.setTheme(dark ? "dark" : "light").catch(() => {})));
		applySettings();
		safe("tab completion", () =>
			tab.init({
				getChatters: () => render.getChatters(),
				getBroadcaster: () => S.channel?.handle || null,
			}),
		);
		safe("guard", () => guard.init({ getCarouselRect: () => tab.carouselRect() }));
		safe("picker", () =>
			picker.init({
				getState: publicState,
				insert: (name) => YTSE.input.insertToken(name),
				openSettings: () => panel.open(),
				openPrompt: () => YTSE.app.openPrompt(),
			}),
		);
		safe("render", () => render.start());
		listen();
		await setupForVideo();
		if (!life.alive) return;
		watchVideoChanges();
	}

	if (document.body) boot();
	else life.on(document, "DOMContentLoaded", boot, { once: true });
})();
