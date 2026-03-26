import { describe, it, expect, beforeEach } from 'vitest'
import { getInstalledGames, installGame, uninstallGame } from './gameInstalls'

const USER_A = 'user-aaa'
const USER_B = 'user-bbb'

beforeEach(() => {
  localStorage.clear()
})

describe('getInstalledGames', () => {
  it('returns ["bubblepop"] by default for a new user', () => {
    expect(getInstalledGames(USER_A)).toEqual(['bubblepop'])
  })

  it('is scoped per user — user B does not see user A installs', () => {
    installGame(USER_A, 'chess')
    expect(getInstalledGames(USER_B)).toEqual(['bubblepop'])
  })
})

describe('installGame', () => {
  it('adds a game to the user library', () => {
    installGame(USER_A, 'chess')
    expect(getInstalledGames(USER_A)).toContain('chess')
  })

  it('does not duplicate if installed twice', () => {
    installGame(USER_A, 'chess')
    installGame(USER_A, 'chess')
    const games = getInstalledGames(USER_A)
    expect(games.filter(g => g === 'chess')).toHaveLength(1)
  })
})

describe('uninstallGame', () => {
  it('removes a game from the user library', () => {
    installGame(USER_A, 'chess')
    uninstallGame(USER_A, 'chess')
    expect(getInstalledGames(USER_A)).not.toContain('chess')
  })

  it('does not error if game was not installed', () => {
    expect(() => uninstallGame(USER_A, 'chess')).not.toThrow()
  })

  it('does not affect bubblepop default', () => {
    uninstallGame(USER_A, 'bubblepop')
    expect(getInstalledGames(USER_A)).not.toContain('bubblepop')
  })
})
