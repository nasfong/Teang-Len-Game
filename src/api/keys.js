// Query keys in one place — every useQuery and invalidateQueries reads from here, so
// a rename can't silently miss an invalidation site.
export const queryKeys = {
  rooms: ['rooms'],
  room: (roomId) => ['room', roomId],
  wallet: ['wallet'],
  friends: ['friends'],
  userSearch: (query) => ['user-search', query],
  shopProducts: ['shop-products'],
}
