import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, RotateCcw } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'
import { t } from '../utils/i18n'

const Preview: React.FC = () => {
  const {
    currentTime,
    duration,
    isPlaying,
    volume,
    muted,
    playbackSpeed,
    language,
    previewSize,
    tracks,
    mediaFiles,
    textLogos,
    isPlayheadDragging,
    play,
    pause,
    setCurrentTime,
    setVolume,
    toggleMute,
    setPlaybackSpeed,
    setPreviewSize // Add this from the store
  } = useEditorStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const [isLoop, setIsLoop] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [currentVideoSource, setCurrentVideoSource] = useState<string | null>(null)
  const [currentAudioSources, setCurrentAudioSources] = useState<Set<string>>(new Set())
  const [isManualSeeking, setIsManualSeeking] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null) // Ref for the container

  // Auto-resize canvas to fit container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setPreviewSize({ width, height })
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [setPreviewSize])

  // Format time for display
  const formatTimecode = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const frames = Math.floor((seconds % 1) * 30) // Assuming 30fps

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  }

  // Get the current video clip that should be playing at the given time
  const getCurrentClip = useCallback((time: number) => {
    // Look for video clips first (V1 track)
    const videoTrack = tracks.find(track => track.type === 'video')
    if (videoTrack) {
      const activeClip = videoTrack.clips.find(clip => 
        time >= clip.startTime && time < clip.endTime
      )
      if (activeClip) {
        const mediaFile = mediaFiles.find(file => file.id === activeClip.mediaFileId)
        if (mediaFile && mediaFile.type === 'video') {
          return { clip: activeClip, mediaFile }
        }
      }
    }
    return null
  }, [tracks, mediaFiles])

  // Get all active audio clips at the given time
  const getActiveAudioClips = useCallback((time: number) => {
    const audioTracks = tracks.filter(track => track.type === 'audio')
    const activeAudioClips: Array<{ clip: any, mediaFile: any, trackId: string }> = []

    audioTracks.forEach(track => {
      track.clips.forEach(clip => {
        if (time >= clip.startTime && time < clip.endTime) {
          const mediaFile = mediaFiles.find(file => file.id === clip.mediaFileId)
          if (mediaFile && mediaFile.type === 'audio') {
            activeAudioClips.push({ clip, mediaFile, trackId: track.id })
          }
        }
      })
    })

    return activeAudioClips
  }, [tracks, mediaFiles])

  // Render current frame to canvas
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas with black background
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // If video is loaded and ready, draw current frame
    if (video && video.readyState >= 2 && currentVideoSource) {
      try {
        // Get video dimensions, fallback to canvas size if not available
        const videoWidth = video.videoWidth || canvas.width
        const videoHeight = video.videoHeight || canvas.height
        
        // Only proceed if we have valid dimensions
        if (videoWidth > 0 && videoHeight > 0) {
          const videoAspect = videoWidth / videoHeight
          const canvasAspect = canvas.width / canvas.height
          
          let drawWidth, drawHeight, offsetX, offsetY

          if (videoAspect > canvasAspect) {
            // Video is wider - fit to width
            drawWidth = canvas.width
            drawHeight = canvas.width / videoAspect
            offsetX = 0
            offsetY = (canvas.height - drawHeight) / 2
          } else {
            // Video is taller - fit to height
            drawHeight = canvas.height
            drawWidth = canvas.height * videoAspect
            offsetX = (canvas.width - drawWidth) / 2
            offsetY = 0
          }

          ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)
        } else {
          // Video dimensions not available yet
          ctx.fillStyle = '#333333'
          ctx.font = '14px Arial'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('Video loading... (dimensions pending)', canvas.width / 2, canvas.height / 2)
        }
      } catch (error) {
        console.error('Error drawing video frame:', error)
        ctx.fillStyle = '#666666'
        ctx.font = '14px Arial'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('Video render error', canvas.width / 2, canvas.height / 2)
      }
    } else {
      // Show placeholder text when no video is loaded
      ctx.fillStyle = '#666666'
      ctx.font = '16px Arial'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      const currentClipData = getCurrentClip(currentTime)
      let text = 'No video clip at current time'
      
      if (currentClipData) {
        if (currentVideoSource) {
          // During dragging, don't show loading text to avoid flickering
          if (isPlayheadDragging) {
            text = 'Video loading...'
          } else {
            // More detailed loading status when not dragging
            const video = videoRef.current
            if (video) {
              const readyStateTexts = [
                'Loading video... (no data)',
                'Loading video... (metadata)',
                'Loading video... (current data)',
                'Loading video... (future data)', 
                'Video ready'
              ]
              text = readyStateTexts[video.readyState] || 'Loading video...'
              
              // Add debug info for troubleshooting
              if (video.readyState >= 1) {
                text += ` (${video.videoWidth}x${video.videoHeight})`
              }
            } else {
              text = 'Loading video...'
            }
          }
        } else {
          text = 'Video source not available'
        }
      }
      
      // During dragging, use a smaller, less intrusive loading indicator
      if (isPlayheadDragging && currentClipData && currentVideoSource) {
        ctx.fillStyle = '#999999'
        ctx.font = '12px Arial'
        text = 'Seeking...'
      }
      
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)
      
      // Show current timecode
      ctx.fillStyle = '#999999'
      ctx.font = '12px monospace'
      ctx.fillText(`Time: ${formatTimecode(currentTime)}`, canvas.width / 2, canvas.height / 2 + 30)
    }

    // Render text logos on top of video
    textLogos.forEach(logo => {
      if (!logo.visible) return

      ctx.save()
      
      // Calculate position relative to video display area
      let logoX = logo.x
      let logoY = logo.y
      let logoFontSize = logo.fontSize
      
      // If video is fitted with aspect ratio, adjust text position accordingly
      if (video && video.readyState >= 2 && currentVideoSource) {
        const videoWidth = video.videoWidth || canvas.width
        const videoHeight = video.videoHeight || canvas.height
        
        if (videoWidth > 0 && videoHeight > 0) {
          const videoAspect = videoWidth / videoHeight
          const canvasAspect = canvas.width / canvas.height
          
          let drawWidth, drawHeight, offsetX, offsetY

          if (videoAspect > canvasAspect) {
            // Video is wider - fit to width
            drawWidth = canvas.width
            drawHeight = canvas.width / videoAspect
            offsetX = 0
            offsetY = (canvas.height - drawHeight) / 2
          } else {
            // Video is taller - fit to height
            drawHeight = canvas.height
            drawWidth = canvas.height * videoAspect
            offsetX = (canvas.width - drawWidth) / 2
            offsetY = 0
          }
          
          // Scale text position and size to match video display
          const scaleX = drawWidth / videoWidth
          const scaleY = drawHeight / videoHeight
          
          logoX = logo.x * scaleX + offsetX
          logoY = logo.y * scaleY + offsetY
          logoFontSize = logo.fontSize * Math.min(scaleX, scaleY)
        }
      }
      
      // Set text properties
      ctx.font = `${logo.fontStyle} ${logo.fontWeight} ${logoFontSize}px ${logo.fontFamily}`
      ctx.globalAlpha = logo.opacity
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      
      // Apply rotation if needed
      if (logo.rotation !== 0) {
        ctx.translate(logoX + logoFontSize / 2, logoY + logoFontSize / 2)
        ctx.rotate((logo.rotation * Math.PI) / 180)
        ctx.translate(-logoFontSize / 2, -logoFontSize / 2)
      } else {
        ctx.translate(logoX, logoY)
      }
      
      // Create gradient if enabled
      let textFillStyle: string | CanvasGradient = logo.color
      if (logo.gradientEnabled && logo.gradientColor1 && logo.gradientColor2) {
        const textMetrics = ctx.measureText(logo.text)
        let gradient: CanvasGradient
        
        if (logo.gradientDirection === 'horizontal') {
          gradient = ctx.createLinearGradient(0, 0, textMetrics.width, 0)
        } else if (logo.gradientDirection === 'radial') {
          const centerX = textMetrics.width / 2
          const centerY = logoFontSize / 2
          gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(textMetrics.width, logoFontSize) / 2)
        } else {
          // vertical
          gradient = ctx.createLinearGradient(0, 0, 0, logoFontSize)
        }
        
        gradient.addColorStop(0, logo.gradientColor1)
        gradient.addColorStop(1, logo.gradientColor2)
        textFillStyle = gradient
      }
      
      // Add shadow effects (combining basic shadow with glow)
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetX = 0
      ctx.shadowOffsetY = 0
      
      // Draw outer glow effect first
      if (logo.outerGlow && logo.glowColor && logo.glowIntensity && logo.glowIntensity > 0) {
        ctx.shadowColor = logo.glowColor
        ctx.shadowBlur = logo.glowIntensity
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        
        // Draw multiple glow layers for stronger effect
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = textFillStyle
          ctx.fillText(logo.text, 0, 0)
        }
        
        // Reset shadow for next elements
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }
      
      // Add basic shadow if defined
      if (logo.shadowBlur && logo.shadowBlur > 0) {
        ctx.shadowColor = logo.shadowColor || '#000000'
        ctx.shadowBlur = logo.shadowBlur
        ctx.shadowOffsetX = logo.shadowOffsetX || 0
        ctx.shadowOffsetY = logo.shadowOffsetY || 0
      }
      
      // Draw background if defined
      if (logo.backgroundColor) {
        const textMetrics = ctx.measureText(logo.text)
        const textHeight = logoFontSize
        ctx.fillStyle = logo.backgroundColor
        ctx.fillRect(-4, -4, textMetrics.width + 8, textHeight + 8)
      }
      
      // Draw outline/border if defined
      let outlineColor = logo.borderColor
      let outlineWidth = logo.borderWidth || 0
      
      if (logo.outlineEnabled && logo.outlineColor && logo.outlineWidth) {
        outlineColor = logo.outlineColor
        outlineWidth = logo.outlineWidth
      }
      
      if (outlineColor && outlineWidth > 0) {
        ctx.strokeStyle = outlineColor
        ctx.lineWidth = outlineWidth
        
        // Apply emboss effect
        if (logo.embossEnabled) {
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          
          // Draw emboss highlight
          ctx.strokeStyle = '#ffffff40'
          ctx.lineWidth = outlineWidth + 1
          ctx.strokeText(logo.text, -1, -1)
          
          // Draw emboss shadow
          ctx.strokeStyle = '#00000060'
          ctx.lineWidth = outlineWidth
          ctx.strokeText(logo.text, 1, 1)
          
          // Draw main outline
          ctx.strokeStyle = outlineColor
        }
        
        ctx.strokeText(logo.text, 0, 0)
      }
      
      // Draw main text
      ctx.fillStyle = textFillStyle
      ctx.fillText(logo.text, 0, 0)
      
      ctx.restore()
    })
  }, [currentVideoSource, currentTime, getCurrentClip, isPlayheadDragging, textLogos])

  // Debounced frame rendering for smooth dragging
  const dragRenderTimeoutRef = useRef<number | null>(null)
  
  // Lightweight update for playhead dragging - only seeks without changing sources
  const updateVideoDisplayForDragging = useCallback(() => {
    const currentClipData = getCurrentClip(currentTime)
    
    if (currentClipData && videoRef.current && currentVideoSource) {
      const { clip } = currentClipData
      
      // Quick time update for same clip - no source change needed
      if (videoRef.current.duration) {
        const timeIntoClip = Math.max(0, currentTime - clip.startTime)
        const clipTime = Math.max(0, clip.inPoint + timeIntoClip)
        const maxClipTime = Math.min(clip.outPoint, videoRef.current.duration)
        const targetTime = Math.max(clip.inPoint, Math.min(clipTime, maxClipTime))
        
        // Direct seek without waiting
        videoRef.current.currentTime = targetTime
        
        // Debounce frame rendering during dragging to avoid excessive calls
        if (dragRenderTimeoutRef.current) {
          clearTimeout(dragRenderTimeoutRef.current)
        }
        
        dragRenderTimeoutRef.current = window.setTimeout(() => {
          renderFrame()
          dragRenderTimeoutRef.current = null
        }, 16) // ~60fps maximum
      }
    }
  }, [currentTime, getCurrentClip, currentVideoSource, renderFrame])

  // Update video source and time based on current timeline position
  const updateVideoDisplay = useCallback(async () => {
    const currentClipData = getCurrentClip(currentTime)
    
    if (currentClipData) {
      const { clip, mediaFile } = currentClipData
      
      // Only change video source if needed (avoid reloading during playback)
      if (currentVideoSource !== mediaFile.url) {
        if (videoRef.current && mediaFile.url) {
          setCurrentVideoSource(mediaFile.url)
          videoRef.current.src = mediaFile.url
          
          try {
            await new Promise<void>((resolve, reject) => {
              const video = videoRef.current!
              const timeout = setTimeout(() => {
                video.removeEventListener('loadeddata', handleLoad)
                video.removeEventListener('error', handleError)
                reject(new Error('Video load timeout'))
              }, 10000)
              
              const handleLoad = () => {
                clearTimeout(timeout)
                video.removeEventListener('loadeddata', handleLoad)
                video.removeEventListener('error', handleError)
                resolve()
              }
              const handleError = () => {
                clearTimeout(timeout)
                video.removeEventListener('loadeddata', handleLoad)
                video.removeEventListener('error', handleError)
                reject(new Error('Failed to load video'))
              }
              
              video.addEventListener('loadeddata', handleLoad)
              video.addEventListener('error', handleError)
            })
          } catch (error) {
            console.error('Error loading video:', error)
            setCurrentVideoSource(null)
            return
          }
        }
      }
      
      // Set video time to match clip position (but only if not currently playing to avoid jitter)
      if (videoRef.current && videoRef.current.duration && !isPlaying) {
        const timeIntoClip = Math.max(0, currentTime - clip.startTime)
        const clipTime = Math.max(0, clip.inPoint + timeIntoClip)
        const maxClipTime = Math.min(clip.outPoint, videoRef.current.duration)
        const targetTime = Math.max(clip.inPoint, Math.min(clipTime, maxClipTime))
        
        if (Math.abs(videoRef.current.currentTime - targetTime) > 0.1) {
          videoRef.current.currentTime = targetTime
        }
      }
    } else {
      // No clip at current time - clear video source
      if (currentVideoSource !== null) {
        setCurrentVideoSource(null)
        if (videoRef.current) {
          videoRef.current.src = ''
        }
      }
    }
    
    renderFrame()
  }, [currentTime, getCurrentClip, currentVideoSource, isPlaying])

  // Update audio sources and playback
  const updateAudioDisplay = useCallback(async () => {
    const activeAudioClips = getActiveAudioClips(currentTime)
    const newAudioSources = new Set<string>()
    
    // Process each active audio clip
    for (const { clip, mediaFile, trackId } of activeAudioClips) {
      if (!mediaFile.url) continue
      
      const audioKey = `${trackId}-${clip.id}`
      newAudioSources.add(audioKey)
      
      let audioElement = audioRefs.current.get(audioKey)
      
      // Create audio element if it doesn't exist
      if (!audioElement) {
        audioElement = new Audio()
        audioElement.src = mediaFile.url
        audioElement.volume = muted ? 0 : volume
        audioElement.playbackRate = playbackSpeed
        audioElement.preload = 'metadata'
        
        // Add event listeners
        audioElement.addEventListener('error', (e) => {
          console.error(`Audio error for ${audioKey}:`, e)
        })
        
        audioRefs.current.set(audioKey, audioElement)
        
        try {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              audioElement!.removeEventListener('loadeddata', handleLoad)
              audioElement!.removeEventListener('error', handleError)
              reject(new Error('Audio load timeout'))
            }, 5000)
            
            const handleLoad = () => {
              clearTimeout(timeout)
              audioElement!.removeEventListener('loadeddata', handleLoad)
              audioElement!.removeEventListener('error', handleError)
              resolve()
            }
            
            const handleError = () => {
              clearTimeout(timeout)
              audioElement!.removeEventListener('loadeddata', handleLoad)
              audioElement!.removeEventListener('error', handleError)
              reject(new Error('Failed to load audio'))
            }
            
            audioElement!.addEventListener('loadeddata', handleLoad)
            audioElement!.addEventListener('error', handleError)
          })
        } catch (error) {
          console.error('Error loading audio:', error)
          audioRefs.current.delete(audioKey)
          continue
        }
      }
      
      // Set correct audio time
      if (audioElement && !isPlaying) {
        const timeIntoClip = Math.max(0, currentTime - clip.startTime)
        const targetTime = Math.max(0, clip.inPoint + timeIntoClip)
        const maxClipTime = Math.min(clip.outPoint, audioElement.duration || clip.duration)
        const clampedTime = Math.max(clip.inPoint, Math.min(targetTime, maxClipTime))
        
        if (Math.abs(audioElement.currentTime - clampedTime) > 0.1) {
          audioElement.currentTime = clampedTime
        }
      }
    }
    
    // Remove audio elements that are no longer active
    const audioMap = audioRefs.current
    for (const [key, audioElement] of audioMap.entries()) {
      if (!newAudioSources.has(key)) {
        audioElement.pause()
        audioElement.src = ''
        audioMap.delete(key)
      }
    }
    
    setCurrentAudioSources(newAudioSources)
  }, [currentTime, getActiveAudioClips, isPlaying, muted, volume, playbackSpeed])

  // Handle manual seeking during playback - update media positions without changing timeline
  const handleManualSeek = useCallback(async (newTime: number) => {
    setIsManualSeeking(true)
    
    console.log(`🎯 Manual seek to ${newTime.toFixed(2)}s during playback`)
    
    // Update video display for new position
    await updateVideoDisplay()
    await updateAudioDisplay()
    
    // Update video time if we have a current video source
    if (videoRef.current && currentVideoSource) {
      const currentClipData = getCurrentClip(newTime)
      if (currentClipData) {
        const { clip } = currentClipData
        const timeIntoClip = Math.max(0, newTime - clip.startTime)
        const targetTime = Math.max(0, clip.inPoint + timeIntoClip)
        
        console.log(`📹 Seeking video to ${targetTime.toFixed(2)}s (clip: ${clip.inPoint}s - ${clip.outPoint}s)`)
        
        if (Math.abs(videoRef.current.currentTime - targetTime) > 0.1) {
          videoRef.current.currentTime = targetTime
        }
      } else {
        console.log('📹 No video clip at new timeline position')
      }
    }
    
    // Update audio times for all active audio elements
    const activeAudioClips = getActiveAudioClips(newTime)
    console.log(`🔊 Found ${activeAudioClips.length} active audio clips`)
    
    activeAudioClips.forEach(({ clip, trackId }) => {
      const audioKey = `${trackId}-${clip.id}`
      const audioElement = audioRefs.current.get(audioKey)
      if (audioElement) {
        const timeIntoClip = Math.max(0, newTime - clip.startTime)
        const targetTime = Math.max(0, clip.inPoint + timeIntoClip)
        const maxClipTime = Math.min(clip.outPoint, audioElement.duration || clip.duration)
        const clampedTime = Math.max(clip.inPoint, Math.min(targetTime, maxClipTime))
        
        console.log(`🔊 Seeking audio ${audioKey} to ${clampedTime.toFixed(2)}s`)
        
        if (Math.abs(audioElement.currentTime - clampedTime) > 0.1) {
          audioElement.currentTime = clampedTime
        }
      }
    })
    
    // Clear the manual seeking flag after a short delay to allow auto-updates to resume
    setTimeout(() => {
      console.log('✅ Manual seeking flag cleared, resuming auto-updates')
      setIsManualSeeking(false)
    }, 300)
  }, [updateVideoDisplay, updateAudioDisplay, getCurrentClip, getActiveAudioClips, currentVideoSource])

  // Animation loop for smooth playback
  const startAnimationLoop = useCallback(() => {
    const animate = () => {
      renderFrame()
      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }
    if (isPlaying && !animationFrameRef.current) {
      animationFrameRef.current = requestAnimationFrame(animate)
    }
  }, [isPlaying, renderFrame])

  const stopAnimationLoop = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  // Apply playback speed to video element
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed, currentVideoSource])

  // Handle play/pause
  const handlePlayPause = useCallback(async () => {
    if (isPlaying) {
      pause()
      stopAnimationLoop()
    } else {
      // Check if there's a valid clip at current time before playing
      const currentClipData = getCurrentClip(currentTime)
      if (currentClipData) {
        // Ensure video and audio are loaded and positioned correctly before playing
        await updateVideoDisplay()
        await updateAudioDisplay()
        
        // Set correct video time before playing
        if (videoRef.current && currentVideoSource) {
          const { clip } = currentClipData
          const timeIntoClip = Math.max(0, currentTime - clip.startTime)
          const targetTime = Math.max(0, clip.inPoint + timeIntoClip)
          
          if (Math.abs(videoRef.current.currentTime - targetTime) > 0.1) {
            videoRef.current.currentTime = targetTime
          }
        }
        
        play()
        startAnimationLoop()
      } else {
        console.warn('No video clip at current timeline position')
      }
    }
  }, [isPlaying, play, pause, startAnimationLoop, stopAnimationLoop, getCurrentClip, currentTime, updateVideoDisplay, currentVideoSource])

  // Handle frame navigation
  const handlePreviousFrame = useCallback(() => {
    const frameTime = 1/30 // One frame at 30fps
    const newTime = Math.max(0, currentTime - frameTime)
    setCurrentTime(Math.round(newTime * 100) / 100) // Round to 0.01 precision
  }, [currentTime, setCurrentTime])

  const handleNextFrame = useCallback(() => {
    const frameTime = 1/30 // One frame at 30fps  
    const newTime = Math.min(duration, currentTime + frameTime)
    setCurrentTime(Math.round(newTime * 100) / 100) // Round to 0.01 precision
  }, [currentTime, duration, setCurrentTime])

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
  }, [setVolume])

  // Handle seeking
  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = (parseFloat(e.target.value) / 100) * duration
    setCurrentTime(Math.round(newTime * 100) / 100) // Round to 0.01 precision like Timeline
  }, [duration, setCurrentTime])

  const handleSeekMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleSeekMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent default browser actions
      if (e.target === document.body) {
        switch (e.code) {
          case 'Space':
            e.preventDefault()
            handlePlayPause()
            break
          case 'ArrowLeft':
            e.preventDefault()
            handlePreviousFrame()
            break
          case 'ArrowRight':
            e.preventDefault()
            handleNextFrame()
            break
          case 'KeyM':
            e.preventDefault()
            toggleMute()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [handlePlayPause, handlePreviousFrame, handleNextFrame, toggleMute])

  // Track previous time to detect manual seeking
  const prevTimeRef = useRef(currentTime)
  
  // Update video and audio display when timeline changes
  useEffect(() => {
    if (isPlayheadDragging) {
      // During playhead dragging, use lightweight updates
      updateVideoDisplayForDragging()
      // Audio updates are skipped during dragging for better performance
    } else if (!isPlaying) {
      updateVideoDisplay()
      updateAudioDisplay()
    } else {
      // During playback, check if this is a manual time jump
      const timeDiff = Math.abs(currentTime - prevTimeRef.current)
      const isLargeJump = timeDiff > 0.5 // If time jumped more than 0.5 seconds, consider it manual
      
      if (isLargeJump && !isManualSeeking) {
        // This is likely a manual seek during playback
        console.log(`🎯 Manual seek detected: ${prevTimeRef.current.toFixed(2)}s → ${currentTime.toFixed(2)}s (diff: ${timeDiff.toFixed(2)}s)`)
        handleManualSeek(currentTime)
      }
    }
    
    prevTimeRef.current = currentTime
  }, [currentTime, isPlaying, isPlayheadDragging, updateVideoDisplay, updateVideoDisplayForDragging, updateAudioDisplay, handleManualSeek, isManualSeeking])

  // Update video and audio display when timeline position changes significantly (while not playing)
  useEffect(() => {
    if (!isPlaying && !isPlayheadDragging) {
      const timeoutId = setTimeout(() => {
        updateVideoDisplay()
        updateAudioDisplay()
      }, 100) // Small delay to debounce rapid changes
      
      return () => clearTimeout(timeoutId)
    }
  }, [currentTime, isPlaying, isPlayheadDragging, updateVideoDisplay, updateAudioDisplay])

  // When playhead dragging ends, update audio to sync properly
  useEffect(() => {
    if (!isPlayheadDragging && !isPlaying) {
      // Small delay to allow video to settle first
      const timeoutId = setTimeout(() => {
        updateAudioDisplay()
      }, 50)
      
      return () => clearTimeout(timeoutId)
    }
  }, [isPlayheadDragging, isPlaying, updateAudioDisplay])



  // Handle playing state changes
  useEffect(() => {
    if (isPlaying) {
      startAnimationLoop()
    } else {
      stopAnimationLoop()
    }
    
    return () => {
      stopAnimationLoop()
    }
  }, [isPlaying, startAnimationLoop, stopAnimationLoop])

  // Update video and audio element properties
  useEffect(() => {
    // Update video volume
    if (videoRef.current) {
      videoRef.current.volume = muted ? 0 : volume
    }
    
    // Update all audio elements volume
    audioRefs.current.forEach(audioElement => {
      audioElement.volume = muted ? 0 : volume
    })
  }, [volume, muted])

  // Update playback speed for all audio elements
  useEffect(() => {
    audioRefs.current.forEach(audioElement => {
      audioElement.playbackRate = playbackSpeed
    })
  }, [playbackSpeed])

  // Handle play/pause state changes for video and audio
  useEffect(() => {
    // Handle video playback
    if (videoRef.current && currentVideoSource) {
      if (isPlaying && !isDragging) {
        videoRef.current.play().catch((error) => {
          console.error('Error playing video:', error)
          pause()
        })
      } else {
        videoRef.current.pause()
      }
    }
    
    // Handle audio playback
    audioRefs.current.forEach(audioElement => {
      if (isPlaying && !isDragging) {
        audioElement.play().catch((error) => {
          console.error('Error playing audio:', error)
        })
      } else {
        audioElement.pause()
      }
    })
  }, [isPlaying, isDragging, currentVideoSource, currentAudioSources, pause])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        duration: video.duration,
        readyState: video.readyState
      })
      // Render frame when video metadata is loaded
      renderFrame()
    }

    const handleSeeked = () => {
      // Render frame when seeking is complete
      renderFrame()
    }

    const handleError = (event: Event) => {
      console.error('Video error:', event, video.error)
      renderFrame()
    }

    const handleCanPlay = () => {
      console.log('Video can play:', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      })
      renderFrame()
    }

    const handleTimeUpdate = () => {
      renderFrame()
      
      // During playback, update timeline position based on video time
      // Skip auto-update if user is manually seeking
      if (!isDragging && !isManualSeeking && isPlaying && currentVideoSource && video) {
        const videoTime = video.currentTime
        
        // Find the currently active clip at the current timeline position
        const videoTrack = tracks.find(track => track.type === 'video')
        if (videoTrack) {
          let activeClip = null
          
          // Find clip that should be active at current timeline position
          for (const clip of videoTrack.clips) {
            if (currentTime >= clip.startTime && currentTime < clip.endTime) {
              activeClip = clip
              break
            }
          }
          
          if (activeClip) {
            // Calculate new timeline position based on video playback
            const videoTimeInClip = videoTime - activeClip.inPoint
            const newTimelineTime = activeClip.startTime + videoTimeInClip
            
            // Check boundaries
            if (videoTime >= activeClip.outPoint || newTimelineTime >= activeClip.endTime) {
              // Reached end of clip - check for next clip to continue playing
              const nextClip = videoTrack.clips
                .filter(clip => clip.startTime >= activeClip.endTime)
                .sort((a, b) => a.startTime - b.startTime)[0]
              
              if (nextClip && nextClip.startTime === activeClip.endTime) {
                // Found adjacent next clip - seamlessly transition to it
                const seamlessTransition = async () => {
                  // Set timeline to next clip start
                  setCurrentTime(nextClip.startTime)
                  
                  // Force update video display for the new clip
                  const nextMediaFile = mediaFiles.find(file => file.id === nextClip.mediaFileId)
                  if (nextMediaFile && videoRef.current) {
                    if (currentVideoSource === nextMediaFile.url) {
                      // Same video source - just seek to new position
                      videoRef.current.currentTime = nextClip.inPoint
                                          } else {
                        // Different video source - need to load new video
                        if (nextMediaFile.url) {
                          setCurrentVideoSource(nextMediaFile.url)
                          videoRef.current.src = nextMediaFile.url
                      
                      // Wait for new video to load, then set correct time
                      try {
                        await new Promise<void>((resolve, reject) => {
                          const video = videoRef.current!
                          const timeout = setTimeout(() => {
                            video.removeEventListener('loadeddata', handleLoad)
                            reject(new Error('Video load timeout'))
                          }, 5000)
                          
                          const handleLoad = () => {
                            clearTimeout(timeout)
                            video.removeEventListener('loadeddata', handleLoad)
                            video.currentTime = nextClip.inPoint
                            resolve()
                          }
                          
                          video.addEventListener('loadeddata', handleLoad)
                        })
                      } catch (error) {
                        console.error('Error loading next video:', error)
                        pause()
                                                 return
                       }
                       }
                     }
                   }
                 }
                 
                 seamlessTransition().catch(console.error)
              } else {
                // No adjacent next clip - pause playback
                setCurrentTime(activeClip.endTime)
                pause()
              }
            } else if (videoTimeInClip >= 0 && Math.abs(newTimelineTime - currentTime) > 0.1) {
              // Update timeline position
              setCurrentTime(Math.round(newTimelineTime * 100) / 100)
            }
          }
        }
      }
    }

    const handleEnded = () => {
      if (isLoop) {
        setCurrentTime(0)
      } else {
        pause()
      }
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('error', handleError)
    video.addEventListener('canplay', handleCanPlay)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('error', handleError)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [currentTime, isDragging, isLoop, isPlaying, currentVideoSource, tracks, setCurrentTime, pause, renderFrame, mediaFiles, setCurrentVideoSource])

  // Initial render when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      renderFrame()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [renderFrame])

  // Render frame when key properties change
  useEffect(() => {
    if (!isPlaying) {
      renderFrame()
    }
  }, [currentTime, currentVideoSource, renderFrame, isPlaying])

  const currentProgress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="preview">
      <div className="preview-video-container" ref={containerRef}>
        <div 
          className="video-canvas"
          style={{ 
            width: previewSize.width,
            height: previewSize.height,
            aspectRatio: '16/9',
            maxWidth: '100%',
            maxHeight: '100%' // Changed to 100% to fill container
          }}
        >
          {/* Video element for actual playback (positioned off-screen but not hidden) */}
          <video
            ref={videoRef}
            style={{ 
              position: 'absolute',
              left: '-9999px',
              top: '-9999px',
              width: '1px',
              height: '1px',
              opacity: 0,
              pointerEvents: 'none'
            }}
            muted={muted}
            preload="metadata"
            crossOrigin="anonymous"
          />
          
          {/* Canvas for composited output */}
          <canvas
            ref={canvasRef}
            width={previewSize.width}
            height={previewSize.height}
            className="preview-canvas"
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#000'
            }}
          />
          
          {/* Timecode overlay */}
          <div className="timecode-overlay">
            {formatTimecode(currentTime)}
          </div>
        </div>
      </div>

      <div className="preview-controls">
        {/* Main controls row */}
        <div className="controls-main-row">
          {/* Transport controls */}
          <div className="transport-controls">
            <button
              className="control-btn"
              onClick={handlePreviousFrame}
              title={t('previousFrame', language)}
            >
              <SkipBack size={18} />
            </button>
            
            <button
              className="control-btn play-pause-btn"
              onClick={handlePlayPause}
              title={isPlaying ? t('pause', language) : t('play', language)}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>
            
            <button
              className="control-btn"
              onClick={handleNextFrame}
              title={t('nextFrame', language)}
            >
              <SkipForward size={18} />
            </button>
            
            <button
              className={`control-btn ${isLoop ? 'active' : ''}`}
              onClick={() => setIsLoop(!isLoop)}
              title={t('loop', language)}
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Secondary controls */}
          <div className="secondary-controls">
            {/* Playback speed control */}
            <div className="speed-controls">
              <select 
                className="speed-selector"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                title={t('speed', language)}
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>
            </div>

            {/* Volume controls */}
            <div className="volume-controls">
              <button
                className="control-btn"
                onClick={toggleMute}
                title={muted ? 'Unmute' : t('mute', language)}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="volume-slider"
                disabled={muted}
              />
              <span className="volume-display">{Math.round((muted ? 0 : volume) * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Progress bar row */}
        <div className="progress-container">
          <span className="time-display">{formatTimecode(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={currentProgress}
            onChange={handleSeek}
            onMouseDown={handleSeekMouseDown}
            onMouseUp={handleSeekMouseUp}
            className="progress-slider"
          />
          <span className="time-display">{formatTimecode(duration)}</span>
        </div>
      </div>
    </div>
  )
}

export default Preview 