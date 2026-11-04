/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

/*
 * A fake dotCMS on localhost for the doctor's tests. It answers the read-only endpoints the checks
 * call, records every request, and can be reshaped per test through `state`. It also serves /dA
 * images, so it doubles as the running site for the proxy checks.
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
	contentTypes: Record<string, { fields: Array<{ variable: string; clazz: string }> }>;
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
		content: { Article: { [SITE_ID]: [{ title: "First", image: "img123" }] } },
		contentTypes: {
			Article: {
				fields: [
					{ variable: "title", clazz: "com.dotcms.contenttype.model.field.ImmutableTextField" },
					{ variable: "image", clazz: "com.dotcms.contenttype.model.field.ImmutableImageField" },
				],
			},
		},
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

		// The running site's image proxy: public, like the real one.
		if (path.startsWith("/dA/")) {
			res.writeHead(200, { "content-type": "image/webp", "cache-control": "no-cache" });
			return res.end("fake image");
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
			const { query = "", limit = 10 } = JSON.parse(body || "{}");
			const contentType = /\+contentType:(\S+)/.exec(query)?.[1] ?? "";
			const site = /\+conhost:(\S+)/.exec(query)?.[1] ?? "";
			const items = state.content[contentType]?.[site] ?? [];
			return json(200, {
				entity: { resultsSize: items.length, jsonObjectView: { contentlets: items.slice(0, limit) } },
			});
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
