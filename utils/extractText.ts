/**
 * Extracts plain text from a ProseMirror/Block Editor JSON node.
 * Recursively walks the document tree and concatenates all text content.
 */
export function extractText(node: unknown): string {
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
