(() => {
	const PALETTE = `
		.ytse-theme {
			--ytse-font: "Roboto", "Arial", sans-serif;
			--ytse-bg: #ffffff;
			--ytse-menu: #ffffff;
			--ytse-text: #0f0f0f;
			--ytse-text-2: #606060;
			--ytse-text-3: #909090;
			--ytse-chip: rgba(0, 0, 0, 0.05);
			--ytse-chip-hover: rgba(0, 0, 0, 0.1);
			--ytse-outline: rgba(0, 0, 0, 0.1);
			--ytse-field-border: #cccccc;
			--ytse-accent: #065fd4;
			--ytse-accent-soft: #def1ff;
			--ytse-primary-bg: #0f0f0f;
			--ytse-primary-fg: #ffffff;
			--ytse-primary-hover: #272727;
			--ytse-error: #cc0000;
			--ytse-success: #107516;
			--ytse-toggle-bar: rgba(0, 0, 0, 0.26);
			--ytse-toggle-knob: #ffffff;
			--ytse-shadow: 0 4px 32px rgba(0, 0, 0, 0.1);
			--ytse-scrim: rgba(0, 0, 0, 0.5);
			color-scheme: light;
		}
		.ytse-theme.dark {
			--ytse-bg: #0f0f0f;
			--ytse-menu: #282828;
			--ytse-text: #f1f1f1;
			--ytse-text-2: #aaaaaa;
			--ytse-text-3: #717171;
			--ytse-chip: rgba(255, 255, 255, 0.1);
			--ytse-chip-hover: rgba(255, 255, 255, 0.2);
			--ytse-outline: rgba(255, 255, 255, 0.2);
			--ytse-field-border: #303030;
			--ytse-accent: #3ea6ff;
			--ytse-accent-soft: #263850;
			--ytse-primary-bg: #f1f1f1;
			--ytse-primary-fg: #0f0f0f;
			--ytse-primary-hover: #d9d9d9;
			--ytse-error: #ff4e45;
			--ytse-success: #2ba640;
			--ytse-toggle-bar: rgba(255, 255, 255, 0.3);
			--ytse-toggle-knob: #e0e0e0;
			--ytse-shadow: 0 4px 32px rgba(0, 0, 0, 0.6);
			--ytse-scrim: rgba(0, 0, 0, 0.6);
			color-scheme: dark;
		}
	`;

	const BASE = `
		.ytse-theme {
			font-family: var(--ytse-font);
			font-size: 14px;
			line-height: 20px;
			font-weight: 400;
			color: var(--ytse-text);
			-webkit-font-smoothing: antialiased;
		}
		.ytse-theme *, .ytse-theme *::before, .ytse-theme *::after { box-sizing: border-box; }
		.muted { color: var(--ytse-text-2); }
		.section-title { margin: 0 0 12px; font-size: 16px; line-height: 22px; font-weight: 500; color: var(--ytse-text); }
		.btn {
			display: inline-flex; align-items: center; justify-content: center; gap: 6px;
			height: 36px; padding: 0 16px; border: 0; border-radius: 18px;
			font-family: var(--ytse-font); font-size: 14px; line-height: 36px; font-weight: 500;
			white-space: nowrap; cursor: pointer;
			background: var(--ytse-chip); color: var(--ytse-text);
		}
		.btn:hover:not(:disabled) { background: var(--ytse-chip-hover); }
		.btn.primary { background: var(--ytse-primary-bg); color: var(--ytse-primary-fg); }
		.btn.primary:hover:not(:disabled) { background: var(--ytse-primary-hover); }
		.btn.text { background: transparent; color: var(--ytse-accent); }
		.btn.text:hover:not(:disabled) { background: var(--ytse-accent-soft); }
		.btn.danger { color: var(--ytse-error); }
		.btn.small { height: 32px; padding: 0 12px; line-height: 32px; border-radius: 16px; }
		.btn:disabled { cursor: default; background: var(--ytse-chip); color: var(--ytse-text-3); }
		.btn:focus-visible, .icon-btn:focus-visible { outline: 2px solid var(--ytse-accent); outline-offset: 2px; }
		.icon-btn {
			display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
			width: 40px; height: 40px; padding: 0; border: 0; border-radius: 50%;
			background: transparent; color: var(--ytse-text); cursor: pointer;
		}
		.icon-btn:hover { background: var(--ytse-chip-hover); }
		.icon-btn svg { width: 24px; height: 24px; }
		.field {
			width: 100%; min-width: 0; height: 40px; padding: 0 12px;
			font-family: var(--ytse-font); font-size: 14px; color: var(--ytse-text);
			background: var(--ytse-bg); border: 1px solid var(--ytse-field-border); border-radius: 8px; outline: none;
		}
		.field::placeholder { color: var(--ytse-text-3); }
		.field:focus { border-color: var(--ytse-accent); box-shadow: inset 0 0 0 1px var(--ytse-accent); }
		.field:disabled { color: var(--ytse-text-3); }
		select.field { width: auto; max-width: 190px; height: 36px; padding: 0 8px; cursor: pointer; }
		.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
		.msg { margin-top: 8px; font-size: 12px; line-height: 16px; color: var(--ytse-text-2); }
		.msg:empty { display: none; }
		.msg.err { color: var(--ytse-error); }
		.msg.ok { color: var(--ytse-success); }
		.channel-name { font-size: 16px; line-height: 22px; font-weight: 500; overflow-wrap: anywhere; }
		.channel-name .handle { margin-inline-start: 6px; font-size: 13px; font-weight: 400; color: var(--ytse-text-2); }
		.stat { display: flex; align-items: center; gap: 6px; margin: 4px 0 12px; font-size: 12px; line-height: 16px; color: var(--ytse-text-2); }
		.dot { flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: var(--ytse-text-3); }
		.dot.on { background: var(--ytse-error); }
		.settings { display: flex; flex-direction: column; }
		.setting {
			display: flex; align-items: center; justify-content: space-between; gap: 16px;
			padding: 10px 0; border-bottom: 1px solid var(--ytse-outline);
		}
		.setting:last-child { border-bottom: 0; }
		.setting .label { font-size: 14px; line-height: 20px; }
		.setting .hint { font-size: 12px; line-height: 16px; color: var(--ytse-text-2); }
		.setting.disabled .label, .setting.disabled .hint { color: var(--ytse-text-3); }
		.switch { position: relative; flex: 0 0 auto; width: 36px; height: 20px; cursor: pointer; }
		.switch input { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
		.switch .bar {
			position: absolute; top: 3px; left: 0; right: 0; height: 14px; border-radius: 7px;
			background: var(--ytse-toggle-bar); transition: background 0.15s;
		}
		.switch .knob {
			position: absolute; top: 0; left: 0; width: 20px; height: 20px; border-radius: 50%;
			background: var(--ytse-toggle-knob); box-shadow: 0 1px 5px rgba(0, 0, 0, 0.4);
			transition: transform 0.15s, background 0.15s;
		}
		.switch input:checked ~ .bar { background: var(--ytse-accent); opacity: 0.5; }
		.switch input:checked ~ .knob { transform: translateX(16px); background: var(--ytse-accent); }
		.switch input:disabled { cursor: default; }
		.switch input:disabled ~ .bar, .switch input:disabled ~ .knob { opacity: 0.4; }
		.switch input:focus-visible ~ .knob { outline: 2px solid var(--ytse-accent); outline-offset: 2px; }
		[dir="rtl"] .switch input:checked ~ .knob { transform: translateX(-16px); }
		[dir="rtl"] .switch .knob { left: auto; right: 0; }
		.tag {
			display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: 4px;
			background: var(--ytse-chip); color: var(--ytse-text-2); font-size: 12px; font-weight: 500;
		}
	`;

	const bound = new Set();
	let dark = false;

	function style(...css) {
		const s = document.createElement("style");
		s.textContent = css.join("\n");
		return s;
	}

	function apply(el) {
		el.classList.add("ytse-theme");
		el.classList.toggle("dark", dark);
		if (!el.hasAttribute("data-fixed-dir")) el.setAttribute("dir", YTSE.i18n.dir());
		el.setAttribute("lang", YTSE.i18n.locale());
		if (el.isConnected) el.__ytseSeen = true;
	}

	function bindTheme(el) {
		bound.add(el);
		apply(el);
		return el;
	}

	function refresh() {
		for (const el of bound) {
			if (!el.isConnected && el.__ytseSeen) {
				bound.delete(el);
				continue;
			}
			apply(el);
		}
	}

	function setDark(v) {
		dark = !!v;
		refresh();
	}

	function watchYouTubeTheme(onChange) {
		const read = () => document.documentElement.hasAttribute("dark");
		dark = read();
		refresh();
		YTSE.life.observer(() => {
			const v = read();
			if (v === dark) return;
			dark = v;
			refresh();
			onChange?.(v);
		}).observe(document.documentElement, { attributes: true, attributeFilter: ["dark"] });
		onChange?.(dark);
	}

	YTSE.ui = { PALETTE, BASE, style, bindTheme, refresh, setDark, isDark: () => dark, watchYouTubeTheme };
})();
