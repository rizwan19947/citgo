import type { Metadata } from "next";
import localFont from "next/font/local";
import { getSiteConfig } from "@/utils/site-config";
import { getFooterContent, getLatestIssue } from "@/utils/getDotCMSContent";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { UVEBodyClass } from "@/components/UVEBodyClass";
import { CookieBanner } from "@/components/CookieBanner";
import "./globals.css";
import { cn } from "@/lib/utils";

// Univers LT Std — self-hosted
const univers = localFont({
	src: [
		{ path: "./fonts/univers/UniversLTStd-Light.woff2", weight: "300", style: "normal" },
		{ path: "./fonts/univers/UniversLTStd.woff2", weight: "400", style: "normal" },
		{ path: "./fonts/univers/UniversLTStd-Obl.woff2", weight: "400", style: "italic" },
		{ path: "./fonts/univers/UniversLTStd-Bold.woff2", weight: "700", style: "normal" },
		{ path: "./fonts/univers/UniversLTStd-BoldObl.woff2", weight: "700", style: "italic" },
		{ path: "./fonts/univers/UniversLTStd-Black.woff2", weight: "900", style: "normal" },
		{ path: "./fonts/univers/UniversLTStd-BlackObl.woff2", weight: "900", style: "italic" },
	],
	variable: "--font-sans",
	display: "swap",
});

/*
 * Root layout — wraps every page in the app.
 * Renders the shared Header and Footer so individual pages don't need to.
 * Site config is resolved from the Host header / cookie (no searchParams needed).
 */

// Layouts don't receive searchParams; getSiteConfig() resolves via override/host/cookie.
export async function generateMetadata(): Promise<Metadata> {
	const { hostname } = await getSiteConfig();

	// Sites are not indexed by default - the env file should have a flag to set it to true
	const indexable = process.env.SITE_INDEXING === "true";

	return {
		metadataBase: new URL(`https://${hostname}`),
		title: {
			template: "%s | CITGO",
			default: "CITGO",
		},
		...(indexable ? {} : { robots: { index: false, follow: false } }),
	};
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const { assetSlug, siteId, hostname } = await getSiteConfig();
	const [currentIssue, footerContentlet] = await Promise.all([
		await getLatestIssue(siteId),
		await getFooterContent(siteId),
	]);

	return (
		<html lang="en" className={cn("font-sans", univers.variable)}>
			<body className="font-sans">
				<UVEBodyClass />
				<Header siteId={siteId} assetSlug={assetSlug} currentIssue={currentIssue} />
				<main className="px-6 md:px-0 [&_[data-full-bleed]]:-mx-6 [&_[data-full-bleed]]:md:mx-0">
					{children}
				</main>
				<Footer contentlet={footerContentlet} />
				<CookieBanner hostname={hostname} />
			</body>
		</html>
	);
}
