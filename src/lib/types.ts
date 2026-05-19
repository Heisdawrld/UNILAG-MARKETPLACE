// TypeScript types for UNILAG Marketplace

import type { RunnerPricingGuide } from './runner-pricing';

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
  isRunner: boolean;
  runnerRating: number;
  tasksCompleted: number;
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

export interface ListingStore {
  id: string;
  name: string;
  logo: string | null;
  slug: string;
  isVerified: boolean;
  phone?: string | null;
  whatsapp?: string | null;
}

export interface Listing {
  id: string;
  sellerId: string;
  storeId?: string | null;
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
  store?: ListingStore | null;
}

export interface Task {
  id: string;
  creatorId: string;
  assignedRunnerId: string | null;
  title: string;
  description: string;
  reward: number;
  category: string;
  location: string | null;
  pickupLocation: string | null;
  urgency: string;
  status: string;
  deadline: string | null;
  images: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    username: string;
    avatar: string | null;
    verificationStatus: string;
    trustScore: number;
    hostel: string | null;
  };
  assignedRunner?: {
    id: string;
    username: string;
    avatar: string | null;
    runnerRating: number;
    tasksCompleted: number;
  } | null;
  applications?: TaskApplication[];
  _count?: { applications: number };
  pricingGuide?: RunnerPricingGuide;
}

export interface TaskApplication {
  id: string;
  taskId: string;
  runnerId: string;
  message: string | null;
  proposedPrice: number | null;
  status: string;
  createdAt: string;
  runner: {
    id: string;
    username: string;
    avatar: string | null;
    runnerRating: number;
    tasksCompleted: number;
    trustScore: number;
    verificationStatus: string;
  };
}

export type RunnerApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface RunnerApplication {
  applicationId: string;
  applicantId: string;
  username: string;
  email: string;
  phone: string;
  whatsapp: string;
  faculty: string;
  hostel: string;
  studentId: string;
  transportMode: string;
  availability: string;
  preferredZone: string;
  deliveryExperience: string;
  motivation: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  profilePhoto: string;
  studentIdImage: string;
  status: RunnerApplicationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewNote: string | null;
}

export interface Store {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  logo: string | null;
  banner: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  twitter: string | null;
  address: string | null;
  openHours: string | null;
  isVerified: boolean;
  followCount: number;
  totalSales: number;
  rating: number;
  isFollowing?: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    username: string;
    avatar: string | null;
    verificationStatus: string;
    ratingAverage: number;
  };
  listings?: Listing[];
  _count?: { listings: number; followers: number };
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
    store?: ListingStore | null;
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
  data: string | null;
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
  openTasks: number;
  completedTasks: number;
}

export type ViewTab = 'home' | 'search' | 'sell' | 'tasks' | 'messages' | 'profile';

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

export const TASK_CATEGORIES = [
  'Delivery',
  'Food Pickup',
  'Printing',
  'Tutoring',
  'Shopping',
  'Queue Holding',
  'Cleaning',
  'Moving Help',
  'Miscellaneous',
] as const;

export const URGENCY_LEVELS = ['low', 'medium', 'high', 'urgent'] as const;

export const URGENCY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Normal',
  high: 'High',
  urgent: '🔥 Urgent',
};

export const URGENCY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

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

export const STORE_CATEGORIES = [
  'Electronics & Gadgets',
  'Fashion & Thrift',
  'Food & Snacks',
  'Beauty & Skincare',
  'Phone Repair',
  'Laundry Services',
  'Printing & Design',
  'Tutoring & Lessons',
  'Photography',
  'Barbing & Hair',
  'Tech Accessories',
  'Hostel Essentials',
  'Fitness & Health',
  'Art & Crafts',
  'Others',
] as const;
