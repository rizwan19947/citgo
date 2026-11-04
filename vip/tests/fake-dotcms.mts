/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

/*
 * A fake dotCMS on localhost for the tests. It answers the read-only endpoints the checks call,
 * records every request, and can be reshaped per test through `state`. It also plays the running
 * site: it serves the site's pages and /dA images.
 */

export const SITE_ID = "0123456789abcdef0123456789abcdef";
export const SITE_INODE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

export interface FakeSite {
	identifier: string;
	inode: string;
	hostname: string;
}

export interface FakeState {
	token: string;
	dotcmsVersion: string;
	sites: FakeSite[];
	/** Live items by content type, then by site identifier. */
	content: Record<string, Record<string, Array<Record<string, unknown>>>>;
	/** Content type definitions by variable name. */
	contentTypes: Record<string, { urlMapPattern?: string; fields: Array<{ variable: string; clazz: string }> }>;
	/** Identifiers of published images. */
	liveAssets: string[];
	/** The running site's pages and the status each returns. Any other path returns 404. */
	pages: Record<string, number>;
}

export interface RecordedRequest {
	method: string;
	path: string;
	body: string;
}

export interface FakeDotcms {
	url: string;
	state: FakeState;
	requests: RecordedRequest[];
	/** Back to a correctly wired one-site setup, with no recorded requests. */
	reset(): void;
	close(): Promise<void>;
}

function defaultState(): FakeState {
	return {
		token: "good",
		dotcmsVersion: "26.08.19-04",
		sites: [{ identifier: SITE_ID, inode: SITE_INODE, hostname: "one.example" }],
		content: {
			Article: {
				[SITE_ID]: [
					{ identifier: "a1", title: "First", slug: "first", issueSlug: "issue-1", image: "img123", modDate: 1 },
				],
			},
		},
		contentTypes: {
			Article: {
				urlMapPattern: "/{issueSlug}/{slug}",
				fields: [
					{ variable: "title", clazz: "com.dotcms.contenttype.model.field.ImmutableTextField" },
					{ variable: "image", clazz: "com.dotcms.contenttype.model.field.ImmutableImageField" },
				],
			},
		},
		liveAssets: ["img123"],
		pages: { "/": 200, "/issue-1/first": 200 },
	};
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		req.on("data", (chunk) => (data += chunk));
		req.on("end", () => resolve(data));
	});
}

export async function startFakeDotcms(): Promise<FakeDotcms> {
	let state = defaultState();
	let requests: RecordedRequest[] = [];

	const server = createServer(async (req, res) => {
		const body = await readBody(req);
		const path = new URL(req.url ?? "/", "http://localhost").pathname;
		requests.push({ method: req.method ?? "GET", path, body });

		const json = (status: number, payload: unknown) => {
			res.writeHead(status, { "content-type": "application/json", "x-dotcms-version": state.dotcmsVersion });
			res.end(JSON.stringify(payload));
		};
		const results = (items: Array<Record<string, unknown>>, limit: number) =>
			json(200, { entity: { resultsSize: items.length, jsonObjectView: { contentlets: items.slice(0, limit) } } });

		// The running site: its image proxy and its pages are public, like the real ones.
		if (path.startsWith("/dA/")) {
			res.writeHead(200, { "content-type": "image/webp", "cache-control": "no-cache" });
			return res.end("fake image");
		}
		if (!path.startsWith("/api/")) {
			res.writeHead(state.pages[path] ?? 404, { "content-type": "text/html" });
			return res.end("<!doctype html><title>fake page</title>");
		}

		if (req.headers.authorization !== `Bearer ${state.token}`) return json(401, {});

		if (path === "/api/v1/appconfiguration") return json(200, { entity: {} });

		const siteLookup = path.match(/^\/api\/v1\/site\/(.+)$/);
		if (siteLookup) {
			const key = decodeURIComponent(siteLookup[1]);
			const site = state.sites.find((s) => s.identifier === key || s.inode === key);
			return site ? json(200, { entity: site }) : json(404, {});
		}

		const typeLookup = path.match(/^\/api\/v1\/contenttype\/id\/(.+)$/);
		if (typeLookup) {
			const variable = decodeURIComponent(typeLookup[1]);
			const type = state.contentTypes[variable];
			return type ? json(200, { entity: { variable, ...type } }) : json(404, {});
		}

		if (path === "/api/content/_search" && req.method === "POST") {
			const { query = "", limit = 10, sort } = JSON.parse(body || "{}");

			// Image lookups: +identifier:("id1" "id2" …) +live:true
			const ids = /\+identifier:\(([^)]*)\)/.exec(query);
			if (ids) {
				const wanted = [...ids[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
				return results(wanted.filter((id) => state.liveAssets.includes(id)).map((identifier) => ({ identifier })), limit);
			}

			const contentType = /\+contentType:(\S+)/.exec(query)?.[1] ?? "";
			const site = /\+conhost:(\S+)/.exec(query)?.[1] ?? "";
			const items = [...(state.content[contentType]?.[site] ?? [])];
			if (sort === "modDate desc") items.sort((a, b) => Number(b.modDate) - Number(a.modDate));
			return results(items, limit);
		}

		json(404, {});
	});

	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.address() as AddressInfo;

	return {
		url: `http://127.0.0.1:${port}`,
		get state() {
			return state;
		},
		get requests() {
			return requests;
		},
		reset() {
			state = defaultState();
			requests = [];
		},
		close() {
			server.closeAllConnections();
			return new Promise((resolve) => server.close(() => resolve()));
		},
	};
}
