import { db, isDatabaseAvailable } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (!isDatabaseAvailable()) {
    return NextResponse.json(
      { error: 'Database not configured. Please set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables.' },
      { status: 503 }
    );
  }
  // Always require a seed key — set SEED_SECRET_KEY in .env.local for development
  const seedKey = request.headers.get('x-seed-key');
  const requiredKey = process.env.SEED_SECRET_KEY;
  if (!requiredKey || !seedKey || seedKey !== requiredKey) {
    return NextResponse.json({ error: 'Seeding requires a valid x-seed-key header matching SEED_SECRET_KEY' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Check if data already exists
    const existingUsers = await db.user.count();
    if (existingUsers > 0 && !force) {
      return NextResponse.json({
        success: true,
        message: 'Database already has data, skipping seed (use ?force=true to override)',
        existingUsers,
      });
    }

    // Clear existing data (in case of partial state)
    await db.boost.deleteMany().catch(() => {});
    await db.storeFollow.deleteMany().catch(() => {});
    await db.store.deleteMany().catch(() => {});
    await db.notification.deleteMany().catch(() => {});
    await db.report.deleteMany().catch(() => {});
    await db.review.deleteMany().catch(() => {});
    await db.savedListing.deleteMany().catch(() => {});
    await db.message.deleteMany().catch(() => {});
    await db.chat.deleteMany().catch(() => {});
    await db.listing.deleteMany().catch(() => {});
    await db.user.deleteMany().catch(() => {});

    // Create Users
    const users = await Promise.all([
      db.user.create({
        data: {
          username: 'chidi_okonkwo', email: 'chidi.okonkwo@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=chidi',
          faculty: 'Engineering', department: 'Electrical/Electronics', level: '400',
          bio: 'Tech enthusiast & part-time phone dealer. Quality gadgets only!',
          phone: '08012345678', whatsapp: '08012345678', hostel: 'Jaja Hall',
          verificationStatus: 'unilag_verified', trustScore: 85, ratingAverage: 4.5, totalReviews: 12, role: 'seller',
        },
      }),
      db.user.create({
        data: {
          username: 'amina_bello', email: 'amina.bello@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=amina',
          faculty: 'Law', department: 'Private Law', level: '300',
          bio: 'Law student selling textbooks and fashion items. Fair prices always!',
          phone: '08023456789', whatsapp: '08023456789', hostel: 'Madam Tinubu Hall',
          verificationStatus: 'email_verified', trustScore: 72, ratingAverage: 4.2, totalReviews: 8, role: 'seller',
        },
      }),
      db.user.create({
        data: {
          username: 'tunde_adebayo', email: 'tunde.adebayo@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=tunde',
          faculty: 'Sciences', department: 'Computer Science', level: '500',
          bio: 'Final year CS student. I fix laptops and phones on the side!',
          phone: '08034567890', whatsapp: '08034567890', hostel: 'Moremi Hall',
          verificationStatus: 'unilag_verified', trustScore: 90, ratingAverage: 4.8, totalReviews: 15, role: 'seller',
        },
      }),
      db.user.create({
        data: {
          username: 'blessing_okeke', email: 'blessing.okeke@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=blessing',
          faculty: 'Business Administration', department: 'Accounting', level: '200',
          bio: 'Looking for affordable textbooks and hostel essentials. Also sell snacks!',
          phone: '08045678901', whatsapp: '08045678901', hostel: 'Kofo Hall',
          verificationStatus: 'email_verified', trustScore: 65, ratingAverage: 4.0, totalReviews: 5, role: 'user',
        },
      }),
      db.user.create({
        data: {
          username: 'seun_olatunji', email: 'seun.olatunji@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=seun',
          faculty: 'Arts', department: 'Creative Arts', level: '400',
          bio: 'Creative arts student. Your UNILAG plug for trendy fashion & custom designs!',
          phone: '08056789012', whatsapp: '08056789012', hostel: 'Eni Njoku Hall',
          verificationStatus: 'unilag_verified', trustScore: 88, ratingAverage: 4.6, totalReviews: 10, role: 'vendor',
        },
      }),
      db.user.create({
        data: {
          username: 'fatima_abdullahi', email: 'fatima.abdullahi@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=fatima',
          faculty: 'Medicine', department: 'Medicine & Surgery', level: '600',
          bio: 'Med student selling textbooks and study materials. Also offering tutoring!',
          phone: '08067890123', whatsapp: '08067890123', hostel: 'Amina Hall',
          verificationStatus: 'unilag_verified', trustScore: 92, ratingAverage: 4.9, totalReviews: 18, role: 'seller',
        },
      }),
      db.user.create({
        data: {
          username: 'david_eze', email: 'david.eze@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=david',
          faculty: 'Engineering', department: 'Mechanical Engineering', level: '300',
          bio: 'Gym bro and sneaker plug. Quality sportswear at student prices 💪',
          phone: '08078901234', whatsapp: '08078901234', hostel: 'Mariere Hall',
          verificationStatus: 'email_verified', trustScore: 70, ratingAverage: 4.3, totalReviews: 7, role: 'seller',
        },
      }),
      db.user.create({
        data: {
          username: 'ngozi_uche', email: 'ngozi.uche@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=ngozi',
          faculty: 'Pharmacy', department: 'Pharmacology', level: '400',
          bio: 'Pharmacy student. Selling hostel essentials and kitchen gadgets!',
          phone: '08089012345', whatsapp: '08089012345', hostel: 'Kofo Hall',
          verificationStatus: 'unilag_verified', trustScore: 78, ratingAverage: 4.4, totalReviews: 9, role: 'seller',
        },
      }),
      db.user.create({
        data: {
          username: 'kemi_fashola', email: 'kemi.fashola@unilag.edu.ng',
          avatar: 'https://api.dicebear.com/9.x/notionists/svg?seed=kemi',
          faculty: 'Social Sciences', department: 'Mass Communication', level: '200',
          bio: 'Content creator & foodie. I do meal preps for students on campus 🍲',
          phone: '08090123456', whatsapp: '08090123456', hostel: 'Off Campus',
          verificationStatus: 'email_verified', trustScore: 60, ratingAverage: 4.1, totalReviews: 4, role: 'user',
        },
      }),
    ]);

    const [chidi, amina, tunde, blessing, seun, fatima, david, ngozi, kemi] = users;

    // Create Listings
    const listings = await Promise.all([
      db.listing.create({
        data: {
          sellerId: chidi.id,
          title: 'iPhone 13 Pro Max - 256GB (Sierra Blue)',
          description: 'Barely used iPhone 13 Pro Max in Sierra Blue. Comes with original charger and earphones. Battery health at 94%. No scratches, always had a screen protector on. Selling because I upgraded.',
          price: 450000,
          category: 'Phones & Tablets',
          condition: 'like_new',
          negotiable: true,
          location: 'Jaja Hall, UNILAG',
          status: 'active',
          views: 234,
          likesCount: 18,
          boosted: true,
          images: JSON.stringify(['/products/iphone.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: tunde.id,
          title: 'MacBook Air M1 - 8GB/256GB (Space Gray)',
          description: 'MacBook Air M1 chip, 8GB RAM, 256GB SSD. Perfect for CS students! Bought last year, still under Apple warranty. Comes with original box and charger.',
          price: 580000,
          category: 'Laptops',
          condition: 'like_new',
          negotiable: false,
          location: 'Moremi Hall, UNILAG',
          status: 'active',
          views: 456,
          likesCount: 32,
          boosted: true,
          images: JSON.stringify(['/products/macbook.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: amina.id,
          title: 'Criminal Law Textbook (6th Edition)',
          description: 'Essential Criminal Law textbook by Smith & Hogan, 6th Edition. Required for LAW 201 and LAW 301. Some highlights and notes inside but still very readable.',
          price: 8500,
          category: 'Textbooks',
          condition: 'fairly_used',
          negotiable: true,
          location: 'Madam Tinubu Hall, UNILAG',
          status: 'active',
          views: 89,
          likesCount: 5,
          boosted: false,
          images: JSON.stringify(['/products/textbooks.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: seun.id,
          title: 'Custom Ankara Tote Bag - Handmade',
          description: 'Beautiful handmade Ankara tote bag, perfect for lectures and casual outings. Made with premium fabric and reinforced stitching.',
          price: 5500,
          category: 'Fashion',
          condition: 'brand_new',
          negotiable: true,
          location: 'Eni Njoku Hall, UNILAG',
          status: 'active',
          views: 167,
          likesCount: 24,
          boosted: true,
          images: JSON.stringify(['/products/sneakers.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: chidi.id,
          title: 'Samsung Galaxy S22 Ultra - 256GB',
          description: 'Samsung Galaxy S22 Ultra with S Pen. Phantom Black color. 12GB RAM, 256GB storage. Camera is amazing for content creation.',
          price: 380000,
          category: 'Phones & Tablets',
          condition: 'fairly_used',
          negotiable: true,
          location: 'Jaja Hall, UNILAG',
          status: 'active',
          views: 145,
          likesCount: 11,
          boosted: false,
          images: JSON.stringify(['/products/iphone.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: tunde.id,
          title: 'HP Pavilion 15 - Intel Core i5, 8GB RAM',
          description: 'HP Pavilion 15 laptop with Intel Core i5 11th Gen, 8GB RAM, 512GB SSD. Good for general use and light programming. Freshly formatted with Windows 11.',
          price: 195000,
          category: 'Laptops',
          condition: 'fairly_used',
          negotiable: true,
          location: 'Moremi Hall, UNILAG',
          status: 'active',
          views: 198,
          likesCount: 8,
          boosted: false,
          images: JSON.stringify(['/products/macbook.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: amina.id,
          title: 'Introduction to Financial Accounting (IFRS Edition)',
          description: 'ACCN 101 textbook - Introduction to Financial Accounting, IFRS Edition. Required for all Business Admin students. Barely used, almost like new.',
          price: 6000,
          category: 'Textbooks',
          condition: 'like_new',
          negotiable: true,
          location: 'Madam Tinubu Hall, UNILAG',
          status: 'active',
          views: 56,
          likesCount: 3,
          boosted: false,
          images: JSON.stringify(['/products/textbooks.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: blessing.id,
          title: 'Standing Desk Fan - Rechargeable',
          description: 'Rechargeable standing desk fan with 3 speed settings. Perfect for the heat in the hostel! Lasts 6-8 hours on a single charge.',
          price: 7500,
          category: 'Hostel Essentials',
          condition: 'brand_new',
          negotiable: false,
          location: 'Fagunwa Hall, UNILAG',
          status: 'active',
          views: 234,
          likesCount: 19,
          boosted: false,
          images: JSON.stringify(['/products/speaker.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: seun.id,
          title: 'Vintage Denim Jacket - Size M',
          description: 'Classic vintage denim jacket, perfect for the Lagos weather. Size Medium. Slightly distressed look. Pairs well with anything.',
          price: 12000,
          category: 'Fashion',
          condition: 'like_new',
          negotiable: true,
          location: 'Eni Njoku Hall, UNILAG',
          status: 'active',
          views: 178,
          likesCount: 22,
          boosted: false,
          images: JSON.stringify(['/products/sneakers.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: tunde.id,
          title: 'Laptop Repair & Software Installation Service',
          description: 'Professional laptop repair services right here in UNILAG! Windows/Mac OS installation, hardware repair, virus removal, SSD upgrade, RAM upgrade.',
          price: 5000,
          category: 'Services',
          condition: 'brand_new',
          negotiable: true,
          location: 'Moremi Hall, UNILAG',
          status: 'active',
          views: 312,
          likesCount: 28,
          boosted: true,
          images: JSON.stringify(['/products/macbook.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: blessing.id,
          title: 'Hot Plate - Single Burner (Electric)',
          description: 'Single burner electric hot plate for cooking in the hostel. Barely used, in perfect condition. 1000W, heats up fast.',
          price: 8500,
          category: 'Hostel Essentials',
          condition: 'fairly_used',
          negotiable: true,
          location: 'Fagunwa Hall, UNILAG',
          status: 'active',
          views: 187,
          likesCount: 14,
          boosted: false,
          images: JSON.stringify(['/products/speaker.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: chidi.id,
          title: 'AirPods Pro 2nd Gen - USB-C',
          description: 'Apple AirPods Pro 2nd Generation with USB-C charging case. Active Noise Cancellation works perfectly. About 4 months old, still in great condition.',
          price: 145000,
          category: 'Electronics',
          condition: 'like_new',
          negotiable: true,
          location: 'Jaja Hall, UNILAG',
          status: 'active',
          views: 276,
          likesCount: 21,
          boosted: false,
          images: JSON.stringify(['/products/airpods.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: seun.id,
          title: 'Packs of Indomie & Sardine Bundle',
          description: 'Survival bundle! 10 packs of Indomie (mixed flavors) + 3 cans of Sardine. Perfect for late-night study sessions.',
          price: 4500,
          category: 'Food & Drinks',
          condition: 'brand_new',
          negotiable: false,
          location: 'Eni Njoku Hall, UNILAG',
          status: 'active',
          views: 342,
          likesCount: 35,
          boosted: false,
          images: JSON.stringify(['/products/textbooks.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: amina.id,
          title: 'Nike Air Force 1 - White (Size 42)',
          description: 'Classic white Nike Air Force 1, EU size 42. Worn only a few times, still very clean. Comes with the original box.',
          price: 28000,
          category: 'Fashion',
          condition: 'like_new',
          negotiable: true,
          location: 'Madam Tinubu Hall, UNILAG',
          status: 'active',
          views: 256,
          likesCount: 30,
          boosted: true,
          images: JSON.stringify(['/products/sneakers.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: tunde.id,
          title: 'Wireless Bluetooth Speaker - JBL Go 3',
          description: 'JBL Go 3 portable Bluetooth speaker. Red color. Waterproof and dustproof. Great sound quality for its size. Battery lasts about 5 hours.',
          price: 18000,
          category: 'Electronics',
          condition: 'fairly_used',
          negotiable: true,
          location: 'Moremi Hall, UNILAG',
          status: 'active',
          views: 134,
          likesCount: 9,
          boosted: false,
          images: JSON.stringify(['/products/speaker.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: chidi.id,
          title: 'Football Boots - Adidas Predator (Size 43)',
          description: 'Adidas Predator football boots, size 43. Great for the UNILAG football league! Firm ground studs.',
          price: 15000,
          category: 'Sports',
          condition: 'fairly_used',
          negotiable: true,
          location: 'Jaja Hall, UNILAG',
          status: 'active',
          views: 67,
          likesCount: 4,
          boosted: false,
          images: JSON.stringify(['/products/sneakers.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: seun.id,
          title: 'Data Structures & Algorithms in Python',
          description: 'CSC 202 textbook - Data Structures and Algorithms in Python by Goodrich, Tamassia & Goldwasser. Essential for Computer Science students.',
          price: 7500,
          category: 'Textbooks',
          condition: 'like_new',
          negotiable: true,
          location: 'Eni Njoku Hall, UNILAG',
          status: 'active',
          views: 98,
          likesCount: 7,
          boosted: false,
          images: JSON.stringify(['/products/textbooks.png']),
        },
      }),
      db.listing.create({
        data: {
          sellerId: blessing.id,
          title: 'Electric Kettle - 1.7L Stainless Steel',
          description: '1.7L stainless steel electric kettle. Boils water in under 3 minutes. Auto shut-off feature.',
          price: 6500,
          category: 'Hostel Essentials',
          condition: 'brand_new',
          negotiable: true,
          location: 'Fagunwa Hall, UNILAG',
          status: 'active',
          views: 156,
          likesCount: 12,
          boosted: false,
          images: JSON.stringify(['/products/speaker.png']),
        },
      }),
      // Sold listing
      db.listing.create({
        data: {
          sellerId: tunde.id,
          title: 'iPad Air 4th Gen - 64GB (Sky Blue)',
          description: 'iPad Air 4th Gen with Apple Pencil 2 support. 64GB WiFi model. Sold to a coursemate already!',
          price: 220000,
          category: 'Electronics',
          condition: 'like_new',
          negotiable: false,
          location: 'Moremi Hall, UNILAG',
          status: 'sold',
          views: 189,
          likesCount: 15,
          boosted: false,
          images: JSON.stringify(['/products/macbook.png']),
        },
      }),
    ]);

    // Create Chats
    const chat1 = await db.chat.create({
      data: { listingId: listings[0].id, buyerId: blessing.id, sellerId: chidi.id },
    });
    const chat2 = await db.chat.create({
      data: { listingId: listings[1].id, buyerId: seun.id, sellerId: tunde.id },
    });
    const chat3 = await db.chat.create({
      data: { listingId: listings[3].id, buyerId: blessing.id, sellerId: seun.id },
    });

    // Create Messages
    await db.message.createMany({
      data: [
        { chatId: chat1.id, senderId: blessing.id, message: 'Hi, is the iPhone 13 Pro Max still available?', seen: true },
        { chatId: chat1.id, senderId: chidi.id, message: 'Yes it is! Are you interested?', seen: true },
        { chatId: chat1.id, senderId: blessing.id, message: 'Yes please. What\'s the last price? I saw it\'s negotiable.', seen: true },
        { chatId: chat1.id, senderId: chidi.id, message: 'I can let it go for 430k if you\'re coming to Jaja Hall to pick it up.', seen: false },
        { chatId: chat2.id, senderId: seun.id, message: 'Hey Tunde, is the MacBook Air M1 still available?', seen: true },
        { chatId: chat2.id, senderId: tunde.id, message: 'Yes it is. The price is firm at 580k though. It\'s still under warranty.', seen: true },
        { chatId: chat2.id, senderId: seun.id, message: 'That\'s fair. Can I come see it tomorrow at Moremi?', seen: false },
        { chatId: chat3.id, senderId: blessing.id, message: 'Hi! I love the Ankara tote bag. Do you have one with blue patterns?', seen: true },
        { chatId: chat3.id, senderId: seun.id, message: 'Yes! I have a beautiful blue and white pattern. Let me send you a picture.', seen: false },
      ],
    });

    // Create Reviews
    await db.review.createMany({
      data: [
        { reviewerId: blessing.id, sellerId: chidi.id, rating: 5, comment: 'Great seller! The phone was exactly as described. Very honest and reliable.' },
        { reviewerId: seun.id, sellerId: chidi.id, rating: 4, comment: 'Good transaction. Phone was in good condition as advertised.' },
        { reviewerId: blessing.id, sellerId: tunde.id, rating: 5, comment: 'Tunde is the go-to tech guy! Fixed my laptop screen in one day. Highly recommended.' },
        { reviewerId: chidi.id, sellerId: seun.id, rating: 4, comment: 'Nice Ankara designs. Quality is good. Will definitely buy again.' },
        { reviewerId: tunde.id, sellerId: amina.id, rating: 5, comment: 'Bought a textbook from Amina. It was in better condition than I expected. Great seller!' },
        { reviewerId: chidi.id, sellerId: tunde.id, rating: 5, comment: 'Tunde helped me upgrade my RAM. Fast and affordable service. Trust him completely!' },
      ],
    });

    // Create Saved Listings
    await db.savedListing.createMany({
      data: [
        { userId: blessing.id, listingId: listings[1].id },
        { userId: blessing.id, listingId: listings[10].id },
        { userId: seun.id, listingId: listings[0].id },
        { userId: amina.id, listingId: listings[9].id },
        { userId: tunde.id, listingId: listings[3].id },
        { userId: chidi.id, listingId: listings[7].id },
      ],
    });

    // Create Reports
    await db.report.createMany({
      data: [
        { reporterId: blessing.id, listingId: listings[4].id, reason: 'fake_listing', status: 'pending' },
        { reporterId: amina.id, listingId: null, reason: 'scam', status: 'reviewed' },
      ],
    });

    // Create Notifications
    await db.notification.createMany({
      data: [
        { userId: chidi.id, type: 'new_message', title: 'New Message', message: 'Blessing sent you a message about iPhone 13 Pro Max', read: false },
        { userId: chidi.id, type: 'item_sold', title: 'Listing Update', message: 'Your iPhone 13 Pro Max has been marked as interested by a buyer', read: true },
        { userId: tunde.id, type: 'new_message', title: 'New Message', message: 'Seun sent you a message about MacBook Air M1', read: false },
        { userId: blessing.id, type: 'boost_expiry', title: 'Boost Expiring Soon', message: 'Your boosted listing is expiring in 24 hours', read: false },
        { userId: seun.id, type: 'new_message', title: 'New Message', message: 'Blessing sent you a message about Custom Ankara Tote Bag', read: false },
        { userId: amina.id, type: 'new_follower', title: 'New Review', message: 'Tunde left you a 5-star review!', read: true },
      ],
    });

    // Create Store
    await db.store.create({
      data: {
        ownerId: seun.id,
        name: 'Seun\'s Creative Corner',
        slug: 'seuns-creative-corner',
        category: 'Fashion & Thrift',
        description: 'Your one-stop shop for custom Ankara fashion, trendy accessories, and creative designs on UNILAG campus!',
        logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=creative',
        address: 'Eni Njoku Hall, UNILAG',
        phone: seun.phone,
        whatsapp: seun.whatsapp,
        isVerified: true,
      },
    });

    // Create Boosts
    await db.boost.createMany({
      data: [
        { listingId: listings[0].id, paymentReference: 'PAY-001-BOOST', expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        { listingId: listings[1].id, paymentReference: 'PAY-002-BOOST', expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
        { listingId: listings[3].id, paymentReference: 'PAY-003-BOOST', expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) },
        { listingId: listings[9].id, paymentReference: 'PAY-004-BOOST', expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        { listingId: listings[12].id, paymentReference: 'PAY-005-BOOST', expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) },
      ],
    });

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully!',
      data: {
        users: users.length,
        listings: listings.length,
        chats: 3,
        messages: 9,
        reviews: 6,
        savedListings: 6,
        reports: 2,
        notifications: 6,
        stores: 1,
        boosts: 5,
      },
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json(
      { error: 'Failed to seed database', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
