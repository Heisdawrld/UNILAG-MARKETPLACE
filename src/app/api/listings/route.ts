import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'newest';
    const negotiable = searchParams.get('negotiable');
    const status = searchParams.get('status') || 'active';
    const sellerId = searchParams.get('sellerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};

    // Filter by status (default to active listings)
    if (status) {
      where.status = status;
    }

    // Filter by category
    if (category && category !== 'All') {
      where.category = category;
    }

    // Filter by condition
    if (condition && condition !== 'All') {
      where.condition = condition;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) priceFilter.gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
      where.price = priceFilter;
    }

    // Search by title and description
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Filter by negotiable
    if (negotiable !== null && negotiable !== undefined) {
      where.negotiable = negotiable === 'true';
    }

    // Filter by seller
    if (sellerId) {
      where.sellerId = sellerId;
    }

    // Sorting
    const orderBy: Record<string, string> = {};
    switch (sort) {
      case 'oldest':
        orderBy.createdAt = 'asc';
        break;
      case 'price_low':
        orderBy.price = 'asc';
        break;
      case 'price_high':
        orderBy.price = 'desc';
        break;
      case 'popular':
        orderBy.views = 'desc';
        break;
      case 'newest':
      default:
        orderBy.createdAt = 'desc';
        break;
    }

    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      db.listing.findMany({
        where,
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
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.listing.count({ where }),
    ]);

    return NextResponse.json({
      listings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const {
      sellerId,
      title,
      description,
      price,
      category,
      condition,
      negotiable,
      location,
      images,
    } = body;

    if (!sellerId || !title || !description || !price || !category || !condition) {
      return NextResponse.json(
        { error: 'Missing required fields: sellerId, title, description, price, category, condition' },
        { status: 400 }
      );
    }

    // Verify seller exists
    const seller = await db.user.findUnique({ where: { id: sellerId } });
    if (!seller) {
      return NextResponse.json(
        { error: 'Seller not found' },
        { status: 404 }
      );
    }

    const listing = await db.listing.create({
      data: {
        sellerId,
        title,
        description,
        price: parseFloat(price),
        category,
        condition,
        negotiable: negotiable !== undefined ? negotiable : true,
        location: location || null,
        images: images ? JSON.stringify(images) : '[]',
        status: 'active',
      },
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
      },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.json(
      { error: 'Failed to create listing' },
      { status: 500 }
    );
  }
}
