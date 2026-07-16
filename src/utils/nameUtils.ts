export function formatUsername(username: string): string {
  // Removes trailing digits (e.g. Jethro091 -> Jethro)
  return username.replace(/\d+$/, '')
}

export function getDisplayName(fullName: string): string {
  if (!fullName) return ''
  const parts = fullName.trim().split(/\s+/)
  if (parts.length > 2) {
    return parts.slice(0, -2).join(' ')
  }
  // If it's a single word (like a username), format it to strip digits
  if (parts.length === 1) {
    return formatUsername(parts[0])
  }
  return parts[0] || fullName
}
