import { Inter } from "next/font/google";
import "./globals.css";

/*
 * Root layout — wraps every page in the app.
 * Sets the Inter font and applies global CSS.
 * Any UI added here (e.g. a toast provider) will appear on all routes.
 */
const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
