(() => {
	function videoIdFromUrl(href) {
		try {
			const u = new URL(href);
			if (!/(^|\.)youtube\.com$/.test(u.hostname)) return null;
			if (u.pathname === "/watch") return u.searchParams.get("v");
			const m = u.pathname.match(/^\/(?:live|embed|shorts)\/([\w-]{11})/);
			return m ? m[1] : null;
		} catch {
			return null;
		}
	}

	function getVideoId() {
		const own = new URL(location.href).searchParams.get("v");
		if (own) return own;
		try {
			if (window.top !== window) {
				const v = videoIdFromUrl(window.top.location.href);
				if (v) return v;
			}
		} catch {}
		return videoIdFromUrl(document.referrer);
	}

	function isReplay() {
		return location.pathname.startsWith("/live_chat_replay");
	}

	function decodeJsonString(s) {
		try {
			return JSON.parse(`"${s}"`);
		} catch {
			return s;
		}
	}

	function parseWatchHtml(html, videoId) {
		const anchor = html.indexOf(`"videoDetails":{"videoId":"${videoId}"`);
		const seg = anchor >= 0 ? html.slice(anchor, anchor + 30000) : "";
		const id = /"channelId":"(UC[\w-]{22})"/.exec(seg)?.[1] || null;
		const authorRaw = /"author":"((?:[^"\\]|\\.)*)"/.exec(seg)?.[1];
		let handle = null;
		const prof = /"ownerProfileUrl":"https?:\/\/www\.youtube\.com\/(@[^"\\/?]+)"/.exec(html)?.[1];
		if (prof) {
			try {
				handle = decodeURIComponent(prof);
			} catch {
				handle = prof;
			}
		}
		if (!id && !handle) return null;
		return { id, handle, name: authorRaw ? decodeJsonString(authorRaw) : handle || id };
	}

	function pageFetch(url) {
		if (typeof content !== "undefined" && content && typeof content.fetch === "function") {
			return content.fetch(url, { credentials: "include" });
		}
		return fetch(url, { credentials: "include" });
	}

	function withTimeout(promise, ms) {
		let timer;
		return Promise.race([
			promise,
			new Promise((_, reject) => {
				timer = setTimeout(() => reject(new Error("Timeout")), ms);
			}),
		]).finally(() => clearTimeout(timer));
	}

	async function fromWatchPage(videoId) {
		return withTimeout(
			(async () => {
				const res = await pageFetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`);
				if (!res.ok) throw new Error("HTTP " + res.status);
				return parseWatchHtml(await res.text(), videoId);
			})(),
			15000,
		);
	}

	function fromParentDom(videoId) {
		try {
			if (window.top === window) return null;
			const doc = window.top.document;
			const flexy = doc.querySelector("ytd-watch-flexy");
			if (!flexy || flexy.getAttribute("video-id") !== videoId) return null;
			const a = doc.querySelector("ytd-watch-metadata ytd-video-owner-renderer a[href^='/@']");
			const href = a?.getAttribute("href");
			if (!href) return null;
			const handle = decodeURIComponent(href.slice(1).split(/[/?#]/)[0]);
			const name = doc.querySelector("ytd-watch-metadata ytd-channel-name a")?.textContent?.trim() || handle;
			return { id: null, handle, name };
		} catch {
			return null;
		}
	}

	const cache = new Map();

	async function resolveChannel(videoId) {
		if (cache.has(videoId)) return cache.get(videoId);
		let ch = null;
		try {
			ch = await fromWatchPage(videoId);
		} catch (e) {
			YTSE.warn("Could not read the video page", e);
		}
		if (!ch || !ch.id) {
			const dom = fromParentDom(videoId);
			if (dom) ch = ch ? { ...dom, ...ch, handle: ch.handle || dom.handle } : dom;
		}
		if (ch) cache.set(videoId, ch);
		return ch;
	}

	YTSE.yt = { getVideoId, isReplay, resolveChannel, parseWatchHtml };
})();
