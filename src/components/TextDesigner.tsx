import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as fabric from 'fabric'
import { X, Save, Trash2, RotateCcw } from 'lucide-react'
import { useEditorStore } from '../store/useEditorStore'

const TextDesigner: React.FC = () => {
  const {
    showTextDesigner,
    textLogos,
    tracks,
    mediaFiles,
    setShowTextDesigner,
    addTextLogo,
    updateTextLogo,
    removeTextLogo,
    clearTextLogos
  } = useEditorStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const [selectedTextLogo, setSelectedTextLogo] = useState<string | null>(null)
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null)
  const [videoSize, setVideoSize] = useState({ width: 1920, height: 1080 })
  const [canvasScale, setCanvasScale] = useState(1)

  // Text properties
  const [textProperties, setTextProperties] = useState({
    text: 'Sample Text',
    fontFamily: 'Arial',
    fontSize: 48,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#ffffff',
    backgroundColor: '',
    borderColor: '',
    borderWidth: 0,
    opacity: 1,
    shadowColor: '#000000',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    // 新增特效属性
    glowColor: '#00ff00',
    glowIntensity: 0,
    outerGlow: false,
    innerGlow: false,
    gradientEnabled: false,
    gradientColor1: '#ffffff',
    gradientColor2: '#ff0000',
    gradientDirection: 'horizontal',
    embossEnabled: false,
    embossDepth: 2,
    outlineEnabled: false,
    outlineColor: '#000000',
    outlineWidth: 2
  })

  // Get video dimensions from first video
  const getVideoDimensions = useCallback(async (): Promise<{ width: number; height: number }> => {
    const firstVideoTrack = tracks.find(track => track.type === 'video')
    if (!firstVideoTrack || firstVideoTrack.clips.length === 0) {
      return { width: 1920, height: 1080 } // Default fallback to common resolution
    }

    const firstClip = firstVideoTrack.clips[0]
    const mediaFile = mediaFiles.find(f => f.id === firstClip.mediaFileId)
    if (!mediaFile?.url) {
      return { width: 1920, height: 1080 }
    }

    try {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.crossOrigin = 'anonymous'
        video.src = mediaFile.url || ''
        
        video.onloadedmetadata = () => {
          const width = video.videoWidth || 1920
          const height = video.videoHeight || 1080
          console.log(`📐 TextDesigner获取到视频真实分辨率: ${width}x${height}`)
          resolve({ width, height })
        }
        
        video.onerror = () => reject(new Error('Failed to load video'))
      })
    } catch (error) {
      console.error('Error getting video dimensions:', error)
      return { width: 1920, height: 1080 }
    }
  }, [tracks, mediaFiles])

  // Load background image from first video frame
  const loadBackgroundImage = useCallback(async (videoWidth: number, videoHeight: number, scale: number) => {
    const firstVideoTrack = tracks.find(track => track.type === 'video')
    if (!firstVideoTrack || firstVideoTrack.clips.length === 0) return

    const firstClip = firstVideoTrack.clips[0]
    const mediaFile = mediaFiles.find(f => f.id === firstClip.mediaFileId)
    if (!mediaFile?.url) return

    try {
      // Create a temporary video element to capture first frame
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.src = mediaFile.url
      
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => {
          video.currentTime = firstClip.inPoint
        }
        
        video.onseeked = () => {
          // Create canvas to capture frame
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = videoWidth
          tempCanvas.height = videoHeight
          const ctx = tempCanvas.getContext('2d')
          
          if (ctx) {
            ctx.drawImage(video, 0, 0, videoWidth, videoHeight)
            const dataURL = tempCanvas.toDataURL()
            setBackgroundImage(dataURL)
            
            // Set as fabric canvas background
            if (fabricCanvasRef.current) {
              fabric.Image.fromURL(dataURL, {
                crossOrigin: 'anonymous'
              }).then((img) => {
                // Scale the background image to fit the canvas
                img.scaleToWidth(videoWidth * scale)
                img.scaleToHeight(videoHeight * scale)
                if (fabricCanvasRef.current) {
                  fabricCanvasRef.current.backgroundImage = img
                  fabricCanvasRef.current.renderAll()
                }
              })
            }
          }
          resolve()
        }
        
        video.onerror = reject
      })
    } catch (error) {
      console.error('Error loading background image:', error)
    }
  }, [tracks, mediaFiles])

  // Load existing text logos into canvas
  const loadExistingTextLogos = useCallback((scale: number) => {
    if (!fabricCanvasRef.current || textLogos.length === 0) return

    textLogos.forEach(logo => {
      if (!logo.visible) return

      // Convert video coordinates to canvas coordinates
      const left = logo.x * scale
      const top = logo.y * scale
      const fontSize = logo.fontSize * scale
      const strokeWidth = (logo.borderWidth || 0) * scale
      const outlineWidth = (logo.outlineWidth || 0) * scale

             // Create text fill
       let textFill: string | any = logo.color
      if (logo.gradientEnabled && logo.gradientColor1 && logo.gradientColor2) {
        if (logo.gradientDirection === 'horizontal') {
          textFill = new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: fontSize * 4, y2: 0 },
            colorStops: [
              { offset: 0, color: logo.gradientColor1 },
              { offset: 1, color: logo.gradientColor2 }
            ]
          })
        } else if (logo.gradientDirection === 'radial') {
          textFill = new fabric.Gradient({
            type: 'radial',
            coords: { x1: fontSize * 2, y1: fontSize * 2, x2: fontSize * 2, y2: fontSize * 2, r1: 0, r2: fontSize * 2 },
            colorStops: [
              { offset: 0, color: logo.gradientColor1 },
              { offset: 1, color: logo.gradientColor2 }
            ]
          })
        } else {
          textFill = new fabric.Gradient({
            type: 'linear',
            coords: { x1: 0, y1: 0, x2: 0, y2: fontSize * 2 },
            colorStops: [
              { offset: 0, color: logo.gradientColor1 },
              { offset: 1, color: logo.gradientColor2 }
            ]
          })
        }
      }

      // Create shadow effect
      let shadowEffect: fabric.Shadow | undefined
      if (logo.outerGlow && logo.glowIntensity && logo.glowIntensity > 0) {
        shadowEffect = new fabric.Shadow({
          color: logo.glowColor || '#00ff00',
          blur: logo.glowIntensity * scale,
          offsetX: 0,
          offsetY: 0
        })
      } else if (logo.shadowBlur && logo.shadowBlur > 0) {
        shadowEffect = new fabric.Shadow({
          color: logo.shadowColor || '#000000',
          blur: logo.shadowBlur * scale,
          offsetX: (logo.shadowOffsetX || 0) * scale,
          offsetY: (logo.shadowOffsetY || 0) * scale
        })
      }

      // Determine stroke properties
      let strokeColor = logo.borderColor
      let finalStrokeWidth = strokeWidth
      if (logo.outlineEnabled && logo.outlineColor) {
        strokeColor = logo.outlineColor
        finalStrokeWidth = outlineWidth
      }

      const textbox = new fabric.Textbox(logo.text, {
        left,
        top,
        fontSize,
        fontFamily: logo.fontFamily,
        fontWeight: logo.fontWeight,
        fontStyle: logo.fontStyle,
        fill: textFill,
        backgroundColor: logo.backgroundColor || undefined,
        stroke: strokeColor || undefined,
        strokeWidth: finalStrokeWidth,
        opacity: logo.opacity,
        angle: logo.rotation,
        shadow: shadowEffect
      })

      // 保存特效属性到textbox的自定义数据中
      ;(textbox as any).customData = {
        glowColor: logo.glowColor,
        glowIntensity: logo.glowIntensity,
        outerGlow: logo.outerGlow,
        gradientEnabled: logo.gradientEnabled,
        gradientColor1: logo.gradientColor1,
        gradientColor2: logo.gradientColor2,
        gradientDirection: logo.gradientDirection,
        embossEnabled: logo.embossEnabled,
        outlineEnabled: logo.outlineEnabled,
        outlineColor: logo.outlineColor,
        outlineWidth: logo.outlineWidth
      }

      // 添加浮雕效果
      if (logo.embossEnabled) {
        textbox.set({
          paintFirst: 'stroke',
          strokeLineCap: 'round',
          strokeLineJoin: 'round'
        })
      }

      fabricCanvasRef.current?.add(textbox)
    })

    fabricCanvasRef.current?.renderAll()
  }, [textLogos])

  // Initialize fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !showTextDesigner) return

    // Get video dimensions first
    getVideoDimensions().then(({ width, height }) => {
      setVideoSize({ width, height })
      
      // Calculate scale to fit in design window (max 800x600)
      const maxWidth = 800
      const maxHeight = 600
      const scaleX = maxWidth / width
      const scaleY = maxHeight / height
      const scale = Math.min(scaleX, scaleY, 1) // Don't scale up
      setCanvasScale(scale)
      
      const displayWidth = width * scale
      const displayHeight = height * scale

      // Create fabric canvas with video dimensions
      if (canvasRef.current) {
        const canvas = new fabric.Canvas(canvasRef.current, {
          width: displayWidth,
          height: displayHeight,
          backgroundColor: '#000000',
          preserveObjectStacking: true,
          renderOnAddRemove: true,
          stateful: true,
          selection: true,
          hoverCursor: 'move',
          moveCursor: 'move'
        })

        // 确保canvas容器正确设置
        const canvasWrapper = canvasRef.current.parentElement
        if (canvasWrapper) {
          canvasWrapper.style.width = `${displayWidth}px`
          canvasWrapper.style.height = `${displayHeight}px`
          canvasWrapper.style.position = 'relative'
        }

        // 手动调整lower-canvas和upper-canvas的对齐
        setTimeout(() => {
          const lowerCanvas = canvas.lowerCanvasEl
          const upperCanvas = canvas.upperCanvasEl
          
          if (lowerCanvas && upperCanvas) {
            // 确保两个canvas的尺寸和位置完全一致
            const canvasStyle = {
              position: 'absolute',
              top: '0px',
              left: '0px',
              width: `${displayWidth}px`,
              height: `${displayHeight}px`
            }
            
            Object.assign(lowerCanvas.style, canvasStyle)
            Object.assign(upperCanvas.style, canvasStyle)
            
            console.log('Canvas alignment fixed:', {
              lowerCanvas: { width: lowerCanvas.style.width, height: lowerCanvas.style.height },
              upperCanvas: { width: upperCanvas.style.width, height: upperCanvas.style.height }
            })
          }
        }, 100)

        fabricCanvasRef.current = canvas

        // 强制重新计算canvas尺寸
        canvas.calcOffset()
        canvas.renderAll()

        // Handle object selection
        canvas.on('selection:created', (e) => {
          const activeObject = e.selected?.[0]
          if (activeObject && activeObject.type === 'textbox') {
            const textbox = activeObject as fabric.Textbox
            
            // 尝试从textbox的自定义数据中恢复特效属性
            const customData = (textbox as any).customData || {}
            
            setTextProperties({
              text: textbox.text || '',
              fontFamily: textbox.fontFamily || 'Arial',
              fontSize: (textbox.fontSize || 48) / canvasScale,
              fontWeight: textbox.fontWeight?.toString() || 'normal',
              fontStyle: textbox.fontStyle || 'normal',
              color: textbox.fill?.toString() || '#ffffff',
              backgroundColor: textbox.backgroundColor || '',
              borderColor: textbox.stroke?.toString() || '',
              borderWidth: (textbox.strokeWidth || 0) / canvasScale,
              opacity: textbox.opacity || 1,
              shadowColor: textbox.shadow?.color || '#000000',
              shadowBlur: (textbox.shadow?.blur || 0) / canvasScale,
              shadowOffsetX: (textbox.shadow?.offsetX || 0) / canvasScale,
              shadowOffsetY: (textbox.shadow?.offsetY || 0) / canvasScale,
              // 从自定义数据中恢复特效属性
              glowColor: customData.glowColor || '#00ff00',
              glowIntensity: customData.glowIntensity || 0,
              outerGlow: customData.outerGlow || false,
              innerGlow: customData.innerGlow || false,
              gradientEnabled: customData.gradientEnabled || false,
              gradientColor1: customData.gradientColor1 || '#ffffff',
              gradientColor2: customData.gradientColor2 || '#ff0000',
              gradientDirection: customData.gradientDirection || 'horizontal',
              embossEnabled: customData.embossEnabled || false,
              embossDepth: customData.embossDepth || 2,
              outlineEnabled: customData.outlineEnabled || false,
              outlineColor: customData.outlineColor || '#000000',
              outlineWidth: customData.outlineWidth || 2
            })
          }
        })

        canvas.on('selection:cleared', () => {
          setSelectedTextLogo(null)
        })

        // Load background image (first frame of first video)
        loadBackgroundImage(width, height, scale)
        
        // 重新载入已有的textLogos
        loadExistingTextLogos(scale)
      }
    })

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose()
        fabricCanvasRef.current = null
      }
    }
  }, [showTextDesigner, getVideoDimensions, loadBackgroundImage, loadExistingTextLogos])

  // Create text fill with effects
  const createTextFill = useCallback((color: string, fontSize: number) => {
    if (textProperties.gradientEnabled) {
      // 简化渐变实现，避免类型错误
      if (textProperties.gradientDirection === 'horizontal') {
        return new fabric.Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: fontSize * 4, y2: 0 },
          colorStops: [
            { offset: 0, color: textProperties.gradientColor1 },
            { offset: 1, color: textProperties.gradientColor2 }
          ]
        })
      } else if (textProperties.gradientDirection === 'radial') {
        return new fabric.Gradient({
          type: 'radial',
          coords: { x1: fontSize * 2, y1: fontSize * 2, x2: fontSize * 2, y2: fontSize * 2, r1: 0, r2: fontSize * 2 },
          colorStops: [
            { offset: 0, color: textProperties.gradientColor1 },
            { offset: 1, color: textProperties.gradientColor2 }
          ]
        })
      } else {
        // vertical
        return new fabric.Gradient({
          type: 'linear',
          coords: { x1: 0, y1: 0, x2: 0, y2: fontSize * 2 },
          colorStops: [
            { offset: 0, color: textProperties.gradientColor1 },
            { offset: 1, color: textProperties.gradientColor2 }
          ]
        })
      }
    }
    return color
  }, [textProperties.gradientEnabled, textProperties.gradientDirection, textProperties.gradientColor1, textProperties.gradientColor2])

  // Create shadow with glow effects
  const createShadowEffect = useCallback(() => {
    const shadows: fabric.Shadow[] = []
    
    // 基础阴影
    if (textProperties.shadowBlur > 0) {
      shadows.push(new fabric.Shadow({
        color: textProperties.shadowColor,
        blur: textProperties.shadowBlur * canvasScale,
        offsetX: textProperties.shadowOffsetX * canvasScale,
        offsetY: textProperties.shadowOffsetY * canvasScale
      }))
    }
    
    // 外发光效果
    if (textProperties.outerGlow && textProperties.glowIntensity > 0) {
      shadows.push(new fabric.Shadow({
        color: textProperties.glowColor,
        blur: textProperties.glowIntensity * canvasScale,
        offsetX: 0,
        offsetY: 0
      }))
    }
    
    return shadows.length > 0 ? shadows[shadows.length - 1] : undefined
  }, [textProperties.shadowBlur, textProperties.shadowColor, textProperties.shadowOffsetX, textProperties.shadowOffsetY, textProperties.outerGlow, textProperties.glowIntensity, textProperties.glowColor, canvasScale])

  // Add new text
  const handleAddText = useCallback(() => {
    if (!fabricCanvasRef.current) return

    // Calculate position relative to canvas scale
    const left = 100 * canvasScale
    const top = 100 * canvasScale
    const width = 300 * canvasScale
    const fontSize = textProperties.fontSize * canvasScale

    // Create text fill (gradient or solid color)
    const textFill = createTextFill(textProperties.color, fontSize)
    
    // Calculate stroke for outline effect
    let strokeColor = textProperties.borderColor
    let strokeWidth = textProperties.borderWidth * canvasScale
    
    if (textProperties.outlineEnabled) {
      strokeColor = textProperties.outlineColor
      strokeWidth = textProperties.outlineWidth * canvasScale
    }

    const textbox = new fabric.Textbox(textProperties.text, {
      left,
      top,
      width,
      fontSize,
      fontFamily: textProperties.fontFamily,
      fontWeight: textProperties.fontWeight,
      fontStyle: textProperties.fontStyle,
      fill: textFill,
      backgroundColor: textProperties.backgroundColor || undefined,
      stroke: strokeColor || undefined,
      strokeWidth: strokeWidth,
      opacity: textProperties.opacity,
      shadow: createShadowEffect()
    })

    // 保存特效属性到textbox的自定义数据中
    ;(textbox as any).customData = {
      glowColor: textProperties.glowColor,
      glowIntensity: textProperties.glowIntensity,
      outerGlow: textProperties.outerGlow,
      innerGlow: textProperties.innerGlow,
      gradientEnabled: textProperties.gradientEnabled,
      gradientColor1: textProperties.gradientColor1,
      gradientColor2: textProperties.gradientColor2,
      gradientDirection: textProperties.gradientDirection,
      embossEnabled: textProperties.embossEnabled,
      embossDepth: textProperties.embossDepth,
      outlineEnabled: textProperties.outlineEnabled,
      outlineColor: textProperties.outlineColor,
      outlineWidth: textProperties.outlineWidth
    }

    // 添加浮雕效果
    if (textProperties.embossEnabled) {
      textbox.set({
        paintFirst: 'stroke',
        strokeLineCap: 'round',
        strokeLineJoin: 'round'
      })
    }

    fabricCanvasRef.current.add(textbox)
    fabricCanvasRef.current.setActiveObject(textbox)
    fabricCanvasRef.current.renderAll()
  }, [textProperties, canvasScale, createTextFill, createShadowEffect])

  // Update selected text properties
  const updateSelectedText = useCallback(() => {
    if (!fabricCanvasRef.current) return
    
    const activeObject = fabricCanvasRef.current.getActiveObject()
    if (!activeObject || activeObject.type !== 'textbox') return

    const textbox = activeObject as fabric.Textbox
    const fontSize = textProperties.fontSize * canvasScale
    
    // Create text fill (gradient or solid color)
    const textFill = createTextFill(textProperties.color, fontSize)
    
    // Calculate stroke for outline effect
    let strokeColor = textProperties.borderColor
    let strokeWidth = textProperties.borderWidth * canvasScale
    
    if (textProperties.outlineEnabled) {
      strokeColor = textProperties.outlineColor
      strokeWidth = textProperties.outlineWidth * canvasScale
    }
    
    textbox.set({
      text: textProperties.text,
      fontSize: fontSize,
      fontFamily: textProperties.fontFamily,
      fontWeight: textProperties.fontWeight,
      fontStyle: textProperties.fontStyle,
      fill: textFill,
      backgroundColor: textProperties.backgroundColor || undefined,
      stroke: strokeColor || undefined,
      strokeWidth: strokeWidth,
      opacity: textProperties.opacity,
      shadow: createShadowEffect()
    })

    // 更新自定义数据
    ;(textbox as any).customData = {
      glowColor: textProperties.glowColor,
      glowIntensity: textProperties.glowIntensity,
      outerGlow: textProperties.outerGlow,
      innerGlow: textProperties.innerGlow,
      gradientEnabled: textProperties.gradientEnabled,
      gradientColor1: textProperties.gradientColor1,
      gradientColor2: textProperties.gradientColor2,
      gradientDirection: textProperties.gradientDirection,
      embossEnabled: textProperties.embossEnabled,
      embossDepth: textProperties.embossDepth,
      outlineEnabled: textProperties.outlineEnabled,
      outlineColor: textProperties.outlineColor,
      outlineWidth: textProperties.outlineWidth
    }

    // 添加浮雕效果
    if (textProperties.embossEnabled) {
      textbox.set({
        paintFirst: 'stroke',
        strokeLineCap: 'round',
        strokeLineJoin: 'round'
      })
    }

    fabricCanvasRef.current.renderAll()
  }, [textProperties, canvasScale, createTextFill, createShadowEffect])

  // Save text logo
  const handleSave = useCallback(() => {
    if (!fabricCanvasRef.current) return

    const objects = fabricCanvasRef.current.getObjects()
    
    // Clear existing logos and save new ones
    clearTextLogos()
    
    objects.forEach((obj) => {
      if (obj.type === 'textbox') {
        const textbox = obj as fabric.Textbox
        const customData = (textbox as any).customData || {}
        
        // 生成单个文字对象的PNG数据
        const generateTextPNG = () => {
          try {
            // 创建临时canvas来渲染单个文字对象
            const tempCanvas = document.createElement('canvas')
            const bounds = textbox.getBoundingRect()
            const padding = 20 // 添加一些边距
            
            tempCanvas.width = Math.max(bounds.width + padding * 2, 100)
            tempCanvas.height = Math.max(bounds.height + padding * 2, 50)
            
            const tempCtx = tempCanvas.getContext('2d')
            if (!tempCtx) return null
            
            // 清空背景（透明）
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
            
            // 保存当前状态
            tempCtx.save()
            
            // 移动到中心位置
            tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2)
            
            // 应用旋转
            if (textbox.angle) {
              tempCtx.rotate((textbox.angle * Math.PI) / 180)
            }
            
            // 设置文字样式
            const fontSize = textbox.fontSize || 20
            tempCtx.font = `${textbox.fontStyle || 'normal'} ${textbox.fontWeight || 'normal'} ${fontSize}px ${textbox.fontFamily || 'Arial'}`
            tempCtx.textAlign = 'center'
            tempCtx.textBaseline = 'middle'
            tempCtx.globalAlpha = textbox.opacity || 1
            
            const text = textbox.text || ''
            
            // 绘制发光效果
            if (customData.outerGlow && customData.glowColor && customData.glowIntensity > 0) {
              tempCtx.shadowColor = customData.glowColor
              tempCtx.shadowBlur = customData.glowIntensity
              tempCtx.shadowOffsetX = 0
              tempCtx.shadowOffsetY = 0
              
              // 绘制多层发光
              for (let i = 0; i < 3; i++) {
                tempCtx.fillStyle = typeof textbox.fill === 'string' ? textbox.fill : '#ffffff'
                tempCtx.fillText(text, 0, 0)
              }
              
              // 重置阴影
              tempCtx.shadowColor = 'transparent'
              tempCtx.shadowBlur = 0
            }
            
            // 绘制轮廓
            if (customData.outlineEnabled && customData.outlineColor && customData.outlineWidth > 0) {
              tempCtx.strokeStyle = customData.outlineColor
              tempCtx.lineWidth = customData.outlineWidth
              tempCtx.strokeText(text, 0, 0)
            }
            
            // 绘制主文字（处理渐变）
            if (customData.gradientEnabled && customData.gradientColor1 && customData.gradientColor2) {
              const textMetrics = tempCtx.measureText(text)
              let gradient: CanvasGradient
              
              if (customData.gradientDirection === 'horizontal') {
                gradient = tempCtx.createLinearGradient(-textMetrics.width/2, 0, textMetrics.width/2, 0)
              } else if (customData.gradientDirection === 'radial') {
                gradient = tempCtx.createRadialGradient(0, 0, 0, 0, 0, Math.max(textMetrics.width, fontSize) / 2)
              } else {
                // vertical
                gradient = tempCtx.createLinearGradient(0, -fontSize/2, 0, fontSize/2)
              }
              
              gradient.addColorStop(0, customData.gradientColor1)
              gradient.addColorStop(1, customData.gradientColor2)
              tempCtx.fillStyle = gradient
            } else {
              tempCtx.fillStyle = typeof textbox.fill === 'string' ? textbox.fill : '#ffffff'
            }
            
            tempCtx.fillText(text, 0, 0)
            
            // 恢复状态
            tempCtx.restore()
            
            return {
              dataURL: tempCanvas.toDataURL('image/png'),
              width: tempCanvas.width,
              height: tempCanvas.height
            }
          } catch (error) {
            console.error('生成文字PNG失败:', error)
            return null
          }
        }
        
        const pngData = generateTextPNG()
        console.log(`🖼️ 生成PNG: "${textbox.text}" 尺寸: ${pngData?.width}x${pngData?.height}`)
        
                 addTextLogo({
          text: textbox.text || '',
                     x: (textbox.left || 0) / canvasScale,
           y: (textbox.top || 0) / canvasScale,
           fontSize: (textbox.fontSize || 20) / canvasScale,
          fontFamily: textbox.fontFamily || 'Arial',
          fontWeight: textbox.fontWeight?.toString() || 'normal',
          fontStyle: textbox.fontStyle || 'normal',
          color: (typeof textbox.fill === 'string' ? textbox.fill : '#ffffff') || '#ffffff',
          opacity: textbox.opacity || 1,
          rotation: textbox.angle || 0,
          visible: textbox.visible !== false,
          borderColor: (typeof textbox.stroke === 'string' ? textbox.stroke : undefined),
          borderWidth: textbox.strokeWidth || 0,
          shadowColor: textbox.shadow?.color?.toString(),
          shadowBlur: textbox.shadow?.blur,
          shadowOffsetX: textbox.shadow?.offsetX,
          shadowOffsetY: textbox.shadow?.offsetY,
          glowColor: customData.glowColor,
          glowIntensity: customData.glowIntensity,
                     outerGlow: customData.outerGlow,
           gradientEnabled: customData.gradientEnabled,
          gradientColor1: customData.gradientColor1,
          gradientColor2: customData.gradientColor2,
          gradientDirection: customData.gradientDirection,
                     embossEnabled: customData.embossEnabled,
           outlineEnabled: customData.outlineEnabled,
          outlineColor: customData.outlineColor,
          outlineWidth: customData.outlineWidth,
          // 保存PNG数据 (尺寸需要考虑设计时的缩放)
          pngData: pngData?.dataURL,
          pngWidth: pngData ? Math.round(pngData.width / canvasScale) : undefined,
          pngHeight: pngData ? Math.round(pngData.height / canvasScale) : undefined
        })
      }
    })

    console.log('💾 文字logo已保存 (包含PNG数据)')
    setShowTextDesigner(false)
     }, [canvasScale, addTextLogo, clearTextLogos, setShowTextDesigner])

  // Delete selected text
  const handleDelete = useCallback(() => {
    if (!fabricCanvasRef.current) return
    
    const activeObject = fabricCanvasRef.current.getActiveObject()
    if (activeObject) {
      fabricCanvasRef.current.remove(activeObject)
      fabricCanvasRef.current.renderAll()
    }
  }, [])

  // Clear all text
  const handleClear = useCallback(() => {
    if (!fabricCanvasRef.current) return
    
    const objects = fabricCanvasRef.current.getObjects().filter(obj => obj.type === 'textbox')
    objects.forEach(obj => fabricCanvasRef.current?.remove(obj))
    fabricCanvasRef.current.renderAll()
  }, [])

  if (!showTextDesigner) return null

  return (
    <div className="text-designer-overlay">
      <div className="text-designer-container">
        <div className="text-designer-header">
          <h3>花字设计器</h3>
          <button className="close-btn" onClick={() => setShowTextDesigner(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="text-designer-content">
          <div className="canvas-container">
            <div className="canvas-wrapper">
              <canvas ref={canvasRef} />
            </div>
          </div>

          <div className="text-designer-controls">
            <div className="control-section">
              <h4>文字内容</h4>
              <input
                type="text"
                value={textProperties.text}
                onChange={(e) => setTextProperties(prev => ({ ...prev, text: e.target.value }))}
                placeholder="输入文字内容"
              />
              <button onClick={handleAddText} className="add-text-btn">添加文字</button>
              <div className="canvas-info">
                <small>画布尺寸: {videoSize.width} × {videoSize.height}</small>
                <small>缩放比例: {(canvasScale * 100).toFixed(0)}%</small>
              </div>
            </div>

            <div className="control-section">
              <h4>字体设置</h4>
              <div className="control-row">
                <label>
                  字体:
                  <select 
                    value={textProperties.fontFamily}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, fontFamily: e.target.value }))}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Impact">Impact</option>
                    <option value="Comic Sans MS">Comic Sans MS</option>
                  </select>
                </label>
                <label>
                  大小:
                  <input
                    type="number"
                    value={textProperties.fontSize}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                    min="12"
                    max="200"
                  />
                </label>
              </div>
              <div className="control-row">
                <label>
                  粗细:
                  <select
                    value={textProperties.fontWeight}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, fontWeight: e.target.value }))}
                  >
                    <option value="normal">正常</option>
                    <option value="bold">粗体</option>
                  </select>
                </label>
                <label>
                  样式:
                  <select
                    value={textProperties.fontStyle}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, fontStyle: e.target.value }))}
                  >
                    <option value="normal">正常</option>
                    <option value="italic">斜体</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="control-section">
              <h4>颜色设置</h4>
              <div className="control-row">
                <label>
                  文字颜色:
                  <input
                    type="color"
                    value={textProperties.color}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, color: e.target.value }))}
                  />
                </label>
                <label>
                  背景颜色:
                  <input
                    type="color"
                    value={textProperties.backgroundColor}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, backgroundColor: e.target.value }))}
                  />
                </label>
              </div>
              <div className="control-row">
                <label>
                  边框颜色:
                  <input
                    type="color"
                    value={textProperties.borderColor}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, borderColor: e.target.value }))}
                  />
                </label>
                <label>
                  边框宽度:
                  <input
                    type="number"
                    value={textProperties.borderWidth}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, borderWidth: parseInt(e.target.value) }))}
                    min="0"
                    max="10"
                  />
                </label>
              </div>
            </div>

            <div className="control-section">
              <h4>效果设置</h4>
              <div className="control-row">
                <label>
                  透明度:
                  <input
                    type="range"
                    value={textProperties.opacity}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                    min="0"
                    max="1"
                    step="0.1"
                  />
                </label>
              </div>
              <div className="control-row">
                <label>
                  阴影颜色:
                  <input
                    type="color"
                    value={textProperties.shadowColor}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, shadowColor: e.target.value }))}
                  />
                </label>
                <label>
                  阴影模糊:
                  <input
                    type="number"
                    value={textProperties.shadowBlur}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, shadowBlur: parseInt(e.target.value) }))}
                    min="0"
                    max="20"
                  />
                </label>
              </div>
            </div>

            <div className="control-section">
              <h4>发光效果</h4>
              <div className="control-row">
                <label>
                  外发光:
                  <input
                    type="checkbox"
                    checked={textProperties.outerGlow}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, outerGlow: e.target.checked }))}
                  />
                </label>
                <label>
                  发光颜色:
                  <input
                    type="color"
                    value={textProperties.glowColor}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, glowColor: e.target.value }))}
                  />
                </label>
              </div>
              <div className="control-row">
                <label>
                  发光强度:
                  <input
                    type="range"
                    value={textProperties.glowIntensity}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, glowIntensity: parseInt(e.target.value) }))}
                    min="0"
                    max="50"
                  />
                  <span>{textProperties.glowIntensity}</span>
                </label>
              </div>
            </div>

            <div className="control-section">
              <h4>渐变效果</h4>
              <div className="control-row">
                <label>
                  启用渐变:
                  <input
                    type="checkbox"
                    checked={textProperties.gradientEnabled}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, gradientEnabled: e.target.checked }))}
                  />
                </label>
                <label>
                  渐变方向:
                  <select
                    value={textProperties.gradientDirection}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, gradientDirection: e.target.value }))}
                    disabled={!textProperties.gradientEnabled}
                  >
                    <option value="horizontal">水平</option>
                    <option value="vertical">垂直</option>
                    <option value="radial">径向</option>
                  </select>
                </label>
              </div>
              <div className="control-row">
                <label>
                  起始颜色:
                  <input
                    type="color"
                    value={textProperties.gradientColor1}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, gradientColor1: e.target.value }))}
                    disabled={!textProperties.gradientEnabled}
                  />
                </label>
                <label>
                  结束颜色:
                  <input
                    type="color"
                    value={textProperties.gradientColor2}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, gradientColor2: e.target.value }))}
                    disabled={!textProperties.gradientEnabled}
                  />
                </label>
              </div>
            </div>

            <div className="control-section">
              <h4>轮廓效果</h4>
              <div className="control-row">
                <label>
                  启用轮廓:
                  <input
                    type="checkbox"
                    checked={textProperties.outlineEnabled}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, outlineEnabled: e.target.checked }))}
                  />
                </label>
                <label>
                  轮廓颜色:
                  <input
                    type="color"
                    value={textProperties.outlineColor}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, outlineColor: e.target.value }))}
                    disabled={!textProperties.outlineEnabled}
                  />
                </label>
              </div>
              <div className="control-row">
                <label>
                  轮廓宽度:
                  <input
                    type="number"
                    value={textProperties.outlineWidth}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, outlineWidth: parseInt(e.target.value) }))}
                    min="1"
                    max="10"
                    disabled={!textProperties.outlineEnabled}
                  />
                </label>
                <label>
                  浮雕效果:
                  <input
                    type="checkbox"
                    checked={textProperties.embossEnabled}
                    onChange={(e) => setTextProperties(prev => ({ ...prev, embossEnabled: e.target.checked }))}
                  />
                </label>
              </div>
            </div>

            <div className="control-section">
              <h4>快速预设</h4>
              <div className="preset-buttons">
                <button 
                  onClick={() => setTextProperties(prev => ({
                    ...prev,
                    outerGlow: true,
                    glowColor: '#00ff00',
                    glowIntensity: 15,
                    shadowBlur: 0
                  }))}
                  className="preset-btn"
                >
                  霓虹发光
                </button>
                <button 
                  onClick={() => setTextProperties(prev => ({
                    ...prev,
                    gradientEnabled: true,
                    gradientColor1: '#ffd700',
                    gradientColor2: '#ff4500',
                    gradientDirection: 'horizontal'
                  }))}
                  className="preset-btn"
                >
                  金色渐变
                </button>
                <button 
                  onClick={() => setTextProperties(prev => ({
                    ...prev,
                    outlineEnabled: true,
                    outlineColor: '#000000',
                    outlineWidth: 3,
                    embossEnabled: true
                  }))}
                  className="preset-btn"
                >
                  3D浮雕
                </button>
                <button 
                  onClick={() => setTextProperties(prev => ({
                    ...prev,
                    shadowBlur: 8,
                    shadowColor: '#ff0000',
                    shadowOffsetX: 3,
                    shadowOffsetY: 3,
                    outerGlow: true,
                    glowColor: '#ff0000',
                    glowIntensity: 10
                  }))}
                  className="preset-btn"
                >
                  火焰效果
                </button>
              </div>
            </div>

            <div className="control-section">
              <button onClick={updateSelectedText} className="update-btn">更新选中文字</button>
              <div className="action-buttons">
                <button onClick={handleDelete} className="delete-btn">
                  <Trash2 size={16} />
                  删除选中
                </button>
                <button onClick={handleClear} className="clear-btn">
                  <RotateCcw size={16} />
                  清空全部
                </button>
                <button onClick={handleSave} className="save-btn">
                  <Save size={16} />
                  保存并应用
                </button>
              </div>
              <div className="canvas-info">
                <small>提示: 再次打开设计器会载入已保存的文字</small>
                <small>选中文字可编辑其属性和特效</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TextDesigner 