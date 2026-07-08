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

  const results: Record<string, unknown> = {};

  // Test 1: simple count
  try {
    results.userCount = await db.user.count();
    results.listingCount = await db.listing.count();
    results.test1_simpleCount = 'ok';
  } catch (error) {
    results.test1_simpleCount = 'FAILED';
    results.test1_error = error instanceof Error ? error.message : String(error);
  }

  // Test 2: updateMany (the boost expiry call in /api/listings)
  try {
    const updated = await db.listing.updateMany({
      where: { boosted: true, boostedUntil: { lt: new Date() } },
      data: { boosted: false, boostedUntil: null, boostTier: null },
    });
    results.test2_updateMany = 'ok';
    results.test2_updatedCount = updated.count;
  } catch (error) {
    results.test2_updateMany = 'FAILED';
    results.test2_error = error instanceof Error ? error.message : String(error);
  }

  // Test 3: findMany with include (the actual listings query)
  try {
    const listings = await db.listing.findMany({
      where: { status: 'active' },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            avatar: true,
            faculty: true,
            department: true,
            verificationStatus: true,
            ratingAverage: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
            logo: true,
            slug: true,
            isVerified: true,
            phone: true,
            whatsapp: true,
          },
        },
      },
      orderBy: [{ boosted: 'desc' }, { createdAt: 'desc' }],
      take: 8,
    });
    results.test3_findManyInclude = 'ok';
    results.test3_listingsFound = listings.length;
    if (listings[0]) {
      results.test3_sampleListing = {
        id: listings[0].id,
        title: listings[0].title,
        hasSeller: !!listings[0].seller,
        hasStore: listings[0].store === null ? 'null' : !!listings[0].store,
      };
    }
  } catch (error) {
    results.test3_findManyInclude = 'FAILED';
    results.test3_error = error instanceof Error ? error.message : String(error);
    results.test3_stack = error instanceof Error ? error.stack?.split('\n').slice(0, 8) : undefined;
  }

  // Test 4: try without the include (isolate whether include is the issue)
  try {
    const listings = await db.listing.findMany({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    results.test4_findManyNoInclude = 'ok';
    results.test4_listingsFound = listings.length;
  } catch (error) {
    results.test4_findManyNoInclude = 'FAILED';
    results.test4_error = error instanceof Error ? error.message : String(error);
  }

  const hasFailure = Object.values(results).some(v => v === 'FAILED');
  return NextResponse.json({
    status: hasFailure ? 'partial_failure' : 'ok',
    results,
  }, { status: hasFailure ? 500 : 200 });
}
