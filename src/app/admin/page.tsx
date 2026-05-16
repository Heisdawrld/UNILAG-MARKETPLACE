'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Shield, Users, Package, AlertTriangle, Zap, MessageCircle, Star, Ban, CheckCircle, XCircle, Trash2, Eye, RefreshCw, ArrowLeft, Crown, UserCheck } from 'lucide-react';
import { api } from '@/lib/api';

type AdminTab = 'overview' | 'users' | 'listings' | 'reports';

export default function AdminPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<AdminTab>('overview');
  const [actionLoading, setActionLoading] = useState('');

  // Sync clerk user to get DB user
  useEffect(() => {
    if (!isLoaded || !clerkUser) return;
    api.get('/api/auth/clerk-me').then(setDbUser).catch(() => setError('Failed to authenticate'));
  }, [isLoaded, clerkUser]);

  // Fetch admin data
  const fetchData = useCallback(async () => {
    if (!dbUser?.id) return;
    setLoading(true);
    try {
      const result = await api.get(`/api/admin/stats?adminId=${dbUser.id}`);
      if (result.error) { setError(result.error); return; }
      setData(result);
    } catch { setError('Access denied or fetch failed'); }
    finally { setLoading(false); }
  }, [dbUser?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doAction = async (action: string, targetId: string, extra?: any) => {
    setActionLoading(targetId);
    try {
      await api.patch('/api/admin/stats', { adminId: dbUser.id, action, targetId, data: extra });
      await fetchData();
    } catch { alert('Action failed'); }
    finally { setActionLoading(''); }
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
      {/* Header */}
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
        {/* Tab Nav */}
        <div className="flex gap-1 mb-6 bg-white/5 rounded-xl p-1 w-fit">
          {([['overview', 'Overview'], ['users', 'Users'], ['listings', 'Listings'], ['reports', 'Reports']] as [AdminTab, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
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
                { label: 'Tasks Posted', value: stats.totalTasks, icon: Zap, color: 'from-orange-500 to-amber-500' },
                { label: 'All Listings', value: stats.totalListings, icon: Package, color: 'from-indigo-500 to-blue-500' },
              ].map(item => (
                <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-3`}>
                    <item.icon className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-2xl font-bold">{item.value}</p>
                  <p className="text-xs text-white/40">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Recent Users */}
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
                      {u.isRunner && <Zap className="w-3 h-3 text-amber-400" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-bold text-sm">All Users ({data.allUsers?.length})</h3>
            </div>
            <div className="divide-y divide-white/5">
              {data.allUsers?.map((u: any) => (
                <div key={u.id} className="flex items-center justify-between p-4 hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <img src={u.avatar || `https://api.dicebear.com/9.x/notionists/svg?seed=${u.username}`} className="w-10 h-10 rounded-full" alt="" />
                    <div>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {u.username}
                        {u.verificationStatus === 'unilag_verified' && <Shield className="w-3 h-3 text-emerald-400" />}
                        {u.isRunner && <Zap className="w-3 h-3 text-amber-400" />}
                      </p>
                      <p className="text-[11px] text-white/40">{u.email} · {u.faculty || 'No faculty'} · Trust: {u.trustScore}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
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

        {/* Listings Tab */}
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

        {/* Reports Tab */}
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
      </div>
    </div>
  );
}
