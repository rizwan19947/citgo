export function resolveImage(field: unknown): string | undefined {
	if (typeof field === "string" && field.length > 0) return field;
	if (field && typeof field === "object") {
		const obj = field as Record<string, unknown>;
		if ("idPath" in obj && typeof obj.idPath === "string") return obj.idPath;
		if ("identifier" in obj && typeof obj.identifier === "string") return obj.identifier;
	}
	return undefined;
}
