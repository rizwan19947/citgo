/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { RunSummary } from "../assertions/index.mts";
import { checkLabels } from "../assertions/index.mts";

/* Shared formatter. `--json` feeds CI and the watchdog; the text form is for humans. */

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string, s: string) => (COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s: string) => paint("2", s);
const bold = (s: string) => paint("1", s);
const red = (s: string) => paint("31", s);
const yellow = (s: string) => paint("33", s);
const green = (s: string) => paint("32", s);

export function renderText(summary: RunSummary): string {
	const lines: string[] = ["", bold("  Headless Doctor"), ""];

	for (const r of summary.results) {
		const label = checkLabels[r.id] ?? r.id;
		const mark = r.skipped
			? dim("-")
			: r.ok
				? green("PASS")
				: r.severity === "warn"
					? yellow("WARN")
					: red("FAIL");
		lines.push(`  ${mark.padEnd(COLOR ? 15 : 4)} ${label}`);
		lines.push(`       ${dim(r.id.padEnd(30))} ${r.skipped ? dim(r.message) : r.message}`);
		if (!r.ok && r.detail) lines.push(`       ${dim(JSON.stringify(r.detail))}`);
		lines.push("");
	}

	const parts = [
		`${summary.passed} passed`,
		summary.warnings ? yellow(`${summary.warnings} warning${summary.warnings > 1 ? "s" : ""}`) : "",
		summary.errors ? red(`${summary.errors} error${summary.errors > 1 ? "s" : ""}`) : "",
		summary.skipped ? dim(`${summary.skipped} skipped`) : "",
	].filter(Boolean);

	lines.push(`  ${parts.join(dim(" | "))} ${dim(`in ${summary.durationMs}ms`)}`, "");
	return lines.join("\n");
}

export function renderJson(summary: RunSummary): string {
	return JSON.stringify(
		{
			status: summary.worst,
			passed: summary.passed,
			warnings: summary.warnings,
			errors: summary.errors,
			skipped: summary.skipped,
			durationMs: summary.durationMs,
			results: summary.results.map((r) => ({ ...r, label: checkLabels[r.id] ?? r.id })),
		},
		null,
		2,
	);
}
