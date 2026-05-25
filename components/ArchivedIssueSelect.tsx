"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import type { IssueContentlet } from "@/types/content-types";

interface ArchivedIssueSelectProps {
	issues: IssueContentlet[];
}

export function ArchivedIssueSelect({ issues }: ArchivedIssueSelectProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	return (
		<div className="mt-8">
			<h2 className="text-xl font-bold uppercase pb-3">View Archived Issues</h2>
			<div className="relative" ref={ref}>
				<button
					onClick={() => setOpen((v) => !v)}
					className="w-full flex items-center justify-between border border-gray-300 rounded px-4 py-2.5 text-sm bg-white hover:bg-gray-50 cursor-pointer"
				>
					<span className="text-gray-500">Select Past Issue</span>
					<ChevronDownIcon
						className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					/>
				</button>
				<div
					className={`absolute top-full left-0 right-0 mt-0 bg-white border border-t-0 border-gray-300 rounded-b shadow-md z-50 overflow-hidden transition-all duration-200 ease-in-out origin-top ${
						open
							? "opacity-100 scale-y-100 max-h-96"
							: "opacity-0 scale-y-95 max-h-0 pointer-events-none"
					}`}
				>
					{issues.map((issue) => (
						<button
							key={issue.identifier}
							onClick={() => {
								setOpen(false);
								router.push(`/issues/${issue.slug}`);
							}}
							className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-100 cursor-pointer"
						>
							{issue.title}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
