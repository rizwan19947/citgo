/**
 * Extracts plain text from a ProseMirror/Block Editor JSON node.
 * Recursively walks the document tree and concatenates all text content.
 */
export function extractText(node: unknown): string {
	// Migrated articles store their body as a markdown string (until first UVE save).
	if (typeof node === "string") return stripMarkdown(node);
	if (!node || typeof node !== "object") return "";

	const n = node as Record<string, unknown>;

	if (n.type === "text" && typeof n.text === "string") {
		return n.text;
	}

	if (Array.isArray(n.content)) {
		return n.content
			.map((child) => extractText(child))
			.join(" ")
			.replace(/\s+/g, " ");
	}

	return "";
}

/**
 * Lightweight markdown -> plain text for search snippets only (NOT a full parser).
 * Migrated article bodies are stored as a markdown string; this removes the common
 * syntax so extractSnippet has readable text to window around. The actual search
 * match runs server-side against the raw string, so this is display-only.
 */
function stripMarkdown(md: string): string {
	return md
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images ![alt](url) -> removed
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links [text](url) -> text
		.replace(/`+/g, "") // inline code / code-fence backticks
		.replace(/[*_]{1,3}/g, "") // bold/italic markers
		.replace(/^#{1,6}\s+/gm, "") // ATX headings
		.replace(/^\s{0,3}>\s?/gm, "") // blockquote markers
		.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "") // list bullets / ordered markers
		.replace(/\s+/g, " ") // collapse whitespace + newlines
		.trim();
}

/**
 * Extracts a snippet of text around the first occurrence of a query term.
 * Returns ~300 chars of context around the match.
 */
export function extractSnippet(text: string, query: string, maxLength = 300): string {
	if (!text || !query) return text?.slice(0, maxLength) ?? "";

	const lower = text.toLowerCase();
	const idx = lower.indexOf(query.toLowerCase());

	if (idx === -1) return text.slice(0, maxLength) + (text.length > maxLength ? "..." : "");

	const start = Math.max(0, idx - 100);
	const end = Math.min(text.length, idx + query.length + 200);
	let snippet = text.slice(start, end);

	if (start > 0) snippet = "..." + snippet;
	if (end < text.length) snippet = snippet + "...";

	return snippet;
}
