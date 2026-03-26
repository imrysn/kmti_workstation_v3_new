import { TreeNode } from './types'

export function getRelativeTimeString(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp * 1000);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;

  const diffInDays = Math.floor(diffInSeconds / 86400);
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;

  return date.toLocaleDateString();
}

export function buildTree(rawNodes: any[]): TreeNode | null {
  if (!rawNodes || rawNodes.length === 0) return null

  const nodes: TreeNode[] = rawNodes.map(n => ({
    name: n.name,
    path: (n.path || '').replace(/\\/g, '/'),
    parent: (n.parent || '').replace(/\\/g, '/'),
    depth: n.depth ?? 0,
    isFolder: !!n.isFolder,
    fileType: n.fileType || '',
    children: [],
  }))

  const map = new Map<string, TreeNode>()
  let root: TreeNode | null = null

  nodes.forEach(node => {
    map.set(node.path, node)
    if (node.depth === 0) root = node
  })

  if (!root) return null

  nodes.forEach(node => {
    if (node.depth === 0) return
    const lastSlash = node.path.lastIndexOf('/')
    if (lastSlash === -1) {
      if (root) root.children.push(node)
      return
    }

    const parentPath = node.path.substring(0, lastSlash)
    const parent = map.get(parentPath)

    if (parent) {
      parent.children.push(node)
    } else {
      let ancestorPath = parentPath
      let ancestorFound = false
      while (ancestorPath.includes('/')) {
        ancestorPath = ancestorPath.substring(0, ancestorPath.lastIndexOf('/'))
        const ancestor = map.get(ancestorPath)
        if (ancestor) {
          ancestor.children.push(node)
          ancestorFound = true
          break
        }
      }
      if (!ancestorFound && root) {
        root.children.push(node)
      }
    }
  })

  const sort = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    n.children.forEach(sort)
  }
  sort(root)

  return root
}

export const formatFileSize = (bytes: number) => {
  if (bytes === 0 || !bytes) return "0 B"
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
