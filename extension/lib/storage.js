(() => {
	const { api } = YTSE;

	const DEFAULT_SETTINGS = {
		language: "auto",
		emoteMenu: true,
		tabCompletion: true,
		tabMode: 0,
		carousel: true,
		carouselArrowKeys: true,
		chatters: true,
		globalEmotes: true,
		tooltips: true,
		liveUpdates: true,
		allMessages: true,
		sendGuard: true,
		askNewChannels: true,
	};

	const SCHEMA = 2;
	const SCHEMA_KEY = "schema";
	const TWITCH_PREFIX = "https://www.twitch.tv/";
	const CHANNEL_PREFIX = "ch:";
	const CACHE_PREFIX = "cache:";
	const THEME_KEY = "ytTheme";
	const MAX_CACHE = 6;
	const LOGIN_RE = /^[a-z0-9_]{1,25}$/;

	function local() {
		const area = api?.storage?.local;
		if (!area) throw new Error("Extension context invalidated");
		return area;
	}

	async function call(fn) {
		try {
			return await fn(local());
		} catch (e) {
			if (YTSE.isContextError(e) || !YTSE.extAlive()) YTSE.life?.teardown("orphaned");
			throw e;
		}
	}

	const get = (keys) => call((s) => s.get(keys));
	const set = (items) => call((s) => s.set(items));
	const remove = (keys) => call((s) => s.remove(keys));

	function langCodes() {
		return YTSE.i18n?.LANGS?.map(([code]) => code) ?? null;
	}

	function sanitizeSettings(raw) {
		const out = { ...DEFAULT_SETTINGS };
		if (!raw || typeof raw !== "object") return out;
		for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
			if (typeof raw[k] === typeof def) out[k] = raw[k];
		}
		if (out.tabMode !== 0 && out.tabMode !== 1) out.tabMode = DEFAULT_SETTINGS.tabMode;
		const codes = langCodes();
		if (out.language !== "auto" && codes && !codes.includes(out.language)) out.language = "auto";
		return out;
	}

	const str = (v) => (typeof v === "string" && v ? v : null);

	function sanitizeMapping(key, raw) {
		if (!raw || typeof raw !== "object") return null;
		const login = str(raw.twitchLogin)?.toLowerCase() ?? null;
		const validLogin = login && LOGIN_RE.test(login) ? login : null;
		const skipped = raw.skipped === true || !validLogin;
		return {
			...raw,
			key,
			ytChannelId: str(raw.ytChannelId),
			ytHandle: str(raw.ytHandle),
			ytName: typeof raw.ytName === "string" ? raw.ytName : "",
			twitchLogin: skipped ? null : validLogin,
			twitchId: skipped ? null : str(raw.twitchId),
			twitchUrl: skipped ? null : TWITCH_PREFIX + validLogin,
			setName: typeof raw.setName === "string" ? raw.setName : "",
			skipped,
			updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
		};
	}

	const MIGRATIONS = [
		{
			to: 2,
			run(all) {
				const patch = { settings: sanitizeSettings(all.settings) };
				const drop = [];
				for (const [k, v] of Object.entries(all)) {
					if (!k.startsWith(CHANNEL_PREFIX)) continue;
					const m = sanitizeMapping(k, v);
					if (!m || (!m.ytChannelId && !m.ytHandle)) drop.push(k);
					else {
						const { key, ...record } = m;
						patch[k] = record;
					}
				}
				return { patch, drop };
			},
		},
	];

	let migrating = null;

	function migrate() {
		migrating ??= (async () => {
			const all = await get(null);
			const from = Number.isInteger(all[SCHEMA_KEY]) ? all[SCHEMA_KEY] : 1;
			if (from > SCHEMA) {
				YTSE.warn(`Storage schema ${from} is newer than this version (${SCHEMA}); leaving data as is`);
				return from;
			}
			if (from === SCHEMA) return from;
			let current = from;
			for (const m of MIGRATIONS) {
				if (m.to <= current) continue;
				const { patch = {}, drop = [] } = m.run(all) || {};
				if (drop.length) await remove(drop);
				await set({ ...patch, [SCHEMA_KEY]: m.to });
				for (const k of drop) delete all[k];
				Object.assign(all, patch);
				current = m.to;
				YTSE.log(`Storage migrated to schema ${m.to}`);
			}
			return current;
		})().catch((e) => {
			migrating = null;
			throw e;
		});
		return migrating;
	}

	function parseTwitchUrl(input) {
		const raw = String(input ?? "").trim();
		if (!raw.startsWith(TWITCH_PREFIX)) return { ok: false, code: "PREFIX" };
		const login = raw.slice(TWITCH_PREFIX.length).split(/[/?#]/)[0];
		if (!login) return { ok: false, code: "MISSING" };
		if (!/^[A-Za-z0-9_]{1,25}$/.test(login)) return { ok: false, code: "INVALID" };
		const l = login.toLowerCase();
		return { ok: true, login: l, url: TWITCH_PREFIX + l };
	}

	function mappingFromResult(res) {
		const login = res.twitch.login.toLowerCase();
		return {
			twitchLogin: login,
			twitchId: res.twitch.id,
			twitchUrl: TWITCH_PREFIX + login,
			setName: res.set.name,
			skipped: false,
		};
	}

	function channelKey(yt) {
		if (yt.id) return CHANNEL_PREFIX + yt.id;
		return CHANNEL_PREFIX + (yt.handle || "").toLowerCase();
	}

	async function getSettings() {
		const { settings } = await get("settings");
		return sanitizeSettings(settings);
	}

	async function setSettings(patch) {
		const next = sanitizeSettings({ ...(await getSettings()), ...patch });
		await set({ settings: next });
		return next;
	}

	async function getAllChannels() {
		const all = await get(null);
		const out = [];
		for (const [k, v] of Object.entries(all)) {
			if (!k.startsWith(CHANNEL_PREFIX)) continue;
			const m = sanitizeMapping(k, v);
			if (m) out.push(m);
		}
		out.sort((a, b) => (a.ytName || a.ytHandle || "").localeCompare(b.ytName || b.ytHandle || ""));
		return out;
	}

	async function findChannel(yt) {
		const key = channelKey(yt);
		const got = await get(key);
		const direct = sanitizeMapping(key, got[key]);
		if (direct) return direct;
		if (yt.handle) {
			const h = yt.handle.toLowerCase();
			for (const c of await getAllChannels()) {
				if ((c.ytHandle || "").toLowerCase() === h) return c;
			}
		}
		return null;
	}

	async function saveChannel(yt, data) {
		const key = channelKey(yt);
		const record = {
			ytChannelId: yt.id || null,
			ytHandle: yt.handle || null,
			ytName: yt.name || yt.handle || yt.id || "",
			updatedAt: Date.now(),
			...data,
		};
		delete record.key;
		await set({ [key]: record });
		return sanitizeMapping(key, record);
	}

	async function removeChannel(key) {
		await remove(key);
	}

	async function getTheme() {
		const got = await get(THEME_KEY);
		return got[THEME_KEY] === "dark" || got[THEME_KEY] === "light" ? got[THEME_KEY] : null;
	}

	async function setTheme(theme) {
		if ((await getTheme()) !== theme) await set({ [THEME_KEY]: theme });
	}

	async function getCache(name) {
		const key = CACHE_PREFIX + name;
		const got = await get(key);
		const v = got[key];
		return v && typeof v === "object" && v.data && Number.isFinite(v.at) ? v : null;
	}

	async function putCache(name, data) {
		const key = CACHE_PREFIX + name;
		await set({ [key]: { at: Date.now(), v: YTSE.version, data } });
		const all = await get(null);
		const caches = Object.entries(all)
			.filter(([k]) => k.startsWith(CACHE_PREFIX))
			.sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0));
		const extra = caches.slice(MAX_CACHE).map(([k]) => k);
		if (extra.length) await remove(extra);
	}

	YTSE.storage = {
		DEFAULT_SETTINGS,
		SCHEMA,
		TWITCH_PREFIX,
		CHANNEL_PREFIX,
		CACHE_PREFIX,
		THEME_KEY,
		migrate,
		sanitizeSettings,
		sanitizeMapping,
		parseTwitchUrl,
		mappingFromResult,
		channelKey,
		getSettings,
		setSettings,
		getAllChannels,
		findChannel,
		saveChannel,
		removeChannel,
		getTheme,
		setTheme,
		getCache,
		putCache,
	};
})();
