/*
 * Reusable hero banner with the CITGO red triangle background.
 * Used on static pages (archives, search) and as a fallback in the Banner content type.
 */

interface HeroBannerProps {
	title: string;
	volumeTitle?: string;
	titleSlot?: React.ReactNode;
}

export function TriangleBackground() {
	return (
		<div className="absolute inset-0 overflow-hidden bg-[#C8102E] w-screen">
			<svg
				className="absolute inset-0 h-full w-full"
				viewBox="0 0 1440 375"
				preserveAspectRatio="none"
			>
				<polygon points="0,375 350,375 1440,0 0,0" fill="#A00D24" />
			</svg>
			<svg
				className="absolute inset-0 h-full w-full"
				viewBox="0 0 1440 375"
				preserveAspectRatio="none"
			>
				<polygon points="1440,375 900,0 1440,0" fill="#8B0A1E" />
			</svg>
		</div>
	);
}

export function DefaultHeroBanner({
	title,
	volumeTitle,
	titleSlot,
}: HeroBannerProps) {
	return (
		<div className="relative w-screen py-16 md:py-20 px-8">
			<TriangleBackground />
			<div className="relative z-10 flex items-center justify-center">
				<h1 className="text-base font-bold text-center text-white uppercase">
					{volumeTitle}
				</h1>
			</div>
			<br />
			<div className="relative z-10 flex items-center justify-center">
				<h1 className="text-4xl font-bold text-center text-white md:text-5xl">
					{titleSlot ?? title}
				</h1>
			</div>
		</div>
	);
}
