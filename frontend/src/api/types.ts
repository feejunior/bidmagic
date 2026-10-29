export type Role = 'auctioneer' | 'bidder'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  alias: string
}

export type LotStatus = 'scheduled' | 'live' | 'closed' | 'cancelled'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus'

export type Card = {
  scryfall_id: string
  name: string
  set_name: string
  rarity: string
  artist: string | null
  type_line: string | null
  image_url: string
}

export type LotSummary = {
  id: number
  status: LotStatus
  card: Card
  auctioneer_alias: string
  starting_bid: number
  min_increment: number
  current_bid: number | null
  minimum_bid: number
  bid_count: number
  leader_alias: string | null
  starts_at: string
  ends_at: string
}

export type Bid = {
  bidder_alias: string
  amount: number
  created_at: string
}

export type LotDetail = LotSummary & {
  description: string | null
  original_ends_at: string
  recent_bids: Bid[]
  server_now: string
}

export type LotList = {
  server_now: string
  items: LotSummary[]
}

export type BidPlaced = {
  type: 'bid_placed'
  lot_id: number
  amount: number
  bidder_alias: string
  created_at: string
  ends_at: string
  bid_count: number
  minimum_bid: number
  server_now: string
}

export type LotClosed = {
  type: 'lot_closed'
  lot_id: number
  winner_alias: string | null
  final_amount: number | null
  server_now: string
}

export type LotEvent = BidPlaced | LotClosed

export type Wallet = {
  total: number
  committed: number
  available: number
  entries: {
    id: number
    type: 'deposit' | 'purchase' | 'sale'
    amount: number
    lot_id: number | null
    card_name: string | null
    created_at: string
  }[]
}
