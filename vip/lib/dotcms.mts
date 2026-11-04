/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { CheckContext } from "../assertions/types.mts";

/*
 * Read-only dotCMS helpers shared by the checks.
 *
 * Searches are built the way @dotcms/client 1.4.0 builds them for this app, so the checks see what
 * the app sees: one site (+conhost:{siteId}) and language 1, with languageId also sent in the
 * request body. The SDK only adds content shared by all sites (SYSTEM_HOST) when code calls
 * includeSystemHost(), and the app doesn't.
 */

const LANGUAGE_ID = 1;

/** Images are looked up this many identifiers per request. */
const ID_BATCH = 100;

export interface SearchResult {
	total: number;
	contentlets: Array<Record<string, unknown>>;
}

/** One request to dotCMS's content search. */
async function search(ctx: CheckContext, body: Record<string, unknown>): Promise<SearchResult> {
	const res = await ctx.fetch(`${ctx.dotcmsHost}/api/content/_search`, {
		method: "POST",
		headers: { Authorization: `Bearer ${ctx.authToken}`, "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`content search returned ${res.status}`);
	const json = await res.json();
	return {
		total: json?.entity?.resultsSize ?? 0,
		contentlets: json?.entity?.jsonObjectView?.contentlets ?? [],
	};
}

/** Live items of one content type on one site, up to `limit`, optionally sorted (e.g. "modDate desc"). */
export function searchLive(
	ctx: CheckContext,
	contentType: string,
	siteId: string,
	limit: number,
	sort?: string,
): Promise<SearchResult> {
	const query = `+contentType:${contentType} +languageId:${LANGUAGE_ID} +live:true +conhost:${siteId}`;
	// Like the SDK, send `sort` only when there is one: JSON.stringify drops it when undefined.
	return search(ctx, { query, sort, limit, offset: 0, languageId: LANGUAGE_ID });
}

/**
 * Which of these identifiers belong to published content, looked up ID_BATCH at a time. No site or
 * language limit: an image can live on another site, or be shared by all of them.
 */
export async function liveIdentifiers(ctx: CheckContext, ids: string[]): Promise<Set<string>> {
	const live = new Set<string>();
	for (let i = 0; i < ids.length; i += ID_BATCH) {
		const batch = ids.slice(i, i + ID_BATCH);
		// Quoted, so each value is looked up exactly as it is and can't break the query.
		const terms = batch.map((id) => `"${id.replace(/["\\]/g, "\\$&")}"`).join(" ");
		const { contentlets } = await search(ctx, {
			query: `+identifier:(${terms}) +live:true`,
			// Room for up to 10 language versions of each image.
			limit: batch.length * 10,
			offset: 0,
		});
		for (const c of contentlets) if (typeof c.identifier === "string") live.add(c.identifier);
	}
	return live;
}

/**
 * The bare identifier from an image field. Accepts the same shapes as utils/resolveImage.ts: the
 * identifier as text, or an object carrying `identifier` or `idPath` ("/dA/{id}/...").
 */
export function resolveImageId(field: unknown): string | undefined {
	if (typeof field === "string" && field.length > 0) return field;
	if (field && typeof field === "object") {
		const obj = field as Record<string, unknown>;
		if (typeof obj.identifier === "string" && obj.identifier) return obj.identifier;
		if (typeof obj.idPath === "string") return obj.idPath.replace(/^\/dA\//, "").split("/")[0] || undefined;
	}
	return undefined;
}

export interface ContentTypeDefinition {
	/** Variables of the type's image fields, e.g. ["image"]. */
	imageFields: string[];
	/** Where the type's items live on the site, e.g. "/{issueSlug}/{slug}". Unset when it has none. */
	urlMapPattern?: string;
}

const definitions = new WeakMap<CheckContext, Promise<ContentTypeDefinition | Error>>();

/**
 * The detail content type's definition, read once per run however many items there are: its image
 * fields, recognised by their `clazz` (e.g. com.dotcms.contenttype.model.field.ImmutableImageField),
 * and its URL map pattern.
 */
export function contentTypeDefinition(ctx: CheckContext): Promise<ContentTypeDefinition | Error> {
	let existing = definitions.get(ctx);
	if (existing) return existing;

	existing = (async () => {
		if (!ctx.detailContentType) return new Error("DETAIL_CONTENT_TYPE isn't set");
		try {
			const res = await ctx.fetch(
				`${ctx.dotcmsHost}/api/v1/contenttype/id/${encodeURIComponent(ctx.detailContentType)}`,
				{ headers: { Authorization: `Bearer ${ctx.authToken}` } },
			);
			if (!res.ok) return new Error(`content type lookup for ${ctx.detailContentType} returned ${res.status}`);
			const body = await res.json();
			const type = body?.entity ?? body;
			const fields: Array<Record<string, unknown>> = Array.isArray(type?.fields) ? type.fields : [];
			const pattern = typeof type?.urlMapPattern === "string" ? type.urlMapPattern.trim() : "";
			return {
				imageFields: fields
					.filter((f) => typeof f.clazz === "string" && f.clazz.endsWith("ImageField"))
					.map((f) => String(f.variable)),
				urlMapPattern: pattern || undefined,
			};
		} catch (e) {
			return e instanceof Error ? e : new Error(String(e));
		}
	})();

	definitions.set(ctx, existing);
	return existing;
}
