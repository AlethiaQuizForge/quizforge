// app/privacy/page.tsx
export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-slate-500 mb-8">Last updated: January 12, 2026</p>
        
        <div className="prose prose-slate max-w-none">
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">1. Introduction</h2>
          <p className="text-slate-600 mb-4">
            QuizForge ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application and website (collectively, the "Service").
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">2.1 Information You Provide</h3>
          <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
            <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
            <li><strong>User Content:</strong> Course materials, documents, and files you upload to generate quizzes</li>
            <li><strong>Quiz Data:</strong> Quizzes you create, answers you submit, and scores you achieve</li>
            <li><strong>Class Information:</strong> Class names, student rosters (names only), and assignment data</li>
          </ul>
          
          <h3 className="text-lg font-medium text-slate-800 mt-6 mb-3">2.2 Information Collected Automatically</h3>
          <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
            <li><strong>Usage Data:</strong> Pages visited, features used, and time spent on the Service</li>
            <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
            <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
            <li>To provide and maintain the Service</li>
            <li>To generate quizzes from your uploaded content using AI</li>
            <li>To track your learning progress and provide analytics</li>
            <li>To enable classroom features (assignments, gradebook)</li>
            <li>To communicate with you about updates and support</li>
            <li>To improve and optimize the Service</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">4. AI Processing</h2>
          <p className="text-slate-600 mb-4">
            We use AI services (Anthropic Claude) to process your uploaded content and generate quiz questions. Your content is sent to these services solely for the purpose of quiz generation and is not used to train AI models. We do not store your uploaded content longer than necessary to provide the Service.
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">5. Data Sharing</h2>
          <p className="text-slate-600 mb-4">We do not sell your personal information. We may share your information with:</p>
          <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
            <li><strong>Service Providers:</strong> Firebase (authentication/storage), Anthropic (AI processing), Vercel (hosting)</li>
            <li><strong>Teachers/Students:</strong> Quiz scores and class data are shared within your classroom groups</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">6. Data Security</h2>
          <p className="text-slate-600 mb-4">
            We implement appropriate security measures including encryption in transit (HTTPS), secure authentication, and access controls. However, no method of transmission over the Internet is 100% secure.
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">7. Data Retention</h2>
          <p className="text-slate-600 mb-4">
            We retain your account data for as long as your account is active. You may delete your account at any time, which will remove your personal data from our systems within 30 days.
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">8. Children's Privacy</h2>
          <p className="text-slate-600 mb-4">
            The Service is intended for users aged 13 and older. If you are under 13, you may only use the Service with parental consent and supervision. We do not knowingly collect personal information from children under 13 without parental consent.
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">9. Your Rights</h2>
          <p className="text-slate-600 mb-4">You have the right to:</p>
          <ul className="list-disc pl-6 text-slate-600 mb-4 space-y-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account and data</li>
            <li>Export your data</li>
            <li>Opt out of marketing communications</li>
          </ul>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">10. International Users</h2>
          <p className="text-slate-600 mb-4">
            If you are accessing the Service from the European Union or other regions with data protection laws, please note that your data may be transferred to and processed in the United States.
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">11. Changes to This Policy</h2>
          <p className="text-slate-600 mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.
          </p>
          
          <h2 className="text-xl font-semibold text-slate-900 mt-8 mb-4">12. Contact Us</h2>
          <p className="text-slate-600 mb-4">
            If you have questions about this Privacy Policy, please contact us at:
          </p>
          <p className="text-slate-600 mb-4">
            <strong>Email:</strong> privacy@quizforgeapp.com<br />
          </p>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-200">
          <a href="/" className="text-indigo-600 hover:text-indigo-500 font-medium">← Back to QuizForge</a>
        </div>
      </div>
    </div>
  );
}
