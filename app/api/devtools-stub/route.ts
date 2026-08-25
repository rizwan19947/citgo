import { NextResponse } from "next/server";

// Stub for Chrome DevTools' com.chrome.devtools.json probe; returns an empty config so the
// request never falls through to the catch-all route (which would query DotCMS and log an error).
export function GET() {
	return NextResponse.json({});
}
