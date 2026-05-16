import { Inter } from "next/font/google";
import { getSiteConfig } from "@/utils/site-config";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import "./globals.css";

/*
 * Root layout — wraps every page in the app.
 * Renders the shared Header and Footer so individual pages don't need to.
 * Site config is resolved from the Host header / cookie (no searchParams needed).
 */
const inter = Inter({ subsets: ["latin"] });

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { assetSlug } = await getSiteConfig();

  return (
    <html lang="en">
      <body className={inter.className}>
        <Header assetSlug={assetSlug} />
        <main className="container mx-auto">
          {children}
        </main>
        <Footer assetSlug={assetSlug} />
      </body>
    </html>
  );
}
