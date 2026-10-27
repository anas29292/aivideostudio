import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSceneTimings,
  getActivePlaybackFrame,
  formatSrtTimestamp,
  generateSrtSubtitles,
  validateProjectTopicInput,
  computePlatformAnalytics,
} from './videoEngine';
import { SceneItemData, SubscriptionData, VideoProjectData } from '../types';

const mockScenes: SceneItemData[] = [
  {
    id: 'scene_1',
    projectId: 'proj_1',
    ownerId: 'user_1',
    sceneIndex: 0,
    narrationText: 'Rahasia finansial pertama dimulai dari pengelolaan arus kas harian.',
    subtitleText: 'Rahasia finansial pertama dimulai sekarang',
    visualPrompt: 'Modern financial district at dusk',
    durationSec: 5,
    cameraMotion: 'zoom_in',
    accentColor: '#2563EB',
  },
  {
    id: 'scene_2',
    projectId: 'proj_1',
    ownerId: 'user_1',
    sceneIndex: 1,
    narrationText: 'Investasi otomatis setiap bulan membantu membangun kebebasan waktu.',
    subtitleText: 'Investasi otomatis setiap bulan',
    visualPrompt: 'Minimalist workspace with growth chart',
    durationSec: 6,
    cameraMotion: 'pan_right',
    accentColor: '#059669',
  },
];

test('calculateSceneTimings computes accurate start, end, and total duration', () => {
  const { timings, totalDurationSec } = calculateSceneTimings(mockScenes);
  assert.equal(totalDurationSec, 11);
  assert.equal(timings.length, 2);
  assert.equal(timings[0].startSec, 0);
  assert.equal(timings[0].endSec, 5);
  assert.equal(timings[1].startSec, 5);
  assert.equal(timings[1].endSec, 11);
});

test('getActivePlaybackFrame resolves active scene and highlights current subtitle word', () => {
  const frameAt2s = getActivePlaybackFrame(mockScenes, 2.5);
  assert.ok(frameAt2s);
  assert.equal(frameAt2s.sceneIndex, 0);
  assert.equal(frameAt2s.activeScene.id, 'scene_1');
  assert.equal(frameAt2s.activeWords.length, 5);
  const highlighted = frameAt2s.activeWords.filter((w) => w.isHighlighted);
  assert.equal(highlighted.length, 1);

  const frameAt7s = getActivePlaybackFrame(mockScenes, 7.0);
  assert.ok(frameAt7s);
  assert.equal(frameAt7s.sceneIndex, 1);
  assert.equal(frameAt7s.activeScene.id, 'scene_2');
});

test('formatSrtTimestamp and generateSrtSubtitles output valid SubRip format', () => {
  assert.equal(formatSrtTimestamp(0), '00:00:00,000');
  assert.equal(formatSrtTimestamp(65.5), '00:01:05,500');

  const srt = generateSrtSubtitles(mockScenes);
  assert.ok(srt.includes('1\n00:00:00,000 --> 00:00:05,000\nRahasia finansial pertama dimulai sekarang'));
  assert.ok(srt.includes('2\n00:00:05,000 --> 00:00:11,000\nInvestasi otomatis setiap bulan'));
});

test('validateProjectTopicInput enforces minimum and maximum length boundaries', () => {
  assert.deepEqual(validateProjectTopicInput({ topic: 'ab' }), {
    valid: false,
    error: 'Topik atau ide video minimal harus terdiri dari 3 karakter.',
  });
  assert.deepEqual(
    validateProjectTopicInput({ topic: 'Strategi Konten TikTok 2026', title: 'Strategi TikTok' }),
    { valid: true }
  );
});

test('computePlatformAnalytics aggregates MRR, platform counts, and active subscriptions', () => {
  const projects: VideoProjectData[] = [
    {
      id: 'p1',
      ownerId: 'u1',
      authorName: 'Budi',
      title: 'Projek Shorts',
      topic: 'Topik A',
      platform: 'youtube_shorts',
      aspectRatio: '9:16',
      voiceName: 'Kore',
      visualStyle: 'Editorial Documentary',
      language: 'id',
      status: 'exported',
      totalDurationSec: 30,
      scenesCount: 5,
      hookText: 'Hook 1',
      createdAtIso: '2026-10-26T00:00:00Z',
      updatedAtIso: '2026-10-26T00:00:00Z',
      scenes: mockScenes,
    },
  ];
  const subs: SubscriptionData[] = [
    {
      id: 's1',
      ownerId: 'u1',
      userName: 'Budi',
      email: 'budi@example.com',
      planTier: 'creator_pro',
      status: 'active',
      monthlyQuota: 30,
      usedQuota: 4,
      amountIdr: 249000,
      updatedAtIso: '2026-10-26T00:00:00Z',
    },
  ];

  const stats = computePlatformAnalytics(projects, subs);
  assert.equal(stats.totalProjects, 1);
  assert.equal(stats.totalDurationRenderedSec, 30);
  assert.equal(stats.exportedVideosCount, 1);
  assert.equal(stats.activeSubscribersCount, 1);
  assert.equal(stats.monthlyRecurringRevenueIdr, 249000);
  assert.equal(stats.platformBreakdown.youtube_shorts, 1);
  assert.equal(stats.tierBreakdown.creator_pro, 1);
});
