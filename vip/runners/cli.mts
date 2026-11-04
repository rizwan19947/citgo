#!/usr/bin/env node
/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { buildContext, runChecks } from "../assertions/index.mts";
import { renderJson, renderText } from "./report.mts";

/*
 * `npm run doctor` — checks that a headless site is set up correctly before it's deployed.
 *
 * Runs on plain Node with nothing to install: Node strips the types and loads the env files
 * itself. Works with any host and any CI, because it's just a command.
 *
 *   npm run doctor
 *   npm run doctor -- --json
 *   npm run doctor -- --base-url https://staging.example.com   # adds the image proxy checks
 *
 * Exits non-zero when any error-severity check fails, so it can gate a pipeline as it is.
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

const ctx = buildContext({ baseUrl: arg("base-url") });
const summary = await runChecks(ctx);

process.stdout.write(process.argv.includes("--json") ? `${renderJson(summary)}\n` : renderText(summary));
// Set the exit code rather than calling process.exit(), which can cut off output still being
// written to a pipe.
process.exitCode = summary.errors > 0 ? 1 : 0;
