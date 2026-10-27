import {
  PlatformAnalytics,
  PlatformType,
  PlanTier,
  SceneItemData,
  SubscriptionData,
  VideoProjectData,
} from '../types';

export interface SceneTimingWindow {
  scene: SceneItemData;
  startSec: number;
  endSec: number;
}

export interface ActivePlaybackFrame {
  activeScene: SceneItemData;
  sceneIndex: number;
  sceneProgress: number;
  activeWords: { word: string; isHighlighted: boolean; isPast: boolean }[];
  totalDurationSec: number;
}

export function calculateSceneTimings(scenes: SceneItemData[]): {
  timings: SceneTimingWindow[];
  totalDurationSec: number;
} {
  const sorted = [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex);
  let cursor = 0;
  const timings: SceneTimingWindow[] = sorted.map((scene) => {
    const duration = Math.max(2, Math.min(120, Math.round(scene.durationSec || 5)));
    const startSec = cursor;
    const endSec = cursor + duration;
    cursor = endSec;
    return {
      scene: { ...scene, durationSec: duration },
      startSec,
      endSec,
    };
  });
  return {
    timings,
    totalDurationSec: Math.max(3, cursor),
  };
}

export function getActivePlaybackFrame(
  scenes: SceneItemData[],
  currentTimeSec: number
): ActivePlaybackFrame | null {
  if (!scenes || scenes.length === 0) return null;
  const { timings, totalDurationSec } = calculateSceneTimings(scenes);
  const clampedTime = Math.max(0, Math.min(totalDurationSec - 0.001, currentTimeSec));

  let foundIndex = timings.findIndex(
    (t) => clampedTime >= t.startSec && clampedTime < t.endSec
  );
  if (foundIndex === -1) {
    foundIndex = timings.length - 1;
  }

  const window = timings[foundIndex];
  const span = Math.max(0.1, window.endSec - window.startSec);
  const sceneProgress = Math.max(0, Math.min(1, (clampedTime - window.startSec) / span));

  const rawWords = (window.scene.subtitleText || window.scene.narrationText || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const activeWordIdx =
    rawWords.length > 0
      ? Math.min(rawWords.length - 1, Math.floor(sceneProgress * rawWords.length))
      : 0;

  const activeWords = rawWords.map((word, idx) => ({
    word,
    isHighlighted: idx === activeWordIdx,
    isPast: idx < activeWordIdx,
  }));

  return {
    activeScene: window.scene,
    sceneIndex: foundIndex,
    sceneProgress,
    activeWords,
    totalDurationSec,
  };
}

export function formatSrtTimestamp(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const ms = Math.round((safeSec - Math.floor(safeSec)) * 1000);

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');

  return `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)},${pad3(ms)}`;
}

export function generateSrtSubtitles(scenes: SceneItemData[]): string {
  const { timings } = calculateSceneTimings(scenes);
  return timings
    .map((item, idx) => {
      const start = formatSrtTimestamp(item.startSec);
      const end = formatSrtTimestamp(item.endSec);
      const caption = (item.scene.subtitleText || item.scene.narrationText).trim();
      return `${idx + 1}\n${start} --> ${end}\n${caption}`;
    })
    .join('\n\n');
}

export function validateProjectTopicInput(input: {
  topic: string;
  title?: string;
}): { valid: boolean; error?: string } {
  const trimmedTopic = (input.topic || '').trim();
  if (trimmedTopic.length < 3) {
    return {
      valid: false,
      error: 'Topik atau ide video minimal harus terdiri dari 3 karakter.',
    };
  }
  if (trimmedTopic.length > 500) {
    return {
      valid: false,
      error: 'Topik terlalu panjang (maksimal 500 karakter).',
    };
  }
  if (input.title !== undefined) {
    const trimmedTitle = input.title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 140) {
      return {
        valid: false,
        error: 'Judul proyek harus antara 3 hingga 140 karakter.',
      };
    }
  }
  return { valid: true };
}

export function computePlatformAnalytics(
  projects: VideoProjectData[],
  subscriptions: SubscriptionData[]
): PlatformAnalytics {
  const platformBreakdown: Record<PlatformType, number> = {
    youtube_shorts: 0,
    tiktok: 0,
    instagram_reels: 0,
    facebook_reels: 0,
    youtube_long: 0,
    marketing_ad: 0,
  };

  const tierBreakdown: Record<PlanTier, number> = {
    starter: 0,
    creator_pro: 0,
    agency_studio: 0,
  };

  let totalDurationRenderedSec = 0;
  let exportedVideosCount = 0;

  for (const proj of projects) {
    if (platformBreakdown[proj.platform] !== undefined) {
      platformBreakdown[proj.platform] += 1;
    }
    totalDurationRenderedSec += proj.totalDurationSec || 0;
    if (proj.status === 'exported' || proj.status === 'ready') {
      exportedVideosCount += 1;
    }
  }

  let activeSubscribersCount = 0;
  let monthlyRecurringRevenueIdr = 0;

  for (const sub of subscriptions) {
    if (tierBreakdown[sub.planTier] !== undefined) {
      tierBreakdown[sub.planTier] += 1;
    }
    if (sub.status === 'active' || sub.status === 'trialing') {
      activeSubscribersCount += 1;
      monthlyRecurringRevenueIdr += sub.amountIdr || 0;
    }
  }

  return {
    totalProjects: projects.length,
    totalDurationRenderedSec,
    exportedVideosCount,
    activeSubscribersCount,
    monthlyRecurringRevenueIdr,
    platformBreakdown,
    tierBreakdown,
  };
}
