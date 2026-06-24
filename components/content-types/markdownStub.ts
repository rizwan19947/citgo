/**
 * Dev-only preview fixture for the Article markdown branch.
 *
 * Keep MARKDOWN_STUB_ENABLED = false in commits — when false, Article renders real content and
 * this fixture is inert.
 */
export const MARKDOWN_STUB_ENABLED: boolean = false;

export const MARKDOWN_STUB = [
	"# Q2 Retail Margins Update",
	"",
	"CITGO **retail partners** posted _record_ margins this quarter, with strong performance across all regions. Read the [full Q2 report](https://www.citgo.com) for the complete breakdown.",
	"",
	"## Regional Performance",
	"",
	"| Region | Jan | Feb | Mar | Apr | May | Jun | Q2 Volume | YoY % | Top Site |",
	"| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
	"| Southeast | 198,400 | 205,100 | 221,750 | 230,900 | 244,300 | 251,800 | 1,352,250 | +12.4% | Miami #4821 |",
	"| Gulf Coast | 320,500 | 331,200 | 345,900 | 352,100 | 360,800 | 372,400 | 2,082,900 | +8.1% | Houston #1190 |",
	"| Midwest | 160,200 | 158,900 | 162,400 | 159,700 | 161,300 | 163,950 | 966,450 | -2.3% | Chicago #3304 |",
	"| Northeast | 232,700 | 240,100 | 248,600 | 251,900 | 259,400 | 263,200 | 1,495,900 | +5.7% | Boston #2207 |",
	"| Southwest | 210,300 | 215,800 | 220,400 | 225,100 | 229,900 | 234,600 | 1,336,100 | +9.2% | Phoenix #5512 |",
	"| West Coast | 288,900 | 295,400 | 301,200 | 308,700 | 315,300 | 322,800 | 1,832,300 | +6.4% | Los Angeles #6033 |",
	"| Mountain | 142,600 | 145,200 | 148,900 | 151,300 | 154,800 | 158,100 | 900,900 | +3.8% | Denver #4490 |",
	"| National Total | 1,553,600 | 1,591,700 | 1,649,150 | 1,679,700 | 1,725,800 | 1,766,850 | 9,966,800 | +6.9% | N/A |",
	"",
	'> "This was our strongest quarter in three years," said the VP of Retail.',
	"",
	"### Key Drivers",
	"",
	"1. Expanded loyalty program enrollment",
	"2. New `MarketNet` pricing dashboard",
	"3. Improved supply chain reliability",
	"",
	"Areas to watch:",
	"",
	"- Midwest volume softness",
	"- ~~Legacy POS rollout~~ (completed)",
	"- Seasonal demand shifts",
	"",
	"**Action items**",
	"",
	"- [x] Finalize Q2 numbers",
	"- [ ] Brief regional managers",
	"- [ ] Publish to newsletter",
	"",
	"For questions, contact your regional rep or visit [citgonow.com](https://www.citgonow.com).",
].join("\n");
