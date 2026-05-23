import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Development-only logger. In production, only warns and errors are shown.
 * Use this instead of console.log to keep production logs clean.
 */
export const logger = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(...args)
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args)
  },
  error: (...args: unknown[]) => {
    console.error(...args)
  },
  info: (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.info(...args)
    }
  },
}
