"use client";

import Link from "next/link";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, } from "@/components/ui/accordion";
import type { IssueContentlet } from "@/types/content-types";

interface IssueAccordionProps {
	issues: IssueContentlet[];
}

export function IssueAccordion({ issues }: IssueAccordionProps) {
	return (
		<Accordion className={"border-t border-b"}>
			{issues.map((issue) => (
				<AccordionItem
					key={issue.identifier}
					value={issue.title ?? issue.identifier}
					className="font-bold capitalize"
				>
					<AccordionTrigger className="text-[#333] font-bold text-2xl uppercase py-5 px-5 cursor-pointer hover:no-underline">
						{issue.title}
					</AccordionTrigger>
					<AccordionContent>
						{"articles" in issue && issue.articles && issue.articles.length > 0 ? (
							<ul className="space-y-2">
								{issue.articles.map((article) => (
									<li key={article.identifier} className="ml-8">
										<Link
											href={`/${issue.slug}/${article.slug}`}
											className="text-lg font-normal text-citgo-link underline hover:text-black"
											target={"_blank"}
										>
											{article.title}
										</Link>
									</li>
								))}
							</ul>
						) : (
							<div className="py-8 text-center text-gray-500 font-bold">
								No Articles found.
							</div>
						)}
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
