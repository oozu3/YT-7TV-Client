if (typeof importScripts === "function" && !globalThis.YTSE?.storage) {
	importScripts("lib/core.js", "lib/i18n.js", "lib/storage.js");
}

(() => {
	const { api, storage } = YTSE;
	const YOUTUBE = /^https:\/\/www\.youtube\.com\//;

	function probe() {
		if (!location.pathname.startsWith("/live_chat")) return false;
		const root = document.documentElement;
		root.removeAttribute("data-ytse-pong");
		document.dispatchEvent(new CustomEvent("ytse:ping"));
		return !root.hasAttribute("data-ytse-pong");
	}

	async function reinjectTab(tabId, cs) {
		const results = await api.scripting.executeScript({ target: { tabId, allFrames: true }, func: probe });
		const frameIds = (results || []).filter((r) => r && r.result === true).map((r) => r.frameId);
		if (!frameIds.length) return 0;
		if (cs.css?.length) await api.scripting.insertCSS({ target: { tabId, frameIds }, files: cs.css });
		await api.scripting.executeScript({ target: { tabId, frameIds }, files: cs.js });
		return frameIds.length;
	}

	function reinjectsNatively() {
		try {
			return api.runtime.getURL("").startsWith("moz-extension:");
		} catch {
			return false;
		}
	}

	async function reinject() {
		if (!api.scripting?.executeScript || reinjectsNatively()) return;
		const cs = api.runtime.getManifest().content_scripts?.[0];
		if (!cs?.js?.length) return;
		let tabs = [];
		try {
			tabs = (await api.tabs.query({})).filter((t) => !t.discarded && (!t.url || YOUTUBE.test(t.url)));
		} catch (e) {
			YTSE.warn("Could not list YouTube tabs", e);
			return;
		}
		let frames = 0;
		await Promise.all(
			tabs.map((tab) =>
				reinjectTab(tab.id, cs)
					.then((n) => (frames += n))
					.catch((e) => YTSE.log(`Re-injection skipped for tab ${tab.id}`, e?.message || e)),
			),
		);
		if (frames) YTSE.log(`Re-injected into ${frames} open chat frame(s)`);
	}

	api.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
		if (reason !== "install" && reason !== "update") return;
		if (reason === "update") YTSE.log(`Updated from ${previousVersion} to ${YTSE.version}`);
		storage
			.migrate()
			.catch((e) => YTSE.warn("Storage migration failed", e))
			.finally(() => reinject());
	});
})();
