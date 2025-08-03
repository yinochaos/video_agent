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
      writeFile?: (path: string, data: Uint8Array) => Promise<void>
    }
  }
}

export {}