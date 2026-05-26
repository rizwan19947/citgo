"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { ArticleContentlet, IssueContentlet } from "@/types/content-types";
import { searchArticles } from "@/utils/searchArticles";

interface NavItem {
	label: string;
	href: string;
	children?: { label: string; href: string }[];
}

interface HeaderProps {
	assetSlug: string;
	logoAlt?: string;
	currentIssue?: IssueContentlet;
	siteId?: string;
}

export default function Header({
	assetSlug,
	logoAlt = "CITGO Retail Connections",
	currentIssue,
	siteId,
}: HeaderProps) {
	const router = useRouter();
	const navItems: NavItem[] = useMemo(() => {
		const issueChildren = (currentIssue?.articles ?? []).map((article) => ({
			label: article.title,
			href: `/${article.issueSlug}/${article.slug}`,
		}));

		return [
			{
				label: "IN THIS ISSUE",
				href: "#",
				children: issueChildren,
			},
			{
				label: "ARCHIVES",
				href: "/archives",
			},
		];
	}, [currentIssue]);
	const [mobileOpen, setMobileOpen] = useState(false);
	const [issueOpen, setIssueOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<ArticleContentlet[]>([]);
	const [searchOpen, setSearchOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const issueDropdownRef = useRef<HTMLDivElement>(null);

	// Close "In This Issue" dropdown on outside click
	useEffect(() => {
		if (!issueOpen) return;
		const handler = (e: MouseEvent) => {
			if (issueDropdownRef.current && !issueDropdownRef.current.contains(e.target as Node)) {
				setIssueOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [issueOpen]);

	const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (searchQuery.trim()) {
			setSearchOpen(false);
			router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
		}
	};

	const handleSearchInput = (value: string) => {
		setSearchQuery(value);
		if (debounceRef.current) clearTimeout(debounceRef.current);

		if (!value.trim() || !siteId) {
			setSearchResults([]);
			setSearchOpen(false);
			return;
		}

		debounceRef.current = setTimeout(async () => {
			try {
				setLoading(true);
				const results = await searchArticles(value.trim(), siteId);
				setLoading(false);
				setSearchResults(results);
				setSearchOpen(results.length > 0);
			} catch {
				setLoading(false);
				setSearchResults([]);
				setSearchOpen(false);
			}
		}, 300);
	};

	const searchDropdown = searchOpen && searchResults.length > 0 && (
		<div className="absolute top-full right-0 mt-2 bg-white text-gray-900 shadow-lg rounded w-max z-50 max-h-96 overflow-y-auto">
			{searchResults.map((result) => {
				const thumb =
					typeof result.image === "string" && result.image.length > 0
						? result.image
						: null;
				return (
					<Link
						key={result.identifier}
						href={`/${result.issueSlug}/${result.slug}`}
						className="flex items-start gap-3 px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-0 no-underline"
						onClick={() => {
							setSearchOpen(false);
							setSearchQuery("");
							setSearchResults([]);
						}}
					>
						{thumb ? (
							<Image
								src={`/dA/${thumb}`}
								alt={result.title || ""}
								width={100}
								height={65}
								quality={75}
								className="shrink-0 object-cover"
							/>
						) : (
							<div className="shrink-0 w-[100px] h-[65px] bg-gray-200 rounded" />
						)}
						<div className="flex flex-col min-w-0 w-full max-w-[calc(100vw-11rem)] md:max-w-md">
							<span className="text-blue-600 font-medium text-sm">
								{result.title}
							</span>
							{result.teaser && (
								<span className="text-gray-500 text-xs mt-1 line-clamp-2">
									{result.teaser}
								</span>
							)}
						</div>
					</Link>
				);
			})}
		</div>
	);

	return (
		<header className="bg-citgo-red text-white">
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
					<nav className="hidden lg:flex items-center gap-10 cursor-pointer">
						{navItems.map((item) => (
							<div
								key={item.label}
								className="relative cursor-pointer"
								ref={item.children ? issueDropdownRef : undefined}
							>
								{item.children ? (
									<button
										onClick={() => setIssueOpen((v) => !v)}
										className="nav-underline flex items-center gap-1.5 text-sm font-bold tracking-widest hover:opacity-80 cursor-pointer h-8"
									>
										{item.label}
										<svg
											className={`w-3 h-3 transition-transform duration-200 ${issueOpen ? "rotate-180" : ""}`}
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
									<Link
										href={item.href}
										className="nav-underline text-sm font-bold tracking-widest hover:opacity-80 pb-2"
									>
										{item.label}
									</Link>
								)}
								{item.children && (
									<div
										className={`absolute px-2 py-3 top-full left-0 mt-5 bg-white text-gray-900 shadow-lg rounded z-50 w-max overflow-visible transition-all duration-200 ease-in-out origin-top ${
											issueOpen
												? "opacity-100 scale-y-100 max-h-[500px]"
												: "opacity-0 scale-y-95 max-h-0 pointer-events-none"
										}`}
									>
										<div className="absolute -top-2 left-6 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white" />
										{item.children.map((child) => (
											<Link
												key={child.label}
												href={child.href}
												onClick={() => setIssueOpen(false)}
												className="block px-4 py-2 text-sm hover:bg-gray-100 w-full"
											>
												{child.label}
											</Link>
										))}
									</div>
								)}
							</div>
						))}

						{/* Search */}
						<div className="relative">
							<form onSubmit={handleSearchSubmit}>
								<input
									type="search"
									name="q"
									placeholder="Search"
									value={searchQuery}
									onChange={(e) => handleSearchInput(e.target.value)}
									onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
									onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
									className="bg-white text-gray-900 placeholder-gray-500 rounded px-4 py-2.5 pr-10 w-72 text-sm focus:outline-none focus:ring-2 focus:ring-white/60"
								/>
								<span className="absolute right-3 top-1/2 -translate-y-1/2 text-citgo-red">
									{loading ? (
										<svg
											className="w-4 h-4 animate-spin"
											viewBox="0 0 24 24"
											fill="none"
										>
											<circle
												className="opacity-25"
												cx="12"
												cy="12"
												r="10"
												stroke="currentColor"
												strokeWidth="3"
											/>
											<path
												className="opacity-75"
												fill="currentColor"
												d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
											/>
										</svg>
									) : searchQuery ? (
										<button
											type="button"
											aria-label="Clear search"
											onClick={() => {
												setSearchQuery("");
												setSearchResults([]);
												setSearchOpen(false);
											}}
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
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									) : (
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
									)}
								</span>
							</form>
							{searchDropdown}
						</div>
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
							{navItems.map((item) => (
								<Link
									key={item.label}
									href={item.href}
									className="text-sm font-bold tracking-widest"
								>
									{item.label}
								</Link>
							))}
							<div className="relative mt-2">
								<form onSubmit={handleSearchSubmit}>
									<input
										type="search"
										name="q"
										placeholder="Search"
										value={searchQuery}
										onChange={(e) => handleSearchInput(e.target.value)}
										onFocus={() =>
											searchResults.length > 0 && setSearchOpen(true)
										}
										onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
										className="bg-white text-gray-900 placeholder-gray-500 rounded px-4 py-2.5 pr-10 w-full text-sm focus:outline-none"
									/>
									<span className="absolute right-3 top-1/2 -translate-y-1/2 text-citgo-red">
										{loading ? (
											<svg
												className="w-4 h-4 animate-spin"
												viewBox="0 0 24 24"
												fill="none"
											>
												<circle
													className="opacity-25"
													cx="12"
													cy="12"
													r="10"
													stroke="currentColor"
													strokeWidth="3"
												/>
												<path
													className="opacity-75"
													fill="currentColor"
													d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
												/>
											</svg>
										) : searchQuery ? (
											<button
												type="button"
												aria-label="Clear search"
												onClick={() => {
													setSearchQuery("");
													setSearchResults([]);
													setSearchOpen(false);
												}}
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
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</button>
										) : (
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
										)}
									</span>
								</form>
								{searchDropdown}
							</div>
						</nav>
					</div>
				)}
			</div>
		</header>
	);
}
