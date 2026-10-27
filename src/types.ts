export type PlatformType =
  | 'youtube_shorts'
  | 'tiktok'
  | 'instagram_reels'
  | 'facebook_reels'
  | 'youtube_long'
  | 'marketing_ad';

export type AspectRatioType = '9:16' | '16:9' | '1:1';

export type VoicePersona = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type CameraMotion = 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';

export type ProjectStatus = 'draft' | 'ready' | 'exported' | 'archived';

export type PlanTier = 'starter' | 'creator_pro' | 'agency_studio';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export interface SceneItemData {
  id: string;
  projectId: string;
  ownerId: string;
  sceneIndex: number;
  narrationText: string;
  subtitleText: string;
  visualPrompt: string;
  durationSec: number;
  cameraMotion: CameraMotion;
  accentColor: string;
  imageUrl?: string;
  audioDataUrl?: string;
}

export interface VideoProjectData {
  id: string;
  ownerId: string;
  authorName: string;
  title: string;
  topic: string;
  platform: PlatformType;
  aspectRatio: AspectRatioType;
  voiceName: VoicePersona;
  visualStyle: string;
  language: 'id' | 'en';
  status: ProjectStatus;
  totalDurationSec: number;
  scenesCount: number;
  hookText: string;
  createdAtIso: string;
  updatedAtIso: string;
  scenes: SceneItemData[];
  fullAudioDataUrl?: string;
}

export interface SubscriptionData {
  id: string;
  ownerId: string;
  userName: string;
  email: string;
  planTier: PlanTier;
  status: SubscriptionStatus;
  monthlyQuota: number;
  usedQuota: number;
  amountIdr: number;
  updatedAtIso: string;
}

export interface PlatformAnalytics {
  totalProjects: number;
  totalDurationRenderedSec: number;
  exportedVideosCount: number;
  activeSubscribersCount: number;
  monthlyRecurringRevenueIdr: number;
  platformBreakdown: Record<PlatformType, number>;
  tierBreakdown: Record<PlanTier, number>;
}
