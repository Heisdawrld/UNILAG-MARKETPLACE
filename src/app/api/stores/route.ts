import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/stores - List stores or search
export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const ownerId = searchParams.get('ownerId');
    const slug = searchParams.get('slug');
    const limit = parseInt(searchParams.get('limit') || '20');

    const where: Record<string, unknown> = {};
    if (category && category !== 'All') where.category = category;
    if (ownerId) where.ownerId = ownerId;
    if (slug) where.slug = slug;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
      ];
    }

    const stores = await db.store.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true, username: true, avatar: true,
            verificationStatus: true, ratingAverage: true,
          },
        },
        _count: { select: { listings: true, followers: true } },
      },
      orderBy: [{ isVerified: 'desc' }, { followCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json({ error: 'Failed to fetch stores' }, { status: 500 });
  }
}

// POST /api/stores - Create a store
export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const body = await request.json();
    const { ownerId, name, category, description, logo, banner, phone, whatsapp, instagram, twitter, address, openHours } = body;

    if (!ownerId || !name || !category) {
      return NextResponse.json({ error: 'Missing required fields: ownerId, name, category' }, { status: 400 });
    }

    // Check if user already has a store
    const existing = await db.store.findUnique({ where: { ownerId } });
    if (existing) {
      return NextResponse.json({ error: 'You already have a store' }, { status: 409 });
    }

    // Generate slug
    const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const slugExists = await db.store.findUnique({ where: { slug: baseSlug } });
    const slug = slugExists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const store = await db.store.create({
      data: {
        ownerId, name, slug, category,
        description: description || null,
        logo: logo || null,
        banner: banner || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        twitter: twitter || null,
        address: address || null,
        openHours: openHours || null,
      },
      include: {
        owner: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, ratingAverage: true },
        },
      },
    });

    // Update user role to seller
    await db.user.update({ where: { id: ownerId }, data: { role: 'seller' } });

    return NextResponse.json(store, { status: 201 });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json({ error: 'Failed to create store' }, { status: 500 });
  }
}

// PATCH /api/stores - Update store
export async function PATCH(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const body = await request.json();
    const { storeId, ...updateData } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'storeId required' }, { status: 400 });
    }

    // Remove undefined fields
    const data: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(updateData)) {
      if (val !== undefined) data[key] = val;
    }

    const store = await db.store.update({
      where: { id: storeId },
      data,
      include: {
        owner: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, ratingAverage: true },
        },
      },
    });

    return NextResponse.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}
