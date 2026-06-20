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
        category: 'Phones',
        condition: 'like_new',
        negotiable: true,
        location: 'Jaja Hall, UNILAG',
        status: 'active',
        views: 204,
        likesCount: 16,
        boosted: true,
        boostTier: 'elite',
        boostedUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        images: JSON.stringify(['/products/iphone.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'MacBook Air M1 - 8GB / 256GB',
        description: 'Reliable laptop for coding, design, and school work.',
        price: 580000,
        category: 'Electronics',
        condition: 'like_new',
        negotiable: false,
        location: 'Moremi Hall, UNILAG',
        status: 'active',
        views: 312,
        likesCount: 25,
        boosted: true,
        boostTier: 'premium',
        boostedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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
        boosted: true,
        boostTier: 'basic',
        boostedUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        images: JSON.stringify(['/products/sneakers.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Engineering Textbook Bundle',
        description: 'EEE 201, EEE 202, and MEE 301 textbooks. Slightly used, no highlights.',
        price: 8000,
        category: 'Books',
        condition: 'good',
        negotiable: true,
        location: 'Jaja Hall, UNILAG',
        status: 'active',
        views: 87,
        likesCount: 8,
        images: JSON.stringify(['/products/books.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: vendorOwner.id,
        storeId: store.id,
        title: 'PS5 Controller - DualSense',
        description: 'White DualSense controller, barely used. Works perfectly.',
        price: 35000,
        category: 'Gaming',
        condition: 'like_new',
        negotiable: false,
        location: 'Eni Njoku Hall, UNILAG',
        status: 'active',
        views: 156,
        likesCount: 12,
        images: JSON.stringify(['/products/gaming.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: buyer.id,
        title: 'Nike Air Force 1 - Size 43',
        description: 'Clean white AF1s, worn only twice. Selling because I got a new pair.',
        price: 28000,
        category: 'Shoes',
        condition: 'like_new',
        negotiable: true,
        location: 'Madam Tinubu Hall, UNILAG',
        status: 'active',
        views: 94,
        likesCount: 7,
        images: JSON.stringify(['/products/shoes.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: vendorOwner.id,
        storeId: store.id,
        title: 'Hostel Bedding Set',
        description: 'Pillow, duvet, and bedsheets. Brand new, still in packaging.',
        price: 12000,
        category: 'Hostel Essentials',
        condition: 'brand_new',
        negotiable: false,
        location: 'Eni Njoku Hall, UNILAG',
        status: 'active',
        views: 73,
        likesCount: 11,
        images: JSON.stringify(['/products/hostel.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: seller.id,
        title: 'Portable Bluetooth Speaker',
        description: 'JBL Go 3, waterproof. Great for hostel vibes.',
        price: 15000,
        category: 'Electronics',
        condition: 'good',
        negotiable: true,
        location: 'Jaja Hall, UNILAG',
        status: 'active',
        views: 61,
        likesCount: 5,
        images: JSON.stringify(['/products/speaker.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: buyer.id,
        title: 'Indomie Carton - 40 packs',
        description: 'Brand new carton of Indomie. Bulk deal, cheaper than buying singles.',
        price: 6500,
        category: 'Food',
        condition: 'brand_new',
        negotiable: false,
        location: 'Moremi Hall, UNILAG',
        status: 'active',
        views: 142,
        likesCount: 22,
        images: JSON.stringify(['/products/food.png']),
      },
    }),
    prisma.listing.create({
      data: {
        sellerId: vendorOwner.id,
        storeId: store.id,
        title: 'Skincare Routine Set',
        description: 'Cleanser, toner, moisturizer, and sunscreen. Suitable for all skin types.',
        price: 9500,
        category: 'Beauty',
        condition: 'brand_new',
        negotiable: true,
        location: 'Eni Njoku Hall, UNILAG',
        status: 'active',
        views: 88,
        likesCount: 14,
        images: JSON.stringify(['/products/beauty.png']),
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
      amount: 2000,
      planId: 'elite',
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.boost.create({
    data: {
      listingId: listings[1].id,
      paymentReference: 'seed-boost-2',
      amount: 1000,
      planId: 'premium',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.boost.create({
    data: {
      listingId: listings[2].id,
      paymentReference: 'seed-boost-3',
      amount: 500,
      planId: 'basic',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
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
