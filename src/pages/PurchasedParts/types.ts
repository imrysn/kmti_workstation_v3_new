export interface TreeNode {
  name: string
  path: string
  parent: string
  depth: number
  isFolder: boolean
  fileType: string
  children: TreeNode[]
}
