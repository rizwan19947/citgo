/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/*
 * Disk-caching fetch for local development.
 *
 * Ground rule: the dotCMS instance is the live dev environment and a token-bucket rate
 * limiter is active (x-dotratelimit-toks-max). Iterating on checks against it un-cached burns that
 * budget for everyone. First call goes to the network; repeats within the TTL are served from disk.
 *
 * Off by default. Enable with VIP_CACHE=1 while developing; never enable it in CI or the watchdog,
 * where a stale hit would mask a real regression.
 */

const TTL_MS = 10 * 60 * 1000;

interface CachedResponse {
	status: number;
	statusText: string;
	headers: [string, string][];
	bodyBase64: string;
	storedAt: number;
}

function cacheDir(): string {
	const dir = process.env.VIP_CACHE_DIR ?? join(tmpdir(), "vip-doctor-cache");
	mkdirSync(dir, { recursive: true });
	return dir;
}

function keyFor(url: string, init?: RequestInit): string {
	const method = (init?.method ?? "GET").toUpperCase();
	const body = typeof init?.body === "string" ? init.body : "";
	// The auth header is deliberately excluded from the key so the token never reaches disk.
	return createHash("sha256").update(`${method} ${url} ${body}`).digest("hex").slice(0, 32);
}

export function createCachedFetch(enabled: boolean): typeof fetch {
	if (!enabled) return fetch;

	return async function cachedFetch(input: RequestInfo | URL, init?: RequestInit) {
		const url = typeof input === "string" ? input : input.toString();
		const method = (init?.method ?? "GET").toUpperCase();

		// Only GET and the read-only _search POST are safe to replay.
		const cacheable = method === "GET" || url.includes("/api/content/_search");
		if (!cacheable) return fetch(input, init);

		const file = join(cacheDir(), `${keyFor(url, init)}.json`);

		if (existsSync(file)) {
			try {
				const hit = JSON.parse(readFileSync(file, "utf8")) as CachedResponse;
				if (Date.now() - hit.storedAt < TTL_MS) {
					return new Response(Buffer.from(hit.bodyBase64, "base64"), {
						status: hit.status,
						statusText: hit.statusText,
						headers: hit.headers,
					});
				}
			} catch {
				// Corrupt entry — fall through and refetch.
			}
		}

		const res = await fetch(input, init);
		const buf = Buffer.from(await res.clone().arrayBuffer());
		const entry: CachedResponse = {
			status: res.status,
			statusText: res.statusText,
			headers: [...res.headers.entries()],
			bodyBase64: buf.toString("base64"),
			storedAt: Date.now(),
		};
		try {
			writeFileSync(file, JSON.stringify(entry));
		} catch {
			// A cache write failure must never fail a check.
		}
		return res;
	};
}
