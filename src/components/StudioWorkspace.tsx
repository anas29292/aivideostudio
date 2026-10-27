import React, { useState } from 'react';
import {
  Wand2,
  Plus,
  Trash2,
  Volume2,
  Loader2,
  Sliders,
  Check,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import {
  AspectRatioType,
  CameraMotion,
  PlatformType,
  SceneItemData,
  VideoProjectData,
  VoicePersona,
} from '../types';
import { PLATFORM_METADATA, PRESET_IMAGE_PATHS } from '../utils/seedData';
import {
  calculateSceneTimings,
  validateProjectTopicInput,
} from '../utils/videoEngine';
import { VideoPreviewPlayer } from './VideoPreviewPlayer';

interface StudioWorkspaceProps {
  activeProject: VideoProjectData;
  onCreateProject: (newProject: VideoProjectData) => Promise<void>;
  onUpdateProject: (updatedProject: VideoProjectData) => Promise<void>;
  currentUserId: string;
  currentUserName: string;
}

const VOICE_OPTIONS: { id: VoicePersona; label: string; character: string }[] = [
  { id: 'Kore', label: 'Kore', character: 'Jernih, Editorial & Profesional' },
  { id: 'Puck', label: 'Puck', character: 'Energik, Cepat & Dinamis (Shorts/TikTok)' },
  { id: 'Charon', label: 'Charon', character: 'Dalam, Dokumenter & Berwibawa' },
  { id: 'Fenrir', label: 'Fenrir', character: 'Tegas, Sinematik & Narasi Sains' },
  { id: 'Zephyr', label: 'Zephyr', character: 'Hangat, Persuasif & Konten Marketing' },
];

const VISUAL_STYLES: { label: string; defaultImage: string; accent: string }[] = [
  {
    label: 'Editorial Architecture',
    defaultImage: PRESET_IMAGE_PATHS.finance,
    accent: '#2563EB',
  },
  {
    label: 'Historical Documentary',
    defaultImage: PRESET_IMAGE_PATHS.history,
    accent: '#B45309',
  },
  {
    label: 'Commercial Luxury Studio',
    defaultImage: PRESET_IMAGE_PATHS.marketing,
    accent: '#0F172A',
  },
  {
    label: 'Science & Cosmos Widescreen',
    defaultImage: PRESET_IMAGE_PATHS.science,
    accent: '#0284C7',
  },
];

const TOPIC_PRESETS = [
  {
    label: 'Finansial & Investasi',
    topic: 'Cara kerja aturan 50-30-20 untuk membangun dana darurat dan kebebasan finansial',
    platform: 'youtube_shorts' as PlatformType,
    style: 'Editorial Architecture',
  },
  {
    label: 'Sejarah & Misteri',
    topic: 'Bagaimana perpustakaan kuno menyelamatkan pengetahuan astronomi lintas peradaban',
    platform: 'tiktok' as PlatformType,
    style: 'Historical Documentary',
  },
  {
    label: 'Marketing Produk',
    topic: 'Kampanye peluncuran perangkat audio minimalis dengan kalibrasi akustik ruang otomatis',
    platform: 'instagram_reels' as PlatformType,
    style: 'Commercial Luxury Studio',
  },
  {
    label: 'Sains & Antariksa',
    topic: 'Bagaimana teleskop optik modern di puncak gunung menangkap foton galaksi purba',
    platform: 'youtube_long' as PlatformType,
    style: 'Science & Cosmos Widescreen',
  },
];

export const StudioWorkspace: React.FC<StudioWorkspaceProps> = ({
  activeProject,
  onCreateProject,
  onUpdateProject,
  currentUserId,
  currentUserName,
}) => {
  // Generator Form State
  const [topicInput, setTopicInput] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('youtube_shorts');
  const [selectedVoice, setSelectedVoice] = useState<VoicePersona>('Kore');
  const [selectedStyle, setSelectedStyle] = useState('Editorial Architecture');
  const [selectedLanguage, setSelectedLanguage] = useState<'id' | 'en'>('id');
  const [sceneCountInput, setSceneCountInput] = useState(4);

  const [formError, setFormError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string | null>(null);
  const [testingVoice, setTestingVoice] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const handleTestVoiceSample = async () => {
    if (testingVoice) return;
    setTestingVoice(true);
    try {
      const sampleText =
        selectedLanguage === 'en'
          ? `Hello creator, this is ${selectedVoice} ready to narrate your faceless video.`
          : `Halo kreator, ini adalah suara AI ${selectedVoice} yang siap membacakan naskah video faceless Anda.`;
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sampleText,
          voiceName: selectedVoice,
          durationSec: 4,
        }),
      });
      const data = await res.json();
      if (data.audioDataUrl) {
        const audio = new Audio(data.audioDataUrl);
        await audio.play().catch(() => {});
      }
    } finally {
      setTestingVoice(false);
    }
  };

  const handleGenerateCompleteVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateProjectTopicInput({ topic: topicInput });
    if (!validation.valid) {
      setFormError(validation.error || 'Topik tidak valid.');
      return;
    }

    setIsGenerating(true);
    setGenerationStep('1/3 Menyusun naskah, hook viral, visual prompt & subtitle dengan Gemini AI...');

    try {
      const res = await fetch('/api/gemini/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicInput.trim(),
          platform: selectedPlatform,
          language: selectedLanguage,
          visualStyle: selectedStyle,
          sceneCount: sceneCountInput,
        }),
      });
      const scriptData = await res.json();
      if (!res.ok) {
        throw new Error(scriptData.error || 'Gagal menghasilkan naskah AI.');
      }

      setGenerationStep('2/3 Menyelaraskan komposisi visual & gerakan kamera per adegan...');

      const stylePreset =
        VISUAL_STYLES.find((s) => s.label === selectedStyle) || VISUAL_STYLES[0];
      const projId = `proj_${Date.now()}`;
      const aspectRatio: AspectRatioType =
        PLATFORM_METADATA[selectedPlatform]?.aspectRatio || '9:16';

      const validMotions: CameraMotion[] = [
        'zoom_in',
        'zoom_out',
        'pan_left',
        'pan_right',
      ];

      const builtScenes: SceneItemData[] = (scriptData.scenes || []).map(
        (raw: Record<string, unknown>, idx: number) => {
          const motionRaw = String(raw.cameraMotion || 'zoom_in') as CameraMotion;
          return {
            id: `sc_${projId}_${idx}`,
            projectId: projId,
            ownerId: currentUserId,
            sceneIndex: idx,
            narrationText: String(
              raw.narrationText || `Adegan ${idx + 1} tentang ${topicInput.trim()}`
            ).slice(0, 600),
            subtitleText: String(
              raw.subtitleText || `Poin penting #${idx + 1}`
            ).slice(0, 300),
            visualPrompt: String(
              raw.visualPrompt || `${selectedStyle} scene for ${topicInput.trim()}`
            ).slice(0, 500),
            durationSec: Math.max(3, Math.min(20, Number(raw.durationSec) || 5)),
            cameraMotion: validMotions.includes(motionRaw) ? motionRaw : 'zoom_in',
            accentColor: String(raw.accentColor || stylePreset.accent).slice(0, 16),
            imageUrl: stylePreset.defaultImage,
          };
        }
      );

      const { totalDurationSec } = calculateSceneTimings(builtScenes);

      setGenerationStep('3/3 Merender narasi suara AI (Gemini TTS) untuk seluruh naskah...');
      let fullAudioDataUrl: string | undefined;
      try {
        const fullNarration = builtScenes.map((s) => s.narrationText).join(' ');
        const ttsRes = await fetch('/api/gemini/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: fullNarration,
            voiceName: selectedVoice,
            durationSec: totalDurationSec,
          }),
        });
        const ttsData = await ttsRes.json();
        if (ttsData.audioDataUrl) {
          fullAudioDataUrl = ttsData.audioDataUrl;
        }
      } catch {
        // Continue even if TTS network call is skipped
      }

      const nowIso = new Date().toISOString();
      const newProject: VideoProjectData = {
        id: projId,
        ownerId: currentUserId,
        authorName: currentUserName,
        title: String(scriptData.title || topicInput.trim()).slice(0, 140),
        topic: topicInput.trim().slice(0, 500),
        platform: selectedPlatform,
        aspectRatio,
        voiceName: selectedVoice,
        visualStyle: selectedStyle,
        language: selectedLanguage,
        status: 'ready',
        totalDurationSec,
        scenesCount: builtScenes.length,
        hookText: String(
          scriptData.hookText || builtScenes[0]?.narrationText || topicInput.trim()
        ).slice(0, 300),
        createdAtIso: nowIso,
        updatedAtIso: nowIso,
        scenes: builtScenes,
        fullAudioDataUrl,
      };

      await onCreateProject(newProject);
      setTopicInput('');
      setSaveBanner('Proyek video faceless baru berhasil disusun dan dimuat ke editor.');
      setTimeout(() => setSaveBanner(null), 4500);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyusun video.'
      );
    } finally {
      setIsGenerating(false);
      setGenerationStep(null);
    }
  };

  // Scene & Project Editing Handlers
  const handleSceneChange = (
    sceneId: string,
    field: keyof SceneItemData,
    value: string | number
  ) => {
    const updatedScenes = activeProject.scenes.map((scene) =>
      scene.id === sceneId ? { ...scene, [field]: value } : scene
    );
    const { totalDurationSec } = calculateSceneTimings(updatedScenes);
    onUpdateProject({
      ...activeProject,
      scenes: updatedScenes,
      totalDurationSec,
      scenesCount: updatedScenes.length,
      updatedAtIso: new Date().toISOString(),
    });
  };

  const handleAddScene = () => {
    if (activeProject.scenes.length >= 12) return;
    const nextIdx = activeProject.scenes.length;
    const stylePreset =
      VISUAL_STYLES.find((s) => s.label === activeProject.visualStyle) ||
      VISUAL_STYLES[0];
    const newScene: SceneItemData = {
      id: `sc_${activeProject.id}_${Date.now()}`,
      projectId: activeProject.id,
      ownerId: activeProject.ownerId,
      sceneIndex: nextIdx,
      narrationText: 'Tambahkan kalimat narasi baru untuk memperkuat pesan akhir video Anda.',
      subtitleText: 'Poin tambahan untuk penonton',
      visualPrompt: `Komposisi sinematik lanjutan untuk ${activeProject.title}`,
      durationSec: 5,
      cameraMotion: 'zoom_in',
      accentColor: stylePreset.accent,
      imageUrl: stylePreset.defaultImage,
    };
    const updatedScenes = [...activeProject.scenes, newScene];
    const { totalDurationSec } = calculateSceneTimings(updatedScenes);
    onUpdateProject({
      ...activeProject,
      scenes: updatedScenes,
      totalDurationSec,
      scenesCount: updatedScenes.length,
      updatedAtIso: new Date().toISOString(),
    });
  };

  const handleDeleteScene = (sceneId: string) => {
    if (activeProject.scenes.length <= 1) return;
    const filtered = activeProject.scenes
      .filter((s) => s.id !== sceneId)
      .map((s, idx) => ({ ...s, sceneIndex: idx }));
    const { totalDurationSec } = calculateSceneTimings(filtered);
    onUpdateProject({
      ...activeProject,
      scenes: filtered,
      totalDurationSec,
      scenesCount: filtered.length,
      updatedAtIso: new Date().toISOString(),
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: AI Faceless Video Generator Form (4 cols) */}
      <section
        aria-label="Generator Video Faceless AI"
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
      >
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            01. Buat Video Faceless Baru
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Masukkan topik atau ide. Gemini AI akan menyusun naskah, narasi suara, visual, dan subtitle otomatis.
          </p>
        </div>

        {/* Quick Topic Inspiration Presets */}
        <div>
          <span className="block text-xs font-medium text-slate-700 mb-1.5">
            Inspirasi Topik Cepat
          </span>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setTopicInput(preset.topic);
                  setSelectedPlatform(preset.platform);
                  setSelectedStyle(preset.style);
                  setFormError(null);
                }}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleGenerateCompleteVideo} className="flex flex-col gap-3.5">
          <div>
            <label
              htmlFor="video-topic-input"
              className="block text-xs font-medium text-slate-800 mb-1"
            >
              Topik atau Ide Konten Video
            </label>
            <textarea
              id="video-topic-input"
              rows={3}
              value={topicInput}
              onChange={(e) => {
                setTopicInput(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Contoh: 3 kebiasaan pagi yang meningkatkan fokus kerja menurut riset neurosains..."
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            {formError && (
              <p
                role="alert"
                className="mt-1.5 text-xs text-red-600 flex items-center gap-1"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{formError}</span>
              </p>
            )}
          </div>

          {/* Target Platform Selection */}
          <div>
            <label
              htmlFor="platform-select"
              className="block text-xs font-medium text-slate-800 mb-1"
            >
              Target Platform Sosial & Marketing
            </label>
            <select
              id="platform-select"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as PlatformType)}
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {(Object.keys(PLATFORM_METADATA) as PlatformType[]).map((key) => {
                const meta = PLATFORM_METADATA[key];
                return (
                  <option key={key} value={key}>
                    {meta.label} ({meta.aspectRatio} · {meta.recommendedSec})
                  </option>
                );
              })}
            </select>
          </div>

          {/* AI Voice Persona & Test Button */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="voice-persona-select"
                className="text-xs font-medium text-slate-800"
              >
                Karakter Narasi Suara AI (Gemini TTS)
              </label>
              <button
                type="button"
                onClick={handleTestVoiceSample}
                disabled={testingVoice}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>{testingVoice ? 'Memutar...' : 'Tes Suara'}</span>
              </button>
            </div>
            <select
              id="voice-persona-select"
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value as VoicePersona)}
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} — {v.character}
                </option>
              ))}
            </select>
          </div>

          {/* Visual Aesthetic & Language */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label
                htmlFor="visual-style-select"
                className="block text-xs font-medium text-slate-800 mb-1"
              >
                Gaya Visual
              </label>
              <select
                id="visual-style-select"
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full px-2.5 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {VISUAL_STYLES.map((st) => (
                  <option key={st.label} value={st.label}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="script-language-select"
                className="block text-xs font-medium text-slate-800 mb-1"
              >
                Bahasa & Jumlah Adegan
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  id="script-language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as 'id' | 'en')}
                  className="w-full px-2 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </select>
                <input
                  type="number"
                  aria-label="Jumlah adegan"
                  min={3}
                  max={6}
                  value={sceneCountInput}
                  onChange={(e) =>
                    setSceneCountInput(Math.max(3, Math.min(6, Number(e.target.value) || 4)))
                  }
                  className="w-14 px-2 py-2 text-xs font-mono tabular-nums text-center text-slate-900 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="mt-1 w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Elemen Multimedia...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Buat Proyek & Susun Naskah AI</span>
              </>
            )}
          </button>

          {generationStep && (
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              {generationStep}
            </p>
          )}

          {saveBanner && (
            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{saveBanner}</span>
            </p>
          )}
        </form>
      </section>

      {/* Center Column: Multi-Scene Script, Subtitle & Visual Editor (4 cols) */}
      <section
        aria-label="Editor Naskah dan Adegan"
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              02. Editor Naskah & Visual Adegan
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeProject.scenes.length} adegan · Total durasi{' '}
              <span className="font-mono tabular-nums">
                {activeProject.totalDurationSec} dtk
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddScene}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Adegan</span>
          </button>
        </div>

        {/* Editable Project Title & Platform */}
        <div className="grid grid-cols-1 gap-2.5 bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <div>
            <label
              htmlFor="active-project-title"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Judul Proyek Aktif
            </label>
            <input
              id="active-project-title"
              type="text"
              value={activeProject.title}
              onChange={(e) =>
                onUpdateProject({
                  ...activeProject,
                  title: e.target.value.slice(0, 140),
                  updatedAtIso: new Date().toISOString(),
                })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-white border border-slate-300 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label
                htmlFor="active-project-platform"
                className="block text-xs text-slate-600 mb-1"
              >
                Format Platform
              </label>
              <select
                id="active-project-platform"
                value={activeProject.platform}
                onChange={(e) => {
                  const newPlat = e.target.value as PlatformType;
                  const newRatio =
                    PLATFORM_METADATA[newPlat]?.aspectRatio || activeProject.aspectRatio;
                  onUpdateProject({
                    ...activeProject,
                    platform: newPlat,
                    aspectRatio: newRatio,
                    updatedAtIso: new Date().toISOString(),
                  });
                }}
                className="w-full px-2 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-md"
              >
                {(Object.keys(PLATFORM_METADATA) as PlatformType[]).map((k) => (
                  <option key={k} value={k}>
                    {PLATFORM_METADATA[k].shortLabel} ({PLATFORM_METADATA[k].aspectRatio})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="active-project-voice"
                className="block text-xs text-slate-600 mb-1"
              >
                Suara Narator AI
              </label>
              <select
                id="active-project-voice"
                value={activeProject.voiceName}
                onChange={(e) =>
                  onUpdateProject({
                    ...activeProject,
                    voiceName: e.target.value as VoicePersona,
                    updatedAtIso: new Date().toISOString(),
                  })
                }
                className="w-full px-2 py-1.5 text-xs text-slate-800 bg-white border border-slate-300 rounded-md"
              >
                {VOICE_OPTIONS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Scene Cards List */}
        <div className="flex flex-col gap-3 max-h-[540px] overflow-y-auto pr-1">
          {activeProject.scenes.map((scene, idx) => (
            <div
              key={scene.id}
              className="border border-slate-200 rounded-lg p-3 flex flex-col gap-2.5 bg-white"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  Adegan 0{idx + 1} ·{' '}
                  <span className="font-mono tabular-nums font-normal text-slate-500">
                    {scene.durationSec} dtk
                  </span>
                </span>
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label={`Gerakan kamera adegan ${idx + 1}`}
                    value={scene.cameraMotion}
                    onChange={(e) =>
                      handleSceneChange(
                        scene.id,
                        'cameraMotion',
                        e.target.value as CameraMotion
                      )
                    }
                    className="px-2 py-1 text-xs text-slate-700 bg-slate-100 rounded border border-slate-200"
                  >
                    <option value="zoom_in">Zoom In</option>
                    <option value="zoom_out">Zoom Out</option>
                    <option value="pan_left">Pan Kiri</option>
                    <option value="pan_right">Pan Kanan</option>
                  </select>

                  <input
                    type="number"
                    aria-label={`Durasi detik adegan ${idx + 1}`}
                    min={2}
                    max={30}
                    value={scene.durationSec}
                    onChange={(e) =>
                      handleSceneChange(
                        scene.id,
                        'durationSec',
                        Math.max(2, Math.min(30, Number(e.target.value) || 5))
                      )
                    }
                    className="w-12 px-1.5 py-1 text-xs font-mono tabular-nums text-center border border-slate-200 rounded"
                  />

                  {activeProject.scenes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteScene(scene.id)}
                      aria-label={`Hapus adegan ${idx + 1}`}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor={`narration-${scene.id}`}
                  className="block text-[11px] font-medium text-slate-600 mb-0.5"
                >
                  Naskah Narasi Suara
                </label>
                <textarea
                  id={`narration-${scene.id}`}
                  rows={2}
                  value={scene.narrationText}
                  onChange={(e) =>
                    handleSceneChange(scene.id, 'narrationText', e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 text-xs text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor={`subtitle-${scene.id}`}
                  className="block text-[11px] font-medium text-slate-600 mb-0.5"
                >
                  Teks Subtitle Layar
                </label>
                <input
                  id={`subtitle-${scene.id}`}
                  type="text"
                  value={scene.subtitleText}
                  onChange={(e) =>
                    handleSceneChange(scene.id, 'subtitleText', e.target.value)
                  }
                  className="w-full px-2.5 py-1.5 text-xs text-slate-900 border border-slate-200 rounded-md focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-1">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    aria-label={`Visual latar adegan ${idx + 1}`}
                    value={scene.imageUrl || ''}
                    onChange={(e) =>
                      handleSceneChange(scene.id, 'imageUrl', e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded"
                  >
                    <option value={PRESET_IMAGE_PATHS.finance}>
                      Visual: Distrik Finansial
                    </option>
                    <option value={PRESET_IMAGE_PATHS.history}>
                      Visual: Perpustakaan Kuno
                    </option>
                    <option value={PRESET_IMAGE_PATHS.marketing}>
                      Visual: Studio Produk Minimalis
                    </option>
                    <option value={PRESET_IMAGE_PATHS.science}>
                      Visual: Observatorium Kosmos
                    </option>
                    <option value="">Visual: Grafis Geometris Studio</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    aria-label={`Deskripsi visual adegan ${idx + 1}`}
                    value={scene.visualPrompt}
                    onChange={(e) =>
                      handleSceneChange(scene.id, 'visualPrompt', e.target.value)
                    }
                    placeholder="Deskripsi visual..."
                    className="w-full px-2 py-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Right Column: Live Video Canvas Player & Exporter (4 cols) */}
      <section aria-label="Pemutar dan Ekspor Video" className="lg:col-span-4">
        <VideoPreviewPlayer
          project={activeProject}
          onMarkExported={(projectId) => {
            if (activeProject.id === projectId) {
              onUpdateProject({
                ...activeProject,
                status: 'exported',
                updatedAtIso: new Date().toISOString(),
              });
            }
          }}
          onUpdateProjectAudio={(projectId, audioDataUrl) => {
            if (activeProject.id === projectId) {
              onUpdateProject({
                ...activeProject,
                fullAudioDataUrl: audioDataUrl,
                updatedAtIso: new Date().toISOString(),
              });
            }
          }}
        />
      </section>
    </div>
  );
};
