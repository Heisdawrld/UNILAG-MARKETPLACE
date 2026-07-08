import { NextResponse } from 'next/server';
import { db, isDatabaseAvailable } from '@/lib/db';

export async function GET() {
  const dbAvailable = isDatabaseAvailable();

  if (!dbAvailable) {
    return NextResponse.json({
      status: 'error',
      message: 'Database not available',
      env: {
        TURSO_URL: process.env.TURSO_DATABASE_URL ? `${process.env.TURSO_DATABASE_URL.substring(0, 40)}...` : 'MISSING',
        TURSO_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
        NODE_ENV: process.env.NODE_ENV,
      },
    }, { status: 503 });
  }

  try {
    // Try a simple query
    const userCount = await db.user.count();
    const listingCount = await db.listing.count();

    return NextResponse.json({
      status: 'ok',
      message: 'Database query succeeded',
      counts: { users: userCount, listings: listingCount },
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Database query failed',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 10) : undefined,
      env: {
        TURSO_URL: process.env.TURSO_DATABASE_URL ? `${process.env.TURSO_DATABASE_URL.substring(0, 40)}...` : 'MISSING',
        TURSO_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
        NODE_ENV: process.env.NODE_ENV,
      },
    }, { status: 500 });
  }
}
