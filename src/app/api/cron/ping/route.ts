import { NextResponse } from 'next/server';

// GET /api/cron/ping - External cron service pings this to keep Render awake
// Set up a free cron job at https://cron-job.org to hit this every 5 minutes
export async function GET() {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
}
