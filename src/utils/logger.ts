interface ElectronLogAPI {
  log: (level: 'info' | 'warn' | 'error' | 'debug', message: string) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronLogAPI;
  }
}

const logger = {
  info: (message: string) => {
    window.electronAPI?.log('info', message);
    console.log(message); // Also log to renderer console
  },
  warn: (message: string) => {
    window.electronAPI?.log('warn', message);
    console.warn(message);
  },
  error: (message: string) => {
    window.electronAPI?.log('error', message);
    console.error(message);
  },
  debug: (message: string) => {
    window.electronAPI?.log('debug', message);
    console.debug(message);
  },
};

export default logger;