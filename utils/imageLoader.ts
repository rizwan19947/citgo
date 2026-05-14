const MAX_WIDTH = 1920;
const DEFAULT_QUALITY = 75;
const FORCE_QUALITY = 95;

const WIDTH_XS = 375;
const WIDTH_SM = 640;
const WIDTH_MD = 768;
const WIDTH_LG = 1024;

const QUALITY_DIVISOR_XS = 3;
const QUALITY_DIVISOR_SM = 2.5;
const QUALITY_DIVISOR_MD = 2;
const QUALITY_DIVISOR_LG = 1.5;

function getDotcmsImageURL({
	src,
	width,
	quality,
	raw = false,
}: {
	src: string;
	width: number | null;
	quality: number;
	raw?: boolean;
}) {
	if (!src || typeof src !== "string") return "";

	if (src.startsWith("http")) return src;

	const isDotcmsAsset = src.includes("/dA/");
	const imageSRC = isDotcmsAsset ? src : `/dA/${src}`;

	if (imageSRC.includes(".gif")) return imageSRC;
	if (imageSRC.includes(".svg")) return `${imageSRC}/100q`;

	if (raw) return imageSRC;

	if (width == null) return `${imageSRC}/${quality || DEFAULT_QUALITY}q`;

	const maxWidth = Math.min(width, MAX_WIDTH);
	return `${imageSRC}/${maxWidth}maxw/${quality || DEFAULT_QUALITY}q`;
}

function getAdaptiveQuality(width: number | null, baseQuality: number) {
	if (!width) return baseQuality;
	if (width <= WIDTH_XS) return Math.floor(baseQuality / QUALITY_DIVISOR_XS);
	if (width <= WIDTH_SM) return Math.floor(baseQuality / QUALITY_DIVISOR_SM);
	if (width <= WIDTH_MD) return Math.floor(baseQuality / QUALITY_DIVISOR_MD);
	if (width <= WIDTH_LG) return Math.floor(baseQuality / QUALITY_DIVISOR_LG);
	return baseQuality;
}

function loadImageFromAsset({ src, width }: { src: string; width?: number }) {
	return `${src.trim()}${width ? "?w=" + width : ""}`;
}

function loadImageFromDotCMS({
	src,
	width,
	quality,
	forceHighQuality,
}: {
	src: string;
	width?: number;
	quality?: number;
	forceHighQuality?: boolean;
}) {
	const normalizedWidth = width && width !== 0 ? Number(width) : null;
	const limitedWidth = normalizedWidth ? Math.min(normalizedWidth, MAX_WIDTH) : null;

	const finalQuality = forceHighQuality
		? FORCE_QUALITY
		: getAdaptiveQuality(limitedWidth, quality ?? DEFAULT_QUALITY);

	return getDotcmsImageURL({ src, width: limitedWidth, quality: finalQuality });
}

const ImageLoader = ({ src, width, quality }: { src: string; width: number; quality?: number }) => {
	const assetsRegex = /^\/assets\//;

	const shouldForceHighQuality = quality === 101;
	const normalizedQuality = quality === 101 ? undefined : quality;

	return assetsRegex.test(src)
		? loadImageFromAsset({ src, width })
		: loadImageFromDotCMS({
				src,
				width,
				quality: normalizedQuality,
				forceHighQuality: shouldForceHighQuality,
			});
};

export default ImageLoader;
