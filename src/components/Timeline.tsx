import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Magnet, Type, Wand2 } from 'lucide-react'
import { useEditorStore, TimelineClip, Track } from '../store/useEditorStore'
import { t } from '../utils/i18n'
import SmartEditButton from './SmartEditButton'

const Timeline: React.FC = () => {
  const {
    tracks,
    selectedClips,
    currentTime,
    duration,
    zoom,
    magneticSnap,
    showTextDesigner,
    language,
    mediaFiles,
    addClipToTrack,
    removeClip,
    updateClip,
    moveClip,
    selectClip,
    clearClipSelection,
    removeSelectedClips,
    splitClip,
    setCurrentTime,
    setZoom,
    setIsPlayheadDragging,
    setMagneticSnap,
    setShowTextDesigner
  } = useEditorStore()

  const [draggedClip, setDraggedClip] = useState<TimelineClip | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [dragOverTrack, setDragOverTrack] = useState<string | null>(null)
  const [draggedMediaType, setDraggedMediaType] = useState<'video' | 'audio' | 'image' | null>(null)
  const [resizingClip, setResizingClip] = useState<{ clipId: string; edge: 'left' | 'right' } | null>(null)
  const [resizeStartTime, setResizeStartTime] = useState(0)
  const [playheadSelected, setPlayheadSelected] = useState(false)
  const [playheadDragging, setPlayheadDragging] = useState(false)
  const [playheadDragStart, setPlayheadDragStart] = useState({ x: 0, time: 0 })
  const timelineRef = useRef<HTMLDivElement>(null)

  // Timeline configuration
  const TIMELINE_HEIGHT = 240
  const RULER_HEIGHT = 32
  const TRACK_HEADER_WIDTH = 120 // Width of the track headers

  const formatTime = (seconds: number): { minutes: string; seconds: string } => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)

    return {
      minutes: `${mins}m`,
      seconds: `${secs.toString().padStart(2, '0')}s`
    }
  }

  const timeToPixels = (time: number): number => {
    return time * zoom * 10 // Use exact calculation for consistency
  }

  const pixelsToTime = (pixels: number): number => {
    return pixels / (zoom * 10) // Exact inverse of timeToPixels, no rounding for better precision
  }

  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return

    // Don't handle timeline clicks if we clicked on the playhead
    const target = e.target as HTMLElement
    if (target.closest('.playhead')) {
      return
    }

    // Prevent event propagation to avoid conflicts
    e.stopPropagation()

    const rect = timelineRef.current.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    // Add scroll offset to get the absolute position in the timeline
    const rulerX = clickX - TRACK_HEADER_WIDTH + timelineRef.current.scrollLeft
    
    // Only process clicks in the time content area (to the right of track headers)
    if (clickX >= TRACK_HEADER_WIDTH) {
      const time = pixelsToTime(rulerX)
      const newTime = Math.max(0, Math.round(time * 100) / 100) // Round to 0.01 second precision for display consistency
      
      // Note: Timeline click position should now align perfectly with playhead
      
      setCurrentTime(newTime)
      // Clear playhead selection when clicking elsewhere on timeline
      setPlayheadSelected(false)
    }
  }, [setCurrentTime, zoom])

  // Playhead event handlers
  const handlePlayheadClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setPlayheadSelected(true)
    
    // Clear other selections
    clearClipSelection()
  }, [clearClipSelection])

  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    setPlayheadSelected(true)
    setPlayheadDragging(true)
    setIsPlayheadDragging(true) // Notify store about dragging state
    
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return
    
    setPlayheadDragStart({
      x: e.clientX,
      time: currentTime
    })
    
    // Clear other selections
    clearClipSelection()
  }, [currentTime, clearClipSelection, setIsPlayheadDragging])

  const handlePlayheadMouseMove = useCallback((e: MouseEvent) => {
    if (!playheadDragging || !timelineRef.current) return
    
    const rect = timelineRef.current.getBoundingClientRect()
    const deltaX = e.clientX - playheadDragStart.x
    const scrollOffset = timelineRef.current.scrollLeft
    
    // Convert pixel movement to time, accounting for scroll
    const deltaTime = pixelsToTime(deltaX)
    const newTime = Math.max(0, playheadDragStart.time + deltaTime)
    
    // Update timeline position
    setCurrentTime(newTime)
  }, [playheadDragging, playheadDragStart, pixelsToTime, setCurrentTime])

  const handlePlayheadMouseUp = useCallback(() => {
    if (playheadDragging) {
      setPlayheadDragging(false)
      setIsPlayheadDragging(false) // Clear dragging state in store
      // Keep selected state after dragging
    }
  }, [playheadDragging, setIsPlayheadDragging])

  const handleClipDragStart = useCallback((clip: TimelineClip, e: React.MouseEvent) => {
    // Don't start dragging if we're resizing
    if (resizingClip) return
    
    e.stopPropagation()
    
    // Handle clip selection with Ctrl/Cmd for multi-select
    const isCtrlOrCmd = e.ctrlKey || e.metaKey
    selectClip(clip.id, isCtrlOrCmd)
    
    setDraggedClip(clip)
    
    const clipElement = e.currentTarget as HTMLElement
    const rect = clipElement.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }, [resizingClip, selectClip])

  // Collision detection function to snap clips together
  const detectCollisionAndSnap = useCallback((draggedClip: TimelineClip, targetTrack: Track, proposedStartTime: number) => {
    const proposedEndTime = proposedStartTime + draggedClip.duration
    
    // Get all other clips in the target track (excluding the dragged clip)
    const otherClips = targetTrack.clips.filter(clip => clip.id !== draggedClip.id)
    
    let adjustedStartTime = proposedStartTime
    
    // Check for collision with each clip
    for (const clip of otherClips) {
      // Check if clips would overlap
      const hasOverlap = proposedStartTime < clip.endTime && proposedEndTime > clip.startTime
      
      if (hasOverlap) {
        // Calculate distances to snap points
        const distToClipStart = Math.abs(proposedEndTime - clip.startTime)
        const distToClipEnd = Math.abs(proposedStartTime - clip.endTime)
        
        // Snap to the closest edge (no threshold needed - any overlap triggers snap)
        if (distToClipStart < distToClipEnd) {
          // Snap dragged clip's end to this clip's start
          adjustedStartTime = clip.startTime - draggedClip.duration
        } else {
          // Snap dragged clip's start to this clip's end
          adjustedStartTime = clip.endTime
        }
        break // Only snap to the first collision found
      }
    }
    
    return Math.max(0, adjustedStartTime) // Ensure we don't go negative
  }, [])

  const handleClipDrag = useCallback((e: React.MouseEvent) => {
    if (!draggedClip || !timelineRef.current) return

    e.preventDefault()
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - dragOffset.x - TRACK_HEADER_WIDTH + timelineRef.current.scrollLeft // Account for track header width and scroll offset
    const y = e.clientY - rect.top - dragOffset.y

    const proposedTime = Math.max(0, pixelsToTime(x))
    
    // Find which track the clip is over
    let trackIndex = -1
    let currentY = RULER_HEIGHT
    for (let i = 0; i < tracks.length; i++) {
      if (y >= currentY && y < currentY + tracks[i].height) {
        trackIndex = i
        break
      }
      currentY += tracks[i].height
    }
    
    if (trackIndex >= 0) {
      const targetTrack = tracks[trackIndex]
      
      // Apply collision detection and snapping
      const adjustedStartTime = detectCollisionAndSnap(draggedClip, targetTrack, proposedTime)
      
      // Update clip position
      updateClip(draggedClip.id, {
        startTime: adjustedStartTime,
        endTime: adjustedStartTime + draggedClip.duration
      })
    }
  }, [draggedClip, dragOffset, tracks, updateClip, detectCollisionAndSnap])

  const handleClipDragEnd = useCallback(() => {
    setDraggedClip(null)
    setDragOffset({ x: 0, y: 0 })
  }, [])

  const handleClipResizeStart = useCallback((clipId: string, edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    
    setResizingClip({ clipId, edge })
    const rect = timelineRef.current?.getBoundingClientRect()
    const scrollLeft = timelineRef.current?.scrollLeft || 0
    setResizeStartTime(pixelsToTime(e.clientX - (rect?.left || 0) - TRACK_HEADER_WIDTH + scrollLeft)) // Account for track header width and scroll offset
  }, [pixelsToTime])

  const handleClipResize = useCallback((e: MouseEvent) => {
    if (!resizingClip || !timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - TRACK_HEADER_WIDTH + timelineRef.current.scrollLeft // Account for track header width and scroll offset
    const newTime = Math.max(0, pixelsToTime(x))
    
    const clip = tracks.flatMap(t => t.clips).find(c => c.id === resizingClip.clipId)
    if (!clip) return

    const mediaFile = mediaFiles.find(f => f.id === clip.mediaFileId)
    const maxDuration = mediaFile?.duration || clip.duration
    
    if (resizingClip.edge === 'left') {
      // Resize from left edge (trim start)
      const maxStartTime = clip.endTime - 0.1 // Minimum clip duration
      const constrainedStartTime = Math.min(newTime, maxStartTime)
      const newDuration = clip.endTime - constrainedStartTime
      const deltaTime = constrainedStartTime - clip.startTime
      const newInPoint = Math.max(0, Math.min(clip.inPoint + deltaTime, maxDuration - 0.1))
      
      updateClip(resizingClip.clipId, {
        startTime: constrainedStartTime,
        inPoint: newInPoint,
        duration: newDuration
      })
    } else {
      // Resize from right edge (trim end)  
      const minEndTime = clip.startTime + 0.1 // Minimum clip duration
      const constrainedEndTime = Math.max(newTime, minEndTime)
      const newDuration = constrainedEndTime - clip.startTime
      const maxOutPoint = Math.min(clip.inPoint + newDuration, maxDuration)
      
      updateClip(resizingClip.clipId, {
        endTime: constrainedEndTime,
        outPoint: maxOutPoint,
        duration: newDuration
      })
    }
  }, [resizingClip, tracks, mediaFiles, pixelsToTime, updateClip])

  const handleClipResizeEnd = useCallback(() => {
    setResizingClip(null)
    setResizeStartTime(0)
  }, [])

  const renderTimeRuler = () => {
    const width = Math.max(1000, timeToPixels(duration))
    const ticks = []
    
    // Generate ticks with optimal spacing for readability
    let interval = 10 // Default 10 seconds
    if (zoom < 0.3) interval = 60 // 1 minute intervals for very low zoom
    else if (zoom < 0.6) interval = 30 // 30 second intervals for low zoom
    else if (zoom < 1.0) interval = 15 // 15 second intervals for medium zoom
    else if (zoom >= 2.0) interval = 5 // 5 second intervals for high zoom
    
    let pixelInterval = timeToPixels(interval) // Pixels between ticks
    
    // Ensure minimum spacing between ticks (at least 60 pixels)
    if (pixelInterval < 60) {
      interval = Math.ceil(60 / (zoom * 10)) * 5 // Round to nearest 5 seconds
      pixelInterval = timeToPixels(interval) // Recalculate pixel interval
    }
    
    for (let i = 0; i * pixelInterval <= width; i++) {
      const time = i * interval
      const x = Math.round(timeToPixels(time) + TRACK_HEADER_WIDTH) // Add header width offset to match playhead
      const timeDisplay = formatTime(time)
      
      ticks.push(
        <div
          key={i}
          className="time-tick"
          style={{ left: `${x}px` }} // Ensure pixel-perfect positioning
        >
          <div className="tick-line" />
          <div className="tick-label">
            <div className="tick-minutes">{timeDisplay.minutes}</div>
            <div className="tick-seconds">{timeDisplay.seconds}</div>
          </div>
        </div>
      )
    }

    return (
      <div className="time-ruler" style={{ height: RULER_HEIGHT }}>
        {ticks}
      </div>
    )
  }

  const renderPlayhead = () => {
    const x = Math.round(timeToPixels(currentTime) + TRACK_HEADER_WIDTH) // Round final position for pixel alignment
    return (
      <div
        className={`playhead ${playheadSelected ? 'selected' : ''} ${playheadDragging ? 'dragging' : ''}`}
        style={{
          left: `${x}px`, // Use px unit for precise positioning
          height: TIMELINE_HEIGHT
        }}
        onMouseDown={handlePlayheadMouseDown}
        onClick={handlePlayheadClick}
      >
        {/* Playhead handle for better grabbing */}
        <div className="playhead-handle" />
      </div>
    )
  }

  const renderClip = (clip: TimelineClip) => {
    const x = Math.round(timeToPixels(clip.startTime)) // Round final position for pixel alignment
    const width = Math.round(timeToPixels(clip.duration))
    
    // Find the track for this clip
    const track = tracks.find(t => t.id === clip.trackId)
    const isTextClip = track?.type === 'text'
    
    // Find the media file for this clip (if not a text clip)
    const mediaFile = !isTextClip ? mediaFiles.find(file => file.id === clip.mediaFileId) : null

    // Determine clip name - for text clips, show the text content
    const clipName = isTextClip 
      ? (clip.text || 'Text') 
      : (mediaFile?.name || clip.mediaFileId)

    return (
      <div
        key={clip.id}
        className={`timeline-clip ${isTextClip ? 'text-clip' : ''} ${draggedClip?.id === clip.id ? 'dragging' : ''} ${resizingClip?.clipId === clip.id ? 'resizing' : ''} ${selectedClips.includes(clip.id) ? 'selected' : ''}`}
        style={{
          left: `${x}px`, // Use px unit for precise positioning
          width: `${Math.max(width, 30)}px`, // Ensure minimum width for handles
          minWidth: '30px'
        }}
        onMouseDown={(e) => handleClipDragStart(clip, e)}
      >
        <div className="clip-content">
          {isTextClip ? (
            <div className="text-clip-content" title={clip.text}>
              {clip.text && width > 40 ? clip.text.substring(0, Math.floor(width / 8)) : '...'}
            </div>
          ) : (
            width > 60 && (
              <span className="clip-name" title={clipName}>{clipName}</span>
            )
          )}
          {resizingClip?.clipId === clip.id && (
            <div className="clip-trim-info">
              <small>
                In: {Math.floor(clip.inPoint)}s | Out: {Math.floor(clip.outPoint)}s
              </small>
            </div>
          )}
        </div>
        <div
          className="clip-handle clip-handle-left"
          onMouseDown={(e) => handleClipResizeStart(clip.id, 'left', e)}
        />
        <div
          className="clip-handle clip-handle-right"
          onMouseDown={(e) => handleClipResizeStart(clip.id, 'right', e)}
        />
      </div>
    )
  }

  const renderTrack = (track: Track, index: number) => {
    const y = RULER_HEIGHT + index * track.height

    return (
             <div
        key={track.id}
        className={`timeline-track timeline-track-${track.type}`}
      >
        <div className="track-header">
          <span className="track-name">{track.name}</span>
          <div className="track-controls">
            <button
              className={`track-mute ${track.muted ? 'active' : ''}`}
              onClick={() => {
                // Toggle track mute
              }}
            >
              M
            </button>
          </div>
        </div>
        <div 
          className="track-content"
          onClick={(e) => {
            // Clear selection when clicking on empty track area
            if (e.target === e.currentTarget) {
              clearClipSelection()
            }
          }}
        >
          {track.clips.map(renderClip)}
        </div>
      </div>
    )
  }

  // Handle drag and drop from asset panel
  const handleDrop = useCallback((e: React.DragEvent, trackId: string) => {
    e.preventDefault()
    
    const mediaFileId = e.dataTransfer.getData('text/plain')
    const mediaFileDataStr = e.dataTransfer.getData('application/json')
    
    if (!mediaFileId) return

    let mediaFile = null
    try {
      if (mediaFileDataStr) {
        mediaFile = JSON.parse(mediaFileDataStr)
      }
    } catch (error) {
      console.warn('Failed to parse media file data:', error)
    }

    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect) return

    // Find the target track first
    const targetTrack = tracks.find(track => track.id === trackId)
    if (!targetTrack) return

    const x = e.clientX - rect.left - TRACK_HEADER_WIDTH + (timelineRef.current?.scrollLeft || 0) // Account for track header width and scroll offset
    let proposedStartTime = pixelsToTime(Math.max(0, x))

    // Use actual duration if available, otherwise default to 5 seconds
    const clipDuration = mediaFile?.duration || 5

    // Magnetic snap: auto-position after the last clip if enabled
    if (magneticSnap && targetTrack.clips.length > 0) {
      const lastClip = targetTrack.clips.reduce((latest, clip) => 
        clip.endTime > latest.endTime ? clip : latest
      )
      proposedStartTime = lastClip.endTime
    }

    // Type compatibility check - prevent mismatched media types
    if (mediaFile) {
      const isVideoMedia = mediaFile.type === 'video'
      const isVideoTrack = targetTrack.type === 'video'
      const isAudioMedia = mediaFile.type === 'audio'
      const isAudioTrack = targetTrack.type === 'audio'
      
      // Video files can only go to video tracks
      if (isVideoMedia && !isVideoTrack) {
        console.warn(`Cannot add video file "${mediaFile.name}" to audio track "${targetTrack.name}"`)
        return
      }
      
      // Audio files can only go to audio tracks  
      if (isAudioMedia && !isAudioTrack) {
        console.warn(`Cannot add audio file "${mediaFile.name}" to video track "${targetTrack.name}"`)
        return
      }
    }

    // Create a temporary clip for collision detection
    const tempClip: TimelineClip = {
      id: 'temp',
      mediaFileId,
      trackId,
      startTime: proposedStartTime,
      endTime: proposedStartTime + clipDuration,
      inPoint: 0,
      outPoint: clipDuration,
      duration: clipDuration
    }

    // Apply collision detection to find the best position (only if magnetic snap is disabled)
    const adjustedStartTime = magneticSnap ? proposedStartTime : detectCollisionAndSnap(tempClip, targetTrack, proposedStartTime)

    // Create new clip with adjusted position
    addClipToTrack({
      mediaFileId,
      trackId,
      startTime: adjustedStartTime,
      endTime: adjustedStartTime + clipDuration,
      inPoint: 0,
      outPoint: clipDuration,
      duration: clipDuration
    })

    // Clear drag over state
    setDragOverTrack(null)
    setDraggedMediaType(null)
  }, [addClipToTrack, pixelsToTime, tracks, detectCollisionAndSnap, magneticSnap])

  const handleDragOver = useCallback((e: React.DragEvent, trackId?: string) => {
    e.preventDefault()
    
    if (trackId) {
      // Get dragged media information
      const mediaFileDataStr = e.dataTransfer.getData('application/json')
      let mediaFile = null
      try {
        if (mediaFileDataStr) {
          mediaFile = JSON.parse(mediaFileDataStr)
        }
      } catch (error) {
        // Fallback: if no media data, allow drag over (could be internal clip drag)
      }

      // Update dragged media type for visual feedback
      if (mediaFile && mediaFile.type !== draggedMediaType) {
        setDraggedMediaType(mediaFile.type)
      }

      // Check type compatibility
      const targetTrack = tracks.find(track => track.id === trackId)
      if (targetTrack && mediaFile) {
        const isVideoMedia = mediaFile.type === 'video'
        const isVideoTrack = targetTrack.type === 'video'
        const isAudioMedia = mediaFile.type === 'audio'
        const isAudioTrack = targetTrack.type === 'audio'
        
        // Only set drag over if types are compatible
        const isCompatible = (isVideoMedia && isVideoTrack) || (isAudioMedia && isAudioTrack)
        
        if (isCompatible && dragOverTrack !== trackId) {
          setDragOverTrack(trackId)
        } else if (!isCompatible && dragOverTrack === trackId) {
          setDragOverTrack(null)
        }
      } else if (!mediaFile && dragOverTrack !== trackId) {
        // For internal drags (clip movements), allow drag over
        setDragOverTrack(trackId)
      }
    }
  }, [dragOverTrack, draggedMediaType, tracks])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the timeline area completely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTrack(null)
      setDraggedMediaType(null)
    }
  }, [])

  // Check if a track is compatible with the currently dragged media type
  const isTrackCompatible = useCallback((track: Track) => {
    if (!draggedMediaType) return true // No media being dragged, or unknown type
    
    const isVideoMedia = draggedMediaType === 'video'
    const isVideoTrack = track.type === 'video'
    const isAudioMedia = draggedMediaType === 'audio'
    const isAudioTrack = track.type === 'audio'
    const isTextTrack = track.type === 'text'
    
    // Text tracks are not compatible with direct media drag and drop
    // They are populated by the smart editing function
    if (isTextTrack) return false
    
    return (isVideoMedia && isVideoTrack) || (isAudioMedia && isAudioTrack)
  }, [draggedMediaType])

  // Handle split clip operation
  const handleSplitClip = useCallback(() => {
    if (selectedClips.length === 0) {
      console.log('⚠️ 请先选择要切割的素材片段')
      return
    }

    if (selectedClips.length > 1) {
      console.log('⚠️ 切割功能只能对单个片段操作，请选择一个片段')
      return
    }

    const clipId = selectedClips[0]
    
    // Find the selected clip
    let targetClip: TimelineClip | null = null
    for (const track of tracks) {
      const clip = track.clips.find(c => c.id === clipId)
      if (clip) {
        targetClip = clip
        break
      }
    }

    if (!targetClip) {
      console.log('❌ 选中的片段未找到')
      return
    }

    // Check if playhead is within the clip bounds
    if (currentTime <= targetClip.startTime || currentTime >= targetClip.endTime) {
      console.log(`⚠️ 时间线红线位置(${currentTime.toFixed(2)}s)不在选中片段范围内(${targetClip.startTime.toFixed(2)}s - ${targetClip.endTime.toFixed(2)}s)`)
      return
    }

    // Check minimum split distance (avoid creating very small clips)
    const minClipDuration = 0.1 // 0.1 seconds minimum
    const leftDuration = currentTime - targetClip.startTime
    const rightDuration = targetClip.endTime - currentTime
    
    if (leftDuration < minClipDuration || rightDuration < minClipDuration) {
      console.log(`⚠️ 切割位置太接近片段边缘，无法创建有效的片段(最小长度: ${minClipDuration}s)`)
      return
    }

    // Perform the split
    splitClip(clipId, currentTime)
    console.log(`✅ 成功切割片段 ${targetClip.mediaFileId} 在时间点 ${currentTime.toFixed(2)}s`)
  }, [selectedClips, currentTime, tracks, splitClip])

  // Handle global keyboard events (for Escape key and other global shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Clear selection when Escape is pressed (this can work globally)
      if (e.key === 'Escape') {
        clearClipSelection()
      }
    }

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown)
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [clearClipSelection])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedClip) {
        handleClipDrag(e as any)
      } else if (resizingClip) {
        handleClipResize(e)
      } else if (playheadDragging) {
        handlePlayheadMouseMove(e)
      }
    }

    const handleMouseUp = () => {
      if (draggedClip) {
        handleClipDragEnd()
      } else if (resizingClip) {
        handleClipResizeEnd()
      } else if (playheadDragging) {
        handlePlayheadMouseUp()
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggedClip, resizingClip, playheadDragging, handleClipDrag, handleClipDragEnd, handleClipResize, handleClipResizeEnd, handlePlayheadMouseMove, handlePlayheadMouseUp])

  // Handle clicks outside playhead to deselect it
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't deselect if we're dragging
      if (playheadDragging) return
      
      const target = e.target as HTMLElement
      // Check if click is on playhead or its children
      if (!target.closest('.playhead')) {
        setPlayheadSelected(false)
      }
    }

    if (playheadSelected) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [playheadSelected, playheadDragging])

  return (
    <div 
      className="timeline"
      tabIndex={0}
      onKeyDown={(e) => {
        // Handle keyboard events directly on the timeline element
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedClips.length > 0) {
            e.preventDefault()
            removeSelectedClips()
          }
        } else if (e.key === 'Escape') {
          clearClipSelection()
        } else if (e.key === 'b' && (e.ctrlKey || e.metaKey) && selectedClips.length > 0) {
          e.preventDefault()
          handleSplitClip()
        }
      }}
    >
      <div className="timeline-header">
        <div className="timeline-controls">
          <label>
            Zoom:
            <input
              type="range"
              min={0.1}
              max={5}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <span>{zoom.toFixed(1)}x</span>
          </label>
          
          <button
            className={`magnetic-snap-btn ${magneticSnap ? 'active' : ''}`}
            onClick={() => setMagneticSnap(!magneticSnap)}
            title={magneticSnap ? '磁吸已开启' : '磁吸已关闭'}
          >
            <Magnet size={16} />
          </button>
          
          <button
            className={`text-designer-btn ${showTextDesigner ? 'active' : ''}`}
            onClick={() => setShowTextDesigner(!showTextDesigner)}
            title="花字设计 - 添加和编辑文字logo"
          >
            <Type size={16} />
          </button>
          
          <SmartEditButton />
          
          <div className="split-hint" title="Ctrl+B: 在红线位置切割选中的片段">
            <kbd>Ctrl+B</kbd>
          </div>
          <div className="delete-hint" title="选中片段后按Delete键删除">
            <kbd>Delete</kbd>
          </div>
        </div>
      </div>

      <div
        ref={timelineRef}
        className="timeline-content"
        style={{ height: TIMELINE_HEIGHT }}
        onClick={handleTimelineClick}
        onDragOver={handleDragOver}
      >
        {renderTimeRuler()}
        {renderPlayhead()}
        
        <div className="timeline-tracks">
          {tracks.map((track, index) => {
            const isCompatible = isTrackCompatible(track)
            const isDragOver = dragOverTrack === track.id
            const isDragging = draggedMediaType !== null
            
            return (
              <div
                key={track.id}
                className={`timeline-track-container ${
                  isDragOver ? 'drag-over' : ''
                } ${
                  isDragging && !isCompatible ? 'drag-incompatible' : ''
                }`}
                onDrop={(e) => handleDrop(e, track.id)}
                onDragOver={(e) => handleDragOver(e, track.id)}
                onDragLeave={handleDragLeave}
              >
                {renderTrack(track, index)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Timeline 