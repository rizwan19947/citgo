#!/usr/bin/env node
/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { buildContext, runChecks } from "../assertions/index.mts";
import { renderJson, renderText } from "./report.mts";

/*
 * `npm run doctor` — validates that a headless deployment is wired correctly.
 *
 * Runs on plain Node; no tsx and no dotenv, because the runtime strips the types and loads .env
 * itself. Host- and CI-agnostic by design — this CLI is the product, and any scheduler that can
 * run a command can run it.
 *
 *   npm run doctor
 *   npm run doctor -- --json
 *   npm run doctor -- --base-url https://staging.example.com   # adds the /dA proxy checks
 *   VIP_CACHE=1 npm run doctor                                 # cache reads while iterating
 *
 * Exits non-zero when any error-severity check fails, so it gates a pipeline as-is.
 */

function arg(name: string): string | undefined {
	const i = process.argv.indexOf(`--${name}`);
	if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
		return process.argv[i + 1];
	}
	return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
}

// Next loads .env automatically; a plain Node process does not.
for (const file of [".env.local", ".env"]) {
	try {
		process.loadEnvFile(file);
	} catch {
		// Absent or unreadable — the required-vars check reports anything actually missing.
	}
}

const ctx = buildContext({ baseUrl: arg("base-url"), cache: process.env.VIP_CACHE === "1" });
const summary = await runChecks(ctx);

process.stdout.write(process.argv.includes("--json") ? `${renderJson(summary)}\n` : renderText(summary));
process.exit(summary.errors > 0 ? 1 : 0);
