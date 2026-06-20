import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { rateLimits } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    // ── SECURITY: verify Clerk session ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // ── SECURITY: ensure requesting user is fetching their own chats ──
    if (userId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — not your chats' }, { status: 403 });
    }

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20')), 50);
    const skip = (page - 1) * limit;

    // Get chats where user is buyer or seller — only load last message, not all messages
    const [chats, total] = await Promise.all([
      db.chat.findMany({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId },
          ],
        },
        include: {
          listing: {
            select: {
              id: true,
              title: true,
              price: true,
              images: true,
              status: true,
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
          },
          buyer: {
            select: { id: true, username: true, avatar: true },
          },
          seller: {
            select: { id: true, username: true, avatar: true },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, message: true, senderId: true, seen: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.chat.count({
        where: {
          OR: [
            { buyerId: userId },
            { sellerId: userId },
          ],
        },
      }),
    ]);

    // Batch count unread messages per chat in a single query
    const chatIds = chats.map(c => c.id);
    let unreadCounts: Record<string, number> = {};

    if (chatIds.length > 0) {
      // Count unread per chat (messages not sent by current user and not seen)
      const counts = await db.message.groupBy({
        by: ['chatId'],
        where: {
          chatId: { in: chatIds },
          senderId: { not: userId },
          seen: false,
        },
        _count: true,
      });
      for (const c of counts) {
        unreadCounts[c.chatId] = c._count;
      }
    }

    const result = chats.map((chat) => ({
      ...chat,
      lastMessage: chat.messages[0] || null,
      unreadCount: unreadCounts[chat.id] || 0,
      messages: undefined,
    }));

    return NextResponse.json({
      chats: result,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }, {
      headers: { 'Cache-Control': 'private, max-age=5' },
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ error: 'Failed to fetch chats' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await rateLimits.write(request)
  if (!rl.success) return rl.response!

  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    // ── SECURITY: verify Clerk session ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { listingId, buyerId, sellerId } = body;

    if (!listingId || !buyerId || !sellerId) {
      return NextResponse.json({ error: 'listingId, buyerId, and sellerId are required' }, { status: 400 });
    }

    // ── SECURITY: ensure requesting user is the buyer ──
    if (buyerId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only start chats as yourself' }, { status: 403 });
    }

    if (buyerId === sellerId) {
      return NextResponse.json({ error: 'Buyer and seller cannot be the same' }, { status: 400 });
    }

    // Check if listing exists
    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (listing.sellerId !== sellerId) {
      return NextResponse.json({ error: 'Seller does not match listing owner' }, { status: 400 });
    }

    // Check if chat already exists (unique constraint on [listingId, buyerId, sellerId])
    const existingChat = await db.chat.findUnique({
      where: {
        listingId_buyerId_sellerId: {
          listingId,
          buyerId,
          sellerId,
        },
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            images: true,
            status: true,
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
        },
        buyer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existingChat) {
      return NextResponse.json(existingChat);
    }

    // Create new chat
    const chat = await db.chat.create({
      data: {
        listingId,
        buyerId,
        sellerId,
      },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            price: true,
            images: true,
            status: true,
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
        },
        buyer: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        seller: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
        messages: true,
      },
    });

    return NextResponse.json(chat, { status: 201 });
  } catch (error) {
    console.error('Error creating/getting chat:', error);
    return NextResponse.json(
      { error: 'Failed to create or get chat' },
      { status: 500 }
    );
  }
}
