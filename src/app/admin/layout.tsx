import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { db, isDatabaseAvailable } from '@/lib/db';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in?redirect_url=/admin');
  }

  // Verify admin role
  if (isDatabaseAvailable()) {
    try {
      const user = await db.user.findUnique({
        where: { clerkId: userId },
        select: { role: true },
      });
      if (!user || user.role !== 'admin') {
        redirect('/');
      }
    } catch {
      // DB error — deny access for safety
      redirect('/');
    }
  } else {
    // No DB — deny access
    redirect('/');
  }

  return <>{children}</>;
}
