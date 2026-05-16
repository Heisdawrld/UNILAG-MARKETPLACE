import { CATEGORY_PLACEHOLDER_IMAGES } from './types';

// Format price with Naira symbol and commas
export function formatPrice(price: number): string {
  return `₦${price.toLocaleString('en-NG')}`;
}

// Time ago formatting
export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

// Get listing images - parse from JSON string, fallback to placeholder
export function getListingImages(images: string, category: string): string[] {
  try {
    const parsed = JSON.parse(images);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // fallback to placeholder
  }
  return [CATEGORY_PLACEHOLDER_IMAGES[category] || CATEGORY_PLACEHOLDER_IMAGES['Others']];
}

// Get the first image of a listing
export function getListingFirstImage(images: string, category: string): string {
  const imgs = getListingImages(images, category);
  return imgs[0];
}

// Debounce function
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Truncate text
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Verification badge label
export function getVerificationLabel(status: string): string {
  switch (status) {
    case 'unilag_verified': return 'UNILAG Verified';
    case 'email_verified': return 'Email Verified';
    default: return '';
  }
}

// Get verification color
export function getVerificationColor(status: string): string {
  switch (status) {
    case 'unilag_verified': return 'text-emerald-600 dark:text-emerald-400';
    case 'email_verified': return 'text-blue-600 dark:text-blue-400';
    default: return '';
  }
}

// Star rating display
export function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
