import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{ id: string; email_address: string }>;
    username?: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    phone_numbers?: Array<{ phone_number: string }>;
  };
}

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  // Get headers
  const svix_id = request.headers.get('svix-id');
  const svix_timestamp = request.headers.get('svix-timestamp');
  const svix_signature = request.headers.get('svix-signature');

  // If there are no Svix headers, the webhook cannot be verified
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Missing svix headers' },
      { status: 400 }
    );
  }

  // Get the body as text
  const body = await request.text();

  // Get the Clerk webhook secret from environment variables
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing CLERK_WEBHOOK_SECRET environment variable');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  // Verify the webhook signature
  let evt: ClerkWebhookEvent;

  try {
    const wh = new Webhook(webhookSecret);
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook signature:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    );
  }

  const { type, data } = evt;
  const clerkId = data.id;
  const email = data.email_addresses[0]?.email_address || '';
  const username = (data.username || data.first_name || email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_]/g, '_');
  const avatar = data.image_url || null;
  const phone = data.phone_numbers?.[0]?.phone_number || null;

  try {
    switch (type) {
      case 'user.created': {
        // Check if user already exists (by clerkId or email)
        const existingByClerkId = await db.user.findUnique({
          where: { clerkId },
        });

        if (existingByClerkId) {
          // User already synced, just update
          console.log(`User with clerkId ${clerkId} already exists, skipping creation`);
          break;
        }

        const existingByEmail = await db.user.findUnique({
          where: { email },
        });

        if (existingByEmail) {
          // Link existing user to Clerk
          await db.user.update({
            where: { email },
            data: {
              clerkId,
              avatar: avatar || existingByEmail.avatar,
              verificationStatus: 'email_verified',
            },
          });
          console.log(`Linked existing user ${existingByEmail.id} to Clerk ${clerkId}`);
        } else {
          // Create new user
          let uniqueUsername = username;
          let counter = 1;
          while (await db.user.findUnique({ where: { username: uniqueUsername } })) {
            uniqueUsername = `${username}_${counter}`;
            counter++;
          }

          await db.user.create({
            data: {
              clerkId,
              username: uniqueUsername,
              email,
              avatar,
              phone,
              verificationStatus: 'email_verified',
              trustScore: 0,
              ratingAverage: 0,
              totalReviews: 0,
              role: 'user',
            },
          });
          console.log(`Created new user for Clerk ${clerkId}`);
        }
        break;
      }

      case 'user.updated': {
        const existingUser = await db.user.findUnique({
          where: { clerkId },
        });

        if (existingUser) {
          const updateData: Record<string, unknown> = {};
          if (avatar) updateData.avatar = avatar;
          if (phone) updateData.phone = phone;

          // Update username if provided and different (ensure uniqueness)
          if (data.username && data.username !== existingUser.username) {
            const desiredUsername = data.username.replace(/[^a-zA-Z0-9_]/g, '_');
            const usernameTaken = await db.user.findUnique({
              where: { username: desiredUsername },
            });
            if (!usernameTaken) {
              updateData.username = desiredUsername;
            }
          }

          // Update email if changed
          if (email && email !== existingUser.email) {
            const emailTaken = await db.user.findUnique({
              where: { email },
            });
            if (!emailTaken) {
              updateData.email = email;
            }
          }

          if (Object.keys(updateData).length > 0) {
            await db.user.update({
              where: { clerkId },
              data: updateData,
            });
            console.log(`Updated user for Clerk ${clerkId}`);
          }
        } else {
          // User doesn't exist in our DB yet, create them
          let uniqueUsername = username;
          let counter = 1;
          while (await db.user.findUnique({ where: { username: uniqueUsername } })) {
            uniqueUsername = `${username}_${counter}`;
            counter++;
          }

          await db.user.create({
            data: {
              clerkId,
              username: uniqueUsername,
              email,
              avatar,
              phone,
              verificationStatus: 'email_verified',
              trustScore: 0,
              ratingAverage: 0,
              totalReviews: 0,
              role: 'user',
            },
          });
          console.log(`Created user on update event for Clerk ${clerkId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled Clerk webhook event type: ${type}`);
    }

    return NextResponse.json({ success: true, type });
  } catch (error) {
    console.error('Error processing Clerk webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
