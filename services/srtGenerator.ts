// SRT subtitle generation for video synchronization
import { Scene } from '../types';

interface SrtEntry {
  index: number;
  startTime: string;
  endTime: string;
  text: string;
}

/**
 * Formats time in SRT format (HH:MM:SS,mmm)
 */
function formatSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);

  const pad = (n: number): string => String(n).padStart(2, '0');
  const padMs = (n: number): string => String(n).padStart(3, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${padMs(milliseconds)}`;
}

/**
 * Splits text into lines based on maximum character length
 * Tries to break at word boundaries
 */
function splitTextIntoLines(text: string, maxLineLength: number = 20): string[] {
  if (!text) return [];

  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const tentativeLine = currentLine ? `${currentLine} ${word}` : word;

    if (tentativeLine.length > maxLineLength && currentLine) {
      // Current line is full, push it and start new line
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = tentativeLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates SRT subtitle entries from scenes
 */
export function generateSrtFromScenes(
  scenes: Scene[],
  maxLineLength: number = 20
): string {
  let srt = '';
  let srtIndex = 1;
  let currentTime = 0;

  for (const scene of scenes) {
    // Get audio duration (in seconds)
    const duration = scene.audioDuration || 3; // Default 3 seconds if no duration

    // Split script text into lines
    const lines = splitTextIntoLines(scene.script || '', maxLineLength);

    if (lines.length === 0) {
      // If no text, skip this scene
      currentTime += duration;
      continue;
    }

    // Calculate time per line
    const timePerLine = duration / lines.length;

    // Create SRT entries for each line
    for (const line of lines) {
      const startTime = formatSrtTime(currentTime);
      currentTime += timePerLine;
      const endTime = formatSrtTime(currentTime);

      // Add SRT entry
      srt += `${srtIndex}\n`;
      srt += `${startTime} --> ${endTime}\n`;
      srt += `${line.trim()}\n`;
      srt += '\n';

      srtIndex++;
    }
  }

  return srt;
}

/**
 * Saves SRT file for a scenario
 */
export async function saveSrtFile(
  scenarioId: string,
  srtContent: string
): Promise<string> {
  const fileName = `${scenarioId}_Subtitle.srt`;
  const filePath = `./data/scenarios/${scenarioId}/Srt/${fileName}`;

  try {
    const response = await fetch('/api/save-scenario-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: filePath,
        data: srtContent,
        type: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to save SRT file: ${response.statusText}`);
    }

    const result = await response.json();
    return result.path;
  } catch (error) {
    console.error('Error saving SRT file:', error);
    throw error;
  }
}

/**
 * Generates and saves SRT for a complete script
 */
export async function generateAndSaveSrt(
  scenarioId: string,
  scenes: Scene[]
): Promise<string> {
  // Generate SRT content
  const srtContent = generateSrtFromScenes(scenes);

  // Save to file
  const srtPath = await saveSrtFile(scenarioId, srtContent);

  return srtPath;
}

/**
 * Parses SRT content into structured format
 */
export function parseSrt(srtContent: string): SrtEntry[] {
  const entries: SrtEntry[] = [];
  const blocks = srtContent.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    const index = parseInt(lines[0], 10);
    const [startTime, endTime] = lines[1].split(' --> ').map(t => t.trim());
    const text = lines.slice(2).join(' ');

    entries.push({
      index,
      startTime,
      endTime,
      text
    });
  }

  return entries;
}

/**
 * Calculates total duration from SRT entries
 */
export function calculateSrtDuration(srtEntries: SrtEntry[]): number {
  if (srtEntries.length === 0) return 0;

  const lastEntry = srtEntries[srtEntries.length - 1];
  const timeParts = lastEntry.endTime.split(/[:,]/);

  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1], 10);
  const seconds = parseInt(timeParts[2], 10);
  const milliseconds = parseInt(timeParts[3], 10);

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}