import { auth } from '@clerk/nextjs/server';
import { db, isDatabaseAvailable } from '@/lib/db';
import { enhanceMarketplaceImage } from '@/lib/image-processing';
import { NextRequest, NextResponse } from 'next/server';

async function getAuthUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  return db.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function generateUniqueSlug(name: string, storeIdToIgnore?: string) {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50) || `store-${Date.now().toString(36)}`;

  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const existing = await db.store.findUnique({ where: { slug } });
    if (!existing || existing.id === storeIdToIgnore) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

// GET /api/stores - List stores or search
export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const viewer = await getAuthUser();
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
            id: true,
            username: true,
            avatar: true,
            verificationStatus: true,
            ratingAverage: true,
          },
        },
        followers: {
          where: { userId: viewer?.id ?? '__viewer_not_signed_in__' },
          select: { userId: true },
          take: 1,
        },
        _count: { select: { listings: true, followers: true } },
      },
      orderBy: [{ isVerified: 'desc' }, { followCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return NextResponse.json(
      stores.map(({ followers, ...store }) => ({
        ...store,
        isFollowing: followers.length > 0,
      })),
    );
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
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (authUser.role === 'banned') {
      return NextResponse.json({ error: 'Banned users cannot create stores' }, { status: 403 });
    }

    const body = await request.json();
    const { ownerId, name, category, description, logo, banner, phone, whatsapp, instagram, twitter, address, openHours } = body;

    if (!ownerId || !name || !category) {
      return NextResponse.json({ error: 'Missing required fields: ownerId, name, category' }, { status: 400 });
    }

    if (ownerId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only create a store for yourself' }, { status: 403 });
    }

    const existing = await db.store.findUnique({ where: { ownerId } });
    if (existing) {
      return NextResponse.json({ error: 'You already have a store' }, { status: 409 });
    }

    const trimmedName = String(name).trim();
    const slug = await generateUniqueSlug(trimmedName);
    const processedLogo = typeof logo === 'string' && logo.startsWith('data:image/')
      ? await enhanceMarketplaceImage(logo, { maxWidth: 600, maxHeight: 600, quality: 84 })
      : normalizeOptionalString(logo);
    const processedBanner = typeof banner === 'string' && banner.startsWith('data:image/')
      ? await enhanceMarketplaceImage(banner, { maxWidth: 1600, maxHeight: 900, quality: 84 })
      : normalizeOptionalString(banner);

    const store = await db.store.create({
      data: {
        ownerId,
        name: trimmedName,
        slug,
        category,
        description: normalizeOptionalString(description),
        logo: processedLogo,
        banner: processedBanner,
        phone: normalizeOptionalString(phone),
        whatsapp: normalizeOptionalString(whatsapp),
        instagram: normalizeOptionalString(instagram),
        twitter: normalizeOptionalString(twitter),
        address: normalizeOptionalString(address),
        openHours: normalizeOptionalString(openHours),
      },
      include: {
        owner: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, ratingAverage: true },
        },
        _count: { select: { listings: true, followers: true } },
      },
    });

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
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { storeId, name, category, description, logo, banner, phone, whatsapp, instagram, twitter, address, openHours } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'storeId required' }, { status: 400 });
    }

    const existingStore = await db.store.findUnique({ where: { id: storeId } });
    if (!existingStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (authUser.role !== 'admin' && existingStore.ownerId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only update your own store' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      updateData.name = trimmedName;
      updateData.slug = await generateUniqueSlug(trimmedName, existingStore.id);
    }
    if (category !== undefined) updateData.category = category;
    if (description !== undefined) updateData.description = normalizeOptionalString(description);
    if (phone !== undefined) updateData.phone = normalizeOptionalString(phone);
    if (whatsapp !== undefined) updateData.whatsapp = normalizeOptionalString(whatsapp);
    if (instagram !== undefined) updateData.instagram = normalizeOptionalString(instagram);
    if (twitter !== undefined) updateData.twitter = normalizeOptionalString(twitter);
    if (address !== undefined) updateData.address = normalizeOptionalString(address);
    if (openHours !== undefined) updateData.openHours = normalizeOptionalString(openHours);
    if (logo !== undefined) {
      updateData.logo = typeof logo === 'string' && logo.startsWith('data:image/')
        ? await enhanceMarketplaceImage(logo, { maxWidth: 600, maxHeight: 600, quality: 84 })
        : normalizeOptionalString(logo);
    }
    if (banner !== undefined) {
      updateData.banner = typeof banner === 'string' && banner.startsWith('data:image/')
        ? await enhanceMarketplaceImage(banner, { maxWidth: 1600, maxHeight: 900, quality: 84 })
        : normalizeOptionalString(banner);
    }

    const store = await db.store.update({
      where: { id: storeId },
      data: updateData,
      include: {
        owner: {
          select: { id: true, username: true, avatar: true, verificationStatus: true, ratingAverage: true },
        },
        _count: { select: { listings: true, followers: true } },
      },
    });

    return NextResponse.json(store);
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json({ error: 'Failed to update store' }, { status: 500 });
  }
}
