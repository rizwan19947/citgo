"use client";

import { useRouter } from "next/navigation";
import type { IssueContentlet } from "@/types/content-types";

interface ArchivedIssueSelectProps {
	issues: IssueContentlet[];
}

export function ArchivedIssueSelect({ issues }: ArchivedIssueSelectProps) {
	const router = useRouter();

	return (
		<div className="mt-8">
			<h2 className="text-xl font-bold uppercase pb-3">View Archived Issues</h2>
			<select
				defaultValue=""
				onChange={(e) => {
					if (e.target.value) router.push(`/issues/${e.target.value}`);
				}}
				className="w-full border border-gray-300 rounded px-4 py-2.5 text-sm bg-white hover:bg-gray-50 cursor-pointer"
			>
				<option value="" disabled>
					Select Past Issue
				</option>
				{issues.map((issue) => (
					<option key={issue.identifier} value={issue.slug}>
						{issue.title}
					</option>
				))}
			</select>
		</div>
	);
}
