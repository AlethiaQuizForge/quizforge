'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';

// Initialize Firebase (same config as main app)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

// Plan data
const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    description: 'Perfect for trying out QuizForge',
    limits: {
      users: 1,
      quizzesPerMonth: 5,
      classesMax: 1,
      studentsPerClass: 30,
    },
    features: [
      '5 quizzes per month',
      '1 class with 30 students',
      'All question types',
      'PDF export',
      'Basic analytics',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 9,
    description: 'For power users who want more',
    limits: {
      users: 1,
      quizzesPerMonth: 25,
      classesMax: 3,
      studentsPerClass: 50,
    },
    features: [
      '25 quizzes per month',
      '3 classes with 50 students each',
      'All question types',
      'PDF export',
      'Full analytics dashboard',
      'Priority support',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  school: {
    id: 'school',
    name: 'School',
    price: 199,
    promoPrice: 159, // 20% off Jan-Feb
    description: 'For departments & small schools',
    limits: {
      users: 25,
      quizzesPerMonth: 25,
      classesMax: 3,
      studentsPerClass: 50,
    },
    features: [
      '25 teacher accounts',
      '25 quizzes per teacher/month',
      '3 classes per teacher',
      '50 students per class',
      'Admin dashboard',
      'Organization analytics',
      'Teacher management',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
  university: {
    id: 'university',
    name: 'University',
    price: 499,
    promoPrice: 399, // 20% off Jan-Feb
    description: 'For large institutions',
    limits: {
      users: 50,
      quizzesPerMonth: 35,
      classesMax: 10,
      studentsPerClass: 100,
    },
    features: [
      '50 professor accounts',
      '35 quizzes per professor/month',
      '10 classes per professor',
      '100 students per class',
      'Advanced admin dashboard',
      'Organization-wide analytics',
      'Invoice billing',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
};

const FAQ_ITEMS = [
  {
    question: 'How does the AI quiz generation work?',
    answer: 'QuizForge uses Claude AI, one of the most advanced language models available, to analyze your course materials and generate high-quality questions. Simply upload your slides, PDFs, or notes, and our AI extracts key concepts to create relevant multiple-choice and true/false questions with detailed explanations.',
  },
  {
    question: 'Do quiz limits reset each month?',
    answer: 'Yes! Your quiz generation limit resets at the beginning of each billing cycle. Unused quizzes do not roll over to the next month, so make the most of your allocation each month.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Absolutely. You can cancel your subscription at any time from your account settings. You\'ll continue to have access to your paid features until the end of your current billing period.',
  },
  {
    question: 'What file formats are supported?',
    answer: 'QuizForge supports PDF, Word documents (.docx), PowerPoint presentations (.pptx), and plain text. You can also upload images of handwritten notes or slides - our AI can extract text from images too!',
  },
  {
    question: 'Can students use QuizForge for free?',
    answer: 'Yes! Students can sign up for free and use QuizForge to generate practice quizzes from their own study materials. They can also join classes created by teachers to take assigned quizzes.',
  },
  {
    question: 'What\'s included in organization plans?',
    answer: 'School and University plans include multiple teacher accounts, an admin dashboard for managing your team, organization-wide analytics to track performance across all classes, and centralized billing.',
  },
];


const FEATURES_COMPARISON = [
  { feature: 'AI Quiz Generation', free: true, pro: true, school: true, university: true },
  { feature: 'Multiple Choice Questions', free: true, pro: true, school: true, university: true },
  { feature: 'True/False Questions', free: true, pro: true, school: true, university: true },
  { feature: 'PDF Export', free: true, pro: true, school: true, university: true },
  { feature: 'Class Management', free: '1 class', pro: '3 classes', school: '3 per teacher', university: '10 per teacher' },
  { feature: 'Students per Class', free: '30', pro: '50', school: '50', university: '100' },
  { feature: 'Quizzes per Month', free: '5', pro: '25', school: '25 per teacher', university: '35 per teacher' },
  { feature: 'Question Editing', free: true, pro: true, school: true, university: true },
  { feature: 'Timed Quizzes', free: true, pro: true, school: true, university: true },
  { feature: 'Student Analytics', free: 'Basic', pro: 'Full', school: 'Full', university: 'Advanced' },
  { feature: 'Admin Dashboard', free: false, pro: false, school: true, university: true },
  { feature: 'Team Management', free: false, pro: false, school: '25 teachers', university: '50 professors' },
  { feature: 'Invoice Billing', free: false, pro: false, school: false, university: true },
  { feature: 'Priority Support', free: false, pro: true, school: true, university: 'Dedicated' },
];

// Check if we're in Jan-Feb promo period
const isPromoActive = () => {
  const month = new Date().getMonth(); // 0 = Jan, 1 = Feb
  return month === 0 || month === 1;
};

export default function PricingPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [selectedOrgPlan, setSelectedOrgPlan] = useState<'school' | 'university' | null>(null);
  const [orgName, setOrgName] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const showPromo = isPromoActive();

  // Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Handle checkout for any plan
  const handleCheckout = async (planId: string, orgName?: string) => {
    if (!user) {
      // Redirect to main app to sign in first
      window.location.href = '/?redirect=pricing&plan=' + planId;
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError('');

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId,
          ...(orgName ? { orgName } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Something went wrong');
      setCheckoutLoading(false);
    }
  };

  // Handle org plan button click
  const handleOrgPlanClick = (planId: 'school' | 'university') => {
    if (!user) {
      window.location.href = '/?redirect=pricing&plan=' + planId;
      return;
    }
    setSelectedOrgPlan(planId);
    setOrgName('');
    setCheckoutError('');
    setShowOrgModal(true);
  };

  // Handle org checkout submit
  const handleOrgCheckoutSubmit = () => {
    if (!orgName.trim()) {
      setCheckoutError('Please enter your organization name');
      return;
    }
    if (!selectedOrgPlan) return;
    setShowOrgModal(false);
    handleCheckout(selectedOrgPlan, orgName.trim());
  };

  // Check for dark mode preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('quizforge-dark-mode');
      if (savedMode) {
        setDarkMode(savedMode === 'true');
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setDarkMode(true);
      }
    }
  }, []);

  // Apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('quizforge-dark-mode', String(newMode));
  };

  const getPrice = (price: number) => {
    if (price === 0) return 'Free';
    if (billingCycle === 'yearly') {
      const yearlyPrice = Math.round(price * 10); // 2 months free
      return `$${yearlyPrice}`;
    }
    return `$${price}`;
  };

  const getPricePeriod = (price: number) => {
    if (price === 0) return 'forever';
    return billingCycle === 'yearly' ? '/year' : '/month';
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-900' : 'bg-white'}`}>
      {/* Navigation */}
      <nav className="px-6 py-4 flex justify-between items-center max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-slate-900'}`}>QuizForge</span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleDarkMode}
            className={`p-2 rounded-lg ${darkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <Link
            href="/"
            className={`px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-500 hover:to-purple-500 transition-all`}
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main id="main-content">
      {/* Hero Section */}
      <section className="pt-12 pb-8 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-6 ${
            darkMode
              ? 'bg-indigo-500/20 text-indigo-300'
              : 'bg-indigo-100 text-indigo-700'
          }`}>
            <span>🧠</span> Powered by Claude AI
          </div>
          <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Save Hours on Assessment Creation
          </h1>
          <p className={`text-xl max-w-2xl mx-auto mb-8 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Transform your course materials into engaging quizzes in seconds.
            Start creating better assessments today.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className={billingCycle === 'monthly' ? (darkMode ? 'text-white font-medium' : 'text-slate-900 font-medium') : (darkMode ? 'text-slate-400' : 'text-slate-500')}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(b => b === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  : darkMode ? 'bg-slate-700' : 'bg-slate-300'
              }`}
            >
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow-md ${
                billingCycle === 'yearly' ? 'translate-x-8' : 'translate-x-1'
              }`} />
            </button>
            <span className={billingCycle === 'yearly' ? (darkMode ? 'text-white font-medium' : 'text-slate-900 font-medium') : (darkMode ? 'text-slate-400' : 'text-slate-500')}>
              Yearly
            </span>
            {billingCycle === 'yearly' && (
              <span className="px-2 py-1 bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">
                Save 17% — 2 months free
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Individual Plans */}
          <div className="mb-16">
            <h2 className={`text-2xl font-bold text-center mb-8 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              For Individual Teachers & Students
            </h2>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {['free', 'pro'].map((planId) => {
                const plan = PLANS[planId as keyof typeof PLANS];
                const isPro = planId === 'pro';
                return (
                  <div
                    key={planId}
                    className={`relative rounded-2xl p-6 transition-all duration-300 ${
                      isPro
                        ? darkMode
                          ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700 shadow-xl shadow-indigo-500/20 ring-2 ring-indigo-400'
                          : 'bg-gradient-to-br from-indigo-500 via-purple-500 to-indigo-600 shadow-xl shadow-indigo-500/30 ring-2 ring-indigo-300'
                        : darkMode
                          ? 'bg-slate-800 border border-slate-700'
                          : 'bg-white border border-slate-200 shadow-lg'
                    }`}
                  >
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-lg">
                          MOST POPULAR
                        </span>
                      </div>
                    )}
                    <div className="text-center mb-6">
                      <h3 className={`text-2xl font-bold mb-2 ${isPro ? 'text-white' : darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {plan.name}
                      </h3>
                      <p className={`text-sm ${isPro ? 'text-indigo-100' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {plan.description}
                      </p>
                    </div>
                    <div className="text-center mb-6">
                      <span className={`text-5xl font-bold ${isPro ? 'text-white' : darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {getPrice(plan.price)}
                      </span>
                      <span className={`text-lg ${isPro ? 'text-indigo-200' : darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {getPricePeriod(plan.price)}
                      </span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className={`flex items-start gap-3 ${isPro ? 'text-white' : darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          <span className={`mt-0.5 ${isPro ? 'text-amber-300' : 'text-green-500'}`}>✓</span>
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {isPro ? (
                      <button
                        onClick={() => handleCheckout('pro')}
                        disabled={checkoutLoading}
                        className={`block w-full py-3 rounded-xl font-semibold text-center transition-all bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {checkoutLoading ? 'Loading...' : plan.cta}
                      </button>
                    ) : (
                      <Link
                        href="/"
                        className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${
                          darkMode
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {plan.cta}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Student discount note */}
          <div className={`mt-8 text-center p-4 rounded-xl ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
            <p className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              🎓 Student on a budget? <button onClick={() => window.location.href = 'mailto:support@quizforgeapp.com?subject=Student%20Discount%20Request'} className="text-indigo-500 hover:text-indigo-400 font-medium underline underline-offset-2">Reach out to us</button> — we'll hook you up with a discount.
            </p>
          </div>
        </div>

          {/* Organization Plans */}
          <div>
            <h2 className={`text-2xl font-bold text-center mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              For Schools & Universities
            </h2>
            <p className={`text-center mb-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Empower your entire institution with AI-powered assessments
            </p>
            {showPromo && (
              <div className="text-center mb-8">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-bold rounded-full shadow-lg">
                  <span>🎉</span> New Year Sale: 20% OFF — Ends Feb 28
                </span>
              </div>
            )}
            {!showPromo && <div className="mb-4" />}
            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {['school', 'university'].map((planId) => {
                const plan = PLANS[planId as keyof typeof PLANS];
                const isUniversity = planId === 'university';
                return (
                  <div
                    key={planId}
                    className={`relative rounded-2xl p-6 transition-all duration-300 ${
                      isUniversity
                        ? darkMode
                          ? 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 shadow-xl shadow-amber-500/20 ring-2 ring-amber-400'
                          : 'bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 shadow-xl shadow-amber-500/30 ring-2 ring-amber-300'
                        : darkMode
                          ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-700 border border-slate-600'
                          : 'bg-gradient-to-br from-slate-100 via-white to-slate-100 border border-slate-200 shadow-lg'
                    }`}
                  >
                    {isUniversity && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 bg-white text-amber-700 text-xs font-bold rounded-full shadow-lg">
                          BEST VALUE
                        </span>
                      </div>
                    )}
                    <div className="text-center mb-6">
                      <h3 className={`text-2xl font-bold mb-2 ${
                        isUniversity ? 'text-white' : darkMode ? 'text-white' : 'text-slate-900'
                      }`}>
                        {plan.name}
                      </h3>
                      <p className={`text-sm ${
                        isUniversity ? 'text-amber-100' : darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {plan.description}
                      </p>
                    </div>
                    <div className="text-center mb-6">
                      {showPromo && 'promoPrice' in plan ? (
                        <>
                          <span className={`text-2xl line-through opacity-60 mr-2 ${
                            isUniversity ? 'text-white' : darkMode ? 'text-slate-400' : 'text-slate-400'
                          }`}>
                            ${plan.price}
                          </span>
                          <span className={`text-5xl font-bold ${
                            isUniversity ? 'text-white' : darkMode ? 'text-white' : 'text-slate-900'
                          }`}>
                            ${(plan as typeof plan & { promoPrice: number }).promoPrice}
                          </span>
                        </>
                      ) : (
                        <span className={`text-5xl font-bold ${
                          isUniversity ? 'text-white' : darkMode ? 'text-white' : 'text-slate-900'
                        }`}>
                          {getPrice(plan.price)}
                        </span>
                      )}
                      <span className={`text-lg ${
                        isUniversity ? 'text-amber-200' : darkMode ? 'text-slate-400' : 'text-slate-500'
                      }`}>
                        {getPricePeriod(plan.price)}
                      </span>
                    </div>
                    <ul className="space-y-3 mb-8">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className={`flex items-start gap-3 ${
                          isUniversity ? 'text-white' : darkMode ? 'text-slate-300' : 'text-slate-600'
                        }`}>
                          <span className={`mt-0.5 ${isUniversity ? 'text-amber-200' : 'text-green-500'}`}>✓</span>
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleOrgPlanClick(planId as 'school' | 'university')}
                      disabled={checkoutLoading}
                      className={`block w-full py-3 rounded-xl font-semibold text-center transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        isUniversity
                          ? 'bg-white text-amber-700 hover:bg-amber-50 shadow-lg'
                          : darkMode
                            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                      }`}
                    >
                      {checkoutLoading ? 'Loading...' : `Get ${plan.name}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Why QuizForge */}
      <section className={`py-16 px-6 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Why Teachers Love QuizForge
          </h2>
          <p className={`text-center mb-12 max-w-2xl mx-auto ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Create professional quizzes in minutes instead of hours
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '⏱️',
                title: 'Save 3-4 Hours Per Week',
                description: 'What used to take hours now takes minutes. Upload your materials and let AI do the heavy lifting.',
              },
              {
                icon: '🧠',
                title: 'Powered by Claude AI',
                description: 'Built on one of the most advanced AI models available. Get questions that test understanding, not just memorization.',
              },
              {
                icon: '📊',
                title: 'Deep Analytics',
                description: 'Understand exactly where students struggle. Identify knowledge gaps and adjust your teaching accordingly.',
              },
              {
                icon: '🎯',
                title: 'Concept-Focused Questions',
                description: 'Our AI extracts underlying theories and frameworks, creating questions that test transferable knowledge.',
              },
              {
                icon: '📱',
                title: 'Works Anywhere',
                description: 'Students can take quizzes on any device. Perfect for in-class assessments or homework.',
              },
              {
                icon: '🔒',
                title: 'Secure & Private',
                description: 'Your course materials and student data are encrypted and never shared. GDPR compliant.',
              },
            ].map((feature, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl ${
                  darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white shadow-lg'
                }`}
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  {feature.title}
                </h3>
                <p className={darkMode ? 'text-slate-400' : 'text-slate-600'}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Compare Plans
          </h2>
          <p className={`text-center mb-12 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Find the perfect plan for your needs
          </p>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={darkMode ? 'border-b border-slate-700' : 'border-b border-slate-200'}>
                  <th className={`text-left py-4 px-4 font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Feature
                  </th>
                  <th className={`text-center py-4 px-4 font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Free
                  </th>
                  <th className={`text-center py-4 px-4 font-semibold ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    Pro
                  </th>
                  <th className={`text-center py-4 px-4 font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    School
                  </th>
                  <th className={`text-center py-4 px-4 font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                    University
                  </th>
                </tr>
              </thead>
              <tbody>
                {FEATURES_COMPARISON.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`${
                      darkMode
                        ? idx % 2 === 0 ? 'bg-slate-800/50' : ''
                        : idx % 2 === 0 ? 'bg-slate-50' : ''
                    } ${darkMode ? 'border-b border-slate-800' : 'border-b border-slate-100'}`}
                  >
                    <td className={`py-3 px-4 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                      {row.feature}
                    </td>
                    {['free', 'pro', 'school', 'university'].map((plan) => (
                      <td key={plan} className="py-3 px-4 text-center">
                        {typeof row[plan as keyof typeof row] === 'boolean' ? (
                          row[plan as keyof typeof row] ? (
                            <span className="text-green-500 text-lg">✓</span>
                          ) : (
                            <span className={`${darkMode ? 'text-slate-600' : 'text-slate-300'}`}>—</span>
                          )
                        ) : (
                          <span className={`text-sm ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                            {row[plan as keyof typeof row]}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Social Proof Badge */}
      <section className={`py-8 px-6 ${darkMode ? 'bg-slate-800/50' : 'bg-gradient-to-br from-indigo-50 to-purple-50'}`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-full ${
            darkMode ? 'bg-slate-700/50 border border-slate-600' : 'bg-white shadow-md'
          }`}>
            <span className="text-2xl">🎓</span>
            <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Loved by Students
            </span>
            <span className={`text-sm ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              — Used at Copenhagen Business School
            </span>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className={`text-3xl font-bold text-center mb-4 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
            Frequently Asked Questions
          </h2>
          <p className={`text-center mb-12 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Got questions? We've got answers.
          </p>
          <div className="space-y-4">
            {FAQ_ITEMS.map((item, idx) => (
              <div
                key={idx}
                className={`rounded-xl overflow-hidden ${
                  darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white shadow-md'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className={`w-full px-6 py-4 flex items-center justify-between text-left ${
                    darkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className={`font-semibold ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {item.question}
                  </span>
                  <span className={`text-xl transition-transform ${openFaq === idx ? 'rotate-45' : ''} ${
                    darkMode ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    +
                  </span>
                </button>
                {openFaq === idx && (
                  <div className={`px-6 pb-4 ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={`py-16 px-6 ${
        darkMode
          ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900'
          : 'bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-700'
      }`}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Assessments?
          </h2>
          <p className="text-xl text-indigo-200 mb-8">
            Save hours every week with AI-powered quiz generation.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/"
              className="px-8 py-4 bg-white text-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-50 shadow-lg transition-all"
            >
              Get Started Free
            </Link>
          </div>
          <p className="mt-6 text-indigo-300 text-sm">
            No credit card required • Free forever plan available
          </p>
        </div>
      </section>
      </main>

      {/* Organization Name Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${
            darkMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'
          }`}>
            <h3 className={`text-xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-slate-900'}`}>
              Set Up Your Organization
            </h3>
            <p className={`text-sm mb-6 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Enter your {selectedOrgPlan === 'university' ? 'university' : 'school'} name to get started.
            </p>

            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder={selectedOrgPlan === 'university' ? 'e.g., Stanford University' : 'e.g., Lincoln High School'}
                className={`w-full px-4 py-3 rounded-xl border transition-colors ${
                  darkMode
                    ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:border-indigo-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                onKeyDown={(e) => e.key === 'Enter' && handleOrgCheckoutSubmit()}
                autoFocus
              />
            </div>

            {checkoutError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {checkoutError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowOrgModal(false)}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  darkMode
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleOrgCheckoutSubmit}
                disabled={checkoutLoading || !orgName.trim()}
                className={`flex-1 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  selectedOrgPlan === 'university'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-400 hover:to-purple-400'
                }`}
              >
                {checkoutLoading ? 'Loading...' : 'Continue to Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Error Toast */}
      {checkoutError && !showOrgModal && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm p-4 bg-red-500 text-white rounded-xl shadow-lg">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-medium">Checkout Error</p>
              <p className="text-sm text-red-100">{checkoutError}</p>
            </div>
            <button onClick={() => setCheckoutError('')} className="text-red-200 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`py-8 px-6 ${darkMode ? 'bg-slate-900 border-t border-slate-800' : 'bg-slate-900'}`}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="font-bold text-white">QuizForge</span>
            <span className="text-slate-400 text-sm ml-2">© 2026</span>
          </div>
          <div className="flex gap-6 text-sm">
            <Link href="/privacy" className="text-slate-400 hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
              Terms of Service
            </Link>
            <button
              onClick={() => window.location.href = 'mailto:support@quizforgeapp.com'}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Contact
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
