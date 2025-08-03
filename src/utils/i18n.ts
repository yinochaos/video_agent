export const translations = {
  zh: {
    // Menu
    file: '文件',
    importMedia: '导入媒体',
    exportVideo: '导出视频',
    quit: '退出',
    edit: '编辑',
    view: '视图',
    
    // Asset Panel
    assetPanel: '素材库',
    dragFilesHere: '拖拽文件到此处或点击导入',
    importFiles: '导入文件',
    search: '搜索文件名...',
    deleteFile: '删除文件',
    showInFinder: '在 Finder 中显示',
    
    // Timeline
    timeline: '时间线',
    videoTrack: '视频轨道',
    audioTrack: '音频轨道',
    
    // Preview
    preview: '预览',
    play: '播放',
    pause: '暂停',
    previousFrame: '上一帧',
    nextFrame: '下一帧',
    loop: '循环',
    volume: '音量',
    mute: '静音',
    timecode: '时间码',
    speed: '播放速度',
    
    // Export
    export: '导出',
    exportSettings: '导出设置',
    resolution: '分辨率',
    format: 'MP4 (H.264 + AAC)',
    frameRate: '帧率',
    bitrate: '码率',
    outputPath: '输出路径',
    exportProgress: '导出进度',
    exporting: '正在导出...',
    exportComplete: '导出完成',
    cancel: '取消',
    
    // Common
    ok: '确定',
    close: '关闭',
    loading: '加载中...',
    error: '错误',
    warning: '警告',
    info: '信息',
    
    // Units
    seconds: '秒',
    minutes: '分钟',
    hours: '小时',
    fps: 'fps',
    kbps: 'kbps',
    mbps: 'Mbps'
  },
  
  en: {
    // Menu
    file: 'File',
    importMedia: 'Import Media',
    exportVideo: 'Export Video',
    quit: 'Quit',
    edit: 'Edit',
    view: 'View',
    
    // Asset Panel
    assetPanel: 'Asset Panel',
    dragFilesHere: 'Drag files here or click to import',
    importFiles: 'Import Files',
    search: 'Search filenames...',
    deleteFile: 'Delete File',
    showInFinder: 'Show in Finder',
    
    // Timeline
    timeline: 'Timeline',
    videoTrack: 'Video Track',
    audioTrack: 'Audio Track',
    
    // Preview
    preview: 'Preview',
    play: 'Play',
    pause: 'Pause',
    previousFrame: 'Previous Frame',
    nextFrame: 'Next Frame',
    loop: 'Loop',
    volume: 'Volume',
    mute: 'Mute',
    timecode: 'Timecode',
    speed: 'Speed',
    
    // Export
    export: 'Export',
    exportSettings: 'Export Settings',
    resolution: 'Resolution',
    format: 'MP4 (H.264 + AAC)',
    frameRate: 'Frame Rate',
    bitrate: 'Bitrate',
    outputPath: 'Output Path',
    exportProgress: 'Export Progress',
    exporting: 'Exporting...',
    exportComplete: 'Export Complete',
    cancel: 'Cancel',
    
    // Common
    ok: 'OK',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    
    // Units
    seconds: 'seconds',
    minutes: 'minutes',
    hours: 'hours',
    fps: 'fps',
    kbps: 'kbps',
    mbps: 'Mbps'
  }
}

export type Language = 'zh' | 'en'
export type TranslationKey = keyof typeof translations.zh

export const t = (key: TranslationKey, language: Language = 'zh'): string => {
  return translations[language][key] || key
} 