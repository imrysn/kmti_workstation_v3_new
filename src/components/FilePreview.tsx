import React, { useState, useEffect } from 'react';
import { ExternalLinkIcon, SearchIcon } from './FileIcons';
import { API_BASE } from '../services/api';
import './FilePreview.css';

interface FilePreviewProps {
  fileId: number;
  fileName: string;
  fileType: string;
  onOpen: () => void;
}

const FilePreview: React.FC<FilePreviewProps> = ({ fileId, fileName, fileType, onOpen }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  
  const previewUrl = `${API_BASE}/parts/preview/${fileId}`;
  const cadExtensions = ['.sldprt', '.sldasm', '.slddrw', '.dwg', '.dxf', '.step', '.stp', '.iges', '.igs'];
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
  
  const isImage = imageExtensions.includes(fileType.toLowerCase());
  const isPdf = fileType.toLowerCase() === '.pdf';
  const isCad = cadExtensions.includes(fileType.toLowerCase());
  
  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [fileId]);

  if (!isImage && !isCad && !isPdf) {
    return null;
  }

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  const toggleZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsZoomed(!isZoomed);
  };

  return (
    <>
      <div className={`file-preview-container ${isPdf ? 'is-pdf' : ''}`}>
        {loading && (
          <div className="file-preview-loading">
            <div className="file-preview-spinner"></div>
            <div className="file-preview-error-text">
              {isCad ? 'Generating CAD Snapshot...' : 'Loading Preview...'}
            </div>
          </div>
        )}
        
        {error ? (
          <div className={`file-preview-placeholder ${isPdf ? 'pdf' : isCad ? 'cad' : 'image'}`} onClick={toggleZoom}>
            <div className="file-preview-placeholder-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <text x="5" y="18" fontSize="5" fontWeight="bold" fill="currentColor">{isPdf ? 'PDF' : isCad ? 'CAD' : 'IMG'}</text>
              </svg>
            </div>
            <div className="file-preview-placeholder-text">Preview Unavailable</div>
            <div style={{ fontSize: '10px', marginTop: -8 }}>Click to view full document</div>
          </div>
        ) : (
          <>
            <img
              src={previewUrl}
              alt={fileName}
              className="file-preview-image"
              onLoad={handleLoad}
              onError={handleError}
              style={{ display: loading ? 'none' : 'block' }}
              onClick={toggleZoom}
              title="Click to expand"
            />
            {!loading && (
              <div className="file-preview-expand-btn" onClick={toggleZoom} title="Expand Preview">
                <SearchIcon size={16} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox / Fullscreen Overlay */}
      {isZoomed && (
        <div className="preview-overlay" onClick={toggleZoom}>
          <div 
            className={`preview-modal ${isPdf ? 'preview-modal-pdf' : ''}`} 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="preview-close-btn" onClick={toggleZoom}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
            
            {isPdf ? (
              <iframe src={`${previewUrl}?full=true`} className="preview-modal-image preview-modal-pdf-iframe" title={fileName} />
            ) : (
              <img src={`${previewUrl}?full=true`} alt={fileName} className="preview-modal-image" />
            )}
            
            <div className="preview-modal-info">
              <span>{fileName}</span>
              <button 
                className="btn btn-primary" 
                style={{ padding: '4px 12px', fontSize: '11px' }}
                onClick={() => { toggleZoom(new MouseEvent('click') as any); onOpen(); }}
              >
                <ExternalLinkIcon size={14} color="white" /> Open File
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FilePreview;
