export function getDisplayName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length > 2) {
    return parts.slice(0, -2).join(' ')
  }
  return parts[0] || fullName
}
