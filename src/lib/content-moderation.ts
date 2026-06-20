/**
 * content-moderation.ts — Basic content moderation for marketplace listings
 *
 * Checks listing titles and descriptions for:
 * - Blocked phrases (academic dishonesty — auto-block)
 * - Flagged words (suspicious content — flag for review)
 */

const BLOCKED_PHRASES = [
  'exam question', 'test paper', 'answer sheet', 'question paper',
  'leaked', 'expo', 'malpractice', 'cheat sheet',
]

const FLAGGED_WORDS = [
  'gun', 'weapon', 'drug', 'weed', 'cannabis', 'cocaine',
  'fraud', 'scam', 'yahoo yahoo', 'hack',
]

export function checkListingContent(title: string, description: string): {
  isBlocked: boolean
  isFlagged: boolean
  reasons: string[]
} {
  const text = `${title} ${description}`.toLowerCase()
  const reasons: string[] = []
  let isBlocked = false
  let isFlagged = false

  for (const phrase of BLOCKED_PHRASES) {
    if (text.includes(phrase)) {
      isBlocked = true
      reasons.push(`Academic dishonesty: "${phrase}"`)
    }
  }

  for (const word of FLAGGED_WORDS) {
    if (text.includes(word)) {
      isFlagged = true
      reasons.push(`Flagged content: "${word}"`)
    }
  }

  return { isBlocked, isFlagged, reasons }
}
