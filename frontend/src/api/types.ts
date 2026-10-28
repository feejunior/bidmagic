export type Role = 'auctioneer' | 'bidder'

export type User = {
  id: number
  name: string
  email: string
  role: Role
  alias: string
}
