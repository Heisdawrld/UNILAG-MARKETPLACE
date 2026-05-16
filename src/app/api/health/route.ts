import { NextResponse } from 'next/server';
import { isDatabaseAvailable } from '@/lib/db';

export async function GET() {
  const dbAvailable = isDatabaseAvailable();
  const hasTurso = !!(
    process.env.TURSO_DATABASE_URL &&
    process.env.TURSO_AUTH_TOKEN &&
    process.env.TURSO_DATABASE_URL !== 'undefined' &&
    process.env.TURSO_AUTH_TOKEN !== 'undefined'
  );
  const hasClerk = !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY &&
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== 'undefined' &&
    process.env.CLERK_SECRET_KEY !== 'undefined'
  );
  const hasFlutterwave = !!(
    process.env.FLUTTERWAVE_SECRET_KEY &&
    process.env.FLUTTERWAVE_SECRET_KEY !== 'undefined'
  );

  const status = dbAvailable ? 'ok' : 'degraded';

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbAvailable ? 'connected' : 'not_configured',
      turso: hasTurso ? 'configured' : 'not_configured',
      clerk: hasClerk ? 'configured' : 'not_configured',
      flutterwave: hasFlutterwave ? 'configured' : 'not_configured',
    },
    message: dbAvailable
      ? 'All systems operational'
      : 'Database not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.',
  }, { status: dbAvailable ? 200 : 503 });
}
