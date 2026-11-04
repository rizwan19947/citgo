#!/usr/bin/env node
/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { buildContext, checksFor, pickSite, runChecks, type Command } from "../assertions/index.mts";
import { renderJson, renderText } from "./report.mts";

/*
 * The VIP tools' command, run two ways:
 *
 *   npm run doctor     checks a headless site's settings and its dotCMS connection, before deploy
 *   npm run watchdog   checks a running site: dotCMS, the image proxy, its key pages, and its newest
 *                      detail pages and their images. One site per run (D12)
 *
 *   npm run doctor -- --json
 *   npm run watchdog -- --base-url https://www.example.com
 *   npm run watchdog -- --base-url http://localhost:3000             # the site your env files pin
 *   npm run watchdog -- --base-url https://preview.example.dev --site www.example.com
 *
 * Runs on plain Node with nothing to install: Node strips the types and loads the env files
 * itself. Works with any host and any CI, because it's just a command. Exits non-zero when any
 * error-severity check fails, so it can gate a pipeline as it is.
 */

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
		return process.argv[i + 1];
	}
	return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

// Load the env files Next would load, in Next's order. process.loadEnvFile never overwrites a value
// that's already set, so the first file to set a value wins and real environment variables beat
// every file — Next's precedence. Unlike Next, $VAR references aren't expanded.
const mode = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" ? process.env.NODE_ENV : "production";
const envFiles = [`.env.${mode}.local`, mode === "test" ? undefined : ".env.local", `.env.${mode}`, ".env"];
for (const file of envFiles) {
	if (!file) continue;
	try {
		process.loadEnvFile(file);
	} catch {
		// Absent or unreadable — the required-settings check reports anything actually missing.
	}
}

/** Says why the run can't start, and returns the exit code. */
function stop(message: string): number {
	process.stderr.write(`${message}\n`);
	return 1;
}

async function main(command: Command): Promise<number> {
	const baseUrl = arg("base-url");
	const ctx = buildContext({ baseUrl });
	let site: string | undefined;

	if (command === "watchdog") {
		if (!baseUrl) return stop("The watchdog needs the running site's address: npm run watchdog -- --base-url https://…");
		const picked = pickSite(ctx, baseUrl, arg("site"));
		if (picked instanceof Error) return stop(picked.message);
		// One site per run (D12).
		ctx.sites = [picked];
		site = picked.hostname;
	} else if (baseUrl) {
		return stop(`The doctor doesn't check running sites. Use the watchdog: npm run watchdog -- --base-url ${baseUrl}`);
	}

	const summary = await runChecks(ctx, checksFor(command));
	const run = { command, site, baseUrl };
	process.stdout.write(process.argv.includes("--json") ? `${renderJson(summary, run)}\n` : renderText(summary, run));
	return summary.errors > 0 ? 1 : 0;
}

// Set the exit code rather than calling process.exit(), which can cut off output still being
// written to a pipe.
process.exitCode = await main(process.argv.includes("--watchdog") ? "watchdog" : "doctor");
