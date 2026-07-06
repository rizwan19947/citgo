"use client";

import { useState } from "react";
import type { FooterContentContentlet } from "@/types/content-types";
import { DotCMSBlockEditorRenderer } from "@dotcms/react";
import Link from "next/link";
import Image from "next/image";

const CITGO_SITES = [
	{ label: "CITGO", href: "https://www.citgo.com/" },
	{ label: "CITGO Lubricants", href: "https://www.citgolubes.com/" },
	{ label: "Clarion Lubricants", href: "https://www.clarionlubricants.com/" },
	{ label: "MarketNet", href: "https://www.citgomarketnet.com/" },
	{ label: "MyCITGOStore", href: "https://www.mycitgostore.com/" },
	{ label: "Mystik Lubricants", href: "https://www.mystiklubes.com/" },
];

const LEGAL_LINKS = [
	{ label: "Privacy Policy", href: "https://www.citgoprivacy.com/" },
	{ label: "Site Accessibility", href: "https://www.citgo.com/site-accessibility/" },
	{ label: "Terms & Conditions", href: "https://www.citgoprivacy.com/CITGOTermsConditions.html" },
];

interface FooterProps {
	contentlet?: FooterContentContentlet;
}

export default function Footer({ contentlet }: FooterProps) {
	const [sitesOpen, setSitesOpen] = useState(false);
	const { title, content, showNewsletterLinks } = contentlet ?? {};

	return (
		<footer className="bg-white text-gray-700">
			<div className="mx-auto max-w-[82rem] px-4 sm:px-6 lg:px-6 py-10 lg:py-12 border-t border-gray-200">
				{/* Top row — 4-column grid: logo | content | newsletters | sites dropdown */}
				<div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-y-6 md:gap-x-12 md:gap-y-8 items-start">
					{/* Logo */}
					<div>
						<Image
							src="/assets/global/logo.svg"
							alt="CITGO"
							width={84}
							height={84}
							className="mr-16"
						/>
					</div>

					{/* Content */}
					<div className="md:max-w-lg">
						<h2 className="text-citgo-red font-bold text-base mb-3">{title}</h2>
						{content && (
							<div
								className="prose prose-sm max-w-none"
								{...{
									"data-block-editor-content": JSON.stringify(content),
									"data-inode": contentlet?.inode,
									"data-language": String(contentlet?.languageId ?? 1),
									"data-content-type": contentlet?.contentType,
									"data-field-name": "content",
								}}
							>
								<DotCMSBlockEditorRenderer blocks={content} />
							</div>
						)}
					</div>

					{/* Newsletter links */}
					{showNewsletterLinks && (
						<div>
							<h2 className="text-citgo-red font-bold text-base mb-3">
								CITGO Newsletters
							</h2>
							<div className="my-2">
								<Link
									className="text-sm hover:underline"
									href="https://www.citgonow.com"
								>
									CITGO Now
								</Link>
							</div>
							<div className="my-2">
								<Link
									className="text-sm hover:underline"
									href="https://www.citgonowlubes.com/"
								>
									CITGO Now Lubes
								</Link>
							</div>
							<div className="my-2">
								<Link
									className="text-sm hover:underline"
									href="https://www.citgoretailconnections.com/"
								>
									CITGO Retail Connections
								</Link>
							</div>
						</div>
					)}

					{/* Sites Dropdown */}
					<div className="md:w-56">
						<div className="relative">
							<button
								onClick={() => setSitesOpen((v) => !v)}
								aria-expanded={sitesOpen}
								className="w-full flex items-center justify-between border border-gray-300 rounded px-4 py-2.5 text-sm bg-white hover:bg-gray-50"
							>
								<span>Visit Other CITGO Sites</span>
								<svg
									className={`w-4 h-4 transition-transform ${sitesOpen ? "rotate-180" : ""}`}
									fill="currentColor"
									viewBox="0 0 20 20"
								>
									<path
										fillRule="evenodd"
										d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
										clipRule="evenodd"
									/>
								</svg>
							</button>
							{sitesOpen && (
								<div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-50 py-1">
									{CITGO_SITES.map((site) => (
										<a
											key={site.label}
											href={site.href}
											target="_blank"
											rel="noopener noreferrer"
											className="block px-4 py-2 text-sm hover:bg-gray-100"
										>
											{site.label}
										</a>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Bottom row */}
				<div className="mt-8 pt-6 border-t border-gray-200 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
					<ul className="flex flex-col lg:flex-row gap-3 lg:gap-6 text-sm">
						{LEGAL_LINKS.map((link) => (
							<li key={link.label}>
								<Link
									target={"_blank"}
									rel="noopener noreferrer"
									href={link.href}
									className="hover:text-gray-900"
								>
									{link.label}
								</Link>
							</li>
						))}
					</ul>
					<p className="text-sm text-gray-500">
						© {new Date().getFullYear()} CITGO Petroleum Corporation. All Rights
						Reserved
					</p>
				</div>
			</div>
		</footer>
	);
}
