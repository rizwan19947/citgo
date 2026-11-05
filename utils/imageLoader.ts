const MAX_WIDTH = 1920;

/*
 * One quality for every image and width. Resizing already keeps small images small, and they lose
 * detail fastest when compressed, so they get the same quality as large ones. Set it here, not on
 * each <Image>: the loader ignores the `quality` prop.
 *
 * Asking dotCMS for a quality makes it send WebP. Keep it that way: AVIF came out 27% larger in our
 * tests, and dotCMS turns it back into WebP as soon as a quality is set.
 */
const QUALITY = 60;

function getDotcmsImageURL({
	src,
	width,
	raw = false,
}: {
	src: string;
	width: number | null;
	raw?: boolean;
}) {
	if (!src || typeof src !== "string") return "";

	if (src.startsWith("http")) return src;

	const isDotcmsAsset = src.includes("/dA/");
	const imageSRC = isDotcmsAsset ? src : `/dA/${src}`;

	if (imageSRC.includes(".gif")) return imageSRC;
	if (imageSRC.includes(".svg")) return `${imageSRC}/100q`;

	if (raw) return imageSRC;

	if (width == null) return `${imageSRC}/${QUALITY}q`;

	const maxWidth = Math.min(width, MAX_WIDTH);
	return `${imageSRC}/${maxWidth}maxw/${QUALITY}q`;
}

function loadImageFromAsset({ src, width }: { src: string; width?: number }) {
	return `${src.trim()}${width ? "?w=" + width : ""}`;
}

function loadImageFromDotCMS({ src, width }: { src: string; width?: number }) {
	const normalizedWidth = width && width !== 0 ? Number(width) : null;
	const limitedWidth = normalizedWidth ? Math.min(normalizedWidth, MAX_WIDTH) : null;

	return getDotcmsImageURL({ src, width: limitedWidth });
}

const ImageLoader = ({ src, width }: { src: string; width: number; quality?: number }) => {
	const assetsRegex = /^\/assets\//;

	return assetsRegex.test(src)
		? loadImageFromAsset({ src, width })
		: loadImageFromDotCMS({ src, width });
};

export default ImageLoader;
