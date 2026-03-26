const KEY = (userId: string) => `aero-installed-games-${userId}`
const DEFAULT: string[] = ['bubblepop']

export function getInstalledGames(userId: string): string[] {
  try {
    const raw = localStorage.getItem(KEY(userId))
    return raw ? (JSON.parse(raw) as string[]) : [...DEFAULT]
  } catch {
    return [...DEFAULT]
  }
}

export function installGame(userId: string, gameId: string): void {
  try {
    const current = getInstalledGames(userId)
    if (!current.includes(gameId)) {
      localStorage.setItem(KEY(userId), JSON.stringify([...current, gameId]))
    }
  } catch {}
}

export function uninstallGame(userId: string, gameId: string): void {
  try {
    const current = getInstalledGames(userId)
    localStorage.setItem(KEY(userId), JSON.stringify(current.filter(g => g !== gameId)))
  } catch {}
}
