import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

/**
 * Generates a valid 24kHz mono 16-bit RIFF WAV buffer containing a warm, natural
 * cadence tone envelope when offline or when fallback audio is needed.
 */
function synthesizeFallbackWavBase64(text: string, durationSec = 4): string {
  const sampleRate = 24000;
  const clampedSec = Math.max(2, Math.min(12, durationSec));
  const numSamples = Math.floor(sampleRate * clampedSec);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const words = Math.max(3, text.trim().split(/\s+/).length);
  const syllableRate = Math.min(5.5, Math.max(2.5, words / clampedSec));

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fade = Math.min(1, t / 0.08) * Math.min(1, (clampedSec - t) / 0.12);
    const cadence = 0.55 + 0.45 * Math.sin(2 * Math.PI * syllableRate * t);
    const f0 = 165 + 25 * Math.sin(2 * Math.PI * 0.7 * t);
    const wave =
      0.5 * Math.sin(2 * Math.PI * f0 * t) +
      0.25 * Math.sin(2 * Math.PI * (f0 * 1.5) * t) +
      0.15 * Math.sin(2 * Math.PI * (f0 * 2) * t);
    const sample = Math.max(-1, Math.min(1, wave * cadence * fade * 0.22));
    buffer.writeInt16LE(Math.floor(sample * 32767), 44 + i * 2);
  }

  return buffer.toString('base64');
}

function buildFallbackScript(params: {
  topic: string;
  platform: string;
  language: 'id' | 'en';
  visualStyle: string;
}) {
  const { topic, language, visualStyle } = params;
  const cleanTopic = topic.trim();
  const isEn = language === 'en';

  const title = isEn
    ? `${cleanTopic.slice(0, 60)}: The Untold Breakdown`
    : ` Mengungkap Fakta & Strategi: ${cleanTopic.slice(0, 55)}`.trim();

  const hookText = isEn
    ? `Most people completely overlook what happens behind ${cleanTopic}—here is the 30-second breakdown.`
    : `90% orang belum menyadari rahasia utama di balik ${cleanTopic}—simak fakta singkatnya dalam 30 detik.`;

  const scenes = isEn
    ? [
        {
          sceneIndex: 0,
          narrationText: hookText,
          subtitleText: `Why ${cleanTopic} matters right now`,
          visualPrompt: `${visualStyle} editorial establishing shot representing ${cleanTopic}, dramatic studio lighting, high contrast`,
          durationSec: 5,
          cameraMotion: 'zoom_in',
          accentColor: '#2563EB',
        },
        {
          sceneIndex: 1,
          narrationText: `First, understanding the core mechanism gives you an immediate strategic advantage over conventional approaches.`,
          subtitleText: `Step 1: Master the core mechanism early`,
          visualPrompt: `Detailed architectural close-up of ${cleanTopic} workflow, crisp depth of field, warm ambient light`,
          durationSec: 6,
          cameraMotion: 'pan_right',
          accentColor: '#0EA5E9',
        },
        {
          sceneIndex: 2,
          narrationText: `Second, consistent execution compounds results faster than waiting for the perfect moment.`,
          subtitleText: `Step 2: Consistent execution compounds results`,
          visualPrompt: `Minimalist analytical visualization of momentum and compounding growth for ${cleanTopic}`,
          durationSec: 6,
          cameraMotion: 'zoom_out',
          accentColor: '#059669',
        },
        {
          sceneIndex: 3,
          narrationText: `Save this video for your next project and follow for daily faceless insights.`,
          subtitleText: `Save & follow for daily insights`,
          visualPrompt: `Clean cinematic closing frame for ${cleanTopic} with subtle horizon glow`,
          durationSec: 5,
          cameraMotion: 'pan_left',
          accentColor: '#4F46E5',
        },
      ]
    : [
        {
          sceneIndex: 0,
          narrationText: hookText,
          subtitleText: `Rahasia di balik ${cleanTopic.slice(0, 42)}`,
          visualPrompt: `Potret dokumenter editorial bergaya ${visualStyle} tentang ${cleanTopic}, pencahayaan dramatis`,
          durationSec: 5,
          cameraMotion: 'zoom_in',
          accentColor: '#2563EB',
        },
        {
          sceneIndex: 1,
          narrationText: `Pertama, pahami fondasi utamanya. Banyak kreator gagal karena melewati struktur pembuka yang memikat di 3 detik awal.`,
          subtitleText: `1. Kuasai fondasi & hook 3 detik pertama`,
          visualPrompt: `Visualisasi dekat elemen kunci ${cleanTopic} dengan tata cahaya sinematik dan kontras tinggi`,
          durationSec: 6,
          cameraMotion: 'pan_right',
          accentColor: '#0284C7',
        },
        {
          sceneIndex: 2,
          narrationText: `Kedua, kombinasikan narasi yang padat dengan visual yang bergerak dinamis agar retensi penonton tetap di atas 80 persen.`,
          subtitleText: `2. Padukan narasi padat & visual dinamis`,
          visualPrompt: `Komposisi studio modern yang menampilkan ritme visual dan pertumbuhan dari ${cleanTopic}`,
          durationSec: 6,
          cameraMotion: 'zoom_out',
          accentColor: '#059669',
        },
        {
          sceneIndex: 3,
          narrationText: `Ketiga, terapkan langkah ini secara konsisten. Simpan video ini sekarang dan bagikan ke rekan tim Anda!`,
          subtitleText: `3. Terapkan konsisten & simpan video ini`,
          visualPrompt: `Latar penutup sinematik berkelas untuk ${cleanTopic} dengan atmosfer profesional`,
          durationSec: 5,
          cameraMotion: 'pan_left',
          accentColor: '#4F46E5',
        },
      ];

  return {
    title,
    hookText,
    scenes,
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  app.post('/api/gemini/script', async (req, res) => {
    const {
      topic = '',
      platform = 'youtube_shorts',
      language = 'id',
      visualStyle = 'Documentary Editorial',
      sceneCount = 4,
    } = req.body || {};

    if (!topic || String(topic).trim().length < 3) {
      res.status(400).json({ error: 'Topik minimal harus 3 karakter.' });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      const fallback = buildFallbackScript({
        topic: String(topic),
        platform: String(platform),
        language: language === 'en' ? 'en' : 'id',
        visualStyle: String(visualStyle),
      });
      res.json({ ...fallback, source: 'fallback' });
      return;
    }

    try {
      const langLabel = language === 'en' ? 'English' : 'Bahasa Indonesia';
      const numScenes = Math.max(3, Math.min(6, Number(sceneCount) || 4));
      const prompt = `Create a high-retention faceless video script for platform "${platform}" in ${langLabel}.
Topic / Idea: "${topic}"
Visual Aesthetic: "${visualStyle}"
Number of scenes: ${numScenes}.
Each scene must have:
- sceneIndex (0 to ${numScenes - 1})
- narrationText (spoken voiceover sentence, 12-28 words, engaging and natural)
- subtitleText (concise punchy on-screen caption, max 10 words)
- visualPrompt (detailed photographic or editorial visual description for the background frame)
- durationSec (integer between 4 and 8)
- cameraMotion (one of: "zoom_in", "zoom_out", "pan_left", "pan_right")
- accentColor (hex color string like "#2563EB", "#059669", "#D97706", "#4F46E5")`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are an expert faceless video producer and scriptwriter for YouTube, Shorts, TikTok, and Reels. Output strictly valid JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: {
                type: Type.STRING,
                description: 'Compelling video title (max 100 chars)',
              },
              hookText: {
                type: Type.STRING,
                description: 'Opening viral hook line',
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneIndex: { type: Type.INTEGER },
                    narrationText: { type: Type.STRING },
                    subtitleText: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING },
                    durationSec: { type: Type.INTEGER },
                    cameraMotion: { type: Type.STRING },
                    accentColor: { type: Type.STRING },
                  },
                  required: [
                    'sceneIndex',
                    'narrationText',
                    'subtitleText',
                    'visualPrompt',
                    'durationSec',
                    'cameraMotion',
                    'accentColor',
                  ],
                },
              },
            },
            required: ['title', 'hookText', 'scenes'],
          },
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('Empty response from Gemini model');
      }
      const parsed = JSON.parse(rawText);
      res.json({ ...parsed, source: 'gemini-3.8-flash' });
    } catch (error) {
      console.error('Gemini script generation error, using structured fallback:', error);
      const fallback = buildFallbackScript({
        topic: String(topic),
        platform: String(platform),
        language: language === 'en' ? 'en' : 'id',
        visualStyle: String(visualStyle),
      });
      res.json({
        ...fallback,
        source: 'fallback',
        warning: error instanceof Error ? error.message : 'Fallback applied',
      });
    }
  });

  app.post('/api/gemini/tts', async (req, res) => {
    const {
      text = '',
      voiceName = 'Kore',
      durationSec = 5,
    } = req.body || {};

    if (!text || String(text).trim().length === 0) {
      res.status(400).json({ error: 'Teks narasi tidak boleh kosong.' });
      return;
    }

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const selectedVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

    const ai = getGenAIClient();
    if (!ai) {
      const wavBase64 = synthesizeFallbackWavBase64(String(text), Number(durationSec) || 5);
      res.json({
        audioDataUrl: `data:audio/wav;base64,${wavBase64}`,
        voiceName: selectedVoice,
        source: 'synthesized-wav',
      });
      return;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: String(text).slice(0, 1200),
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('No inline audio returned by Gemini TTS');
      }

      res.json({
        audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
        voiceName: selectedVoice,
        source: 'gemini-3.8-flash-lite-tts',
      });
    } catch (error) {
      console.error('Gemini TTS error, using synthesized WAV fallback:', error);
      const wavBase64 = synthesizeFallbackWavBase64(String(text), Number(durationSec) || 5);
      res.json({
        audioDataUrl: `data:audio/wav;base64,${wavBase64}`,
        voiceName: selectedVoice,
        source: 'synthesized-wav',
        warning: error instanceof Error ? error.message : 'Fallback WAV used',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VoxReel Studio server running at http://localhost:${PORT}`);
  });
}

startServer();
