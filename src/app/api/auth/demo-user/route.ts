import { NextResponse } from 'next/server';

// This endpoint has been disabled — it exposed real user PII (email, phone, GPS) publicly.
export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
