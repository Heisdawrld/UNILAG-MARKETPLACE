import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { enhanceMarketplaceImages } from '@/lib/image-processing';
import { validateBody, ListingCreateSchema } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimits } from '@/lib/rate-limit';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
}

// GET /api/listings
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
    const storeId = searchParams.get('storeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (status && status !== 'all') where.status = status;
    if (category && category !== 'All') where.category = category;
    if (condition && condition !== 'All') where.condition = condition;
    if (minPrice || maxPrice) {
      const priceFilter: Record<string, number> = {};
      if (minPrice) priceFilter.gte = parseFloat(minPrice);
      if (maxPrice) priceFilter.lte = parseFloat(maxPrice);
      where.price = priceFilter;
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }
    if (negotiable !== null && negotiable !== undefined) {
      where.negotiable = negotiable === 'true';
    }
    if (sellerId) where.sellerId = sellerId;
    if (storeId) where.storeId = storeId;

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

    await db.listing.updateMany({
      where: {
        boosted: true,
        boostedUntil: { lt: new Date() },
      },
      data: { boosted: false, boostedUntil: null },
    });

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
          store: {
            select: {
              id: true,
              name: true,
              logo: true,
              slug: true,
              isVerified: true,
            },
          },
        },
        orderBy: [{ boosted: 'desc' }, orderBy],
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
    return NextResponse.json({ error: 'Failed to fetch listings' }, { status: 500 });
  }
}

// POST /api/listings
export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot create listings' }, { status: 403 });
    }

    const body = await request.json();

    // Validate request body with Zod schema
    const { data, error: validationError } = validateBody(ListingCreateSchema, body);
    if (validationError) return validationError;

    const {
      storeId,
      title,
      description,
      price,
      category,
      condition,
      negotiable,
      location,
      images,
    } = data;

    // sellerId is not in the Zod schema (it's determined from auth), so get it from body
    const sellerId = body.sellerId;

    if (!sellerId || !storeId) {
      return NextResponse.json(
        { error: 'Missing required fields: sellerId, storeId' },
        { status: 400 }
      );
    }

    if (sellerId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only create listings as yourself' }, { status: 403 });
    }

    const seller = await db.user.findUnique({ where: { id: sellerId } });
    if (!seller) {
      return NextResponse.json({ error: 'Seller not found' }, { status: 404 });
    }

    const store = await db.store.findUnique({ where: { id: storeId } });
    if (!store || store.ownerId !== sellerId) {
      return NextResponse.json({ error: 'Only your store can post products or services' }, { status: 403 });
    }

    const processedImages = await enhanceMarketplaceImages(images, { maxWidth: 1600, maxHeight: 1600, quality: 84 });

    const listing = await db.listing.create({
      data: {
        sellerId,
        storeId,
        title: String(title).trim(),
        description: String(description ?? '').trim(),
        price,
        category,
        condition: condition || 'new',
        negotiable: negotiable !== undefined ? negotiable : true,
        location: typeof location === 'string' && location.trim() ? location.trim() : null,
        images: processedImages.length > 0 ? JSON.stringify(processedImages) : '[]',
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
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (error) {
    console.error('Error creating listing:', error);
    return NextResponse.json({ error: 'Failed to create listing' }, { status: 500 });
  }
}
