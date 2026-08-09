/** Display name, one definition — screens used to inline this fallback chain. */
export function displayName(user) {
  return user?.displayName ?? user?.username ?? 'Player'
}
