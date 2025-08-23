// import { GoogleGenerativeAI } from '@google/generative-ai';
import { useEditorStore, TimelineClip } from '../store/useEditorStore';
import logger from '../utils/logger';

// 初始化 Google Generative AI 客户端
// const genAI = new GoogleGenerativeAI('AIzaSyAvWuUcp6CI0K7qT6zAWldIiF4Fu4ObjWU');

/**
 * Interface for subtitle data
 */
interface Subtitle {
  id: number;
  start: number;
  end: number;
  text: string;
}

/**
 * Interface for smart editing result
 */
export interface SmartEditResult {
  clips: TimelineClip[];
  subtitles: Subtitle[];
}

/**
 * Interface for intelligent cut API response parts
 */
interface VideoPart {
  video_name: string;
  start: string;
  end: string;
}

interface FinalSrtEntry {
  start: string;
  end: string;
  text: string;
}

interface IntelligentCutResponse {
  success: boolean;
  video_part_list: VideoPart[];
  srt_list: FinalSrtEntry[];
  error_message?: string;
}

/**
 * Parse SRT file content to get subtitle data
 * @param srtContent SRT file content
 * @returns Array of subtitle objects
 */
export function parseSRT(srtContent: string): Subtitle[] {
  if (!srtContent) return [];
  
  const subtitles: Subtitle[] = [];
  const blocks = srtContent.trim().split(/\r?\n\r?\n/);
  
  blocks.forEach(block => {
    const lines = block.split(/\r?\n/);
    if (lines.length < 3) return;
    
    const id = parseInt(lines[0]);
    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/);
    
    if (!timeMatch) return;
    
    const startHours = parseInt(timeMatch[1]);
    const startMinutes = parseInt(timeMatch[2]);
    const startSeconds = parseInt(timeMatch[3]);
    const startMilliseconds = parseInt(timeMatch[4]);
    
    const endHours = parseInt(timeMatch[5]);
    const endMinutes = parseInt(timeMatch[6]);
    const endSeconds = parseInt(timeMatch[7]);
    const endMilliseconds = parseInt(timeMatch[8]);
    
    const start = startHours * 3600 + startMinutes * 60 + startSeconds + startMilliseconds / 1000;
    const end = endHours * 3600 + endMinutes * 60 + endSeconds + endMilliseconds / 1000;
    
    const text = lines.slice(2).join(' ');
    
    subtitles.push({ id, start, end, text });
  });
  
  return subtitles;
}

/**
 * Calls the backend intelligent editing service to get a new timeline.
 * @returns Promise with smart edit result
 */
export async function smartEdit(): Promise<SmartEditResult> {
  logger.info('Starting smartEdit process...');
  const state = useEditorStore.getState();
  const { mediaFiles } = state;
  logger.info(`Current media files in store: ${JSON.stringify(mediaFiles.map(f => f.name), null, 2)}`);

  // 1. Find video files and read their corresponding SRT files
  logger.info('Finding video files and their SRT counterparts...');
  const videoFiles = mediaFiles.filter(file => file.type === 'video');
  logger.info(`Found ${videoFiles.length} video files.`);

  const srtPairs: { video_name: string; srt_content: string }[] = [];

  for (const videoFile of videoFiles) {
    const srtPath = videoFile.path.replace(/\.[^/.]+$/, ".srt");
    
    try {
      logger.info(`Attempting to read SRT file from: ${srtPath}`);
      // @ts-ignore - Electron API is injected globally
      const result = await window.electronAPI.readFile(srtPath);
      
      if (result.success && result.content) {
        logger.info(`Successfully read SRT file for ${videoFile.name}.`);
        srtPairs.push({ video_name: videoFile.name, srt_content: result.content });
      } else {
        logger.warn(`Could not find or read SRT file for ${videoFile.name} at ${srtPath}. Skipping.`);
        if (result.error) {
          logger.error(`Error details: ${result.error}`);
        }
      }
    } catch (error) {
      logger.error(`An unexpected error occurred while reading SRT file for ${videoFile.name}: ${error}`);
    }
  }

  if (srtPairs.length === 0) {
    const errorMsg = 'No valid SRT files could be read. Aborting smart edit.';
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 2. Call the intelligent_cut API
  logger.info(`Calling intelligent_cut API...`);

  const endpoint = `/api/editing/intelligent_cut`;

  let apiResult: IntelligentCutResponse;
  try {
    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // The vite proxy will add the Authorization header
      },
      body: JSON.stringify({ srt_pairs: srtPairs }),
    });
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    logger.info(`Intelligent cut API request took ${duration} seconds.`);

    if (!response.ok) {
        const errorText = await response.text();
        logger.error(`API request failed with status ${response.status}: ${errorText}`);
        throw new Error(`Request to intelligent editing service failed: ${response.statusText}`);
    }
    
    apiResult = await response.json();


    if (!apiResult.success) {
      logger.error(`Intelligent editing failed on server: ${apiResult.error_message}`);
      throw new Error(apiResult.error_message || 'Intelligent editing failed on server');
    }
    logger.info("Intelligent editing task completed successfully on server.");
  } catch (e) {
    const errorMsg = `Request to intelligent editing service failed: ${e}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  // 3. Process the response
  logger.info('Processing API response...');
  const clips: TimelineClip[] = [];
  const subtitles: Subtitle[] = [];
  let currentTime = 0;

  const { video_part_list, srt_list } = apiResult;
  logger.info(`video_part_list: ${JSON.stringify(video_part_list)}`);

  if (video_part_list) {
      for (const part of video_part_list) {
        const videoFile = videoFiles.find(f => f.name === part.video_name);
        if (!videoFile) {
          logger.warn(`Video file not found for clip: ${part.video_name}`);
          continue;
        };

        const start = parseFloat(part.start);
        const end = parseFloat(part.end);
        const duration = end - start;
        
        if (duration <= 0) continue;

        const videoClip: Omit<TimelineClip, 'id'> = {
          mediaFileId: videoFile.id,
          trackId: 'video-1',
          startTime: currentTime,
          endTime: currentTime + duration,
          inPoint: start,
          outPoint: end,
          duration: duration,
        };

        clips.push({
          ...videoClip,
          id: `clip-${videoFile.id}-${clips.length}-${Date.now()}`,
        });

        currentTime += duration;
      }
  }

  if (srt_list) {
      srt_list.forEach((srt, index) => {
          const start = parseSrtTime(srt.start);
          const end = parseSrtTime(srt.end);
          if (end - start <= 0) return;
          subtitles.push({
            id: index + 1,
            start: start,
            end: end,
            text: srt.text,
          });
      });
  }
  
  logger.info(`Processed ${clips.length} clips and ${subtitles.length} subtitles.`);
  
  // Log detailed timeline content for analysis
  logger.info(`Final timeline clips: ${JSON.stringify(clips.map(clip => ({
    id: clip.id,
    mediaFileId: clip.mediaFileId,
    startTime: clip.startTime.toFixed(2),
    endTime: clip.endTime.toFixed(2),
    inPoint: clip.inPoint.toFixed(2),
    outPoint: clip.outPoint.toFixed(2),
    duration: clip.duration.toFixed(2)
  })), null, 2)}`);
  
  logger.info(`Final timeline subtitles: ${JSON.stringify(subtitles.map(sub => ({
    id: sub.id,
    start: sub.start.toFixed(2),
    end: sub.end.toFixed(2),
    text: sub.text.length > 50 ? sub.text.substring(0, 50) + '...' : sub.text
  })), null, 2)}`);

  return { clips, subtitles };
}

function parseSrtTime(time: string): number {
  const parts = time.split(':');
  const secondsParts = parts[2].split(',');
  const hours = parseInt(parts[0]);
  const minutes = parseInt(parts[1]);
  const seconds = parseInt(secondsParts[0]);
  const milliseconds = parseInt(secondsParts[1]);
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}