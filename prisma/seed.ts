import { db } from '@/lib/db';

const categories = [
  'Textbooks & Notes',
  'Electronics',
  'Fashion',
  'Accommodation',
  'Food & Groceries',
  'Services',
  'Furniture',
  'Phones & Accessories',
  'Others',
];

const hostels = [
  'Moremi Hall',
  'Makama Bida Hall',
  'Jaja Hall',
  'Queen Amina Hall',
  'King Jaja Hall',
  'Biobaku Hall',
  'Eni Njoku Hall',
  'Kofo Hall',
  'Off-Campus',
];

const departments = [
  'Computer Science',
  'Electrical Engineering',
  'Accounting',
  'Law',
  'Medicine',
  'Mass Communication',
  'Economics',
  'Business Administration',
  'Architecture',
  'Pharmacy',
];

const conditions = ['New', 'Like New', 'Good', 'Fair', 'Used'];

const sampleListings = [
  { title: 'CSC 201 Textbook - Introduction to Programming', description: 'Clean copy, barely used. Covers Python and Java basics. Great for 200-level CS students.', price: 3500, category: 'Textbooks & Notes', condition: 'Like New', images: '[]', location: 'Moremi Hall' },
  { title: 'HP Laptop - Core i5, 8GB RAM, 256GB SSD', description: 'Perfect for coding and assignments. Battery life is solid at 4-5 hours. Comes with charger and laptop bag.', price: 85000, category: 'Electronics', condition: 'Good', images: '[]', location: 'Biobaku Hall' },
  { title: 'Unilag Branded Hoodie - Size L', description: 'Original Unilag hoodie, black with gold lettering. Worn only twice. Very clean.', price: 5500, category: 'Fashion', condition: 'Like New', images: '[]', location: 'Queen Amina Hall' },
  { title: 'Single Room at Bariga - Close to Campus', description: 'Self-contained room, running water, prepaid meter. 5 mins walk to school gate. Available from next semester.', price: 150000, category: 'Accommodation', condition: 'Good', images: '[]', location: 'Off-Campus' },
  { title: 'Home-cooked Pounded Yam & Egusi', description: 'Freshly made, can deliver within campus. Order before 12pm for same-day delivery. Serves 2.', price: 2500, category: 'Food & Groceries', condition: 'New', images: '[]', location: 'Moremi Hall' },
  { title: 'Assignment Typing & Printing Service', description: 'Fast and affordable. ₦100 per page for typing, ₦50 per page for printing. Bulk discounts available.', price: 100, category: 'Services', condition: 'New', images: '[]', location: 'Jaja Hall' },
  { title: ' Wooden Study Table with Chair', description: 'Sturdy table perfect for reading. Comes with a comfortable chair. Moving out so need to sell.', price: 8000, category: 'Furniture', condition: 'Good', images: '[]', location: 'Eni Njoku Hall' },
  { title: 'iPhone 11 - 64GB, Black', description: 'Clean UK used iPhone 11. Battery health at 87%. No cracks, everything works perfectly.', price: 120000, category: 'Phones & Accessories', condition: 'Good', images: '[]', location: 'Makama Bida Hall' },
  { title: 'ECO 201 Past Questions & Answers (2020-2025)', description: 'Comprehensive past question compilation with detailed answers. Helped me score an A!', price: 1500, category: 'Textbooks & Notes', condition: 'Good', images: '[]', location: 'Kofo Hall' },
  { title: 'AirPods Pro 2 - White', description: 'Barely used, comes with original case and cable. Active noise cancellation works perfectly.', price: 65000, category: 'Electronics', condition: 'Like New', images: '[]', location: 'Moremi Hall' },
  { title: 'Ankara Fabric - 6 yards, Premium Quality', description: 'Beautiful ankara print, perfect for traditional events. 100% cotton, never been used.', price: 4000, category: 'Fashion', condition: 'New', images: '[]', location: 'Queen Amina Hall' },
  { title: 'Hair Braiding Service - Various Styles', description: 'Professional braiding at affordable prices. Box braids, twists, cornrows, and more. Home service available.', price: 5000, category: 'Services', condition: 'New', images: '[]', location: 'Off-Campus' },
  { title: 'Mini Fridge - 50L, Working Perfectly', description: 'Great for keeping drinks and food cold in your room. Low power consumption.', price: 18000, category: 'Furniture', condition: 'Good', images: '[]', location: 'King Jaja Hall' },
  { title: 'Samsung Galaxy A14 - 128GB', description: 'Clean phone, no scratches. Comes with pouch and charger. Good for browsing and school work.', price: 55000, category: 'Phones & Accessories', condition: 'Good', images: '[]', location: 'Biobaku Hall' },
  { title: 'MAT 101 Textbook + Solution Manual', description: 'Essential for 100-level students. Textbook and solution manual as a bundle. Save ₦500 buying both!', price: 4000, category: 'Textbooks & Notes', condition: 'Good', images: '[]', location: 'Jaja Hall' },
  { title: 'Indomie, Spaghetti & Groceries Bundle', description: 'Bulk food items at wholesale prices. 10 packs indomie, 5 packs spaghetti, vegetable oil, and seasoning.', price: 6000, category: 'Food & Groceries', condition: 'New', images: '[]', location: 'Off-Campus' },
  { title: 'Self-Contained Room in Akoka', description: 'Tiled room, water available, close to campus. Agent fee applies. Available immediately.', price: 180000, category: 'Accommodation', condition: 'Good', images: '[]', location: 'Off-Campus' },
  { title: 'Graphic Design Service - Logos, Flyers, Posters', description: 'Professional designs for events, businesses, and school projects. Fast turnaround, unlimited revisions.', price: 3000, category: 'Services', condition: 'New', images: '[]', location: 'Moremi Hall' },
  { title: 'Bluetooth Speaker - JBL Go 3', description: 'Portable speaker, great sound quality. Waterproof. Perfect for room vibes.', price: 12000, category: 'Electronics', condition: 'Like New', images: '[]', location: 'Makama Bida Hall' },
  { title: 'Sneakers - Nike Air Max, Size 42', description: 'Original Nike Air Max, worn a few times. Very clean, no tears. Selling because I got a new pair.', price: 25000, category: 'Fashion', condition: 'Good', images: '[]', location: 'Eni Njoku Hall' },
];

async function seed() {
  // Create sample users
  const users = [];
  const names = ['Adebayo Okafor', 'Chioma Nwosu', 'Emeka Adeyemi', 'Fatima Bello', 'Tunde Bakare', 'Blessing Ojo', 'Olumide Fashola', 'Ngozi Eze', 'Segun Adeniyi', 'Aisha Mohammed'];
  
  for (let i = 0; i < names.length; i++) {
    const user = await db.user.create({
      data: {
        name: names[i],
        email: `${names[i].toLowerCase().replace(' ', '.')}@unilag.edu.ng`,
        phone: `+234801234567${i}`,
        whatsapp: `+234801234567${i}`,
        hostel: hostels[i % hostels.length],
        department: departments[i % departments.length],
        level: `${200 + (i % 4)} Level`,
      },
    });
    users.push(user);
  }

  // Create sample listings
  for (let i = 0; i < sampleListings.length; i++) {
    const listing = sampleListings[i];
    await db.listing.create({
      data: {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        images: listing.images,
        location: listing.location,
        isFeatured: i < 6,
        sellerId: users[i % users.length].id,
      },
    });
  }

  console.log('Seed data created successfully!');
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect());
