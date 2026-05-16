import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [
      totalUsers,
      totalListings,
      activeListings,
      totalChats,
      totalReports,
      pendingReports,
      activeSellers,
      totalReviews,
      totalSavedListings,
      totalNotifications,
    ] = await Promise.all([
      db.user.count(),
      db.listing.count(),
      db.listing.count({ where: { status: 'active' } }),
      db.chat.count(),
      db.report.count(),
      db.report.count({ where: { status: 'pending' } }),
      db.user.count({
        where: {
          role: { in: ['seller', 'vendor'] },
        },
      }),
      db.review.count(),
      db.savedListing.count(),
      db.notification.count(),
    ]);

    // Listings by category
    const listingsByCategory = await db.listing.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { status: 'active' },
    });

    // Listings by condition
    const listingsByCondition = await db.listing.groupBy({
      by: ['condition'],
      _count: { id: true },
      where: { status: 'active' },
    });

    // Recent listings
    const recentListings = await db.listing.findMany({
      take: 5,
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: {
        seller: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Recent users
    const recentUsers = await db.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        username: true,
        email: true,
        avatar: true,
        role: true,
        verificationStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      totalUsers,
      totalListings,
      activeListings,
      totalChats,
      totalReports,
      pendingReports,
      activeSellers,
      totalReviews,
      totalSavedListings,
      totalNotifications,
      listingsByCategory: listingsByCategory.map((item) => ({
        category: item.category,
        count: item._count.id,
      })),
      listingsByCondition: listingsByCondition.map((item) => ({
        condition: item.condition,
        count: item._count.id,
      })),
      recentListings,
      recentUsers,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch admin stats' },
      { status: 500 }
    );
  }
}
