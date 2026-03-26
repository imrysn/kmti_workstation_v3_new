import React from 'react';
import './Breadcrumbs.css';

interface BreadcrumbsProps {
  path: string;
  rootPath: string; 
  rootName: string;
  onNavigate: (path: string) => void;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ path, rootPath, rootName, onNavigate }) => {
  if (!path || !rootPath) return null;

  const normPath = path.replace(/\\/g, '/').replace(/\/$/, '');
  const normRoot = rootPath.replace(/\\/g, '/').replace(/\/$/, '');

  // Case 1: Path is exactly the root
  if (normPath === normRoot) {
    return (
      <nav className="findr-breadcrumbs">
        <div className="findr-breadcrumb-item active" onClick={() => onNavigate(normRoot)}>
          {rootName}
        </div>
      </nav>
    );
  }

  // Case 2: Path is outside the root (Safety check)
  if (!normPath.startsWith(normRoot)) {
    return null;
  }

  // Case 3: Path is inside the root
  const relativePath = normPath.substring(normRoot.length).replace(/^\//, '');
  const segments = relativePath.split('/');

  const crumbs = [{ name: rootName, fullPath: normRoot }];
  let currentPath = normRoot;

  segments.forEach(segment => {
    if (segment) {
      currentPath += '/' + segment;
      crumbs.push({ name: segment, fullPath: currentPath });
    }
  });

  return (
    <nav className="findr-breadcrumbs">
      {crumbs.map((crumb, index) => (
        <React.Fragment key={crumb.fullPath}>
          <div 
            className={`findr-breadcrumb-item ${index === crumbs.length - 1 ? 'active' : ''}`}
            onClick={() => onNavigate(crumb.fullPath)}
          >
            {crumb.name}
          </div>
          {index < crumbs.length - 1 && (
            <span className="findr-breadcrumb-separator">/</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
