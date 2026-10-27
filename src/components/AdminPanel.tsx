import React, { useState } from 'react';
import {
  Search,
  Trash2,
  Edit3,
  RotateCcw,
  UserPlus,
  Check,
} from 'lucide-react';
import {
  PlanTier,
  PlatformType,
  ProjectStatus,
  SubscriptionData,
  SubscriptionStatus,
  VideoProjectData,
} from '../types';
import { computePlatformAnalytics } from '../utils/videoEngine';
import { PLATFORM_METADATA } from '../utils/seedData';

interface AdminPanelProps {
  allProjects: VideoProjectData[];
  allSubscriptions: SubscriptionData[];
  onInspectProjectInStudio: (project: VideoProjectData) => void;
  onUpdateProjectStatus: (projectId: string, status: ProjectStatus) => void;
  onAdminDeleteProject: (projectId: string) => void;
  onUpdateSubscription: (updated: SubscriptionData) => void;
  onAddSubscriber: (newSub: SubscriptionData) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  allProjects,
  allSubscriptions,
  onInspectProjectInStudio,
  onUpdateProjectStatus,
  onAdminDeleteProject,
  onUpdateSubscription,
  onAddSubscriber,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'analytics' | 'projects' | 'subscriptions'
  >('analytics');
  const [projectSearch, setProjectSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [subSearch, setSubSearch] = useState('');

  // New subscriber form state
  const [newSubName, setNewSubName] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubTier, setNewSubTier] = useState<PlanTier>('creator_pro');
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  const analytics = computePlatformAnalytics(allProjects, allSubscriptions);

  const filteredProjects = allProjects.filter((p) => {
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const q = projectSearch.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q) ||
      p.topic.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const filteredSubscriptions = allSubscriptions.filter((s) => {
    const q = subSearch.trim().toLowerCase();
    return (
      !q ||
      s.userName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.planTier.toLowerCase().includes(q)
    );
  });

  const formatIdr = (amount: number) =>
    `Rp ${amount.toLocaleString('id-ID')}`;

  const handleCreateSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubName.trim().length < 2 || !newSubEmail.includes('@')) return;

    const quotaMap: Record<PlanTier, { quota: number; price: number }> = {
      starter: { quota: 10, price: 0 },
      creator_pro: { quota: 50, price: 249000 },
      agency_studio: { quota: 200, price: 699000 },
    };

    const spec = quotaMap[newSubTier];
    const newRecord: SubscriptionData = {
      id: `sub_${Date.now()}`,
      ownerId: `user_${Date.now()}`,
      userName: newSubName.trim(),
      email: newSubEmail.trim(),
      planTier: newSubTier,
      status: 'active',
      monthlyQuota: spec.quota,
      usedQuota: 0,
      amountIdr: spec.price,
      updatedAtIso: new Date().toISOString(),
    };

    onAddSubscriber(newRecord);
    setNewSubName('');
    setNewSubEmail('');
    setAdminFeedback(`Pelanggan ${newRecord.userName} berhasil ditambahkan.`);
    setTimeout(() => setAdminFeedback(null), 4000);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Admin Top Header & Mode Switcher */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Panel Administrasi Platform VoxReel
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat kendali seluruh proyek pengguna, manajemen langganan & kuota, serta analitik pendapatan platform.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveAdminTab('analytics')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeAdminTab === 'analytics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Analitik Platform
          </button>
          <button
            type="button"
            onClick={() => setActiveAdminTab('projects')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeAdminTab === 'projects'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Proyek ({allProjects.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveAdminTab('subscriptions')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeAdminTab === 'subscriptions'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Langganan Pengguna ({allSubscriptions.length})
          </button>
        </div>
      </div>

      {adminFeedback && (
        <div
          role="status"
          className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" />
          <span>{adminFeedback}</span>
        </div>
      )}

      {/* KPI Strip (Always visible for immediate executive clarity) */}
      <section
        aria-label="Metrik Utama Platform"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Pendapatan Bulanan (MRR)</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {formatIdr(analytics.monthlyRecurringRevenueIdr)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Dari {analytics.activeSubscribersCount} langganan aktif
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Proyek Pengguna</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {analytics.totalProjects}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.exportedVideosCount} proyek siap/diekspor
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Durasi Dirender</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {analytics.totalDurationRenderedSec} dtk
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Akumulasi narasi & visual AI
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Distribusi Paket Pro & Agency</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {analytics.tierBreakdown.creator_pro +
              analytics.tierBreakdown.agency_studio}{' '}
            akun
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {analytics.tierBreakdown.starter} akun Starter
          </p>
        </div>
      </section>

      {/* TAB 1: ANALYTICS BREAKDOWN */}
      {activeAdminTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Distribusi Produksi Video per Platform
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Proporsi proyek faceless berdasarkan target sosial media & marketing.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {(Object.keys(PLATFORM_METADATA) as PlatformType[]).map((plat) => {
                const count = analytics.platformBreakdown[plat] || 0;
                const pct =
                  analytics.totalProjects > 0
                    ? Math.round((count / analytics.totalProjects) * 100)
                    : 0;
                return (
                  <div key={plat} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">
                        {PLATFORM_METADATA[plat].label}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {count} proyek ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all"
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Kinerja Langganan & Penggunaan Kuota
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Rincian pelanggan aktif dan tingkat pemakaian kuota bulanan.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Nama Kreator</th>
                    <th className="py-2 px-3">Paket</th>
                    <th className="py-2 px-3 text-right">Pemakaian Kuota</th>
                    <th className="py-2 pl-3 text-right">Tagihan / Bln</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allSubscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-900">
                        {sub.userName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {sub.planTier.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                        {sub.usedQuota} / {sub.monthlyQuota}
                      </td>
                      <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-900">
                        {formatIdr(sub.amountIdr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: MANAGE ALL USER PROJECTS */}
      {activeAdminTab === 'projects' && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Manajemen Semua Proyek Pengguna
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Tinjau konten naskah, ubah status moderasi, atau buka proyek di Studio.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Filter proyek semua pengguna"
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Cari kreator atau judul..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48"
                />
              </div>

              <select
                aria-label="Filter status proyek"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | ProjectStatus)
                }
                className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700"
              >
                <option value="all">Semua Status</option>
                <option value="ready">Ready</option>
                <option value="exported">Exported</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 pr-3">Judul Proyek</th>
                  <th className="py-2.5 px-3">Kreator</th>
                  <th className="py-2.5 px-3">Platform</th>
                  <th className="py-2.5 px-3 text-right">Durasi</th>
                  <th className="py-2.5 px-3">Status Proyek</th>
                  <th className="py-2.5 pl-3 text-right">Kontrol Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredProjects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-slate-50/80">
                    <td className="py-3 pr-3 max-w-xs">
                      <div className="font-semibold text-slate-900 truncate">
                        {proj.title}
                      </div>
                      <div className="text-slate-500 truncate">{proj.topic}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                      {proj.authorName}
                    </td>
                    <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                      {PLATFORM_METADATA[proj.platform]?.shortLabel} ·{' '}
                      {proj.aspectRatio}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {proj.totalDurationSec} dtk ({proj.scenes.length} adegan)
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <select
                        aria-label={`Ubah status ${proj.title}`}
                        value={proj.status}
                        onChange={(e) =>
                          onUpdateProjectStatus(
                            proj.id,
                            e.target.value as ProjectStatus
                          )
                        }
                        className="px-2 py-1 text-xs bg-white border border-slate-200 rounded text-slate-800"
                      >
                        <option value="draft">Draft</option>
                        <option value="ready">Ready</option>
                        <option value="exported">Exported</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td className="py-3 pl-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onInspectProjectInStudio(proj)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Buka</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onAdminDeleteProject(proj.id)}
                          aria-label={`Hapus proyek pengguna ${proj.title}`}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 3: MANAGE USER SUBSCRIPTIONS */}
      {activeAdminTab === 'subscriptions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Daftar Langganan & Kuota Pengguna
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Sesuaikan paket langganan, status penagihan, atau reset pemakaian kuota bulanan.
                </p>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Cari pelanggan"
                  value={subSearch}
                  onChange={(e) => setSubSearch(e.target.value)}
                  placeholder="Cari nama atau email..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 pr-3">Pengguna & Email</th>
                    <th className="py-2.5 px-2">Paket Langganan</th>
                    <th className="py-2.5 px-2">Status</th>
                    <th className="py-2.5 px-2 text-right">Kuota</th>
                    <th className="py-2.5 pl-2 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/80">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900">
                          {sub.userName}
                        </div>
                        <div className="text-slate-500">{sub.email}</div>
                      </td>
                      <td className="py-3 px-2">
                        <select
                          aria-label={`Ubah paket ${sub.userName}`}
                          value={sub.planTier}
                          onChange={(e) => {
                            const nextTier = e.target.value as PlanTier;
                            const priceMap: Record<PlanTier, { q: number; p: number }> = {
                              starter: { q: 10, p: 0 },
                              creator_pro: { q: 50, p: 249000 },
                              agency_studio: { q: 200, p: 699000 },
                            };
                            onUpdateSubscription({
                              ...sub,
                              planTier: nextTier,
                              monthlyQuota: priceMap[nextTier].q,
                              amountIdr: priceMap[nextTier].p,
                              updatedAtIso: new Date().toISOString(),
                            });
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800"
                        >
                          <option value="starter">Starter (10)</option>
                          <option value="creator_pro">Creator Pro (50)</option>
                          <option value="agency_studio">Agency Studio (200)</option>
                        </select>
                      </td>
                      <td className="py-3 px-2">
                        <select
                          aria-label={`Ubah status langganan ${sub.userName}`}
                          value={sub.status}
                          onChange={(e) =>
                            onUpdateSubscription({
                              ...sub,
                              status: e.target.value as SubscriptionStatus,
                              updatedAtIso: new Date().toISOString(),
                            })
                          }
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-slate-800"
                        >
                          <option value="active">Active</option>
                          <option value="trialing">Trialing</option>
                          <option value="past_due">Past Due</option>
                          <option value="canceled">Canceled</option>
                        </select>
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {sub.usedQuota} / {sub.monthlyQuota}
                      </td>
                      <td className="py-3 pl-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSubscription({
                              ...sub,
                              usedQuota: 0,
                              updatedAtIso: new Date().toISOString(),
                            })
                          }
                          aria-label={`Reset kuota ${sub.userName}`}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded inline-flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Kuota</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-3.5">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Tambah Langganan Pengguna Baru
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftarkan akun kreator atau agensi baru secara langsung.
              </p>
            </div>

            <form onSubmit={handleCreateSubscriber} className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="admin-new-sub-name"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Nama Lengkap Kreator
                </label>
                <input
                  id="admin-new-sub-name"
                  type="text"
                  required
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  placeholder="Contoh: Dimas Prakoso"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-new-sub-email"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Alamat Email
                </label>
                <input
                  id="admin-new-sub-email"
                  type="email"
                  required
                  value={newSubEmail}
                  onChange={(e) => setNewSubEmail(e.target.value)}
                  placeholder="dimas@kreator.id"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-new-sub-tier"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Paket Langganan Awal
                </label>
                <select
                  id="admin-new-sub-tier"
                  value={newSubTier}
                  onChange={(e) => setNewSubTier(e.target.value as PlanTier)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  <option value="starter">Starter (10 video / bln)</option>
                  <option value="creator_pro">Creator Pro (50 video / bln)</option>
                  <option value="agency_studio">Agency Studio (200 video / bln)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Simpan Pelanggan Baru</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
