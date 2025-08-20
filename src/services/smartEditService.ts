import { useEditorStore } from '../store/useEditorStore';
import { smartEdit, parseSRT } from './aiService';
import logger from '../utils/logger';

/**
 * Interface for text clip data
 */
export interface TextClip {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Apply smart editing result to the timeline
 * This function will add video clips and corresponding text clips to the timeline
 * @returns Promise that resolves when the operation is complete
 */
export async function applySmartEditing(): Promise<void> {
  logger.info('Applying smart editing...');
  try {
    // Get the editor store state and actions
    const store = useEditorStore.getState();
    const { addClipToTrack } = store;
    
    // Call the smart edit function to get clips and subtitles
    logger.info('Calling smartEdit function...');
    const result = await smartEdit();
    
    // Apply video clips to the timeline
    result.clips.forEach(clip => {
      addClipToTrack({
        mediaFileId: clip.mediaFileId,
        trackId: clip.trackId,
        startTime: clip.startTime,
        endTime: clip.endTime,
        inPoint: clip.inPoint,
        outPoint: clip.outPoint,
        duration: clip.duration
      });
    });
    
    // Apply subtitle clips to the text track
    result.subtitles.forEach((subtitle) => {
      // Create a text clip for each subtitle
      addClipToTrack({
        mediaFileId: 'text', // Special ID for text clips
        trackId: 'text-1',
        startTime: subtitle.start,
        endTime: subtitle.end,
        inPoint: 0,
        outPoint: subtitle.end - subtitle.start,
        duration: subtitle.end - subtitle.start,
        // Add custom properties for text
        text: subtitle.text
      });
    });
    
    logger.info('Smart editing applied successfully');
    return Promise.resolve();
  } catch (error) {
    logger.error(`Error applying smart editing: ${error}`);
    return Promise.reject(error);
  }
}

/**
 * Process SRT file and add text clips to the timeline
 * @param srtContent SRT file content
 * @param offset Time offset to apply to all subtitles (in seconds)
 * @returns Promise that resolves when the operation is complete
 */
export async function processSrtToTimeline(srtContent: string, offset: number = 0): Promise<void> {
  try {
    // Parse SRT content
    const subtitles = parseSRT(srtContent);
    
    // Get the editor store state and actions
    const store = useEditorStore.getState();
    const { addClipToTrack } = store;
    
    // Apply subtitle clips to the text track
    subtitles.forEach((subtitle) => {
      // Create a text clip for each subtitle
      addClipToTrack({
        mediaFileId: 'text', // Special ID for text clips
        trackId: 'text-1',
        startTime: subtitle.start + offset,
        endTime: subtitle.end + offset,
        inPoint: 0,
        outPoint: subtitle.end - subtitle.start,
        duration: subtitle.end - subtitle.start,
        // Add custom properties for text
        text: subtitle.text
      });
    });
    
    logger.info('SRT processing applied successfully');
    return Promise.resolve();
  } catch (error) {
    logger.error(`Error processing SRT to timeline: ${error}`);
    return Promise.reject(error);
  }
}