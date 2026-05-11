"use client";

import { useState } from "react";

const CITGO_SITES = [
    { label: "CITGO.com", href: "#" },
    { label: "CITGO Lubricants", href: "#" },
    { label: "Fuels Hub", href: "#" },
    { label: "TriCON Industries", href: "#" },
];

const LEGAL_LINKS = [
    { label: "Privacy Policy", href: "#" },
    { label: "Site Accessibility", href: "#" },
    { label: "Terms & Conditions", href: "#" },
];

export default function Footer() {
    const [sitesOpen, setSitesOpen] = useState(false);

    return (
        <footer className="bg-white border-t border-gray-200 text-gray-700">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
                {/* Top row */}
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                    <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 lg:flex-1">
                        {/* Logo placeholder */}
                        <div className="flex-shrink-0">
                            <div className="w-20 h-20 bg-gray-200 border border-gray-300 flex items-center justify-center text-[10px] text-gray-500 tracking-wider">
                                LOGO
                            </div>
                        </div>

                        <div className="max-w-2xl">
                            <h2 className="text-[#C8102E] font-bold text-base mb-3">
                                CITGO Retail Connections
                            </h2>
                            <p className="text-sm leading-relaxed mb-4">
                                CITGO Retail Connections is a quarterly digital newsletter intended to inform,
                                engage and fuel the success of CITGO gas station Retailers. The publication
                                features a wide variety of timely topics from operational, initiative, and
                                program updates to resources, meetings and education opportunities.
                            </p>
                            <p className="text-sm leading-relaxed">
                                This publication is designed and produced by the CITGO Corporate Communications
                                Department together with CITGO Brand Equity.
                            </p>
                        </div>
                    </div>

                    {/* Sites Dropdown */}
                    <div className="lg:w-72 lg:flex-shrink-0">
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
                                <a href={link.href} className="hover:text-gray-900">
                                    {link.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm text-gray-500">
                        © {new Date().getFullYear()} CITGO Petroleum Corporation. All Rights Reserved
                    </p>
                </div>
            </div>
        </footer>
    );
}