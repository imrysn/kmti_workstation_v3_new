import React from 'react';

export type StatusType = 'success' | 'error' | 'warning' | 'info';

interface IconProps {
  size?: number | string;
  className?: string;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

interface FileIconProps extends IconProps {
  fileName?: string;
  fileType?: string;
  isFolder?: boolean;
  isOpen?: boolean;
}

export const FileIcon: React.FC<FileIconProps> = ({ 
  fileName, 
  fileType, 
  isFolder, 
  size = 20, 
  className = "",
  color,
  strokeWidth = 2,
  style,
  isOpen = false
}) => {
  const extension = fileType || (fileName ? `.${fileName.split('.').pop()?.toLowerCase()}` : '');

  // Folder Icon
  if (isFolder) {
    if (isOpen) {
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#f39c12"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          <path d="M7 11l5 5 5-5"></path>
        </svg>
      );
    }
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#f39c12"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
    );
  }

  // CAD Icons (.icd, .dwg, .sldprt, .step, .stp)
  if (['.icd', '.dwg', '.sldprt', '.step', '.stp', '.obj', '.stl'].includes(extension)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#27ae60"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
    );
  }

  // PDF Icon
  if (extension === '.pdf') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#e74c3c"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    );
  }

  // Image Icons
  if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(extension)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#3498db"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
    );
  }

  // Spreadsheet Icons
  if (['.xlsx', '.xls', '.csv'].includes(extension)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#2ecc71"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="8" y1="13" x2="16" y2="13"></line>
        <line x1="8" y1="17" x2="16" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
      </svg>
    );
  }

  // Document Icons
  if (['.docx', '.doc', '.txt'].includes(extension)) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#3498db"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
      </svg>
    );
  }

  // Generic File Icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "#95a5a6"} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
      <polyline points="13 2 13 9 20 9"></polyline>
    </svg>
  );
};

interface StatusIconProps extends IconProps {
  type: StatusType;
}

export const StatusIcon: React.FC<StatusIconProps> = ({ type, size = 20, className = "", style }) => {
  switch (type) {
    case 'success':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    case 'error':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
    case 'warning':
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    case 'info':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      );
  }
};

export const PlusIcon: React.FC<IconProps> = ({ size = 20, className = "", color = "currentColor", strokeWidth = 2.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size = 20, className = "", color = "currentColor", strokeWidth = 2.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size = 20, className = "", color = "currentColor", strokeWidth = 2.2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size = 20, className = "", color = "currentColor", strokeWidth = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ size = 20, className = "", color = "currentColor", strokeWidth = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

export const ExternalLinkIcon: React.FC<IconProps> = ({ size = 20, className = "", color = "currentColor", strokeWidth = 2, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);
