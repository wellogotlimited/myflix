"use client";

export interface CaptionCue {
  start: number;
  end: number;
  text: string;
}

interface SubtitleRendererProps {
  cues: CaptionCue[];
  currentTime: number;
  delay: number;
  fontSize: number; // percentage, 100 = default
  controlsVisible?: boolean;
}

export default function SubtitleRenderer({
  cues,
  currentTime,
  delay,
  fontSize,
  controlsVisible = true,
}: SubtitleRendererProps) {
  const activeCues = cues.filter(
    (cue) =>
      currentTime >= cue.start + delay && currentTime <= cue.end + delay
  );

  if (activeCues.length === 0) return null;

  const scale = fontSize / 100;

  return (
    <div
      className={`pointer-events-none absolute left-0 right-0 z-20 flex flex-col items-center px-6 transition-[bottom] duration-300 ${
        controlsVisible ? "bottom-28 md:bottom-32" : "bottom-12 md:bottom-16"
      }`}
    >
      {activeCues.map((cue, i) => (
        <div
          key={i}
          className="mb-2 max-w-[88%] px-3 text-center font-black tracking-[0.01em] text-white"
          style={{
            fontSize: `clamp(${scale * 1.35}rem, ${scale * 1.3}vw + 1rem, ${scale * 2.2}rem)`,
            lineHeight: 1.3,
            textShadow:
              "0 3px 10px rgba(0,0,0,0.95), 0 1px 2px rgba(0,0,0,0.95), 0 0 28px rgba(0,0,0,0.65)",
          }}
          dangerouslySetInnerHTML={{
            __html: cue.text.replace(/\n/g, "<br/>"),
          }}
        />
      ))}
    </div>
  );
}

/**
 * Parse VTT/SRT text into caption cues
 */
export function parseCaptions(text: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  // Normalize line endings
  const content = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Match timestamp lines: 00:00:00.000 --> 00:00:00.000
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let timeLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(
      /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})(?:\s+.*)?$/
    );
    if (!match) continue;

    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    const textLines = lines.slice(timeLineIdx + 1).join("\n").trim();

    // Strip HTML tags except <br>, <i>, <b>
    const cleanText = textLines
      .replace(/<(?!\/?(?:br|i|b|u)\b)[^>]+>/gi, "")
      .trim();

    if (cleanText) {
      cues.push({ start, end, text: cleanText });
    }
  }

  return cues;
}

function parseTimestamp(ts: string): number {
  const clean = ts.replace(",", ".");
  const parts = clean.split(":");
  if (parts.length === 3) {
    const [h, m, rest] = parts;
    const [s, ms] = rest.split(".");
    return (
      parseInt(h) * 3600 +
      parseInt(m) * 60 +
      parseInt(s) +
      parseInt(ms) / 1000
    );
  }
  if (parts.length === 2) {
    const [m, rest] = parts;
    const [s, ms] = rest.split(".");
    return parseInt(m) * 60 + parseInt(s) + parseInt(ms) / 1000;
  }
  return 0;
}
