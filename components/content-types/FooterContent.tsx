import { DotCMSBlockEditorRenderer } from "@dotcms/react";
import type { FooterContentContentlet } from "@/types/content-types";

export default function FooterContent({ title, content, showNewsletterLinks }: FooterContentContentlet) {
	const showLinks = showNewsletterLinks === true || showNewsletterLinks === "true";

	return (
		<div data-component="FooterContent">
			{title && <h3 className="mb-4 text-base font-bold">{title}</h3>}
			{content && (
				<div className="prose prose-sm max-w-none">
					<DotCMSBlockEditorRenderer blocks={content} />
				</div>
			)}
			{showLinks && (
				<div className="mt-6">{/* Newsletter site links rendered here when enabled */}</div>
			)}
		</div>
	);
}
