/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { CheckContext } from "../assertions/types.mts";

/*
 * Requests to the running site, shared by the watchdog's checks. Each one gives up after
 * SITE_TIMEOUT_MS, and network failures are explained in words.
 */

/** How long the watchdog waits for one page or image from the running site. */
export const SITE_TIMEOUT_MS = 30_000;

/** One request to the running site. */
export function fetchSite(ctx: CheckContext, url: string): Promise<Response> {
	return ctx.fetch(url, { signal: AbortSignal.timeout(SITE_TIMEOUT_MS) });
}

/** Plain words for the network errors people meet most. */
const PLAIN: Record<string, string> = {
	ECONNREFUSED: "nothing is answering at that address",
	ENOTFOUND: "that address doesn't exist",
	ECONNRESET: "the connection was dropped",
};

/** Why a request failed. fetch reports every network error as "fetch failed"; its cause says why. */
export function whyFailed(e: unknown): string {
	if (!(e instanceof Error)) return String(e);
	if (e.name === "TimeoutError") return `no answer within ${SITE_TIMEOUT_MS / 1000} s`;
	const cause = (e as { cause?: { code?: string; message?: string } }).cause;
	if (cause?.code) return PLAIN[cause.code] ? `${PLAIN[cause.code]} (${cause.code})` : cause.code;
	return cause?.message ?? e.message;
}
