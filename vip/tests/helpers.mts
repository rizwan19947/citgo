/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { after, before, beforeEach } from "node:test";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { allChecks, buildContext, checksFor, runChecks, type CheckResult, type Command } from "../assertions/index.mts";
import { SITE_ID, startFakeDotcms, type FakeDotcms } from "./fake-dotcms.mts";

/* Shared by the test files: the fake dotCMS, throwaway project folders, and ways to run the checks. */

export const VIP = join(dirname(fileURLToPath(import.meta.url)), "..");
export const CLI = join(VIP, "runners/cli.mts");
const exec = promisify(execFile);

/** The current test file's fake dotCMS, started by setUpFakeDotcms(). */
export let dotcms: FakeDotcms;
const tempDirs: string[] = [];

/** Starts a fake dotCMS for this test file, and resets it before each test. */
export function setUpFakeDotcms(): void {
	before(async () => {
		dotcms = await startFakeDotcms();
	});
	after(async () => {
		await dotcms.close();
		for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
	});
	beforeEach(() => dotcms.reset());
}

export interface RepoOptions {
	sdk?: string;
	baseline?: Record<string, string> | null;
	assetSlugs?: string[];
	files?: Record<string, string>;
}

/** A throwaway project folder holding the files the checks read. */
export function repo(options: RepoOptions = {}): string {
	const root = mkdtempSync(join(tmpdir(), "vip-tools-"));
	tempDirs.push(root);
	writeFileSync(
		join(root, "package-lock.json"),
		JSON.stringify({ packages: { "node_modules/@dotcms/client": { version: options.sdk ?? "1.4.0" } } }),
	);
	if (options.baseline !== null) {
		mkdirSync(join(root, "vip"));
		writeFileSync(
			join(root, "vip/baseline.json"),
			JSON.stringify(options.baseline ?? { sdk: "1.4.0", dotcms: "26.08.19-04" }),
		);
	}
	for (const slug of options.assetSlugs ?? ["one"]) mkdirSync(join(root, "public/assets", slug), { recursive: true });
	for (const [name, content] of Object.entries(options.files ?? {})) writeFileSync(join(root, name), content);
	return root;
}

/** Settings for a correctly wired one-site project, pointed at the fake dotCMS. */
export function env(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
	return {
		DOTCMS_HOST: dotcms.url,
		DOTCMS_AUTH_TOKEN: "good",
		DEFAULT_SITE_HOST: "one.example",
		SITE_1: `one.example|${SITE_ID}|one`,
		DETAIL_CONTENT_TYPE: "Article",
		...overrides,
	};
}

export const envFile = (settings: Record<string, string | undefined>) =>
	Object.entries(settings)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${value}`)
		.join("\n");

/** Runs one command's checks (or every check) in-process; returns the results by check id. */
export async function check(
	settings = env(),
	root = repo(),
	baseUrl?: string,
	command?: Command,
): Promise<Record<string, CheckResult>> {
	const ctx = buildContext({ env: settings, repoRoot: root, baseUrl });
	const summary = await runChecks(ctx, command ? checksFor(command) : allChecks);
	return Object.fromEntries(summary.results.map((r) => [r.id, r]));
}

export interface CliRun {
	code: number;
	/** The --json report; empty when the run stopped before checking anything. */
	report: { site?: string; results: CheckResult[] };
	stderr: string;
}

/** Runs the real command in `cwd` with no inherited environment, always with --json. */
export async function cli(cwd: string, extraEnv: Record<string, string> = {}, args: string[] = []): Promise<CliRun> {
	const parse = (stdout: string) => (stdout ? JSON.parse(stdout) : { results: [] });
	try {
		// Next's types make NODE_ENV required on ProcessEnv; this child deliberately starts without it.
		const { stdout, stderr } = await exec(process.execPath, [CLI, "--json", ...args], {
			cwd,
			env: extraEnv as NodeJS.ProcessEnv,
		});
		return { code: 0, report: parse(stdout), stderr };
	} catch (e) {
		const failure = e as { code: number; stdout: string; stderr: string };
		return { code: failure.code, report: parse(failure.stdout), stderr: failure.stderr };
	}
}
