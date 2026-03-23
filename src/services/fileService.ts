import { IPurchasedPart } from '../types';
import { partsApi } from './api';

export const fileService = {
  /**
   * Opens a file or folder using Electron's shell API or falls back to web download.
   */
  async openItem(part: IPurchasedPart, notify: (msg: string, type?: any) => void): Promise<void> {
    // @ts-ignore
    if (window.electronAPI) {
      if (part.isFolder) {
        // @ts-ignore
        window.electronAPI.openFolder(part.filePath);
      } else {
        // @ts-ignore
        window.electronAPI.openFile(part.filePath);
      }
      return;
    }

    if (part.isFolder) {
      notify("Opening folders locally requires native OS integration.", "warning");
      return;
    }

    try {
      const res = await partsApi.downloadPart(part.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = part.fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      notify("Failed to open file via web download.", "error");
    }
  },

  /**
   * Opens the containing folder of a file or folder.
   */
  async openLocation(item: IPurchasedPart): Promise<void> {
    // @ts-ignore
    if (window.electronAPI) {
      const separator = item.filePath.includes('\\') ? '\\' : '/';
      const folderPath = item.filePath.substring(0, item.filePath.lastIndexOf(separator));
      // @ts-ignore
      window.electronAPI.openFolder(folderPath || item.filePath);
    }
  }
};
