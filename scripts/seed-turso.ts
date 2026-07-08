// seed-turso.ts — runs prisma/seed.ts logic but with the Turso LibSQL adapter
// Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/seed-turso.ts
import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
  process.exit(1);
}

const adapter = new PrismaLibSQL({ url: TURSO_URL, authToken: TURSO_TOKEN });
const prisma = new PrismaClient({ adapter });

// Inline the seed logic (from prisma/seed.ts) but using our adapter-connected client
async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`Seed skipped: database already contains ${existingUsers} users.`);
    return;
  }

  console.log('Seeding Turso database...');

  const [seller, buyer, vendorOwner] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'chidi_okonkwo',
        email: 'chidi.okonkwo@unilag.edu.ng',
        avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=chidi',
        faculty: 'Engineering',
        department: 'Electrical/Electronics',
        level: '400',
        bio: 'Campus gadget seller and pickup helper.',
        phone: '08012345678',
        whatsapp: '08012345678',
        hostel: 'Jaja Hall',
        verificationStatus: 'unilag_verified',
        trustScore: 88,
        ratingAverage: 4.6,
        totalReviews: 18,
        role: 'seller',
      },
    }),
    prisma.user.create({
      data: {
        username: 'amina_bello',
        email: 'amina.bello@unilag.edu.ng',
        avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=amina',
        faculty: 'Law',
        department: 'Private Law',
        level: '300',
        bio: 'Buying and selling textbooks around campus.',
        phone: '08023456789',
        whatsapp: '08023456789',
        hostel: 'Madam Tinubu Hall',
        verificationStatus: 'email_verified',
        trustScore: 71,
        ratingAverage: 4.2,
        totalReviews: 9,
        role: 'user',
      },
    }),
    prisma.user.create({
      data: {
        username: 'seun_olatunji',
        email: 'seun.olatunji@unilag.edu.ng',
        avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=seun',
        faculty: 'Arts',
        department: 'Creative Arts',
        level: '400',
        bio: 'Creative vendor for fashion and hostel basics.',
        phone: '08034567890',
        whatsapp: '08034567890',
        hostel: 'Moremi Hall',
        verificationStatus: 'unilag_verified',
        trustScore: 92,
        ratingAverage: 4.8,
        totalReviews: 24,
        role: 'seller',
      },
    }),
  ]);

  console.log(`Created 3 users: ${seller.username}, ${buyer.username}, ${vendorOwner.username}`);

  // Create a runner user
  const runner = await prisma.user.create({
    data: {
      username: 'tunde_adebayo',
      email: 'tunde.adebayo@unilag.edu.ng',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=tunde',
      faculty: 'Science',
      department: 'Computer Science',
      level: '500',
      bio: 'Reliable campus runner for deliveries and errands.',
      phone: '08045678901',
      whatsapp: '08045678901',
      hostel: 'Honors Hall',
      verificationStatus: 'unilag_verified',
      trustScore: 95,
      ratingAverage: 4.9,
      totalReviews: 32,
      role: 'runner',
      isRunner: true,
      runnerRating: 4.9,
      tasksCompleted: 32,
    },
  });
  console.log(`Created runner: ${runner.username}`);

  // Admin user
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@unilagmarketplace.online',
      avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=admin',
      faculty: 'Administration',
      department: 'Management',
      level: 'Graduate',
      bio: 'Platform administrator.',
      verificationStatus: 'unilag_verified',
      trustScore: 100,
      ratingAverage: 5,
      totalReviews: 0,
      role: 'admin',
    },
  });
  console.log(`Created admin: ${admin.username}`);

  // Create listings
  const listings = await Promise.all([
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'iPhone 13 Pro Max - 256GB',
        description: 'Barely used iPhone 13 Pro Max, 256GB storage. Comes with original box and charger. No scratches, battery health 92%.',
        price: 480000,
        category: 'Electronics',
        condition: 'like_new',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=800',
          'https://images.unsplash.com/photo-1605236453806-6ff36851218e?w=800',
        ]),
        negotiable: true,
        location: 'Jaja Hall, UNILAG',
        status: 'active',
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'MacBook Air M2 - 8GB/256GB',
        description: 'MacBook Air M2, Midnight color. Used for one semester. Perfect condition with AppleCare+ until 2025.',
        price: 950000,
        category: 'Electronics',
        condition: 'like_new',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800',
        ]),
        negotiable: false,
        location: 'Engineering Faculty, UNILAG',
        status: 'active',
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: vendorOwner.id,
        title: 'Ankara Print Fabric - 6 yards',
        description: 'Beautiful Ankara print fabric, 6 yards, perfect for traditional outfits. Multiple patterns available.',
        price: 8500,
        category: 'Fashion',
        condition: 'brand_new',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800',
        ]),
        negotiable: true,
        location: 'Moremi Hall, UNILAG',
        status: 'active',
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: vendorOwner.id,
        title: 'Nike Air Force 1 - Size 42',
        description: 'Authentic Nike Air Force 1, white color, size 42. Worn twice, excellent condition.',
        price: 65000,
        category: 'Fashion',
        condition: 'like_new',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
        ]),
        negotiable: true,
        location: 'Moremi Hall, UNILAG',
        status: 'active',
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Engineering Textbooks Bundle',
        description: 'Complete set of 400-level Electrical Engineering textbooks. Includes Circuits, Electronics, and Signals.',
        price: 25000,
        category: 'Books',
        condition: 'good',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800',
        ]),
        negotiable: true,
        location: 'Engineering Library, UNILAG',
        status: 'active',
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: buyer.id,
        title: 'Scientific Calculator - Casio fx-991EX',
        description: 'Casio fx-991EX ClassWiz scientific calculator. Perfect working condition, no scratches.',
        price: 12000,
        category: 'Electronics',
        condition: 'good',
        images: JSON.stringify([
          'https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=800',
        ]),
        negotiable: false,
        location: 'Law Faculty, UNILAG',
        status: 'active',
      },
    }),
  ]);

  console.log(`Created ${listings.length} listings`);

  // Boost a few listings
  await prisma.boost.createMany({
    data: [
      { listingId: listings[0].id, paymentReference: 'seed-boost-1', amount: 500, planId: 'premium', expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
      { listingId: listings[2].id, paymentReference: 'seed-boost-2', amount: 200, planId: 'basic', expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
    ],
  });
  console.log('Created 2 boosts');

  // Create a store
  const store = await prisma.store.create({
    data: {
      ownerId: vendorOwner.id,
      name: 'Seun\'s Campus Boutique',
      slug: 'seuns-campus-boutique',
      category: 'Fashion',
      description: 'Fashion items, Ankara fabrics, and hostel essentials.',
      logo: 'https://api.dicebear.com/9.x/notionists/svg?seed=store',
      phone: '08034567890',
      whatsapp: '08034567890',
      instagram: '@seuns_boutique',
      address: 'Moremi Hall, UNILAG',
      openHours: 'Mon-Sat 9am-7pm',
      isVerified: true,
      followCount: 45,
      totalSales: 128,
      rating: 4.7,
    },
  });
  console.log(`Created store: ${store.name}`);

  // Link some listings to the store
  await prisma.listing.updateMany({
    where: { id: { in: [listings[2].id, listings[3].id] } },
    data: { storeId: store.id },
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
