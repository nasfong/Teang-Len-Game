// Display name, one definition. The session user carries an optional displayName
// and a required username; screens showed `user?.displayName ?? user?.username ??
// 'Player'` inline, so a change to the fallback had to be made in every screen.
export function displayName(user) {
  return user?.displayName ?? user?.username ?? 'Player'
}
