(() => {
	const API = "https://7tv.io";
	const EVENTS_URL = "wss://events.7tv.io/v3";

	class SevenTVError extends Error {
		constructor(code, params = {}, cause) {
			super(code);
			this.code = code;
			this.params = params;
			this.cause = cause;
		}
	}

	const TIMEOUT_MS = 15000;

	function timeoutSignal(ms) {
		if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) return AbortSignal.timeout(ms);
		const c = new AbortController();
		setTimeout(() => c.abort(), ms);
		return c.signal;
	}

	async function getJSON(url, opts = {}) {
		const res = await fetch(url, { cache: "no-cache", signal: timeoutSignal(TIMEOUT_MS), ...opts });
		if (!res.ok) {
			const err = new Error(`HTTP ${res.status} at ${url}`);
			err.status = res.status;
			throw err;
		}
		const data = await res.json();
		if (data == null || typeof data !== "object") throw new Error(`Unexpected response at ${url}`);
		return data;
	}

	async function gql(query, variables) {
		const data = await getJSON(`${API}/v4/gql`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ query, variables }),
		});
		if (data.errors?.length) throw new Error(data.errors[0].message || "GQL error");
		return data.data;
	}

	const SEARCH_QUERY = `query($q:String!){users{search(query:$q,page:1,perPage:10){items{id connections{platform platformId platformUsername}}}}}`;
	const BY_CONNECTION_QUERY = `query($id:String!){users{userByConnection(platform:GOOGLE,platformId:$id){id connections{platform platformId platformUsername}}}}`;

	async function resolveTwitchId(login) {
		const l = login.toLowerCase();
		try {
			const d = await gql(SEARCH_QUERY, { q: l });
			for (const u of d?.users?.search?.items ?? []) {
				for (const c of u.connections ?? []) {
					if (c.platform === "TWITCH" && (c.platformUsername || "").toLowerCase() === l) {
						return { id: c.platformId, login: c.platformUsername };
					}
				}
			}
		} catch (e) {
			YTSE.warn("7TV search failed, trying api.ivr.fi", e);
		}
		try {
			const arr = await getJSON(`https://api.ivr.fi/v2/twitch/user?login=${encodeURIComponent(l)}`);
			const u = Array.isArray(arr) ? arr[0] : null;
			if (u?.id) return { id: String(u.id), login: u.login || l, displayName: u.displayName };
		} catch (e) {
			YTSE.warn("api.ivr.fi failed", e);
		}
		return null;
	}

	async function fetchTwitchChannel(login, knownTwitchId) {
		let twitchId = knownTwitchId || null;
		let data = null;
		if (twitchId) {
			try {
				data = await getJSON(`${API}/v3/users/twitch/${twitchId}`);
			} catch (e) {
				if (e.status !== 404) throw new SevenTVError("NETWORK", {}, e);
				twitchId = null;
			}
		}
		if (!data) {
			const resolved = await resolveTwitchId(login);
			if (!resolved) throw new SevenTVError("TWITCH_NOT_FOUND", { login });
			twitchId = resolved.id;
			try {
				data = await getJSON(`${API}/v3/users/twitch/${twitchId}`);
			} catch (e) {
				if (e.status === 404) {
					throw new SevenTVError("NO_7TV", { login }, e);
				}
				throw new SevenTVError("NETWORK", {}, e);
			}
		}
		const set = data.emote_set;
		if (!set || !set.id) {
			throw new SevenTVError("NO_SET", { login });
		}
		return {
			twitch: { id: String(data.id ?? twitchId), login: data.username || login, displayName: data.display_name || login },
			user: {
				id: data.user?.id || null,
				username: data.user?.username || null,
				displayName: data.user?.display_name || null,
			},
			set: { id: set.id, name: set.name || "", emotes: validEmotes(set.emotes) },
		};
	}

	async function fetchGlobalSet() {
		const s = await getJSON(`${API}/v3/emote-sets/global`);
		if (!s.id) throw new Error("Global set without id");
		return { id: s.id, name: s.name || "Global", emotes: validEmotes(s.emotes) };
	}

	async function suggestTwitchForYouTube(ytChannelId) {
		if (!ytChannelId) return null;
		try {
			const d = await gql(BY_CONNECTION_QUERY, { id: ytChannelId });
			const user = d?.users?.userByConnection;
			const tw = user?.connections?.find((c) => c.platform === "TWITCH" && c.platformUsername);
			return tw ? tw.platformUsername.toLowerCase() : null;
		} catch {
			return null;
		}
	}

	function validEmotes(list) {
		if (!Array.isArray(list)) return [];
		return list.filter((e) => e && typeof e.id === "string" && typeof e.name === "string" && e.name && !/\s/.test(e.name));
	}

	function trimEmote(ae) {
		const d = ae.data || {};
		const host = d.host || null;
		return {
			id: ae.id,
			name: ae.name,
			flags: ae.flags || 0,
			data: {
				name: d.name,
				flags: d.flags || 0,
				animated: !!d.animated,
				owner: d.owner ? { display_name: d.owner.display_name, username: d.owner.username } : null,
				host: host
					? {
							url: host.url,
							files: (host.files || [])
								.filter((f) => /^\dx\.webp$/.test(f.name || ""))
								.map((f) => ({ name: f.name, width: f.width, height: f.height })),
						}
					: null,
			},
		};
	}

	function trimSet(set) {
		return set ? { id: set.id, name: set.name, emotes: validEmotes(set.emotes).map(trimEmote) } : null;
	}

	function errorMessage(e) {
		if (e instanceof SevenTVError) return YTSE.i18n.t("err" + e.code, e.params);
		return YTSE.i18n.t("errGENERIC");
	}

	function normalizeEmote(ae, scope) {
		const d = ae.data || {};
		const host = d.host || {};
		let base = host.url || `//cdn.7tv.app/emote/${ae.id}`;
		if (base.startsWith("//")) base = "https:" + base;
		const files = (host.files || []).filter((f) => /^\dx\.webp$/.test(f.name || ""));
		files.sort((a, b) => a.name.localeCompare(b.name));
		const f1 = files[0];
		const srcset = files.length
			? files.map((f) => `${base}/${f.name} ${f.name[0]}x`).join(", ")
			: `${base}/1x.webp 1x, ${base}/2x.webp 2x, ${base}/3x.webp 3x, ${base}/4x.webp 4x`;
		const big = files.find((f) => f.name === "3x.webp")?.name || (files.length ? files[files.length - 1].name : "3x.webp");
		return {
			id: ae.id,
			name: ae.name,
			scope,
			provider: "7TV",
			zeroWidth: ((ae.flags || 0) & 1) === 1 || ((d.flags || 0) & 256) === 256,
			animated: !!d.animated,
			owner: d.owner?.display_name || d.owner?.username || "",
			originalName: d.name && d.name !== ae.name ? d.name : null,
			width: f1?.width || null,
			height: f1?.height || null,
			src: `${base}/1x.webp`,
			srcset,
			big: `${base}/${big}`,
		};
	}

	class EventClient {
		constructor({ onDispatch, onReconnect, onStatus } = {}) {
			this.onDispatch = onDispatch;
			this.onReconnect = onReconnect;
			this.onStatus = onStatus;
			this.subs = new Map();
			this.ws = null;
			this.closed = false;
			this.backoff = 1000;
			this.heartbeat = 25000;
			this.lastMsg = 0;
			this.everOpened = false;
			this.connected = false;
			this.watchdog = null;
			this.retryTimer = null;
		}

		connect() {
			if (this.closed || this.ws) return;
			let ws;
			try {
				ws = new WebSocket(EVENTS_URL);
			} catch (e) {
				YTSE.warn("WebSocket failed", e);
				this.scheduleRetry();
				return;
			}
			this.ws = ws;
			ws.onmessage = (ev) => this.handle(ws, ev);
			ws.onclose = () => {
				if (this.ws === ws) this.ws = null;
				this.setConnected(false);
				clearInterval(this.watchdog);
				this.scheduleRetry();
			};
			ws.onerror = () => {};
		}

		scheduleRetry() {
			if (this.closed || this.subs.size === 0) return;
			clearTimeout(this.retryTimer);
			const delay = this.backoff + Math.random() * 1000;
			this.backoff = Math.min(this.backoff * 2, 60000);
			this.retryTimer = setTimeout(() => this.connect(), delay);
		}

		setConnected(v) {
			if (this.connected === v) return;
			this.connected = v;
			this.onStatus?.(v);
		}

		handle(ws, ev) {
			let msg;
			try {
				msg = JSON.parse(ev.data);
			} catch {
				return;
			}
			this.lastMsg = Date.now();
			switch (msg.op) {
				case 1: {
					this.heartbeat = msg.d?.heartbeat_interval || 25000;
					this.backoff = 1000;
					for (const s of this.subs.values()) this.send(35, s);
					this.setConnected(true);
					clearInterval(this.watchdog);
					this.watchdog = setInterval(() => {
						if (Date.now() - this.lastMsg > this.heartbeat * 3) ws.close();
					}, this.heartbeat);
					if (this.everOpened) this.onReconnect?.();
					this.everOpened = true;
					break;
				}
				case 0:
					try {
						this.onDispatch?.(msg.d?.type, msg.d?.body);
					} catch (e) {
						YTSE.warn("Failed to apply 7TV event", e);
					}
					break;
				case 4:
				case 7:
					ws.close();
					break;
				default:
					break;
			}
		}

		send(op, d) {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.send(JSON.stringify({ op, d }));
			}
		}

		subscribe(type, condition) {
			const key = type + ":" + JSON.stringify(condition);
			if (this.subs.has(key)) return;
			const s = { type, condition };
			this.subs.set(key, s);
			this.send(35, s);
			this.connect();
		}

		unsubscribeAll() {
			for (const s of this.subs.values()) this.send(36, s);
			this.subs.clear();
		}

		close() {
			this.closed = true;
			clearInterval(this.watchdog);
			clearTimeout(this.retryTimer);
			this.subs.clear();
			this.ws?.close();
			this.ws = null;
		}
	}

	YTSE.seventv = {
		SevenTVError,
		resolveTwitchId,
		fetchTwitchChannel,
		fetchGlobalSet,
		suggestTwitchForYouTube,
		normalizeEmote,
		validEmotes,
		trimSet,
		errorMessage,
		EventClient,
	};
})();
