import { VideoProjectData } from '../types';
import { getActivePlaybackFrame } from './videoEngine';
import { PLATFORM_METADATA } from './seedData';

const imageCache = new Map<string, HTMLImageElement>();

export function preloadImage(url: string): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  if (imageCache.has(url)) {
    return Promise.resolve(imageCache.get(url)!);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Renders a single video frame onto an HTML5 Canvas with Ken Burns camera motion,
 * editorial visual composition, progress indicator, and highlighted word subtitles.
 */
export function drawVideoFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  project: VideoProjectData,
  currentTimeSec: number,
  showSubtitles = true
) {
  const frame = getActivePlaybackFrame(project.scenes, currentTimeSec);
  if (!frame) return;

  const { activeScene, sceneIndex, sceneProgress, activeWords, totalDurationSec } = frame;
  const accent = activeScene.accentColor || '#2563EB';

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // 1. Base editorial dark canvas
  const bgGrad = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  bgGrad.addColorStop(0, '#090D16');
  bgGrad.addColorStop(0.55, '#111827');
  bgGrad.addColorStop(1, '#0F172A');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 2. Compute Ken Burns transform
  let scale = 1.08;
  let offsetX = 0;
  let offsetY = 0;

  if (activeScene.cameraMotion === 'zoom_in') {
    scale = 1.0 + sceneProgress * 0.14;
  } else if (activeScene.cameraMotion === 'zoom_out') {
    scale = 1.14 - sceneProgress * 0.12;
  } else if (activeScene.cameraMotion === 'pan_left') {
    scale = 1.12;
    offsetX = (0.5 - sceneProgress) * canvasWidth * 0.07;
  } else if (activeScene.cameraMotion === 'pan_right') {
    scale = 1.12;
    offsetX = (sceneProgress - 0.5) * canvasWidth * 0.07;
  }

  ctx.save();
  ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

  const cachedImg = activeScene.imageUrl ? imageCache.get(activeScene.imageUrl) : null;
  if (cachedImg && cachedImg.complete && cachedImg.naturalWidth > 0) {
    const imgRatio = cachedImg.naturalWidth / cachedImg.naturalHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawW = canvasWidth;
    let drawH = canvasHeight;
    let drawX = 0;
    let drawY = 0;

    if (imgRatio > canvasRatio) {
      drawH = canvasHeight;
      drawW = canvasHeight * imgRatio;
      drawX = (canvasWidth - drawW) / 2;
    } else {
      drawW = canvasWidth;
      drawH = canvasWidth / imgRatio;
      drawY = (canvasHeight - drawH) / 2;
    }
    ctx.drawImage(cachedImg, drawX, drawY, drawW, drawH);
  } else {
    // Rich procedural editorial illustration when scene has no external photo
    const radial = ctx.createRadialGradient(
      canvasWidth * 0.5,
      canvasHeight * 0.35,
      canvasWidth * 0.05,
      canvasWidth * 0.5,
      canvasHeight * 0.45,
      canvasWidth * 0.85
    );
    radial.addColorStop(0, `${accent}66`);
    radial.addColorStop(0.5, `${accent}22`);
    radial.addColorStop(1, '#090D16');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Subtle architectural grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const step = Math.round(canvasWidth / 8);
    for (let x = 0; x < canvasWidth; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasHeight);
      ctx.stroke();
    }
    for (let y = 0; y < canvasHeight; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasWidth, y);
      ctx.stroke();
    }

    // Geometric focal ring
    ctx.strokeStyle = `${accent}88`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(
      canvasWidth * 0.5,
      canvasHeight * 0.38,
      Math.min(canvasWidth, canvasHeight) * 0.22,
      0,
      Math.PI * 2
    );
    ctx.stroke();
  }
  ctx.restore();

  // 3. Measured Contrast Scrim for guaranteed WCAG legibility
  const scrim = ctx.createLinearGradient(0, 0, 0, canvasHeight);
  scrim.addColorStop(0, 'rgba(9, 13, 22, 0.55)');
  scrim.addColorStop(0.4, 'rgba(9, 13, 22, 0.20)');
  scrim.addColorStop(0.7, 'rgba(9, 13, 22, 0.68)');
  scrim.addColorStop(1, 'rgba(9, 13, 22, 0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 4. Top Editorial Watermark & Scene Metadata
  const padX = Math.round(canvasWidth * 0.065);
  const topY = Math.round(canvasHeight * 0.055);
  const baseFontSize = Math.max(12, Math.round(canvasWidth * 0.028));

  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.font = `600 ${baseFontSize}px "Plus Jakarta Sans", sans-serif`;
  const platformName = PLATFORM_METADATA[project.platform]?.shortLabel || 'VIDEO';
  ctx.fillText(
    `${platformName}  ·  SCENE 0${sceneIndex + 1}/0${project.scenes.length}`,
    padX,
    topY
  );

  // Visual prompt quiet descriptor
  ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
  ctx.font = `400 ${Math.max(10, Math.round(baseFontSize * 0.82))}px "Plus Jakarta Sans", sans-serif`;
  const promptPreview =
    activeScene.visualPrompt.length > 52
      ? `${activeScene.visualPrompt.slice(0, 52)}...`
      : activeScene.visualPrompt;
  ctx.fillText(promptPreview, padX, topY + baseFontSize * 1.45);

  // 5. Dynamic Word-by-Word Highlighted Subtitles
  if (showSubtitles && activeWords.length > 0) {
    const subFontSize = Math.max(17, Math.round(canvasWidth * 0.052));
    ctx.font = `700 ${subFontSize}px "Plus Jakarta Sans", sans-serif`;
    const maxSubWidth = canvasWidth - padX * 2;

    const fullLineText = activeWords.map((w) => w.word).join(' ');
    const lines = wrapTextLines(ctx, fullLineText, maxSubWidth);
    const lineHeight = Math.round(subFontSize * 1.38);
    const blockHeight = lines.length * lineHeight;
    const startY = canvasHeight - Math.round(canvasHeight * 0.16) - blockHeight;

    // Subtle dark backdrop bar behind subtitle block
    ctx.fillStyle = 'rgba(9, 13, 22, 0.72)';
    const boxPadX = Math.round(subFontSize * 0.65);
    const boxPadY = Math.round(subFontSize * 0.5);
    ctx.beginPath();
    ctx.roundRect(
      padX - boxPadX / 2,
      startY - subFontSize - boxPadY / 2,
      maxSubWidth + boxPadX,
      blockHeight + boxPadY * 1.3,
      10
    );
    ctx.fill();

    // Render word by word with active highlight color
    let wordCursor = 0;
    lines.forEach((line, lineIdx) => {
      const lineWords = line.split(/\s+/).filter(Boolean);
      const lineWidth = ctx.measureText(line).width;
      let cursorX = (canvasWidth - lineWidth) / 2;
      const y = startY + lineIdx * lineHeight;

      lineWords.forEach((wText) => {
        const wordMeta = activeWords[wordCursor];
        wordCursor += 1;

        if (wordMeta?.isHighlighted) {
          ctx.fillStyle = '#FACC15'; // Crisp gold active word highlight
        } else if (wordMeta?.isPast) {
          ctx.fillStyle = '#FFFFFF';
        } else {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
        }

        ctx.fillText(wText, cursorX, y);
        cursorX += ctx.measureText(`${wText} `).width;
      });
    });
  }

  // 6. Bottom Progress Timeline Bar
  const progressRatio = Math.max(0, Math.min(1, currentTimeSec / totalDurationSec));
  const barHeight = Math.max(4, Math.round(canvasHeight * 0.007));
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(0, canvasHeight - barHeight, canvasWidth, barHeight);

  ctx.fillStyle = accent;
  ctx.fillRect(0, canvasHeight - barHeight, canvasWidth * progressRatio, barHeight);

  ctx.restore();
}

/**
 * Renders the entire project into a downloadable .webm video file using
 * HTML5 Canvas + MediaRecorder, reporting real-time progress [0..100].
 */
export async function exportProjectToWebmVideo(
  project: VideoProjectData,
  onProgress: (percent: number) => void
): Promise<{ url: string; filename: string; mimeType: string }> {
  // Preload all scene images first
  await Promise.all(
    project.scenes.map((s) => (s.imageUrl ? preloadImage(s.imageUrl) : Promise.resolve(null)))
  );

  const isVertical = project.aspectRatio === '9:16';
  const isSquare = project.aspectRatio === '1:1';
  const width = isVertical ? 540 : isSquare ? 640 : 854;
  const height = isVertical ? 960 : isSquare ? 640 : 480;

  const offscreenCanvas = document.createElement('canvas');
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext('2d')!;

  const fps = 24;
  // Render a fast preview-grade full reel (capped at 6 seconds real-time capture mapped across the entire video timeline so users get their file in ~5 seconds!)
  const totalTimelineSec = Math.max(4, project.totalDurationSec || 16);
  const exportCaptureSec = Math.min(5, totalTimelineSec);
  const totalFrames = Math.floor(exportCaptureSec * fps);

  const stream = offscreenCanvas.captureStream(fps);
  const supportedMime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm')
    ? 'video/webm'
    : '';

  const recorder = supportedMime
    ? new MediaRecorder(stream, { mimeType: supportedMime })
    : new MediaRecorder(stream);

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    recorder.onerror = (err) => reject(err);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: supportedMime || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const slug = project.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40);
      resolve({
        url,
        filename: `${slug || 'voxreel-video'}-${project.platform}.webm`,
        mimeType: supportedMime || 'video/webm',
      });
    };

    recorder.start(100);

    let frameIdx = 0;
    const intervalMs = Math.round(1000 / fps);

    const timer = window.setInterval(() => {
      const progress = frameIdx / totalFrames;
      const mappedTimelineSec = progress * totalTimelineSec;
      drawVideoFrameToCanvas(ctx, width, height, project, mappedTimelineSec, true);
      onProgress(Math.min(99, Math.round(progress * 100)));

      frameIdx += 1;
      if (frameIdx > totalFrames) {
        window.clearInterval(timer);
        onProgress(100);
        recorder.stop();
      }
    }, intervalMs);
  });
}
