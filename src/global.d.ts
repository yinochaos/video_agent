// 全局类型声明
declare global {
  interface Window {
    electronAPI: {
      showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>
      showSaveDialog: () => Promise<{ canceled: boolean; filePath?: string }>
      checkFFmpeg: () => Promise<{ available: boolean; error?: string }>
      runFFmpeg: (options: {
        inputFiles: string[]
        outputPath: string
        command: string[]
        logoData?: Array<{ fileName: string; data: string }>
      }) => Promise<{ success: boolean; outputPath: string }>
      onFFmpegProgress: (callback: (progress: number) => void) => void
      removeAllListeners: (channel: string) => void
      onMenuImportMedia: (callback: () => void) => void
      onMenuExportVideo: (callback: () => void) => void
      writeFile: (options: { path: string, content: string }) => Promise<{ success: boolean; error?: string }>
      readFile: (path: string) => Promise<{ content?: string; success: boolean; error?: string }>
      readFileAsBuffer: (path: string) => Promise<{ buffer?: Buffer; success: boolean; error?: string }>
      log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void
      convertToMp3: (options: { inputPath: string, outputPath: string, onProgress?: (progress: number) => void }) => Promise<{ success: boolean; error?: string }>
    }
  }
}

export {}