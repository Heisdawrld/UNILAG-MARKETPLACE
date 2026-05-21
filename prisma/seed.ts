import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existingUsers = await prisma.user.count();

  if (existingUsers > 0) {
    console.log('Seed skipped: database already contains users.');
    return;
  }

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
        phone: '08056789012',
        whatsapp: '08056789012',
        hostel: 'Eni Njoku Hall',
        verificationStatus: 'unilag_verified',
        trustScore: 90,
        ratingAverage: 4.8,
        totalReviews: 14,
        role: 'vendor',
      },
    }),
  ]);

  const store = await prisma.store.create({
    data: {
      ownerId: vendorOwner.id,
      name: "Seun's Creative Corner",
      slug: 'seuns-creative-corner',
      category: 'Fashion & Thrift',
      description: 'Premium campus fashion, accessories, and hostel-ready essentials.',
      logo: 'https://api.dicebear.com/9.x/shapes/svg?seed=creative-store',
      address: 'Eni Njoku Hall, UNILAG',
      phone: vendorOwner.phone,
      whatsapp: vendorOwner.whatsapp,
      isVerified: true,
      rating: 4.7,
      followCount: 12,
    },
  });

  const listings = await Promise.all([
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'iPhone 13 Pro Max - 256GB',
        description: 'Clean device with strong battery life and original accessories.',
        price: 450000,
        category: 'Phones & Tablets',
        condition: 'like_new',
        negotiable: true,
        location: 'Jaja Hall, UNILAG',
        status: 'active',
        views: 204,
        likesCount: 16,
        boosted: true,
        images: JSON.stringify(['/products/iphone.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'MacBook Air M1 - 8GB / 256GB',
        description: 'Reliable laptop for coding, design, and school work.',
        price: 580000,
        category: 'Laptops',
        condition: 'like_new',
        negotiable: false,
        location: 'Moremi Hall, UNILAG',
        status: 'active',
        views: 312,
        likesCount: 25,
        boosted: true,
        images: JSON.stringify(['/products/macbook.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: vendorOwner.id,
        storeId: store.id,
        title: 'Custom Ankara Tote Bag',
        description: 'Handmade campus tote with strong stitching and clean finishing.',
        price: 5500,
        category: 'Fashion',
        condition: 'brand_new',
        negotiable: true,
        location: 'Eni Njoku Hall, UNILAG',
        status: 'active',
        views: 118,
        likesCount: 19,
        images: JSON.stringify(['/products/sneakers.png']),
      },
    }),
  ]);

  await prisma.savedListing.create({
    data: {
      userId: buyer.id,
      listingId: listings[0].id,
    },
  });

  await prisma.review.create({
    data: {
      reviewerId: buyer.id,
      sellerId: seller.id,
      rating: 5,
      comment: 'Very smooth transaction and accurate listing details.',
    },
  });

  await prisma.notification.create({
    data: {
      userId: seller.id,
      type: 'new_message',
      title: 'Seed data ready',
      message: 'Sample marketplace content has been loaded.',
    },
  });

  await prisma.boost.create({
    data: {
      listingId: listings[0].id,
      paymentReference: 'seed-boost-1',
      amount: 700,
      planId: 'standard',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
