import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-950 to-slate-900 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        {/* 404 Icon */}
        <div className="text-8xl mb-6">
          <span role="img" aria-label="Confused face">🤔</span>
        </div>

        {/* Error Message */}
        <h1 className="text-4xl font-bold text-white mb-4">
          Page Not Found
        </h1>
        <p className="text-indigo-200 text-lg mb-8">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:from-amber-400 hover:to-orange-400 shadow-lg transition-all"
          >
            Go to Homepage
          </Link>
          <Link
            href="/pricing"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 shadow-lg transition-all"
          >
            View Pricing
          </Link>
        </div>

        {/* Help Text */}
        <p className="text-indigo-300 text-sm mt-8">
          Need help? Contact us at{' '}
          <a
            href="mailto:support@quizforgeapp.com"
            className="text-amber-400 hover:text-amber-300 underline"
          >
            support@quizforgeapp.com
          </a>
        </p>
      </div>
    </div>
  );
}
