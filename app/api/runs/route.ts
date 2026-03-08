import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  console.log("POST /api/runs:", JSON.stringify(body, null, 2));
  return new NextResponse(null, { status: 200 });
}
