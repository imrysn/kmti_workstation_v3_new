import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'rect' | 'circle' | 'text';
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  width, 
  height, 
  variant = 'rect', 
  className = '', 
  style 
}) => {
  const baseClass = `skeleton-base ${variant === 'circle' ? 'skeleton-circle' : ''} ${className}`;
  
  const inlineStyle: React.CSSProperties = {
    width: width || (variant === 'text' ? '100%' : '100%'),
    height: height || (variant === 'text' ? '14px' : '100%'),
    ...style
  };

  return (
    <div 
      className={baseClass} 
      style={inlineStyle}
      aria-hidden="true"
    />
  );
};

export const ResultSkeleton = () => (
  <div style={{ display: 'flex', alignItems: 'center', height: '60px', padding: '0 16px', gap: '12px', borderBottom: '1px solid #f1f5f9' }}>
    <Skeleton width={32} height={32} variant="circle" />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <Skeleton width="60%" height={14} />
      <Skeleton width="40%" height={10} />
    </div>
    <Skeleton width={40} height={12} />
  </div>
);
