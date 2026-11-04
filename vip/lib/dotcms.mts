/* Node type-stripping: erasable syntax only — no enum, namespace, or parameter properties. See assertions/types.mts. */
import type { CheckContext } from "../assertions/types.mts";

/*
 * Read-only dotCMS helpers shared by the checks.
 *
 * Searches are built the way @dotcms/client 1.4.0 builds them for this app, so the doctor sees what
 * the app sees: one site (+conhost:{siteId}) and language 1, with languageId also sent in the
 * request body. The SDK only adds content shared by all sites (SYSTEM_HOST) when code calls
 * includeSystemHost(), and the app doesn't.
 */

const LANGUAGE_ID = 1;

export interface SearchResult {
	total: number;
	contentlets: Array<Record<string, unknown>>;
}

/** Live items of one content type on one site, up to `limit`. */
export async function searchLive(
	ctx: CheckContext,
	contentType: string,
	siteId: string,
	limit: number,
): Promise<SearchResult> {
	const query = `+contentType:${contentType} +languageId:${LANGUAGE_ID} +live:true +conhost:${siteId}`;
	const res = await ctx.fetch(`${ctx.dotcmsHost}/api/content/_search`, {
		method: "POST",
		headers: { Authorization: `Bearer ${ctx.authToken}`, "Content-Type": "application/json" },
		body: JSON.stringify({ query, limit, offset: 0, languageId: LANGUAGE_ID }),
	});
	if (!res.ok) throw new Error(`content search returned ${res.status}`);
	const body = await res.json();
	return {
		total: body?.entity?.resultsSize ?? 0,
		contentlets: body?.entity?.jsonObjectView?.contentlets ?? [],
	};
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
}

const definitions = new WeakMap<CheckContext, Promise<ContentTypeDefinition | Error>>();

/**
 * The detail content type's definition, read once per run however many items there are. Image
 * fields are recognised by their `clazz`, e.g. com.dotcms.contenttype.model.field.ImmutableImageField.
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
			return {
				imageFields: fields
					.filter((f) => typeof f.clazz === "string" && f.clazz.endsWith("ImageField"))
					.map((f) => String(f.variable)),
			};
		} catch (e) {
			return e instanceof Error ? e : new Error(String(e));
		}
	})();

	definitions.set(ctx, existing);
	return existing;
}
