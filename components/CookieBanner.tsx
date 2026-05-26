"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CookieBannerProps {
	hostname: string;
}

export function CookieBanner({ hostname }: CookieBannerProps) {
	const COOKIE_KEY = `citgo-cookie-consent-${hostname}`;
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const isInUVE = window.parent !== window;
		if (isInUVE) return;
		if (!localStorage.getItem(COOKIE_KEY)) {
			const timer = setTimeout(() => setVisible(true), 500);
			return () => clearTimeout(timer);
		}
	}, []);

	const handleAccept = () => {
		localStorage.setItem(COOKIE_KEY, "accepted");
		setVisible(false);
	};

	return (
		<div
			className={`fixed bottom-0 left-0 right-0 z-50 bg-black text-white transition-transform duration-500 ease-in-out ${
				visible ? "translate-y-0" : "translate-y-full"
			}`}
		>
			<div className="mx-auto max-w-[100rem] px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<p className="text-sm leading-relaxed">
					We are committed to protecting your privacy and we don&apos;t sell your personal
					information to anyone. Our refined Privacy Policy addresses collection and use
					of personal information. Like most websites, this one uses cookies for
					functional and analytical purposes. To learn more, please read our updated{" "}
					<Link
						href="https://www.citgoprivacy.com/"
						target="_blank"
						rel="noopener noreferrer"
						className="underline hover:text-gray-300"
					>
						Privacy Policy
					</Link>
					. Click &quot;OK&quot; to acknowledge the notice of the updated Privacy.
				</p>
				<button
					onClick={handleAccept}
					className="shrink-0 border border-white text-citgo-red bg-white font-bold text-sm uppercase tracking-wide px-10 py-2 rounded-sm hover:bg-gray-100 transition-colors cursor-pointer"
				>
					OK
				</button>
			</div>
		</div>
	);
}
