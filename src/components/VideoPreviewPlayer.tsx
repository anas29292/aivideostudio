import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  FileText,
  Film,
  Subtitles,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { VideoProjectData } from '../types';
import {
  calculateSceneTimings,
  generateSrtSubtitles,
  getActivePlaybackFrame,
} from '../utils/videoEngine';
import {
  drawVideoFrameToCanvas,
  exportProjectToWebmVideo,
  preloadImage,
} from '../utils/canvasVideoRenderer';
import { PLATFORM_METADATA } from '../utils/seedData';

interface VideoPreviewPlayerProps {
  project: VideoProjectData;
  onMarkExported: (projectId: string) => void;
  onUpdateProjectAudio: (projectId: string, audioDataUrl: string) => void;
}

export const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({
  project,
  onMarkExported,
  onUpdateProjectAudio,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);

  const [isExportingVideo, setIsExportingVideo] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedVideoFile, setExportedVideoFile] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  const [isSynthesizingVoice, setIsSynthesizingVoice] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [imageReadyTick, setImageReadyTick] = useState(0);

  const { totalDurationSec } = calculateSceneTimings(project.scenes);

  // Reset playback state when switching projects
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setExportedVideoFile(null);
    setStatusMessage(null);
  }, [project.id]);

  // Preload scene images and trigger canvas redraw when ready
  useEffect(() => {
    let active = true;
    Promise.all(
      project.scenes.map((scene) =>
        scene.imageUrl ? preloadImage(scene.imageUrl) : Promise.resolve(null)
      )
    ).then(() => {
      if (active) {
        setImageReadyTick((t) => t + 1);
      }
    });
    return () => {
      active = false;
    };
  }, [project.id, project.scenes]);

  // Draw current frame whenever time, scenes, loaded images, or subtitle visibility changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawVideoFrameToCanvas(
      ctx,
      canvas.width,
      canvas.height,
      project,
      currentTimeSec,
      showSubtitles
    );
  }, [project, currentTimeSec, showSubtitles, imageReadyTick]);

  // Playback loop at 25 FPS
  useEffect(() => {
    if (!isPlaying) return;
    const stepSec = 0.04;
    const interval = window.setInterval(() => {
      setCurrentTimeSec((prev) => {
        if (prev + stepSec >= totalDurationSec) {
          setIsPlaying(false);
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
          return 0;
        }
        return prev + stepSec;
      });
    }, 40);

    return () => window.clearInterval(interval);
  }, [isPlaying, totalDurationSec]);

  const handleTogglePlay = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    // Start playback
    setIsPlaying(true);
    if (audioRef.current && project.fullAudioDataUrl && !isMuted) {
      try {
        audioRef.current.currentTime = Math.min(
          currentTimeSec,
          Math.max(0, (audioRef.current.duration || totalDurationSec) - 0.2)
        );
        await audioRef.current.play();
      } catch {
        // Ignore browser autoplay restrictions if any
      }
    }
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setCurrentTimeSec(0);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const handleSynthesizeFullNarration = async () => {
    setIsSynthesizingVoice(true);
    setStatusMessage('Menghubungi Gemini TTS untuk merender narasi suara penuh...');
    try {
      const combinedScript = project.scenes
        .map((s) => s.narrationText.trim())
        .join(' ');
      const response = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: combinedScript,
          voiceName: project.voiceName,
          durationSec: totalDurationSec,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.audioDataUrl) {
        throw new Error(data.error || 'Gagal membuat narasi suara AI');
      }
      onUpdateProjectAudio(project.id, data.audioDataUrl);
      setStatusMessage(`Narasi suara (${project.voiceName}) siap diputar & diunduh.`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Gagal membuat narasi suara AI.'
      );
    } finally {
      setIsSynthesizingVoice(false);
    }
  };

  const handleDownloadAudioWav = async () => {
    let audioUrl = project.fullAudioDataUrl;
    if (!audioUrl) {
      setIsSynthesizingVoice(true);
      setStatusMessage('Menyiapkan file audio WAV narasi...');
      try {
        const combinedScript = project.scenes
          .map((s) => s.narrationText.trim())
          .join(' ');
        const response = await fetch('/api/gemini/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: combinedScript,
            voiceName: project.voiceName,
            durationSec: totalDurationSec,
          }),
        });
        const data = await response.json();
        if (data.audioDataUrl) {
          audioUrl = data.audioDataUrl;
          onUpdateProjectAudio(project.id, data.audioDataUrl);
        }
      } finally {
        setIsSynthesizingVoice(false);
      }
    }

    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      const slug = project.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .slice(0, 35);
      a.download = `${slug || 'narasi'}-${project.voiceName.toLowerCase()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setStatusMessage('File audio narasi (.wav) berhasil diunduh.');
    }
  };

  const handleDownloadSubtitlesSrt = () => {
    const srtContent = generateSrtSubtitles(project.scenes);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = project.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 35);
    a.download = `${slug || 'subtitle'}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage('File subtitle (.srt) berhasil diunduh.');
  };

  const handleRenderAndDownloadVideo = async () => {
    if (isExportingVideo) return;
    setIsPlaying(false);
    setIsExportingVideo(true);
    setExportProgress(5);
    setStatusMessage('Merender komposisi visual, subtitle & gerakan kamera ke file video...');

    try {
      const result = await exportProjectToWebmVideo(project, (pct) => {
        setExportProgress(pct);
      });
      setExportedVideoFile({ url: result.url, filename: result.filename });
      onMarkExported(project.id);

      // Automatically trigger browser download
      const a = document.createElement('a');
      a.href = result.url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setStatusMessage(`Video final (${result.filename}) selesai dirender dan siap diunduh.`);
    } catch (err) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Gagal mengekspor file video.'
      );
    } finally {
      setIsExportingVideo(false);
    }
  };

  const isVertical = project.aspectRatio === '9:16';
  const canvasWidth = isVertical ? 360 : 640;
  const canvasHeight = isVertical ? 640 : 360;

  const activeFrame = getActivePlaybackFrame(project.scenes, currentTimeSec);
  const platformMeta = PLATFORM_METADATA[project.platform];

  const formatTimeCode = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Pratinjau & Ekspor Video Final
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {platformMeta?.label} · Rasio {project.aspectRatio} · Suara {project.voiceName}
          </p>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-600">
          {formatTimeCode(currentTimeSec)} / {formatTimeCode(totalDurationSec)}
        </span>
      </div>

      {/* Canvas Viewport */}
      <div className="bg-slate-950 rounded-lg p-3 flex flex-col items-center justify-center relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          data-testid="faceless-video-canvas"
          onClick={handleTogglePlay}
          className={`cursor-pointer rounded-md border border-slate-800 ${
            isVertical ? 'w-[230px] h-[408px]' : 'w-full max-w-[420px] aspect-video'
          }`}
        />

        {project.fullAudioDataUrl && (
          <audio
            ref={audioRef}
            src={project.fullAudioDataUrl}
            muted={isMuted}
            onEnded={() => setIsPlaying(false)}
          />
        )}
      </div>

      {/* Timeline Scrubber & Transport Controls */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <label htmlFor="video-timeline-scrubber" className="sr-only">
            Posisi waktu video
          </label>
          <input
            id="video-timeline-scrubber"
            type="range"
            min={0}
            max={totalDurationSec}
            step={0.1}
            value={currentTimeSec}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentTimeSec(Number(e.target.value));
            }}
            className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Jeda pratinjau video' : 'Putar pratinjau video'}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Jeda' : 'Putar Video'}</span>
            </button>

            <button
              type="button"
              onClick={handleRestart}
              aria-label="Ulang dari awal"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              aria-label={isMuted ? 'Aktifkan suara' : 'Bisukan suara'}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowSubtitles((s) => !s)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
              showSubtitles
                ? 'border-blue-600 text-blue-700 bg-blue-50/60'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>{showSubtitles ? 'Subtitle Aktif' : 'Subtitle Nonaktif'}</span>
          </button>
        </div>
      </div>

      {/* Active Scene Narration Readout */}
      {activeFrame && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Adegan Aktif #{activeFrame.sceneIndex + 1}</span>
            <span className="font-mono tabular-nums">
              Durasi {activeFrame.activeScene.durationSec} dtk · Gerakan {activeFrame.activeScene.cameraMotion.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed">
            “{activeFrame.activeScene.narrationText}”
          </p>
        </div>
      )}

      {/* Voiceover Synthesis & Multimedia Export Actions */}
      <div className="border-t border-slate-200 pt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleRenderAndDownloadVideo}
          disabled={isExportingVideo}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isExportingVideo ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-mono tabular-nums">
                Merender Video Final ({exportProgress}%)...
              </span>
            </>
          ) : (
            <>
              <Film className="w-4 h-4" />
              <span>Render & Unduh File Video (.webm)</span>
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleDownloadAudioWav}
            disabled={isSynthesizingVoice}
            className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSynthesizingVoice ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>Unduh Audio AI (.wav)</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSubtitlesSrt}
            className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh Subtitle (.srt)</span>
          </button>
        </div>

        {!project.fullAudioDataUrl && (
          <button
            type="button"
            onClick={handleSynthesizeFullNarration}
            disabled={isSynthesizingVoice}
            className="w-full py-1.5 px-3 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
          >
            Generate Ulang Narasi Suara AI ({project.voiceName})
          </button>
        )}
      </div>

      {/* Status & Playable Exported Video File Container */}
      {statusMessage && (
        <div
          role="status"
          className="text-xs text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {exportedVideoFile && (
        <div className="border-t border-slate-200 pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-900">
              File Video Final Siap Diputar
            </span>
            <a
              href={exportedVideoFile.url}
              download={exportedVideoFile.filename}
              className="text-xs font-medium text-blue-600 hover:underline whitespace-nowrap shrink-0"
            >
              Simpan {exportedVideoFile.filename}
            </a>
          </div>
          <video
            src={exportedVideoFile.url}
            controls
            className="w-full max-h-56 bg-slate-950 rounded-lg border border-slate-200"
          />
        </div>
      )}
    </div>
  );
};
