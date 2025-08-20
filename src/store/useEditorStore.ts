import { create } from 'zustand'

export interface MediaFile {
  id: string
  name: string
  path: string
  type: 'video' | 'audio' | 'image' | 'srt'
  duration?: number
  size: number
  thumbnail?: string
  url?: string
}

export interface TimelineClip {
  id: string
  mediaFileId: string
  trackId: string
  startTime: number
  endTime: number
  inPoint: number
  outPoint: number
  duration: number
  text?: string // Optional text content for text clips
}

export interface Track {
  id: string
  type: 'video' | 'audio' | 'text'
  name: string
  height: number
  clips: TimelineClip[]
  muted: boolean
  volume: number
}

// Undo system types
export interface UndoAction {
  id: string
  type: 'ADD_CLIP' | 'REMOVE_CLIP' | 'UPDATE_CLIP' | 'MOVE_CLIP' | 'SPLIT_CLIP' | 'REMOVE_SELECTED_CLIPS'
  description: string
  timestamp: number
  // Undo data specific to each action type
  data: {
    // For ADD_CLIP
    clipId?: string
    trackId?: string
    
    // For REMOVE_CLIP and REMOVE_SELECTED_CLIPS
    removedClips?: Array<{ clip: TimelineClip; trackId: string }>
    
    // For UPDATE_CLIP
    oldClip?: TimelineClip
    newClip?: TimelineClip
    
    // For MOVE_CLIP
    oldTrackId?: string
    newTrackId?: string
    oldStartTime?: number
    newStartTime?: number
    
    // For SPLIT_CLIP
    originalClip?: TimelineClip
    newClipIds?: string[]
  }
}

export interface TextLogo {
  id: string
  text: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle: string
  color: string
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  opacity: number
  x: number
  y: number
  rotation: number
  shadowColor?: string
  shadowBlur?: number
  shadowOffsetX?: number
  shadowOffsetY?: number
  visible: boolean
  // 新增特效属性
  glowColor?: string
  glowIntensity?: number
  outerGlow?: boolean
  gradientEnabled?: boolean
  gradientColor1?: string
  gradientColor2?: string
  gradientDirection?: string
  embossEnabled?: boolean
  outlineEnabled?: boolean
  outlineColor?: string
  outlineWidth?: number
  // PNG数据用于FFmpeg导出
  pngData?: string // base64编码的PNG数据
  pngWidth?: number // PNG实际宽度
  pngHeight?: number // PNG实际高度
}

export interface EditorState {
  // Media files
  mediaFiles: MediaFile[]
  selectedMediaFiles: string[]
  
  // Timeline
  tracks: Track[]
  selectedClips: string[]
  currentTime: number
  duration: number
  isPlaying: boolean
  zoom: number
  isPlayheadDragging: boolean
  magneticSnap: boolean
  
  // Preview
  previewSize: { width: number; height: number }
  volume: number
  muted: boolean
  playbackSpeed: number
  
  // Text Logo
  textLogos: TextLogo[]
  showTextDesigner: boolean
  
  // Export
  isExporting: boolean
  exportProgress: number
  
  // Undo system
  undoStack: UndoAction[]
  redoStack: UndoAction[]
  maxUndoSize: number
  
  // UI
  language: 'zh' | 'en'
  
  // Actions
  addMediaFiles: (files: MediaFile[]) => void
  removeMediaFile: (id: string) => void
  selectMediaFile: (id: string, multi?: boolean) => void
  clearSelection: () => void
  
  // Timeline actions
  addClipToTrack: (clip: Omit<TimelineClip, 'id'>) => void
  removeClip: (clipId: string) => void
  updateClip: (clipId: string, updates: Partial<TimelineClip>) => void
  moveClip: (clipId: string, trackId: string, startTime: number) => void
  selectClip: (clipId: string, multi?: boolean) => void
  clearClipSelection: () => void
  removeSelectedClips: () => void
  splitClip: (clipId: string, splitTime: number) => void
  
  // Playback actions
  play: () => void
  pause: () => void
  setCurrentTime: (time: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  setPlaybackSpeed: (speed: number) => void
  
  // Timeline actions
  setZoom: (zoom: number) => void
  setIsPlayheadDragging: (dragging: boolean) => void
  setMagneticSnap: (enabled: boolean) => void
  
  // Text Logo actions
  addTextLogo: (textLogo: Omit<TextLogo, 'id'>) => void
  updateTextLogo: (id: string, updates: Partial<TextLogo>) => void
  removeTextLogo: (id: string) => void
  clearTextLogos: () => void
  setShowTextDesigner: (show: boolean) => void
  
  // Export actions
  startExport: () => void
  updateExportProgress: (progress: number) => void
  finishExport: () => void
  
  // Undo/Redo actions
  undo: () => void
  redo: () => void
  clearUndoHistory: () => void
  addUndoAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void
  
  // UI actions
  setLanguage: (language: 'zh' | 'en') => void
  setPreviewSize: (size: { width: number; height: number }) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  // Initial state
  mediaFiles: [],
  selectedMediaFiles: [],
  selectedClips: [],
  
  tracks: [
    {
      id: 'video-1',
      type: 'video',
      name: 'V1',
      height: 65,
      clips: [],
      muted: false,
      volume: 1
    },
    {
      id: 'text-1',
      type: 'text',
      name: 'T1',
      height: 40,
      clips: [],
      muted: false,
      volume: 1
    },
    {
      id: 'audio-1',
      type: 'audio',
      name: 'A1',
      height: 50,
      clips: [],
      muted: false,
      volume: 1
    },
    {
      id: 'audio-2',
      type: 'audio',
      name: 'A2',
      height: 50,
      clips: [],
      muted: false,
      volume: 1
    },
    {
      id: 'audio-3',
      type: 'audio',
      name: 'A3',
      height: 50,
      clips: [],
      muted: false,
      volume: 1
    },
    {
      id: 'audio-4',
      type: 'audio',
      name: 'A4',
      height: 50,
      clips: [],
      muted: false,
      volume: 1
    }
  ],
  
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  zoom: 1,
  isPlayheadDragging: false,
  magneticSnap: true,
  
  previewSize: { width: 640, height: 360 },
  volume: 1,
  muted: false,
  playbackSpeed: 1,
  
  textLogos: [],
  showTextDesigner: false,
  
  isExporting: false,
  exportProgress: 0,
  
  // Undo system
  undoStack: [],
  redoStack: [],
  maxUndoSize: 50,
  
  language: 'zh',
  
  // Actions
  addMediaFiles: (files) => set((state) => ({
    mediaFiles: [...state.mediaFiles, ...files]
  })),
  
  removeMediaFile: (id) => set((state) => ({
    mediaFiles: state.mediaFiles.filter(file => file.id !== id),
    selectedMediaFiles: state.selectedMediaFiles.filter(fileId => fileId !== id)
  })),
  
  selectMediaFile: (id, multi = false) => set((state) => {
    if (multi) {
      const isSelected = state.selectedMediaFiles.includes(id)
      return {
        selectedMediaFiles: isSelected
          ? state.selectedMediaFiles.filter(fileId => fileId !== id)
          : [...state.selectedMediaFiles, id]
      }
    } else {
      return { selectedMediaFiles: [id] }
    }
  }),
  
  clearSelection: () => set({ selectedMediaFiles: [] }),
  
  // Timeline clip selection actions
  selectClip: (clipId, multi = false) => set((state) => {
    if (multi) {
      const isSelected = state.selectedClips.includes(clipId)
      return {
        selectedClips: isSelected
          ? state.selectedClips.filter(id => id !== clipId)
          : [...state.selectedClips, clipId]
      }
    } else {
      return { selectedClips: [clipId] }
    }
  }),
  
  clearClipSelection: () => set({ selectedClips: [] }),
  
  removeSelectedClips: () => {
    const state = get()
    
    // Collect all clips to be removed
    const removedClips: Array<{ clip: TimelineClip; trackId: string }> = []
    
    for (const track of state.tracks) {
      for (const clip of track.clips) {
        if (state.selectedClips.includes(clip.id)) {
          removedClips.push({ clip, trackId: track.id })
        }
      }
    }
    
    if (removedClips.length > 0) {
      // Record undo action
      get().addUndoAction({
        type: 'REMOVE_SELECTED_CLIPS',
        description: `删除选中的${removedClips.length}个片段`,
        data: {
          removedClips
        }
      })
    }
    
    set((state) => {
      const newTracks = state.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => !state.selectedClips.includes(clip.id))
      }))
      
      // Recalculate duration after removing clips
      let maxEndTime = 0
      for (const track of newTracks) {
        for (const clip of track.clips) {
          if (clip.endTime > maxEndTime) {
            maxEndTime = clip.endTime
          }
        }
      }
      
      return {
        tracks: newTracks,
        selectedClips: [],
        duration: maxEndTime
      }
    })
  },

  splitClip: (clipId: string, splitTime: number) => {
    const state = get()
    let targetClip: TimelineClip | null = null
    let targetTrack: Track | null = null
    
    // Find the clip and its track
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        targetClip = clip
        targetTrack = track
        break
      }
    }
    
    if (!targetClip || !targetTrack) return
    
    // Check if split time is within clip bounds
    if (splitTime <= targetClip.startTime || splitTime >= targetClip.endTime) {
      return // Can't split outside clip bounds
    }
    
    // Calculate time positions
    const timeIntoClip = splitTime - targetClip.startTime
    const splitPointInMedia = targetClip.inPoint + timeIntoClip
    
    // Create first clip (before split)
    const firstClip: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}_1_${Date.now()}`,
      endTime: splitTime,
      outPoint: splitPointInMedia,
      duration: splitTime - targetClip.startTime
    }
    
    // Create second clip (after split)
    const secondClip: TimelineClip = {
      ...targetClip,
      id: `${targetClip.id}_2_${Date.now()}`,
      startTime: splitTime,
      inPoint: splitPointInMedia,
      duration: targetClip.endTime - splitTime
    }
    
    // Record undo action
    get().addUndoAction({
      type: 'SPLIT_CLIP',
      description: `切分片段`,
      data: {
        originalClip: targetClip,
        newClipIds: [firstClip.id, secondClip.id]
      }
    })
    
    set((state) => ({
      tracks: state.tracks.map(track =>
        track.id === targetTrack!.id
          ? {
              ...track,
              clips: track.clips
                .filter(clip => clip.id !== clipId) // Remove original clip
                .concat([firstClip, secondClip]) // Add split clips
                .sort((a, b) => a.startTime - b.startTime) // Keep clips sorted
            }
          : track
      ),
      selectedClips: state.selectedClips.includes(clipId)
        ? [firstClip.id, secondClip.id] // Select both new clips if original was selected
        : state.selectedClips
    }))
  },
  
  // Timeline actions
  addClipToTrack: (clip) => {
    const clipId = `clip-${Date.now()}-${Math.random()}`
    const newClip = { ...clip, id: clipId }
    
    // Record undo action
    get().addUndoAction({
      type: 'ADD_CLIP',
      description: `添加片段到轨道`,
      data: {
        clipId: clipId,
        trackId: clip.trackId
      }
    })
    
    set((state) => {
      const newTracks = state.tracks.map(track =>
        track.id === clip.trackId
          ? { ...track, clips: [...track.clips, newClip] }
          : track
      )
      
      // Calculate new timeline duration
      let maxEndTime = 0
      for (const track of newTracks) {
        for (const clip of track.clips) {
          if (clip.endTime > maxEndTime) {
            maxEndTime = clip.endTime
          }
        }
      }
      
      return {
        tracks: newTracks,
        duration: maxEndTime
      }
    })
  },
  
  removeClip: (clipId) => {
    const state = get()
    
    // Find the clip to remove
    let removedClip: TimelineClip | null = null
    let trackId: string | null = null
    
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        removedClip = clip
        trackId = track.id
        break
      }
    }
    
    if (removedClip && trackId) {
      // Record undo action
      get().addUndoAction({
        type: 'REMOVE_CLIP',
        description: `删除片段`,
        data: {
          removedClips: [{ clip: removedClip, trackId }]
        }
      })
    }
    
    set((state) => ({
      tracks: state.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => clip.id !== clipId)
      }))
    }))
  },
  
  updateClip: (clipId, updates) => {
    const state = get()
    
    // Find the clip to update
    let oldClip: TimelineClip | null = null
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        oldClip = { ...clip }
        break
      }
    }
    
    if (oldClip) {
      const newClip = { ...oldClip, ...updates }
      
      // Record undo action
      get().addUndoAction({
        type: 'UPDATE_CLIP',
        description: `修改片段`,
        data: {
          clipId,
          oldClip,
          newClip
        }
      })
    }
    
    set((state) => ({
      tracks: state.tracks.map(track => ({
        ...track,
        clips: track.clips.map(clip =>
          clip.id === clipId ? { ...clip, ...updates } : clip
        )
      }))
    }))
  },
  
  moveClip: (clipId, trackId, startTime) => {
    const state = get()
    let clipToMove: TimelineClip | null = null
    let oldTrackId: string | null = null
    
    // Find the clip and its current track
    for (const track of state.tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        clipToMove = clip
        oldTrackId = track.id
        break
      }
    }
    
    if (clipToMove && oldTrackId) {
      // Record undo action
      get().addUndoAction({
        type: 'MOVE_CLIP',
        description: `移动片段`,
        data: {
          clipId,
          oldTrackId,
          newTrackId: trackId,
          oldStartTime: clipToMove.startTime,
          newStartTime: startTime
        }
      })
    }
    
    set((state) => {
      let clipToMove: TimelineClip | null = null
      
      // Remove clip from current track
      const tracksWithoutClip = state.tracks.map(track => ({
        ...track,
        clips: track.clips.filter(clip => {
          if (clip.id === clipId) {
            clipToMove = clip
            return false
          }
          return true
        })
      }))
      
      if (!clipToMove) return state
      
      // Add clip to new track with new position
      const updatedClip = {
        ...clipToMove,
        trackId,
        startTime,
        endTime: startTime + clipToMove.duration
      }
      
      return {
        tracks: tracksWithoutClip.map(track =>
          track.id === trackId
            ? { ...track, clips: [...track.clips, updatedClip] }
            : track
        )
      }
    })
  },
  
  // Playback actions
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ muted: !state.muted })),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  
  // Timeline actions
  setZoom: (zoom) => set({ zoom }),
  setIsPlayheadDragging: (dragging) => set({ isPlayheadDragging: dragging }),
  setMagneticSnap: (enabled) => set({ magneticSnap: enabled }),
  
  // Text Logo actions
  addTextLogo: (textLogo) => set((state) => ({
    textLogos: [...state.textLogos, { ...textLogo, id: `textlogo-${Date.now()}-${Math.random()}` }]
  })),
  
  updateTextLogo: (id, updates) => set((state) => ({
    textLogos: state.textLogos.map(logo => 
      logo.id === id ? { ...logo, ...updates } : logo
    )
  })),
  
  removeTextLogo: (id) => set((state) => ({
    textLogos: state.textLogos.filter(logo => logo.id !== id)
  })),
  
  clearTextLogos: () => set({ textLogos: [] }),
  
  setShowTextDesigner: (show) => set({ showTextDesigner: show }),
  
  // Export actions
  startExport: () => set({ isExporting: true, exportProgress: 0 }),
  updateExportProgress: (progress) => set({ exportProgress: progress }),
  finishExport: () => set({ isExporting: false, exportProgress: 0 }),
  
  // Helper function to add undo action
  addUndoAction: (action: Omit<UndoAction, 'id' | 'timestamp'>) => {
    const newAction: UndoAction = {
      ...action,
      id: `undo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    set((state) => {
      const newUndoStack = [...state.undoStack, newAction]
      
      // Limit undo stack size
      if (newUndoStack.length > state.maxUndoSize) {
        newUndoStack.shift() // Remove oldest entry
      }
      
      return {
        undoStack: newUndoStack,
        redoStack: [] // Clear redo stack when new action is performed
      }
    })
  },
  
  // Undo/Redo actions
  undo: () => set((state) => {
    if (state.undoStack.length === 0) return state
    
    const lastAction = state.undoStack[state.undoStack.length - 1]
    const newUndoStack = state.undoStack.slice(0, -1)
    const newRedoStack = [...state.redoStack, lastAction]
    
    // Apply undo logic based on action type
    let newState = { ...state, undoStack: newUndoStack, redoStack: newRedoStack }
    
    switch (lastAction.type) {
      case 'ADD_CLIP':
        // Remove the added clip
        if (lastAction.data.clipId && lastAction.data.trackId) {
          newState.tracks = newState.tracks.map(track => 
            track.id === lastAction.data.trackId
              ? { ...track, clips: track.clips.filter(clip => clip.id !== lastAction.data.clipId) }
              : track
          )
        }
        break
        
      case 'REMOVE_CLIP':
      case 'REMOVE_SELECTED_CLIPS':
        // Restore removed clips
        if (lastAction.data.removedClips) {
          lastAction.data.removedClips.forEach(({ clip, trackId }) => {
            newState.tracks = newState.tracks.map(track =>
              track.id === trackId
                ? { ...track, clips: [...track.clips, clip].sort((a, b) => a.startTime - b.startTime) }
                : track
            )
          })
        }
        break
        
      case 'UPDATE_CLIP':
        // Restore old clip state
        if (lastAction.data.clipId && lastAction.data.oldClip) {
          newState.tracks = newState.tracks.map(track => ({
            ...track,
            clips: track.clips.map(clip =>
              clip.id === lastAction.data.clipId ? lastAction.data.oldClip! : clip
            )
          }))
        }
        break
        
      case 'MOVE_CLIP':
        // Move clip back to original position
        if (lastAction.data.clipId && lastAction.data.oldTrackId && lastAction.data.oldStartTime !== undefined) {
          const clipToMove = newState.tracks
            .flatMap(track => track.clips)
            .find(clip => clip.id === lastAction.data.clipId)
          
          if (clipToMove) {
            // Remove from current track
            newState.tracks = newState.tracks.map(track => ({
              ...track,
              clips: track.clips.filter(clip => clip.id !== lastAction.data.clipId)
            }))
            
            // Add back to original track with original timing
            const originalDuration = clipToMove.duration
            const restoredClip = {
              ...clipToMove,
              trackId: lastAction.data.oldTrackId!,
              startTime: lastAction.data.oldStartTime!,
              endTime: lastAction.data.oldStartTime! + originalDuration
            }
            
            newState.tracks = newState.tracks.map(track =>
              track.id === lastAction.data.oldTrackId
                ? { ...track, clips: [...track.clips, restoredClip].sort((a, b) => a.startTime - b.startTime) }
                : track
            )
          }
        }
        break
        
      case 'SPLIT_CLIP':
        // Restore original clip and remove split clips
        if (lastAction.data.originalClip && lastAction.data.newClipIds) {
          // Remove split clips
          newState.tracks = newState.tracks.map(track => ({
            ...track,
            clips: track.clips.filter(clip => !lastAction.data.newClipIds!.includes(clip.id))
          }))
          
          // Restore original clip
          newState.tracks = newState.tracks.map(track =>
            track.id === lastAction.data.originalClip!.trackId
              ? { ...track, clips: [...track.clips, lastAction.data.originalClip!].sort((a, b) => a.startTime - b.startTime) }
              : track
          )
        }
        break
    }
    
    // Recalculate duration
    const maxEndTime = Math.max(
      ...newState.tracks.flatMap(track => track.clips.map(clip => clip.endTime)),
      0
    )
    newState.duration = maxEndTime
    
    return newState
  }),
  
  redo: () => set((state) => {
    if (state.redoStack.length === 0) return state
    
    const actionToRedo = state.redoStack[state.redoStack.length - 1]
    const newRedoStack = state.redoStack.slice(0, -1)
    const newUndoStack = [...state.undoStack, actionToRedo]
    
    // Re-apply the action (this is simplified - in a real app you might want to re-execute the original action)
    console.log('Redo action:', actionToRedo.description)
    
    return {
      undoStack: newUndoStack,
      redoStack: newRedoStack
    }
  }),
  
  clearUndoHistory: () => set({
    undoStack: [],
    redoStack: []
  }),
  
  // UI actions
  setLanguage: (language) => set({ language }),
  setPreviewSize: (size) => set({ previewSize: size })
})) 