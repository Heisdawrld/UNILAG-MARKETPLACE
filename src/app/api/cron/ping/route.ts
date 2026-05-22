import { NextRequest, NextResponse } from 'next/server';

// GET /api/cron/ping - External cron service pings this to keep Render awake
// Set CRON_SECRET env var and configure the cron service to send it in x-cron-secret header
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = request.headers.get('x-cron-secret');
    if (provided !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}
