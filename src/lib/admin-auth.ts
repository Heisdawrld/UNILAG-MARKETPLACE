import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

const DEFAULT_BOOTSTRAP_ADMIN_EMAILS = ['davidchuks229@gmail.com'];
const DEFAULT_BOOTSTRAP_ADMIN_USERNAMES = ['dawrld'];

function parseCsv(value: string | undefined) {
  return new Set(
    (value || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getBootstrapAdminEmails() {
  return new Set([
    ...DEFAULT_BOOTSTRAP_ADMIN_EMAILS.map((email) => email.toLowerCase()),
    ...parseCsv(process.env.ADMIN_EMAILS),
  ]);
}

function getBootstrapAdminUsernames() {
  return new Set([
    ...DEFAULT_BOOTSTRAP_ADMIN_USERNAMES.map((username) => username.toLowerCase()),
    ...parseCsv(process.env.ADMIN_USERNAMES),
  ]);
}

function canBootstrapAdmin(user: { email: string; username: string }) {
  const email = user.email.trim().toLowerCase();
  const username = user.username.trim().toLowerCase();
  return getBootstrapAdminEmails().has(email) || getBootstrapAdminUsernames().has(username);
}

export async function requireAdminUser() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return { ok: false as const, status: 401, error: 'Unauthorized' };
  }

  const user = await db.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      clerkId: true,
      email: true,
      username: true,
      role: true,
      isRunner: true,
      verificationStatus: true,
      trustScore: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return { ok: false as const, status: 404, error: 'User not found' };
  }

  if (user.role === 'admin') {
    return { ok: true as const, user };
  }

  if (canBootstrapAdmin(user)) {
    const upgradedUser = await db.user.update({
      where: { id: user.id },
      data: { role: 'admin' },
      select: {
        id: true,
        clerkId: true,
        email: true,
        username: true,
        role: true,
        isRunner: true,
        verificationStatus: true,
        trustScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { ok: true as const, user: upgradedUser, bootstrapped: true as const };
  }

  const adminCount = await db.user.count({ where: { role: 'admin' } });
  return {
    ok: false as const,
    status: 403,
    error: adminCount === 0 ? 'No admin account is configured for this login yet' : 'Access denied',
  };
}
