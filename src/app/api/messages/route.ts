import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendPushToUser } from '@/lib/push';

export async function GET(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
      return NextResponse.json({ error: 'chatId is required' }, { status: 400 });
    }

    // ── SECURITY: verify Clerk session ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const authUser = await db.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!authUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if chat exists
    const chat = await db.chat.findUnique({ where: { id: chatId } });
    if (!chat) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // ── SECURITY: ensure requester is a participant ──
    if (authUser.id !== chat.buyerId && authUser.id !== chat.sellerId) {
      return NextResponse.json({ error: 'Forbidden — not your chat' }, { status: 403 });
    }

    const messages = await db.message.findMany({
      where: { chatId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mark unseen messages as seen (only messages not sent by the requesting user)
    if (authUser.id) {
      await db.message.updateMany({
        where: {
          chatId,
          seen: false,
          senderId: { not: authUser.id },
        },
        data: { seen: true },
      });
    }

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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
    const { chatId, senderId, message, imageUrl } = body;

    if (!chatId || !senderId || !message) {
      return NextResponse.json(
        { error: 'chatId, senderId, and message are required' },
        { status: 400 }
      );
    }

    // ── SECURITY: ensure the sender is the authenticated user ──
    if (senderId !== authUser.id) {
      return NextResponse.json({ error: 'Forbidden — you can only send messages as yourself' }, { status: 403 });
    }

    // Check if chat exists
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      include: {
        buyer: { select: { id: true } },
        seller: { select: { id: true } },
      },
    });
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Verify sender is part of the chat
    if (senderId !== chat.buyerId && senderId !== chat.sellerId) {
      return NextResponse.json(
        { error: 'Sender is not part of this chat' },
        { status: 403 }
      );
    }

    const newMessage = await db.message.create({
      data: {
        chatId,
        senderId,
        message,
        imageUrl: imageUrl || null,
        seen: false,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            avatar: true,
          },
        },
      },
    });

    // Create notification for the other user
    const recipientId = senderId === chat.buyerId ? chat.sellerId : chat.buyerId;
    const senderUser = await db.user.findUnique({ where: { id: senderId }, select: { username: true } });
    // Strip any HTML-like content from the notification preview to prevent XSS if ever rendered unsafely
    const safePreview = String(message).replace(/<[^>]*>/g, '').slice(0, 80);
    await db.notification.create({
      data: {
        userId: recipientId,
        type: 'new_message',
        title: 'New Message',
        message: `${senderUser?.username || 'Someone'}: ${safePreview}`,
        data: JSON.stringify({ chatId }),
      },
    });

    // Push notification
    sendPushToUser(recipientId, {
      title: `💬 ${senderUser?.username || 'New Message'}`,
      body: message.slice(0, 100),
      type: 'new_message',
      tag: `chat-${chatId}`,
      data: { chatId },
    }).catch(() => {});

    return NextResponse.json(newMessage, { status: 201 });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
