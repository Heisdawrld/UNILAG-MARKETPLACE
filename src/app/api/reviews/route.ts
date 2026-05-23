import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from '@/lib/rate-limit';
import { validateBody, ReviewCreateSchema } from '@/lib/validation';
import { sanitizeText } from '@/lib/sanitize';

export async function POST(request: NextRequest) {
  // 1. Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

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

    // 2. Validate input
    const { data, error } = validateBody(ReviewCreateSchema, body)
    if (error) return error

    const { sellerId, rating, comment } = data

    if (sellerId === authUser.id) {
      return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 });
    }

    // 3. Check for duplicate reviews (same reviewer + same seller)
    const existingReview = await db.review.findFirst({
      where: {
        reviewerId: authUser.id,
        sellerId,
      },
    })
    if (existingReview) {
      return NextResponse.json({ error: 'You have already reviewed this seller' }, { status: 409 })
    }

    // 4. Sanitize comment
    const sanitizedComment = comment ? sanitizeText(comment, 1000) : ''

    const review = await db.review.create({
      data: {
        reviewerId: authUser.id,
        sellerId,
        rating,
        comment: sanitizedComment,
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
  // Rate limit
  const rl = await rateLimits.standard(request)
  if (!rl.success) return rl.response!

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
