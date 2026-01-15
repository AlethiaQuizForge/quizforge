// Constants for QuizForge application
// Extracted from QuizForge.jsx to avoid magic numbers

export const CONSTANTS = {
  // File handling
  MAX_FILE_SIZE_MB: 20,
  MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024,

  // Quiz settings
  MAX_PRACTICE_QUESTIONS: 10,
  MAX_TIMED_QUESTIONS: 20,
  RECENT_SCORES_HISTORY: 7,
  QUICK_PRACTICE_SIZE: 5,
  MAX_QUESTION_BANK_SIZE: 500,
  MAX_SHARED_QUESTIONS: 50,

  // Pagination
  ADMIN_BATCH_SIZE: 5,
  MEMBERS_PER_PAGE: 10,

  // Time limits
  SAVED_PROGRESS_EXPIRY_HOURS: 24,
  TOAST_DURATION_MS: 3000,
  DEBOUNCE_DELAY_MS: 500,
  FILE_UPLOAD_TIMEOUT_MS: 120000, // 2 minutes
  SUBSCRIPTION_POLL_INTERVAL_MS: 2000,
  SUBSCRIPTION_POLL_MAX_ATTEMPTS: 10,

  // Rate limits
  MAX_PDF_PAGES: 20,
  MAX_VISION_PAGES: 10,

  // Spaced repetition
  REVIEW_DAYS: {
    MASTERED: 7,    // >80% correct
    LEARNING: 3,    // 60-80% correct
    STRUGGLING: 1,  // 40-60% correct
    NEEDS_WORK: 0.5 // <40% correct
  }
} as const;

// Valid enum values for API validation
export const VALID_DIFFICULTIES = ['basic', 'mixed', 'advanced'] as const;
export const VALID_QUESTION_TYPES = ['multiple-choice', 'true-false', 'mixed'] as const;
export const VALID_QUESTION_STYLES = ['concept', 'case', 'mixed'] as const;

export type Difficulty = typeof VALID_DIFFICULTIES[number];
export type QuestionType = typeof VALID_QUESTION_TYPES[number];
export type QuestionStyle = typeof VALID_QUESTION_STYLES[number];
