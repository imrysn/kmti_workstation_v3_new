import { RefreshIcon } from '../../components/FileIcons'
import { FileIcon } from '../../components/FileIcons'
import { TreeNode } from './types'

interface TreeItemProps {
  node: TreeNode
  selectedPath: string
  expandedFolders: Set<string>
  onToggle: (path: string, isExpanding: boolean) => void
  onSelect: (path: string, isFolder: boolean) => void
  searchFilter: string
  isLoading?: boolean
  loadingNodes: Set<string>
}

export function TreeItem({ node, selectedPath, expandedFolders, onToggle, onSelect, searchFilter, isLoading, loadingNodes }: TreeItemProps) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPath === node.path
  const totalCount = node.isFolder ? node.children.length : 0

  return (
    <div>
      <div
        className={`tree-node-item ${isSelected ? 'active' : ''} ${node.isFolder ? 'is-folder' : 'is-file'}`}
        style={{ paddingLeft: `${(node.depth || 0) * 16 + 4}px` }}
        onClick={() => {
          if (node.isFolder) {
            onToggle(node.path, !isExpanded)
            onSelect(node.path, true)
          } else {
            onSelect(node.path, false)
          }
        }}
      >
        {node.isFolder && (
          <span className={`tree-arrow ${isExpanded ? 'open' : ''} ${isLoading ? 'loading' : ''}`}>
            {isLoading ? (
              <RefreshIcon size={10} className="spinning" />
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M3 2l4 3-4 3z" />
              </svg>
            )}
          </span>
        )}
        {!node.isFolder && <span className="tree-arrow-spacer" />}

        <FileIcon
          isFolder={node.isFolder}
          isOpen={node.isFolder && isExpanded}
          fileType={node.fileType}
          size={15}
          color={isSelected ? "var(--accent)" : (node.isFolder ? "var(--warning)" : "var(--text-muted)")}
          filePath={node.path}
        />

        <span className="tree-node-name" title={node.name}>{node.name}</span>

        {node.isFolder && totalCount > 0 && (
          <span className="tree-node-badge">{totalCount}</span>
        )}
      </div>

      {node.isFolder && isExpanded && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem
              key={child.path + i}
              node={child}
              selectedPath={selectedPath}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              onSelect={onSelect}
              searchFilter={searchFilter}
              isLoading={loadingNodes.has(child.path)}
              loadingNodes={loadingNodes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
