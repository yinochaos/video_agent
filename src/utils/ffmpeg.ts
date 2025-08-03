/*
This helper function calculates the actual display area of a video within a canvas container,
accounting for aspect ratio differences by calculating letterboxing/pillarboxing.
*/
const calculateVideoDisplayArea = (
  videoWidth: number,
  videoHeight: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  const videoAspect = videoWidth / videoHeight
  const canvasAspect = canvasWidth / canvasHeight

  let drawWidth, drawHeight, offsetX, offsetY

  if (videoAspect > canvasAspect) {
    // Video is wider than the canvas, so it's letterboxed (black bars top/bottom)
    drawWidth = canvasWidth
    drawHeight = canvasWidth / videoAspect
    offsetX = 0
    offsetY = (canvasHeight - drawHeight) / 2
  } else {
    // Video is taller than the canvas, so it's pillarboxed (black bars left/right)
    drawHeight = canvasHeight
    drawWidth = canvasHeight * videoAspect
    offsetX = (canvasWidth - drawWidth) / 2
    offsetY = 0
  }

  return { drawWidth, drawHeight, offsetX, offsetY }
}

// Native FFmpeg export using local installation (only export function)
export const exportVideoNative = async (options: ExportOptions): Promise<void> => {
  const { clips, mediaFiles, textLogos, bitrate, outputPath, onProgress } = options

  console.log('🎬 使用本地FFmpeg导出视频...')
  
  if (onProgress) onProgress(5)

  // FFmpeg availability already checked in main function
  console.log('🚀 开始使用本地FFmpeg导出...')
  if (onProgress) onProgress(10)

  // Group clips by track type and sort by start time
  const videoClips = clips.filter(clip => {
    const mediaFile = mediaFiles.find(m => m.id === clip.mediaFileId)
    return mediaFile?.type === 'video'
  }).sort((a, b) => a.startTime - b.startTime)

  if (videoClips.length === 0) {
    throw new Error('需要至少一个视频片段')
  }

  console.log(`📹 处理${videoClips.length}个视频片段`)

  if (onProgress) onProgress(20)

  console.log('🛠️ 构建FFmpeg命令...')
  
  // Build FFmpeg command with multiple inputs and concat filter
  let ffmpegCommand = ['-y'] // Overwrite output file
  
  // Add unique media files as inputs and map clips to input indices
  const inputFiles: string[] = []
  const mediaFileInputMap = new Map<string, number>() // mediaFileId -> inputIndex
  
  // First, collect unique media files
  for (const clip of videoClips) {
    const mediaFile = mediaFiles.find(m => m.id === clip.mediaFileId)
    if (!mediaFile) {
      throw new Error(`找不到媒体文件: ${clip.mediaFileId}`)
    }
    
    if (!mediaFileInputMap.has(mediaFile.id)) {
      // Convert file:// URL to local path
      let inputPath = mediaFile.path || mediaFile.url
      if (inputPath?.startsWith('file://')) {
        inputPath = inputPath.replace('file://', '').replace(/^\/+/, '/')
      }
      
      // Add input file
      const inputIndex = inputFiles.length
      ffmpegCommand.push('-i', inputPath!)
      inputFiles.push(inputPath!)
      mediaFileInputMap.set(mediaFile.id, inputIndex)
      
      console.log(`📥 输入${inputIndex}: ${mediaFile.name} (${inputPath})`)
    }
  }
  
  // Build filter_complex for trimming and concatenating clips
  let filterParts: string[] = []
  
  // First, trim each clip according to its settings
  videoClips.forEach((clip, index) => {
    const inputIndex = mediaFileInputMap.get(clip.mediaFileId)!
    const startTime = clip.inPoint || 0
    const duration = clip.duration
    filterParts.push(`[${inputIndex}:v]trim=start=${startTime}:duration=${duration},setpts=PTS-STARTPTS[v${index}]`)
    filterParts.push(`[${inputIndex}:a]atrim=start=${startTime}:duration=${duration},asetpts=PTS-STARTPTS[a${index}]`)
    console.log(`✂️ 片段${index}: 从输入${inputIndex}切割 ${startTime}s-${startTime + duration}s`)
  })
  
  // Then concatenate all trimmed clips
  if (videoClips.length > 1) {
    let concatInputs = ''
    for (let i = 0; i < videoClips.length; i++) {
      concatInputs += `[v${i}][a${i}]`
    }
    filterParts.push(`${concatInputs}concat=n=${videoClips.length}:v=1:a=1[vconcat][aconcat]`)
    console.log(`🔗 拼接${videoClips.length}个片段: ${concatInputs}`)
  }
  
  // Get original video dimensions for logo scaling
  const firstMediaFile = mediaFiles.find(m => m.id === videoClips[0].mediaFileId)!
  const originalResolution = await getVideoResolution(firstMediaFile)
  console.log(`📐 原始视频分辨率: ${originalResolution.width}x${originalResolution.height}`)

   // Add text logo PNG overlays if any
   if (textLogos.length > 0) {
     const visibleLogos = textLogos.filter(logo => logo.visible && logo.pngData)
     if (visibleLogos.length > 0) {
       console.log(`🖼️ 添加${visibleLogos.length}个PNG文字logo到原始视频...`)
       
       const logoInputs: string[] = []
       
       // Add logo PNGs as inputs to FFmpeg
       visibleLogos.forEach((logo, index) => {
         const logoFileName = `text_logo_${index}.png`
         logoInputs.push(logoFileName)
         ffmpegCommand.push('-i', logoFileName)
       })
       
      // Build overlay filter chain
      const logoStartIndex = inputFiles.length // logo inputs start after media file inputs
      const baseVideo = videoClips.length > 1 ? '[vconcat]' : '[v0]'
      const finalOutputName = '[finalvideo]' // Define variable in the correct scope
      
      let overlayFilters: string[] = []
      
      visibleLogos.forEach((logo, index) => {
        const logoInputIndex = logoStartIndex + index

        // --- SIMPLIFIED 1:1 SCALE LOGIC ---
        // TextDesigner now uses video's real resolution, so coordinates map directly
        // We just need to account for any design-time scaling that was applied for display
        const finalX = Math.round(logo.x)
        const finalY = Math.round(logo.y)
        const finalW = Math.round(logo.pngWidth || 100)
        const finalH = Math.round(logo.pngHeight || 50)
        
        console.log(`📸 处理文字logo: "${logo.text}"`)
        console.log(`📐 画布尺寸与视频尺寸一致: ${originalResolution.width}x${originalResolution.height}`)
        console.log(`📍 最终位置:(${finalX}, ${finalY}), 最终尺寸: ${finalW}x${finalH}`)
        
        const prevOverlay = index === 0 ? baseVideo : `[ovr${index - 1}]`
        const currentOverlay = `[logo${index}]`
        const nextOverlay = `[ovr${index}]`
        
        overlayFilters.push(`[${logoInputIndex}:v]scale=${finalW}:${finalH}${currentOverlay}`)
        
        const outputName = (index === visibleLogos.length - 1) ? finalOutputName : nextOverlay
        overlayFilters.push(`${prevOverlay}${currentOverlay}overlay=${finalX}:${finalY}${outputName}`)
      })
      
      const allFilters = [...filterParts, ...overlayFilters].join(';')
      console.log('🎨 完整滤镜链:', allFilters)
      
      ffmpegCommand.push('-filter_complex', allFilters)
      ffmpegCommand.push('-map', finalOutputName)
      
      const audioMap = videoClips.length > 1 ? '[aconcat]' : '[a0]'
      ffmpegCommand.push('-map', audioMap)
        
      ;(ffmpegCommand as any).logoData = visibleLogos.map((logo, index) => ({
        fileName: `text_logo_${index}.png`,
        data: logo.pngData!
      }))
     } else {
       const finalVideo = videoClips.length > 1 ? '[vconcat]' : '[v0]'
       const finalAudio = videoClips.length > 1 ? '[aconcat]' : '[a0]'
       
       ffmpegCommand.push('-filter_complex', filterParts.join(';'))
       ffmpegCommand.push('-map', finalVideo)
       ffmpegCommand.push('-map', finalAudio)
     }
   } else {
     const finalVideo = videoClips.length > 1 ? '[vconcat]' : '[v0]'
     const finalAudio = videoClips.length > 1 ? '[aconcat]' : '[a0]'
     
     ffmpegCommand.push('-filter_complex', filterParts.join(';'))
     ffmpegCommand.push('-map', finalVideo)
     ffmpegCommand.push('-map', finalAudio)
   }

   // Add encoding parameters
   ffmpegCommand.push(
     '-c:v', 'libx264',
     '-preset', 'medium',
     '-b:v', `${bitrate}k`,
     '-pix_fmt', 'yuv420p',
     '-movflags', '+faststart'
   )

   // Add output path
   ffmpegCommand.push(outputPath)

   if (onProgress) onProgress(30)

   console.log('🚀 执行FFmpeg命令...')
   console.log('命令:', ffmpegCommand.join(' '))

   // Set up progress listener
   const progressListener = (progress: number) => {
     const adjustedProgress = 30 + (progress * 0.6) // 30-90%
     if (onProgress) onProgress(adjustedProgress)
   }

   // Register progress listener
   (window.electronAPI as any).onFFmpegProgress(progressListener)

   try {
     await (window.electronAPI as any).runFFmpeg({
       inputFiles: inputFiles,
       outputPath,
       command: ffmpegCommand,
       logoData: (ffmpegCommand as any).logoData // Pass PNG logo data
     })

     if (onProgress) onProgress(100)
     console.log('✅ 本地FFmpeg导出完成! 文件已保存到:', outputPath)
     console.log('🎯 输出格式: MP4')

   } catch (error) {
     console.error('❌ 本地FFmpeg导出失败:', error)
     throw error
   } finally {
     // Clean up progress listener
     ;(window.electronAPI as any).removeAllListeners('ffmpeg-progress')
   }
}

const getVideoResolution = async (mediaFile: MediaFile): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth || 1920,
        height: video.videoHeight || 1080
      })
      URL.revokeObjectURL(video.src)
    }
    
    video.onerror = () => {
      console.warn('无法获取视频分辨率，使用默认值')
      resolve({ width: 1920, height: 1080 })
      URL.revokeObjectURL(video.src)
    }
    
    if (mediaFile.url) {
      video.src = mediaFile.url
    } else if (mediaFile.path) {
      video.src = mediaFile.path
    } else {
      reject(new Error('媒体文件缺少URL或路径'))
    }
  })
}

// 移除了获取视频元数据的函数，简化代码
export const getVideoMetadata = async (file: File): Promise<{ duration: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration || 0
      })
      URL.revokeObjectURL(video.src)
    }
    
    video.onerror = () => {
      reject(new Error('无法加载视频元数据'))
      URL.revokeObjectURL(video.src)
    }
    
    video.src = URL.createObjectURL(file)
  })
}
