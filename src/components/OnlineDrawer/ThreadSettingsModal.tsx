import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { chatApi, SERVER_BASE } from '../../services/api';

interface MediaItem {
  id: number;
  sender: string;
  name: string;
  path: string;
  created_at?: string;
}

interface LinkItem {
  id: number;
  sender: string;
  url: string;
  created_at?: string;
}

interface ThreadSettingsModalProps {
  peer: string | null;
  groupId: number | null;
  peerLabel: string;
  onClose: () => void;
  onJumpToMessage?: (msgId: number) => void;
}

export function ThreadSettingsModal({
  peer,
  groupId,
  peerLabel,
  onClose,
  onJumpToMessage: _onJumpToMessage
}: ThreadSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'links'>('media');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ media: MediaItem[]; files: MediaItem[]; links: LinkItem[] }>({
    media: [],
    files: [],
    links: []
  });
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  const getMediaUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${SERVER_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    chatApi.getThreadMedia(peer, groupId)
      .then(res => {
        const mediaData = res?.data || res;
        if (isMounted && mediaData) {
          setData(mediaData);
        }
      })
      .catch(err => {
        console.error('Failed to fetch thread media:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [peer, groupId]);

  const filteredMedia = data.media.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) || m.sender.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFiles = data.files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) || f.sender.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLinks = data.links.filter(l =>
    l.url.toLowerCase().includes(search.toLowerCase()) || l.sender.toLowerCase().includes(search.toLowerCase())
  );

  return createPortal(
    <div className="thread-settings-overlay" onClick={onClose}>
      <div className="thread-settings-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="thread-settings-header">
          <div className="thread-settings-title-group">
            <h3>Shared Content</h3>
            <span className="thread-settings-subtitle">{peerLabel}</span>
          </div>
          <button className="thread-settings-close-btn" onClick={onClose} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="thread-settings-tabs">
          <button
            className={`thread-tab ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Media ({data.media.length})
          </button>
          <button
            className={`thread-tab ${activeTab === 'files' ? 'active' : ''}`}
            onClick={() => setActiveTab('files')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> Files ({data.files.length})
          </button>
          <button
            className={`thread-tab ${activeTab === 'links' ? 'active' : ''}`}
            onClick={() => setActiveTab('links')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Links ({data.links.length})
          </button>
        </div>

        {/* Search */}
        <div className="thread-settings-search">
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}>&times;</button>}
        </div>

        {/* Content Body */}
        <div className="thread-settings-body">
          {loading ? (
            <div className="thread-settings-loading">Loading shared content...</div>
          ) : activeTab === 'media' ? (
            filteredMedia.length === 0 ? (
              <div className="thread-settings-empty">No media shared in this thread yet.</div>
            ) : (
              <div className="thread-media-grid">
                {filteredMedia.map(item => (
                  <div
                    key={item.id}
                    className="thread-media-item"
                    onClick={() => setPreviewImage({ url: getMediaUrl(item.path), name: item.name })}
                    title={`${item.name} • Shared by ${item.sender}`}
                  >
                    <img src={getMediaUrl(item.path)} alt={item.name} loading="lazy" />
                    <div className="media-hover-overlay">
                      <span>{item.sender}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'files' ? (
            filteredFiles.length === 0 ? (
              <div className="thread-settings-empty">No files or documents shared yet.</div>
            ) : (
              <div className="thread-files-list">
                {filteredFiles.map(item => (
                  <div key={item.id} className="thread-file-card">
                    <div className="file-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    </div>
                    <div className="file-info">
                      <span className="file-name" title={item.name}>{item.name}</span>
                      <span className="file-meta">Shared by {item.sender}</span>
                    </div>
                    <a
                      href={getMediaUrl(item.path)}
                      download={item.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="file-download-btn"
                      title="Download file"
                      style={{ display: 'inline-flex', alignItems: 'center' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    </a>
                  </div>
                ))}
              </div>
            )
          ) : filteredLinks.length === 0 ? (
            <div className="thread-settings-empty">No web links posted yet.</div>
          ) : (
            <div className="thread-links-list">
              {filteredLinks.map((item, idx) => (
                <div key={`${item.id}_${idx}`} className="thread-link-card">
                  <div className="link-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </div>
                  <div className="link-info">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="link-url">
                      {item.url}
                    </a>
                    <span className="link-meta">Posted by {item.sender}</span>
                  </div>
                  <button
                    className="copy-link-btn"
                    onClick={() => navigator.clipboard.writeText(item.url)}
                    title="Copy URL"
                    style={{ display: 'inline-flex', alignItems: 'center' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div className="chat-lightbox-overlay" onClick={() => setPreviewImage(null)}>
          <div className="chat-lightbox-header" onClick={e => e.stopPropagation()}>
            <span className="chat-lightbox-title">{previewImage.name}</span>
            <div className="chat-lightbox-actions">
              <a
                href={previewImage.url}
                download={previewImage.name}
                target="_blank"
                rel="noopener noreferrer"
                className="chat-lightbox-download-btn"
                title="Download Image"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </a>
              <button
                type="button"
                className="chat-lightbox-close-btn"
                onClick={() => setPreviewImage(null)}
                title="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <img
            src={previewImage.url}
            alt={previewImage.name}
            className="chat-lightbox-img"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>,
    document.body
  );
}
