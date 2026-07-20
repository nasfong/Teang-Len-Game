// Adapters — map the backend's wire shapes onto our component props, so screens
// stay presentational and the server contract can shift without touching them.

// Shop product (server, typed 'purchase' | 'ads') → Shop pack props. The API is
// data-only; presentation (icon, layout, colours, CTA) is applied here per type —
// 'ads' becomes the full-width rewarded-video banner (kind 'ad', routed to
// onWatchAd), 'purchase' a normal paid tile.
export function productToPack(p) {
  if (p.type === 'ads') {
    return {
      id: p.id,
      kind: 'ad',
      wide: true,
      coins: p.coins,
      icon: '🎬',
      cta: '▶ Watch',
      accent: 'blue',
      subtitle: 'Watch a video, claim free coins',
    }
  }
  return { id: p.id, coins: p.coins, price: p.price, bonus: p.bonus, tag: p.tag }
}

// RoomSnapshot (server, BACKEND_SPEC §4) → RoomCard / RoomPage props.
// The snapshot names its id `roomId`; RoomCard/RoomPage key on `id`. Player seats
// carry only a name over the wire (no avatar art on the server yet).
export function roomSnapshotToCard(room) {
  return {
    id: room.roomId,
    name: room.name,
    betCoin: room.betCoin,
    maxPlayers: room.maxPlayers,
    status: room.status, // 'waiting' | 'playing' — the card shows a live badge + Join/Watch
    players: room.players.map((p) => ({ name: p.name })),
  }
}
