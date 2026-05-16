import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get('sellerId');

    if (!sellerId) {
      return NextResponse.json(
        { error: 'sellerId query parameter is required' },
        { status: 400 }
      );
    }

    const reviews = await db.review.findMany({
      where: { sellerId },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewerId, sellerId, rating, comment } = body;

    if (!reviewerId || !sellerId || !rating || !comment) {
      return NextResponse.json(
        { error: 'reviewerId, sellerId, rating, and comment are required' },
        { status: 400 }
      );
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if reviewer and seller exist
    const [reviewer, seller] = await Promise.all([
      db.user.findUnique({ where: { id: reviewerId } }),
      db.user.findUnique({ where: { id: sellerId } }),
    ]);

    if (!reviewer) {
      return NextResponse.json(
        { error: 'Reviewer not found' },
        { status: 404 }
      );
    }

    if (!seller) {
      return NextResponse.json(
        { error: 'Seller not found' },
        { status: 404 }
      );
    }

    if (reviewerId === sellerId) {
      return NextResponse.json(
        { error: 'Cannot review yourself' },
        { status: 400 }
      );
    }

    const review = await db.review.create({
      data: {
        reviewerId,
        sellerId,
        rating,
        comment,
      },
      include: {
        reviewer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Update seller's average rating and total reviews
    const sellerReviews = await db.review.findMany({
      where: { sellerId },
      select: { rating: true },
    });

    const totalReviews = sellerReviews.length;
    const ratingAverage = sellerReviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;

    await db.user.update({
      where: { id: sellerId },
      data: {
        ratingAverage: Math.round(ratingAverage * 10) / 10,
        totalReviews,
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}
