import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { sellerId, rating, comment } = body;

    if (!sellerId || !rating) {
      return NextResponse.json({ error: 'sellerId and rating are required' }, { status: 400 });
    }

    if (sellerId === authUser.id) {
      return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 });
    }

    if (typeof comment === 'string' && comment.length > 1000) {
      return NextResponse.json({ error: 'Comment must be 1000 characters or fewer' }, { status: 400 });
    }

    const review = await db.review.create({
      data: {
        reviewerId: authUser.id,
        sellerId,
        rating: Math.min(5, Math.max(1, rating)),
        comment: typeof comment === 'string' ? comment.trim() : '',
      },
    });

    const allReviews = await db.review.findMany({ where: { sellerId } });
    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    const newTrust = Math.min(100, Math.round(50 + avgRating * 10));

    await db.user.update({
      where: { id: sellerId },
      data: {
        ratingAverage: Math.round(avgRating * 10) / 10,
        totalReviews: allReviews.length,
        trustScore: newTrust,
      },
    });

    return NextResponse.json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json({ error: 'sellerId is required' }, { status: 400 });
    }

    const reviews = await db.review.findMany({
      where: { sellerId },
      include: { reviewer: { select: { username: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}
