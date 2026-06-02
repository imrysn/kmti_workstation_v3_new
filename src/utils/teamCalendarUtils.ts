export interface IHoliday {
  date: string
  name: string
  isRegular: boolean
}

export const formatLocalDate = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export const formatDisplayDate = (dateStr: string) => {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const day = parseInt(parts[2], 10)
    const d = new Date(year, month, day)
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }
  return dateStr
}

export const formatDisplayDateTime = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export const getWorkingDaysCount = (startStr: string, endStr: string) => {
  if (!startStr || !endStr) return 0
  const startParts = startStr.split('-')
  const endParts = endStr.split('-')
  if (startParts.length !== 3 || endParts.length !== 3) return 0

  const start = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10))
  const end = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10))

  let count = 0
  const current = new Date(start)
  while (current <= end) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sunday (0) and Saturday (6)
      count++
    }
    current.setDate(current.getDate() + 1)
  }
  return count
}

export const formatDurationRange = (startStr: string, endStr: string) => {
  if (!startStr) return ''
  if (!endStr) return formatDisplayDate(startStr)

  const startFormatted = formatDisplayDate(startStr)
  const endFormatted = formatDisplayDate(endStr)
  const workingDays = getWorkingDaysCount(startStr, endStr)
  const daysText = workingDays === 1 ? '1 day' : `${workingDays} days`

  return `${startFormatted} to ${endFormatted} (${daysText})`
}

// ─── Task-Type Inference ──────────────────────────────────────────────────────
// Infers task category by scanning the title + description for keywords.
// Team leaders consistently include keywords like "3D Modelling" or "2D Detailing".

export type TaskType = '3D' | '2D' | 'Checking' | 'Other'

const TASK_TYPE_KEYWORDS: Record<string, string[]> = {
  '3D': ['3d', 'solidworks', 'solid model', '3d model', '3d design', '3d drawing', 'inventor'],
  '2D': ['2d', 'drafting', 'drawing', 'autocad', '2d detail', 'detailing', '2d drawing'],
  'Checking': ['checking', 'check', 'review', 'qa', 'qc', 'inspection', 'verify', 'approval'],
}

export function inferTaskType(
  title: string | null,
  description: string | null
): TaskType {
  const haystack = `${title ?? ''} ${description ?? ''}`.toLowerCase()
  for (const [type, keywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (keywords.some(kw => haystack.includes(kw))) return type as TaskType
  }
  return 'Other'
}

// ─── Task-Type Color Map ──────────────────────────────────────────────────────
export const TASK_TYPE_COLORS: Record<TaskType, { bg: string; border: string; text: string }> = {
  '3D': { bg: 'rgba(37, 99, 235, 0.12)',  border: '#2563eb', text: '#2563eb' }, // blue
  '2D': { bg: 'rgba(220, 38, 38, 0.12)', border: '#dc2626', text: '#dc2626' }, // red
  'Checking': { bg: 'rgba(234, 90, 12, 0.12)', border: '#ea580c', text: '#ea580c' }, // orange
  'Other':    { bg: 'rgba(107, 114, 128, 0.08)', border: '#6b7280', text: '#6b7280' }, // gray
}

// Pill labels shown as prefix icon-replacement chips on calendar badges
export const TASK_TYPE_PILL_LABELS: Record<TaskType, string> = {
  '3D': '3D',
  '2D': '2D',
  'Checking': 'CHK',
  'Other': '',
}

export const getTaskTypeColor = (type: TaskType) => TASK_TYPE_COLORS[type]

// ─── Team Color Map ───────────────────────────────────────────────────────────
// Left-border accent on event badges and sidebar legend dots.
// "General" team is excluded (admin-only, no tasks).
// Unknown teams get a deterministic hue derived from the team name string.

export function getTeamColor(team: string | null | undefined): string {
  if (!team || team.toLowerCase() === 'general') return 'transparent'
  // Deterministic hash → hue so every unknown team gets a consistent color
  let hash = 0
  for (let i = 0; i < team.length; i++) {
    hash = (hash * 31 + team.charCodeAt(i)) & 0xffffffff
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 60%, 58%)`
}

const getEasterSunday = (year: number): Date => {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

export const getPhilippineHolidays = (year: number): Record<string, IHoliday> => {
  const holidays: IHoliday[] = [
    { date: `${year}-01-01`, name: "New Year's Day", isRegular: true },
    { date: `${year}-04-09`, name: "Araw ng Kagitingan", isRegular: true },
    { date: `${year}-05-01`, name: "Labor Day", isRegular: true },
    { date: `${year}-06-12`, name: "Independence Day", isRegular: true },
    { date: `${year}-08-21`, name: "Ninoy Aquino Day", isRegular: false },
    { date: `${year}-11-01`, name: "All Saints' Day", isRegular: false },
    { date: `${year}-11-02`, name: "All Souls' Day", isRegular: false },
    { date: `${year}-11-30`, name: "Bonifacio Day", isRegular: true },
    { date: `${year}-12-08`, name: "Feast of the Immaculate Conception", isRegular: false },
    { date: `${year}-12-24`, name: "Christmas Eve", isRegular: false },
    { date: `${year}-12-25`, name: "Christmas Day", isRegular: true },
    { date: `${year}-12-30`, name: "Rizal Day", isRegular: true },
    { date: `${year}-12-31`, name: "New Year's Eve", isRegular: false },
  ]

  // Compute National Heroes Day (Last Monday of August)
  const nhd = new Date(year, 7, 31)
  while (nhd.getDay() !== 1) {
    nhd.setDate(nhd.getDate() - 1)
  }
  holidays.push({ date: formatLocalDate(nhd), name: "National Heroes Day", isRegular: true })

  // Compute Easter-based movable Christian holidays dynamically
  try {
    const easter = getEasterSunday(year)

    // Maundy Thursday (Easter Sunday - 3 days)
    const maundy = new Date(easter)
    maundy.setDate(easter.getDate() - 3)
    holidays.push({ date: formatLocalDate(maundy), name: 'Maundy Thursday', isRegular: true })

    // Good Friday (Easter Sunday - 2 days)
    const good = new Date(easter)
    good.setDate(easter.getDate() - 2)
    holidays.push({ date: formatLocalDate(good), name: 'Good Friday', isRegular: true })

    // Black Saturday (Easter Sunday - 1 day)
    const sat = new Date(easter)
    sat.setDate(easter.getDate() - 1)
    holidays.push({ date: formatLocalDate(sat), name: 'Black Saturday', isRegular: false })
  } catch (e) {
    console.error('Error computing Easter movable holidays:', e)
  }

  // Decadal Predictor Lookup Table for Islamic movable holidays (Hijri-Gregorian predictions 2025 - 2035)
  const islamicHolidaysTable: Record<number, { fitr: string; adha: string }> = {
    2025: { fitr: '2025-03-31', adha: '2025-06-07' },
    2026: { fitr: '2026-03-20', adha: '2026-05-27' },
    2027: { fitr: '2027-03-10', adha: '2027-05-17' },
    2028: { fitr: '2028-02-27', adha: '2028-05-05' },
    2029: { fitr: '2029-02-15', adha: '2029-04-24' },
    2030: { fitr: '2030-02-04', adha: '2030-04-13' },
    2031: { fitr: '2031-01-25', adha: '2031-04-03' },
    2032: { fitr: '2032-01-14', adha: '2032-03-22' },
    2033: { fitr: '2033-11-23', adha: '2033-03-11' },
    2034: { fitr: '2034-11-12', adha: '2034-03-01' },
    2035: { fitr: '2035-11-01', adha: '2035-02-18' }
  }

  const islamic = islamicHolidaysTable[year]
  if (islamic) {
    holidays.push({ date: islamic.fitr, name: 'Eid al-Fitr', isRegular: true })
    holidays.push({ date: islamic.adha, name: 'Eid al-Adha', isRegular: true })
  }

  const lookup: Record<string, IHoliday> = {}
  holidays.forEach(h => {
    lookup[h.date] = h
  })
  return lookup
}
