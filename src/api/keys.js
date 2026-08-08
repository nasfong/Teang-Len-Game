// Query keys, in one place. Every useQuery/invalidateQueries in the app reads from
// here — previously these were bare string literals spread across the query hooks
// AND their invalidation sites (the table screen invalidated ['wallet'] by hand),
// so a rename could silently miss an invalidation and leave stale data on screen.
export const queryKeys = {
  rooms: ['rooms'],
  room: (roomId) => ['room', roomId],
  wallet: ['wallet'],
  friends: ['friends'],
  userSearch: (query) => ['user-search', query],
  shopProducts: ['shop-products'],
}
