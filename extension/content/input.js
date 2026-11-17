(() => {
	const FIELD = "yt-live-chat-text-input-field-renderer";
	const MAX_CHARS = 200;

	let lastRange = null;

	function findInput(from) {
		const el = from instanceof Element ? from : from?.parentElement ?? null;
		const host = el?.closest(FIELD);
		if (!host) return null;
		return host.querySelector("#input[contenteditable]") || (el.isContentEditable ? el : null);
	}

	function field() {
		const inputs = document.querySelectorAll(`${FIELD} #input[contenteditable]`);
		for (const input of inputs) if (input.getClientRects().length) return input;
		return inputs[0] || null;
	}

	function activeInput() {
		const a = document.activeElement;
		const input = a ? findInput(a) : null;
		return input && input.contains(a) ? input : null;
	}

	function count(input) {
		if (!input) return 0;
		let n = 0;
		const walk = (node) => {
			for (const c of node.childNodes) {
				if (c.nodeType === Node.TEXT_NODE) n += c.data.length;
				else if (c.nodeName === "IMG") n += (c.alt || "").length;
				else if (c.nodeType === Node.ELEMENT_NODE && c.nodeName !== "BR") walk(c);
			}
		};
		walk(input);
		return n;
	}

	function isOver(input) {
		if (!input) return false;
		const overflow = input.querySelector("#overflow-text");
		return (!!overflow && overflow.textContent.length > 0) || count(input) > MAX_CHARS;
	}

	function rememberSelection() {
		const sel = document.getSelection();
		if (!sel || !sel.rangeCount) return;
		const r = sel.getRangeAt(0);
		if (findInput(r.startContainer)) lastRange = r.cloneRange();
	}

	function placeCaret(input) {
		const sel = document.getSelection();
		if (lastRange && input.contains(lastRange.startContainer) && input.contains(lastRange.endContainer)) {
			sel.removeAllRanges();
			sel.addRange(lastRange.cloneRange());
			return;
		}
		const r = document.createRange();
		r.selectNodeContents(input);
		r.collapse(false);
		sel.removeAllRanges();
		sel.addRange(r);
	}

	function textBeforeCaret(input) {
		const sel = document.getSelection();
		if (!sel.rangeCount) return "";
		const r = sel.getRangeAt(0);
		const pre = document.createRange();
		pre.selectNodeContents(input);
		pre.setEnd(r.startContainer, r.startOffset);
		return pre.toString();
	}

	function insertText(input, text) {
		const doc = input.ownerDocument;
		let ok = false;
		try {
			ok = doc.execCommand("insertText", false, text);
		} catch {
			ok = false;
		}
		if (ok) return;
		const sel = doc.getSelection();
		const r = sel.getRangeAt(0);
		r.deleteContents();
		const node = doc.createTextNode(text);
		r.insertNode(node);
		r.setStartAfter(node);
		r.collapse(true);
		sel.removeAllRanges();
		sel.addRange(r);
		input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
	}

	function insertToken(token) {
		const input = field();
		if (!input) return false;
		input.focus();
		placeCaret(input);
		const before = textBeforeCaret(input);
		const last = before.slice(-1);
		const text = (last && !/\s/.test(last) ? " " : "") + token + " ";
		const selected = document.getSelection().toString().length;
		if (!YTSE.guard.allows(text.length - selected, input)) return false;
		insertText(input, text);
		rememberSelection();
		return true;
	}

	YTSE.life.on(document, "selectionchange", rememberSelection);

	YTSE.input = { MAX_CHARS, findInput, field, activeInput, count, isOver, insertText, insertToken };
})();
