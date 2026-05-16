"use client";

import { useState } from "react";
import Link from "next/link";

interface HeaderProps {
	assetSlug: string;
	logoAlt?: string;
}

const NAV_ITEMS: { label: string; href: string; children?: { label: string; href: string }[] }[] = [
	{
		label: "IN THIS ISSUE",
		href: "#",
		children: [
			{ label: "Featured Story", href: "#" },
			{ label: "News & Updates", href: "#" },
			{ label: "Resources", href: "#" },
		],
	},
	{
		label: "specific article",
		href: "/issue/july-sept-2025/article/unlocking-more-savings-with-premier-status", //TODO to test in deployed env - remove later
	},
	{
		label: "ARCHIVES",
		href: "/archives",
	},
];

export default function Header({ assetSlug, logoAlt = "CITGO Retail Connections" }: HeaderProps) {
	const [mobileOpen, setMobileOpen] = useState(false);
	const [issueOpen, setIssueOpen] = useState(false);

	const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const formData = new FormData(e.currentTarget);
		const q = formData.get("q");
		// placeholder: route to /search?q=... when search page exists
		console.log("search:", q);
	};

	return (
		<header className="bg-[#C8102E] text-white">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="flex items-center justify-between h-20 lg:h-28">
					{/* Logo */}
					<Link href="/" className="shrink-0" aria-label={logoAlt}>
						<img
							src={`/assets/${assetSlug}/header-logo.svg`}
							alt={logoAlt}
							className="h-10 lg:h-14 max-h-11"
						/>
					</Link>

					{/* Desktop Nav */}
					<nav className="hidden lg:flex items-center gap-10">
						{NAV_ITEMS.map((item) => (
							<div key={item.label} className="relative">
								{item.children ? (
									<button
										onClick={() => setIssueOpen((v) => !v)}
										className="flex items-center gap-1.5 text-sm font-bold tracking-widest hover:opacity-80"
									>
										{item.label}
										<svg
											className={`w-3 h-3 transition-transform ${issueOpen ? "rotate-180" : ""}`}
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
								) : (
									<a
										href={item.href}
										className="text-sm font-bold tracking-widest hover:opacity-80"
									>
										{item.label}
									</a>
								)}
								{item.children && issueOpen && (
									<div className="absolute top-full left-0 mt-3 bg-white text-gray-900 shadow-lg rounded min-w-[200px] z-50 py-1">
										{item.children.map((child) => (
											<a
												key={child.label}
												href={child.href}
												className="block px-4 py-2 text-sm hover:bg-gray-100"
											>
												{child.label}
											</a>
										))}
									</div>
								)}
							</div>
						))}

						{/* Search */}
						<form onSubmit={handleSearch} className="relative">
							<input
								type="search"
								name="q"
								placeholder="Search"
								className="bg-white text-gray-900 placeholder-gray-500 rounded px-4 py-2.5 pr-10 w-72 text-sm focus:outline-none focus:ring-2 focus:ring-white/60"
							/>
							<button
								type="submit"
								aria-label="Submit search"
								className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8102E]"
							>
								<svg
									className="w-4 h-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									strokeWidth={2.5}
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"
									/>
								</svg>
							</button>
						</form>
					</nav>

					{/* Mobile Icons */}
					<div className="flex lg:hidden items-center gap-4">
						<button
							aria-label="Toggle search"
							onClick={() => setMobileOpen((v) => !v)}
							className="p-1"
						>
							<svg
								className="w-5 h-5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"
								/>
							</svg>
						</button>
						<button
							aria-label="Toggle menu"
							aria-expanded={mobileOpen}
							onClick={() => setMobileOpen((v) => !v)}
							className="p-1"
						>
							<svg
								className="w-6 h-6"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M4 6h16M4 12h16M4 18h16"
								/>
							</svg>
						</button>
					</div>
				</div>

				{/* Mobile Menu */}
				{mobileOpen && (
					<div className="lg:hidden pb-6 pt-4 border-t border-white/20">
						<nav className="flex flex-col gap-4">
							{NAV_ITEMS.map((item) => (
								<a
									key={item.label}
									href={item.href}
									className="text-sm font-bold tracking-widest"
								>
									{item.label}
								</a>
							))}
							<form onSubmit={handleSearch} className="relative mt-2">
								<input
									type="search"
									name="q"
									placeholder="Search"
									className="bg-white text-gray-900 placeholder-gray-500 rounded px-4 py-2.5 pr-10 w-full text-sm focus:outline-none"
								/>
								<button
									type="submit"
									aria-label="Submit search"
									className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C8102E]"
								>
									<svg
										className="w-4 h-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										strokeWidth={2.5}
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"
										/>
									</svg>
								</button>
							</form>
						</nav>
					</div>
				)}
			</div>
		</header>
	);
}
