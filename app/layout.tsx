import { Geist, Inter } from "next/font/google";
import { getSiteConfig } from "@/utils/site-config";
import { getFooterContent, getLatestIssue } from "@/utils/getDotCMSContent";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { UVEBodyClass } from "@/components/UVEBodyClass";
import { CookieBanner } from "@/components/CookieBanner";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

/*
 * Root layout — wraps every page in the app.
 * Renders the shared Header and Footer so individual pages don't need to.
 * Site config is resolved from the Host header / cookie (no searchParams needed).
 */
const inter = Inter({ subsets: ["latin"] });

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const { assetSlug, siteId, hostname } = await getSiteConfig();
	const [currentIssue, footerContentlet] = await Promise.all([
		await getLatestIssue(siteId),
		await getFooterContent(siteId),
	]);

	return (
		<html lang="en" className={cn("font-sans", geist.variable)}>
			<body className={inter.className}>
				<UVEBodyClass />
				<Header siteId={siteId} assetSlug={assetSlug} currentIssue={currentIssue} />
				<main>{children}</main>
				<Footer contentlet={footerContentlet} />
				<CookieBanner hostname={hostname} />
			</body>
		</html>
	);
}
