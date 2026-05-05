/*
 * Custom image loader for Next.js <Image> — routes image requests through
 * the DotCMS asset API (/dA/) which supports on-the-fly resizing.
 * Pass this as the `loader` prop on <Image> for any DotCMS-hosted image.
 * The width parameter maps to DotCMS's /{width}w resizing suffix.
 */
const ImageLoader = ({ src, width = 250 }: { src: string; width: number }) => {
  const dotcmsURL = new URL(process.env.NEXT_PUBLIC_DOTCMS_HOST as string)
    .origin;
  /* If src already contains /dA/ it's a full asset path; otherwise prepend it. */
  const imageSRC = src.includes("/dA/") ? src : `/dA/${src}`;
  return `${dotcmsURL}${imageSRC}/${width}w`;
};

export default ImageLoader;
