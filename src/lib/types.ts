// TypeScript types for UNILAG Marketplace

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  faculty: string | null;
  department: string | null;
  level: string | null;
  bio: string | null;
  phone: string | null;
  whatsapp: string | null;
  hostel: string | null;
  verificationStatus: string;
  trustScore: number;
  ratingAverage: number;
  totalReviews: number;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListingSeller {
  id: string;
  username: string;
  avatar: string | null;
  faculty: string | null;
  department: string | null;
  verificationStatus: string;
  ratingAverage: number;
  phone?: string;
  whatsapp?: string;
  hostel?: string;
}

export interface Listing {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: number;
  category: string;
  condition: string;
  negotiable: boolean;
  location: string | null;
  status: string;
  views: number;
  likesCount: number;
  boosted: boolean;
  images: string;
  createdAt: string;
  updatedAt: string;
  seller: ListingSeller;
}

export interface Chat {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  listing: {
    id: string;
    title: string;
    price: number;
    images: string;
    status: string;
  };
  buyer: {
    id: string;
    username: string;
    avatar: string | null;
  };
  seller: {
    id: string;
    username: string;
    avatar: string | null;
  };
  lastMessage: {
    id: string;
    message: string;
    senderId: string;
    seen: boolean;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  message: string;
  imageUrl: string | null;
  seen: boolean;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export interface Review {
  id: string;
  reviewerId: string;
  sellerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  reviewer: {
    id: string;
    username: string;
    avatar: string | null;
  };
}

export interface SavedListing {
  id: string;
  userId: string;
  listingId: string;
  createdAt: string;
  listing: Listing;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  listingId: string | null;
  reason: string;
  status: string;
  createdAt: string;
  reporter?: {
    id: string;
    username: string;
  };
  listing?: {
    id: string;
    title: string;
  } | null;
}

export interface AdminStats {
  totalUsers: number;
  activeListings: number;
  totalChats: number;
  pendingReports: number;
  totalListings: number;
  soldListings: number;
}

export type ViewTab = 'home' | 'search' | 'sell' | 'messages' | 'profile';

export const CATEGORIES = [
  'Electronics',
  'Phones & Tablets',
  'Laptops',
  'Textbooks',
  'Fashion',
  'Services',
  'Hostel Essentials',
  'Food & Drinks',
  'Sports',
  'Others',
] as const;

export const CONDITIONS = [
  'brand_new',
  'like_new',
  'fairly_used',
] as const;

export const CONDITION_LABELS: Record<string, string> = {
  brand_new: 'Brand New',
  like_new: 'Like New',
  fairly_used: 'Fairly Used',
};

export const CONDITION_COLORS: Record<string, string> = {
  brand_new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  like_new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  fairly_used: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

export const CATEGORY_PLACEHOLDER_IMAGES: Record<string, string> = {
  'Electronics': 'https://placehold.co/400x400/1a1a2e/eee?text=Electronics',
  'Phones & Tablets': 'https://placehold.co/400x400/16213e/eee?text=Phones',
  'Laptops': 'https://placehold.co/400x400/0f3460/eee?text=Laptops',
  'Textbooks': 'https://placehold.co/400x400/533483/eee?text=Textbooks',
  'Fashion': 'https://placehold.co/400x400/e94560/eee?text=Fashion',
  'Services': 'https://placehold.co/400x400/6B1D2A/eee?text=Services',
  'Hostel Essentials': 'https://placehold.co/400x400/2d4059/eee?text=Hostel',
  'Food & Drinks': 'https://placehold.co/400x400/ea5455/eee?text=Food',
  'Sports': 'https://placehold.co/400x400/3d5a80/eee?text=Sports',
  'Others': 'https://placehold.co/400x400/666/eee?text=Other',
};
