import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "TV features are disabled" }, { status: 404 });
}
