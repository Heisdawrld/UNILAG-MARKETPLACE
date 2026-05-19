'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  Shield,
  Users,
  Package,
  AlertTriangle,
  MessageCircle,
  Star,
  Ban,
  CheckCircle,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Crown,
  UserCheck,
  Eye,
  XCircle,
  Clock3,
  Phone,
  IdCard,
  MapPin,
  Route,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';

type AdminTab = 'overview' | 'users' | 'listings' | 'reports' | 'runner_ops';
type RunnerReviewFilter = 'pending' | 'approved' | 'rejected';

const runnerStatusStyles: Record<RunnerReviewFilter, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-400/20',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/20',
  rejected: 'bg-rose-500/15 text-rose-300 border-rose-400/20',
};

export default function AdminPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [runnerApps, setRunnerApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');
  const [actionLoading, setActionLoading] = useState('');
  const [runnerFilter, setRunnerFilter] = useState<RunnerReviewFilter>('pending');
  const [selectedRunnerApp, setSelectedRunnerApp] = useState<any | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    api.get('/api/auth/clerk-me').then(setDbUser).catch(() => setError('Failed to authenticate'));
  }, [isLoaded, clerkUser]);

  const fetchData = useCallback(async () => {
    if (!dbUser?.id) return;
    setLoading(true);
    setError('');

    try {
      const [result, apps] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/runner-applications'),
      ]);

      if (result.error) {
        setError(result.error);
        return;
      }

      setData(result);
      setRunnerApps(apps || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Access denied or fetch failed');
    } finally {
      setLoading(false);
    }
  }, [dbUser?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const doAction = async (action: string, targetId: string, extra?: any) => {
    setActionLoading(extra?.applicationId || targetId);
    try {
      await api.patch('/api/admin/stats', { action, targetId, data: extra });
      await fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const runnerCounts = useMemo(() => ({
    pending: runnerApps.filter((app) => app.status === 'pending').length,
    approved: runnerApps.filter((app) => app.status === 'approved').length,
    rejected: runnerApps.filter((app) => app.status === 'rejected').length,
  }), [runnerApps]);

  const filteredRunnerApps = useMemo(
    () => runnerApps.filter((app) => app.status === runnerFilter),
    [runnerApps, runnerFilter],
  );

  const openRunnerReview = (application: any) => {
    setSelectedRunnerApp(application);
    setReviewNote(application.reviewNote || '');
  };

  const closeRunnerReview = () => {
    setSelectedRunnerApp(null);
    setReviewNote('');
  };

  const handleRunnerReview = async (status: RunnerReviewFilter, application: any) => {
    const action = status === 'approved' ? 'approve_runner' : 'reject_runner';
    await doAction(action, application.applicantId, {
      applicationId: application.applicationId,
      reviewNote,
    });
    closeRunnerReview();
  };

  if (!isLoaded || !dbUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center text-white">
          <Shield className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-sm opacity-60">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center text-white max-w-sm">
          <Ban className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p className="text-sm opacity-60 mb-4">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300">
            <ArrowLeft className="w-4 h-4" /> Back to Marketplace
          </a>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin" />
          <p className="text-sm opacity-60">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">UNILAG Admin</h1>
              <p className="text-[11px] text-white/40">Marketplace Control Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <a href="/" className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Marketplace
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit overflow-x-auto hide-scrollbar">
          {([
            ['overview', 'Overview'],
            ['users', 'Users'],
            ['listings', 'Listings'],
            ['reports', 'Reports'],
            ['runner_ops', 'Runner Ops'],
          ] as [AdminTab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}
            >
              {label}
              {id === 'runner_ops' && runnerCounts.pending > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{runnerCounts.pending}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'from-blue-500 to-cyan-500' },
                { label: 'Active Listings', value: stats.activeListings, icon: Package, color: 'from-emerald-500 to-green-500' },
                { label: 'Items Sold', value: stats.soldListings, icon: CheckCircle, color: 'from-purple-500 to-pink-500' },
                { label: 'Pending Reports', value: stats.pendingReports, icon: AlertTriangle, color: 'from-red-500 to-orange-500' },
                { label: 'Total Reviews', value: stats.totalReviews, icon: Star, color: 'from-amber-500 to-yellow-500' },
                { label: 'Active Chats', value: stats.totalChats, icon: MessageCircle, color: 'from-pink-500 to-rose-500' },
                { label: 'Runner Requests', value: stats.totalTasks, icon: Route, color: 'from-orange-500 to-amber-500' },
                { label: 'Pending Runner Apps', value: runnerCounts.pending, icon: UserCheck, color: 'from-indigo-500 to-blue-500' },
              ].map((item) => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3`}>
                    <item.icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-white/40">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Recent Users</h3>
              <div className="space-y-2">
                {data.recentUsers?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5">
                    <div className="flex items-center gap-2">
                      <img src={u.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${u.username}`} className="w-8 h-8 rounded-full" alt="" />
                      <div>
                        <p className="text-sm font-medium">{u.username}</p>
                        <p className="text-[10px] text-white/40">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : u.role === 'banned' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/60'}`}>{u.role}</span>
                      {u.isRunner && <Route className="w-3 h-3 text-amber-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold text-sm">All Users ({data.allUsers?.length})</h3>
            </div>
            <div className="divide-y divide-white/5">
              {data.allUsers?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-4 hover:bg-white/5 flex-wrap gap-4">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${u.username}`} className="w-10 h-10 rounded-full" alt="" />
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {u.username}
                        {u.verificationStatus === 'unilag_verified' && <Shield className="w-3 h-3 text-emerald-400" />}
                        {u.isRunner && <Route className="w-3 h-3 text-amber-400" />}
                      </p>
                      <p className="text-[11px] text-white/40">{u.email} · {u.faculty || 'No faculty'} · Trust: {u.trustScore}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {u.verificationStatus !== 'unilag_verified' && (
                      <button onClick={() => doAction('verify_user', u.id)} disabled={actionLoading === u.id} className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                        Verify
                      </button>
                    )}
                    {!u.isRunner && (
                      <button onClick={() => doAction('approve_runner', u.id)} disabled={actionLoading === u.id} className="text-[10px] px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">
                        <UserCheck className="w-3 h-3 inline mr-0.5" />Runner
                      </button>
                    )}
                    {u.isRunner && (
                      <button onClick={() => doAction('reject_runner', u.id)} disabled={actionLoading === u.id} className="text-[10px] px-2.5 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition-colors">
                        Remove Runner
                      </button>
                    )}
                    {u.role !== 'admin' && u.role !== 'banned' && (
                      <button onClick={() => doAction('ban_user', u.id)} disabled={actionLoading === u.id} className="text-[10px] px-2.5 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors">
                        Ban
                      </button>
                    )}
                    {u.role === 'banned' && (
                      <button onClick={() => doAction('unban_user', u.id)} disabled={actionLoading === u.id} className="text-[10px] px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                        Unban
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'listings' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold text-sm">All Listings ({data.allListings?.length})</h3>
            </div>
            <div className="divide-y divide-white/5">
              {data.allListings?.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/10 overflow-hidden flex-shrink-0">
                      {(() => { try { const imgs = JSON.parse(l.images || '[]'); return imgs[0] ? <img src={imgs[0]} className="w-full h-full object-cover" alt="" /> : null; } catch { return null; } })()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{l.title}</p>
                      <p className="text-[11px] text-white/40">₦{l.price.toLocaleString()} · by {l.seller?.username} · {l.views} views</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : l.status === 'sold' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>{l.status}</span>
                    {l.status === 'active' && (
                      <button onClick={() => doAction('remove_listing', l.id)} disabled={actionLoading === l.id} className="text-[10px] px-2 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'reports' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold text-sm">Pending Reports ({data.recentReports?.length})</h3>
            </div>
            {data.recentReports?.length === 0 ? (
              <p className="p-6 text-center text-sm text-white/40">No pending reports 🎉</p>
            ) : (
              <div className="divide-y divide-white/5">
                {data.recentReports?.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                    <div>
                      <p className="text-sm font-medium">Report: {r.reason.replace('_', ' ')}</p>
                      <p className="text-[11px] text-white/40">
                        By: {r.reporter?.username} · {r.listing ? `Listing: ${r.listing.title}` : 'General report'}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => doAction('resolve_report', r.id, { status: 'resolved' })} className="text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                        Resolve
                      </button>
                      <button onClick={() => doAction('resolve_report', r.id, { status: 'dismissed' })} className="text-[10px] px-2.5 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20">
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'runner_ops' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {([
                ['pending', 'Pending reviews', runnerCounts.pending, Clock3],
                ['approved', 'Approved runners', runnerCounts.approved, CheckCircle],
                ['rejected', 'Rejected applications', runnerCounts.rejected, XCircle],
              ] as [RunnerReviewFilter, string, number, typeof Clock3][]).map(([status, label, value, Icon]) => (
                <button
                  key={status}
                  onClick={() => setRunnerFilter(status)}
                  className={`text-left rounded-2xl border p-4 transition-all ${runnerFilter === status ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/7'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${runnerStatusStyles[status]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${runnerStatusStyles[status]}`}>{status}</span>
                  </div>
                  <p className="text-3xl font-bold">{value}</p>
                  <p className="text-xs text-white/45 mt-1">{label}</p>
                </button>
              ))}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
              <div className="p-5 border-b border-white/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-bold text-base">Runner Applications</h3>
                  <p className="text-xs text-white/45 mt-1">Review documents, approve trusted runners, and keep your ops queue clean.</p>
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  {(['pending', 'approved', 'rejected'] as RunnerReviewFilter[]).map((status) => (
                    <button
                      key={status}
                      onClick={() => setRunnerFilter(status)}
                      className={`px-3.5 py-2 rounded-full text-xs font-medium border whitespace-nowrap ${runnerFilter === status ? runnerStatusStyles[status] : 'border-white/10 text-white/55 hover:text-white hover:border-white/20'}`}
                    >
                      {status[0].toUpperCase() + status.slice(1)} ({runnerCounts[status]})
                    </button>
                  ))}
                </div>
              </div>

              {filteredRunnerApps.length === 0 ? (
                <div className="p-10 text-center text-white/45">
                  <UserCheck className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p className="font-medium">No {runnerFilter} runner applications</p>
                  <p className="text-sm mt-1">New submissions will appear here automatically.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filteredRunnerApps.map((application: any) => {
                    const reviewActionId = application.applicationId || application.applicantId;

                    return (
                      <div key={application.applicationId} className="p-5 hover:bg-white/5 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <img
                              src={application.profilePhoto || application.studentIdImage || `https://api.dicebear.com/9.x/notionists/svg?seed=${application.username}`}
                              alt={application.username}
                              className="w-16 h-16 rounded-2xl object-cover border border-white/10 shadow-lg flex-shrink-0"
                            />
                            <div className="min-w-0 space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-sm md:text-base truncate">{application.username}</p>
                                <span className={`text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${runnerStatusStyles[application.status as RunnerReviewFilter]}`}>
                                  {application.status}
                                </span>
                                <span className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-white/65">
                                  {application.transportMode || 'walking'}
                                </span>
                              </div>
                              <p className="text-xs text-white/45 truncate">{application.email}</p>
                              <div className="flex flex-wrap gap-2 text-[11px] text-white/60">
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1"><Phone className="w-3 h-3" /> {application.phone || 'No phone'}</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1"><MapPin className="w-3 h-3" /> {application.hostel || 'No hostel'}</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1"><IdCard className="w-3 h-3" /> {application.studentId || 'No matric no.'}</span>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-white/70 max-w-2xl">
                                <div className="rounded-xl bg-white/5 px-3 py-2 border border-white/5">
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">Availability</p>
                                  <p>{application.availability || 'Not provided'}</p>
                                </div>
                                <div className="rounded-xl bg-white/5 px-3 py-2 border border-white/5">
                                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/35 mb-1">Coverage</p>
                                  <p>{application.preferredZone || 'Campus-wide'}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <button
                              onClick={() => openRunnerReview(application)}
                              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium flex items-center gap-2 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> Review details
                            </button>
                            {application.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => doAction('approve_runner', application.applicantId, { applicationId: application.applicationId })}
                                  disabled={actionLoading === reviewActionId}
                                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => doAction('reject_runner', application.applicantId, { applicationId: application.applicationId })}
                                  disabled={actionLoading === reviewActionId}
                                  className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-semibold transition-colors disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedRunnerApp && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
          <div className="max-w-5xl mx-auto bg-slate-900 border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/45">Runner review</p>
                <h3 className="text-xl font-bold mt-1">{selectedRunnerApp.username}</h3>
                <p className="text-sm text-white/45 mt-1">{selectedRunnerApp.email}</p>
              </div>
              <button onClick={closeRunnerReview} className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
                <div className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/45 mb-3 uppercase tracking-[0.2em]">Profile photo</p>
                      <img src={selectedRunnerApp.profilePhoto || selectedRunnerApp.studentIdImage} alt="Profile" className="w-full aspect-[4/3] rounded-2xl object-cover" />
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs text-white/45 mb-3 uppercase tracking-[0.2em]">Student ID / document</p>
                      <img src={selectedRunnerApp.studentIdImage || selectedRunnerApp.profilePhoto} alt="Student ID" className="w-full aspect-[4/3] rounded-2xl object-cover" />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 text-sm">
                    {[
                      ['Phone', selectedRunnerApp.phone || 'Not provided'],
                      ['WhatsApp', selectedRunnerApp.whatsapp || 'Not provided'],
                      ['Faculty', selectedRunnerApp.faculty || 'Not provided'],
                      ['Hostel', selectedRunnerApp.hostel || 'Not provided'],
                      ['Matric no.', selectedRunnerApp.studentId || 'Not provided'],
                      ['Movement', selectedRunnerApp.transportMode || 'Not provided'],
                      ['Availability', selectedRunnerApp.availability || 'Not provided'],
                      ['Coverage zone', selectedRunnerApp.preferredZone || 'Campus-wide'],
                      ['Emergency contact', selectedRunnerApp.emergencyContactName || 'Not provided'],
                      ['Emergency phone', selectedRunnerApp.emergencyContactPhone || 'Not provided'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">{label}</p>
                        <p className="text-white/90">{value}</p>
                      </div>
                    ))}
                  </div>

                  {selectedRunnerApp.motivation && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">Why they want to join Runner</p>
                      <p className="text-sm leading-7 text-white/85">{selectedRunnerApp.motivation}</p>
                    </div>
                  )}

                  {selectedRunnerApp.deliveryExperience && (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-2">Delivery / errand experience</p>
                      <p className="text-sm leading-7 text-white/85">{selectedRunnerApp.deliveryExperience}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">Application status</p>
                        <p className="text-lg font-semibold mt-1">{selectedRunnerApp.status[0].toUpperCase() + selectedRunnerApp.status.slice(1)}</p>
                      </div>
                      <span className={`text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${runnerStatusStyles[selectedRunnerApp.status as RunnerReviewFilter]}`}>
                        {selectedRunnerApp.status}
                      </span>
                    </div>

                    <div className="space-y-3 text-sm text-white/70">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/45">Submitted</span>
                        <span>{new Date(selectedRunnerApp.submittedAt).toLocaleString()}</span>
                      </div>
                      {selectedRunnerApp.reviewedAt && (
                        <>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/45">Reviewed</span>
                            <span>{new Date(selectedRunnerApp.reviewedAt).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-white/45">Reviewed by</span>
                            <span>{selectedRunnerApp.reviewedByName || 'Admin'}</span>
                          </div>
                        </>
                      )}
                      {selectedRunnerApp.emergencyContactRelationship && (
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-white/45">Emergency relationship</span>
                          <span>{selectedRunnerApp.emergencyContactRelationship}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/40 mb-3">Admin review note</p>
                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      rows={5}
                      placeholder="Optional note to keep with this decision..."
                      className="w-full rounded-2xl bg-slate-950/50 border border-white/10 px-4 py-3 text-sm text-white outline-none focus:border-white/25 resize-none"
                    />
                  </div>

                  {selectedRunnerApp.status === 'pending' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleRunnerReview('approved', selectedRunnerApp)}
                        disabled={actionLoading === (selectedRunnerApp.applicationId || selectedRunnerApp.applicantId)}
                        className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3.5 transition-colors disabled:opacity-50"
                      >
                        Approve runner
                      </button>
                      <button
                        onClick={() => handleRunnerReview('rejected', selectedRunnerApp)}
                        disabled={actionLoading === (selectedRunnerApp.applicationId || selectedRunnerApp.applicantId)}
                        className="rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold py-3.5 transition-colors disabled:opacity-50"
                      >
                        Reject application
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/70">
                      <p className="font-medium text-white mb-1">Decision already recorded</p>
                      <p>{selectedRunnerApp.reviewNote || 'No admin note was left for this application.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
