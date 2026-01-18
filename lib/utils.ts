// Utility functions for QuizForge application

/**
 * Fisher-Yates shuffle algorithm
 * Returns a new shuffled array without modifying the original
 */
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate a random class code (6 characters, alphanumeric, no ambiguous chars)
 */
export function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Safe JSON parse with fallback
 * Returns null if parsing fails instead of throwing
 */
export function safeJsonParse<T>(json: string, fallback: T | null = null): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Format seconds as MM:SS
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, word: string): string {
  return count === 1 ? `${count} ${word}` : `${count} ${word}s`;
}

/**
 * Estimate quiz completion time based on question types
 */
export function estimateQuizTime(questions: Array<{ type?: string }>): string {
  if (!questions || questions.length === 0) return '0 min';
  const totalSeconds = questions.reduce((acc, q) => {
    return acc + (q.type === 'true-false' ? 20 : 30);
  }, 0);
  const minutes = Math.ceil(totalSeconds / 60);
  return minutes <= 1 ? '~1 min' : `~${minutes} min`;
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Create a promise that rejects after a timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sanitize text to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize a quiz question object
 * Cleans all text fields to prevent XSS
 */
export function sanitizeQuestion(question: {
  question?: string;
  explanation?: string;
  topic?: string;
  options?: Array<{ text?: string; isCorrect?: boolean }>;
  [key: string]: unknown;
}): typeof question {
  return {
    ...question,
    question: sanitizeText(question.question),
    explanation: sanitizeText(question.explanation),
    topic: sanitizeText(question.topic),
    options: question.options?.map(opt => ({
      ...opt,
      text: sanitizeText(opt.text),
    })),
  };
}

/**
 * Validate and sanitize a URL
 * Prevents javascript: and data: URIs
 * Returns empty string if URL is invalid or potentially dangerous
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';

  // Trim whitespace
  const trimmed = url.trim();

  // Block dangerous protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:')
  ) {
    return '';
  }

  // Allow http, https, mailto, and relative URLs
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('/') ||
    lower.startsWith('#')
  ) {
    return trimmed;
  }

  // For other URLs, prepend https:// if it looks like a domain
  if (/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z]{2,})+/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return '';
}
