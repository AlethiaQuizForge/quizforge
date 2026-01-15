'use client';

import { PLANS, PlanId, formatPrice } from '@/lib/stripe';

interface PricingCardProps {
  planId: PlanId;
  currentPlan?: PlanId;
  onSelectPlan: (planId: PlanId) => void;
  isLoading?: boolean;
  highlighted?: boolean;
}

export function PricingCard({
  planId,
  currentPlan,
  onSelectPlan,
  isLoading,
  highlighted,
}: PricingCardProps) {
  const plan = PLANS[planId];
  const isCurrentPlan = currentPlan === planId;
  const isUpgrade = currentPlan === 'free' && planId !== 'free';
  const isDowngrade = currentPlan !== 'free' && planId === 'free';

  return (
    <div
      className={`relative rounded-2xl p-6 ${
        highlighted
          ? 'bg-gradient-to-b from-indigo-600 to-purple-600 text-white ring-4 ring-indigo-500/50'
          : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 text-sm font-bold rounded-full">
          Most Popular
        </div>
      )}

      <div className="text-center mb-6">
        <h3
          className={`text-xl font-bold mb-2 ${
            highlighted ? 'text-white' : 'text-slate-900 dark:text-white'
          }`}
        >
          {plan.name}
        </h3>
        <div
          className={`text-4xl font-bold ${
            highlighted ? 'text-white' : 'text-slate-900 dark:text-white'
          }`}
        >
          {formatPrice(plan.price)}
        </div>
        {plan.price > 0 && (
          <p
            className={`text-sm mt-1 ${
              highlighted ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            billed monthly
          </p>
        )}
      </div>

      <ul className="space-y-3 mb-6">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              className={`text-lg ${
                highlighted ? 'text-green-300' : 'text-green-500'
              }`}
            >
              ✓
            </span>
            <span
              className={
                highlighted
                  ? 'text-indigo-100'
                  : 'text-slate-600 dark:text-slate-300'
              }
            >
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelectPlan(planId)}
        disabled={isLoading || isCurrentPlan}
        className={`w-full py-3 rounded-xl font-semibold transition ${
          isCurrentPlan
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : highlighted
            ? 'bg-white text-indigo-600 hover:bg-indigo-50'
            : 'bg-indigo-600 text-white hover:bg-indigo-500'
        } ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
      >
        {isLoading ? (
          'Loading...'
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : isUpgrade ? (
          'Upgrade'
        ) : isDowngrade ? (
          'Downgrade'
        ) : (
          'Get Started'
        )}
      </button>

      {planId === 'institution' && (
        <p
          className={`text-center text-sm mt-3 ${
            highlighted ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          Contact us for custom pricing
        </p>
      )}
    </div>
  );
}

// Full pricing section component
export function PricingSection({
  currentPlan = 'free',
  onSelectPlan,
  isLoading,
}: {
  currentPlan?: PlanId;
  onSelectPlan: (planId: PlanId) => void;
  isLoading?: boolean;
}) {
  return (
    <div className="py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
          Same great product for everyone. Pay only when you need more volume.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6">
        <PricingCard
          planId="free"
          currentPlan={currentPlan}
          onSelectPlan={onSelectPlan}
          isLoading={isLoading}
        />
        <PricingCard
          planId="pro"
          currentPlan={currentPlan}
          onSelectPlan={onSelectPlan}
          isLoading={isLoading}
          highlighted
        />
        <PricingCard
          planId="institution"
          currentPlan={currentPlan}
          onSelectPlan={onSelectPlan}
          isLoading={isLoading}
        />
      </div>

      <p className="text-center text-slate-500 dark:text-slate-400 mt-8 text-sm">
        All plans include: Full quiz quality • All question types • PDF export • Analytics
      </p>
    </div>
  );
}
