'use client';

import React, { useState, useEffect } from 'react';
import {
  Organization,
  OrgMember,
  getOrganization,
  getOrgMembers,
  getActiveMemberCount,
  removeMemberFromOrg,
  regenerateInviteCode,
  updateOrganization,
  getOrgLimits,
} from '@/lib/organizations';

interface AdminDashboardProps {
  orgId: string;
  userId: string;
  onBack: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export function AdminDashboard({ orgId, userId, onBack, showToast }: AdminDashboardProps) {
  const [org, setOrg] = useState<Organization | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'settings'>('overview');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load organization data
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [orgData, membersData] = await Promise.all([
          getOrganization(orgId),
          getOrgMembers(orgId),
        ]);
        setOrg(orgData);
        setMembers(membersData);
        if (orgData) {
          setNameInput(orgData.name);
          setDomainInput(orgData.emailDomain || '');
        }
      } catch (err) {
        console.error('Failed to load organization:', err);
        showToast('Failed to load organization data', 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [orgId, showToast]);

  // Check if current user is admin
  const isAdmin = org?.adminUserId === userId;
  const activeMembers = members.filter(m => m.status === 'active');
  const limits = org ? getOrgLimits(org.plan) : null;

  const handleCopyInviteLink = () => {
    if (!org) return;
    const link = `${window.location.origin}/join/${org.inviteCode}`;
    navigator.clipboard.writeText(link);
    showToast('Invite link copied!', 'success');
  };

  const handleRegenerateCode = async () => {
    if (!org || !isAdmin) return;
    setIsActionLoading(true);
    try {
      const newCode = await regenerateInviteCode(orgId);
      setOrg({ ...org, inviteCode: newCode });
      showToast('Invite link regenerated', 'success');
    } catch (err) {
      showToast('Failed to regenerate invite link', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!isAdmin) return;
    if (memberId === userId) {
      showToast('You cannot remove yourself as admin', 'error');
      return;
    }
    if (!confirm(`Remove ${memberName} from the organization?`)) return;

    setIsActionLoading(true);
    try {
      await removeMemberFromOrg(orgId, memberId);
      setMembers(members.map(m =>
        m.userId === memberId ? { ...m, status: 'removed' } : m
      ));
      showToast(`${memberName} has been removed`, 'success');
    } catch (err) {
      showToast('Failed to remove member', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!org || !isAdmin || !nameInput.trim()) return;
    setIsActionLoading(true);
    try {
      await updateOrganization(orgId, { name: nameInput.trim() });
      setOrg({ ...org, name: nameInput.trim() });
      setEditingName(false);
      showToast('Organization name updated', 'success');
    } catch (err) {
      showToast('Failed to update name', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUpdateDomain = async () => {
    if (!org || !isAdmin) return;
    setIsActionLoading(true);
    try {
      const domain = domainInput.trim() || null;
      await updateOrganization(orgId, { emailDomain: domain });
      setOrg({ ...org, emailDomain: domain });
      showToast(domain ? 'Email domain updated' : 'Email domain removed', 'success');
    } catch (err) {
      showToast('Failed to update domain', 'error');
    } finally {
      setIsActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 dark:text-slate-300 mb-4">Organization not found</p>
          <button onClick={onBack} className="text-indigo-600 hover:underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Navigation */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              ← Back
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏫</span>
              <span className="font-bold text-slate-900 dark:text-white">{org.name}</span>
              <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-full capitalize">
                {org.plan}
              </span>
            </div>
          </div>
          <button
            onClick={handleCopyInviteLink}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 text-sm"
          >
            Copy Invite Link
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-200 dark:border-slate-700">
          {(['overview', 'members', 'settings'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-2 text-sm font-medium border-b-2 transition ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeMembers.length}</p>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Teachers ({limits?.teachers} max)
                </p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{limits?.quizzesPerTeacher}</p>
                <p className="text-sm text-slate-500 dark:text-slate-300">Quizzes/teacher/mo</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{limits?.classesPerTeacher}</p>
                <p className="text-sm text-slate-500 dark:text-slate-300">Classes per teacher</p>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{limits?.studentsPerClass}</p>
                <p className="text-sm text-slate-500 dark:text-slate-300">Students per class</p>
              </div>
            </div>

            {/* Invite Section */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Invite Teachers</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">
                Share this link with teachers to invite them to your organization. They will automatically join when they sign up or log in.
              </p>
              <div className="flex items-center gap-3">
                <code className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                  {`${typeof window !== 'undefined' ? window.location.origin : ''}/join/${org.inviteCode}`}
                </code>
                <button
                  onClick={handleCopyInviteLink}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 text-sm whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
              {isAdmin && (
                <button
                  onClick={handleRegenerateCode}
                  disabled={isActionLoading}
                  className="mt-3 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Regenerate invite link
                </button>
              )}
            </div>

            {/* Recent Members */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">Recent Members</h3>
                <button
                  onClick={() => setActiveTab('members')}
                  className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
                >
                  View all →
                </button>
              </div>
              {activeMembers.length > 0 ? (
                <div className="space-y-3">
                  {activeMembers.slice(0, 5).map(member => (
                    <div key={member.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-xs font-bold">
                          {member.displayName?.substring(0, 2).toUpperCase() || '??'}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">
                            {member.displayName || 'Unknown'}
                            {member.role === 'admin' && (
                              <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs rounded">
                                Admin
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-sm text-center py-4">
                  No members yet. Share the invite link to add teachers.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Organization Members</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {activeMembers.length} of {limits?.teachers} teacher slots used
                  </p>
                </div>
                <button
                  onClick={handleCopyInviteLink}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 text-sm"
                >
                  Invite Teachers
                </button>
              </div>
            </div>

            {/* Members List */}
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {activeMembers.map(member => (
                <div key={member.userId} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center font-bold">
                      {member.displayName?.substring(0, 2).toUpperCase() || '??'}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {member.displayName || 'Unknown'}
                        {member.role === 'admin' && (
                          <span className="ml-2 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs rounded-full">
                            Admin
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
                    </div>
                  </div>
                  {isAdmin && member.role !== 'admin' && (
                    <button
                      onClick={() => handleRemoveMember(member.userId, member.displayName)}
                      disabled={isActionLoading}
                      className="px-3 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>

            {activeMembers.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-slate-500 dark:text-slate-400">No members yet</p>
                <button
                  onClick={handleCopyInviteLink}
                  className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Share invite link to add teachers
                </button>
              </div>
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Organization Name */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Organization Name</h3>
              {editingName ? (
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={isActionLoading || !nameInput.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => { setEditingName(false); setNameInput(org.name); }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-slate-700 dark:text-slate-300">{org.name}</p>
                  {isAdmin && (
                    <button
                      onClick={() => setEditingName(true)}
                      className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Email Domain */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Email Domain (Optional)</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Teachers with this email domain can automatically join the organization.
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                  <input
                    type="text"
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value.replace('@', ''))}
                    placeholder="school.edu"
                    className="w-full pl-8 pr-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    disabled={!isAdmin}
                  />
                </div>
                {isAdmin && (
                  <button
                    onClick={handleUpdateDomain}
                    disabled={isActionLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Save
                  </button>
                )}
              </div>
            </div>

            {/* Plan Info */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Subscription</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white capitalize">{org.plan} Plan</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    ${org.plan === 'school' ? '199' : '499'}/month
                  </p>
                </div>
                <span className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-sm font-medium rounded-full">
                  Active
                </span>
              </div>
              <a
                href="/api/stripe/portal"
                className="text-indigo-600 dark:text-indigo-400 text-sm hover:underline"
              >
                Manage billing →
              </a>
            </div>

            {/* Danger Zone */}
            {isAdmin && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">Danger Zone</h3>
                <p className="text-sm text-red-600 dark:text-red-300 mb-4">
                  Canceling your subscription will remove all teachers from the organization. This cannot be undone.
                </p>
                <a
                  href="/api/stripe/portal"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 text-sm inline-block"
                >
                  Cancel Subscription
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
