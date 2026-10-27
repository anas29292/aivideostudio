import React, { useState } from 'react';
import {
  Search,
  Edit3,
  Copy,
  Trash2,
  FileText,
  Plus,
  Check,
} from 'lucide-react';
import {
  PlanTier,
  PlatformType,
  SubscriptionData,
  VideoProjectData,
} from '../types';
import { PLATFORM_METADATA } from '../utils/seedData';
import { generateSrtSubtitles } from '../utils/videoEngine';

interface UserDashboardProps {
  projects: VideoProjectData[];
  userSubscription: SubscriptionData;
  onSelectProjectToEdit: (project: VideoProjectData) => void;
  onDuplicateProject: (project: VideoProjectData) => void;
  onDeleteProject: (projectId: string) => void;
  onUpgradeTier: (newTier: PlanTier) => void;
  onNavigateToStudio: () => void;
}

const PLAN_DETAILS: {
  id: PlanTier;
  name: string;
  audience: string;
  priceLabel: string;
  monthlyQuota: number;
  resolution: string;
}[] = [
  {
    id: 'starter',
    name: 'Starter Creator',
    audience: 'Untuk kreator pemula & eksperimen konten harian',
    priceLabel: 'Rp 0 / bln',
    monthlyQuota: 10,
    resolution: 'HD 720p · 5 Suara AI Standar',
  },
  {
    id: 'creator_pro',
    name: 'Creator Pro',
    audience: 'Untuk channel YouTube Shorts, TikTok & Reels aktif',
    priceLabel: 'Rp 249.000 / bln',
    monthlyQuota: 50,
    resolution: 'Full HD 1080p · Semua Suara Gemini TTS & Ekspor Tanpa Batas',
  },
  {
    id: 'agency_studio',
    name: 'Agency Studio',
    audience: 'Untuk agensi konten marketing & multi-channel produksi',
    priceLabel: 'Rp 699.000 / bln',
    monthlyQuota: 200,
    resolution: '4K Ultra HD · Lisensi Komersial Penuh & Prioritas Render',
  },
];

export const UserDashboard: React.FC<UserDashboardProps> = ({
  projects,
  userSubscription,
  onSelectProjectToEdit,
  onDuplicateProject,
  onDeleteProject,
  onUpgradeTier,
  onNavigateToStudio,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | PlatformType>('all');
  const [tierMessage, setTierMessage] = useState<string | null>(null);

  const filteredProjects = projects.filter((proj) => {
    const matchesPlatform =
      platformFilter === 'all' || proj.platform === platformFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      proj.title.toLowerCase().includes(q) ||
      proj.topic.toLowerCase().includes(q);
    return matchesPlatform && matchesSearch;
  });

  const totalDurationSec = projects.reduce(
    (acc, p) => acc + (p.totalDurationSec || 0),
    0
  );
  const exportedCount = projects.filter(
    (p) => p.status === 'exported' || p.status === 'ready'
  ).length;

  const handleExportSrt = (project: VideoProjectData) => {
    const srt = generateSrtSubtitles(project.scenes);
    const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-subtitles.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSelectTier = (tier: PlanTier) => {
    onUpgradeTier(tier);
    const planObj = PLAN_DETAILS.find((p) => p.id === tier);
    setTierMessage(`Paket langganan Anda berhasil diperbarui ke ${planObj?.name}.`);
    setTimeout(() => setTierMessage(null), 4000);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Top Summary Metrics Row */}
      <section
        aria-label="Ringkasan Produksi Pengguna"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Proyek Saya</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {projects.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Tersimpan di riwayat produksi
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Total Durasi Konten</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {totalDurationSec} dtk
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Akumulasi seluruh adegan video
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Video Siap Publikasi</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {exportedCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Status siap unduh & telah diekspor
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <span className="text-xs text-slate-500">Kuota Render Bulanan</span>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {userSubscription.usedQuota} / {userSubscription.monthlyQuota}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Paket {userSubscription.planTier.replace('_', ' ')}
          </p>
        </div>
      </section>

      {/* Project History & Filter Controls */}
      <section
        aria-label="Riwayat Proyek Video Faceless"
        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Riwayat Proyek & Galeri Media
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kelola, sunting ulang naskah, atau ekspor file video dan subtitle dari proyek yang pernah Anda buat.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Cari proyek berdasarkan judul atau topik"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul atau topik..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 w-52"
              />
            </div>

            <button
              type="button"
              onClick={onNavigateToStudio}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Proyek Baru</span>
            </button>
          </div>
        </div>

        {/* Interactive Filter Segmented Bar */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              platformFilter === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Semua Platform ({projects.length})
          </button>
          {(Object.keys(PLATFORM_METADATA) as PlatformType[]).map((plat) => (
            <button
              key={plat}
              type="button"
              onClick={() => setPlatformFilter(plat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                platformFilter === plat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {PLATFORM_METADATA[plat].shortLabel}
            </button>
          ))}
        </div>

        {/* Projects List or Empty State */}
        {filteredProjects.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center gap-2">
            <p className="text-sm font-medium text-slate-800">
              Belum ada proyek video yang sesuai dengan pencarian Anda.
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              Mulai buat video faceless otomatis untuk YouTube Shorts, TikTok, atau Reels hanya dengan menuliskan topik.
            </p>
            <button
              type="button"
              onClick={onNavigateToStudio}
              className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Buat Video Pertama Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">Judul & Topik Proyek</th>
                  <th className="py-2.5 px-3">Platform & Format</th>
                  <th className="py-2.5 px-3">Suara AI</th>
                  <th className="py-2.5 px-3 text-right">Adegan & Durasi</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 pl-3 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredProjects.map((project) => {
                  const meta = PLATFORM_METADATA[project.platform];
                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 pr-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">
                          {project.title}
                        </div>
                        <div className="text-slate-500 truncate mt-0.5">
                          {project.topic}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {meta?.shortLabel} · {project.aspectRatio} ·{' '}
                        {project.language.toUpperCase()}
                      </td>
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {project.voiceName} · {project.visualStyle}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                        {project.scenes.length} adegan · {project.totalDurationSec} dtk
                      </td>
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        {project.status === 'exported'
                          ? 'Telah Diekspor'
                          : project.status === 'ready'
                          ? 'Siap Unduh'
                          : project.status === 'archived'
                          ? 'Diarsipkan'
                          : 'Draf'}
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectProjectToEdit(project)}
                            aria-label={`Edit proyek ${project.title}`}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-md inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit & Putar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExportSrt(project)}
                            aria-label={`Ekspor SRT ${project.title}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Unduh Subtitle (.srt)"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicateProject(project)}
                            aria-label={`Duplikasi proyek ${project.title}`}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Duplikasi Proyek"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project.id)}
                            aria-label={`Hapus proyek ${project.title}`}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                            title="Hapus Proyek"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Subscription & Billing Tier Architecture */}
      <section
        id="subscription-plans"
        aria-label="Manajemen Paket Langganan"
        className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Paket Langganan & Kapasitas Produksi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Pilih kapasitas render bulanan yang sesuai dengan jadwal publikasi channel Anda.
            </p>
          </div>
          {tierMessage && (
            <div
              role="status"
              className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{tierMessage}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLAN_DETAILS.map((plan) => {
            const isCurrent = userSubscription.planTier === plan.id;
            return (
              <div
                key={plan.id}
                className={`border rounded-xl p-4 flex flex-col justify-between gap-4 ${
                  isCurrent
                    ? 'border-blue-600 bg-blue-50/20'
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      {plan.name}
                    </h3>
                    <span className="text-xs font-mono tabular-nums font-semibold text-slate-800">
                      {plan.priceLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{plan.audience}</p>
                  <div className="mt-3 pt-3 border-t border-slate-200/80 text-xs text-slate-700 flex flex-col gap-1.5">
                    <div>
                      Kuota Produksi:{' '}
                      <span className="font-mono tabular-nums font-semibold">
                        {plan.monthlyQuota} video / bulan
                      </span>
                    </div>
                    <div>Spesifikasi: {plan.resolution}</div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handleSelectTier(plan.id)}
                  className={`w-full py-2 px-3 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'bg-slate-200 text-slate-600 cursor-default'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  {isCurrent ? 'Paket Aktif Saat Ini' : `Pilih ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
