'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrganizationByInviteCode, Organization } from '@/lib/organizations';

export default function JoinOrgPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function lookupOrg() {
      if (!code) {
        setError('Invalid invite link');
        setLoading(false);
        return;
      }

      try {
        const foundOrg = await getOrganizationByInviteCode(code.toLowerCase());
        if (foundOrg) {
          setOrg(foundOrg);
          // Store the org info in sessionStorage for the join flow
          sessionStorage.setItem('pendingOrgJoin', JSON.stringify({
            orgId: foundOrg.id,
            orgName: foundOrg.name,
            inviteCode: code.toLowerCase(),
          }));
          // Redirect to main app with join flag
          router.replace('/?join=org');
        } else {
          setError('This invite link is invalid or has expired');
        }
      } catch (err) {
        console.error('Error looking up organization:', err);
        setError('Unable to verify invite link. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    lookupOrg();
  }, [code, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-300">Verifying invite link...</p>
          </>
        ) : error ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg">
            <div className="text-red-500 text-5xl mb-4">!</div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Invalid Invite Link
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mb-6">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-500 transition"
            >
              Go to QuizForge
            </button>
          </div>
        ) : org ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-300">
              Joining {org.name}...
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
