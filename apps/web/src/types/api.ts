/**
 * Tipos do contrato da API (espelham as respostas do back-end).
 * Valores monetários SEMPRE em centavos (inteiros); datas em ISO 8601 (UTC).
 */

export type Role = 'AUCTIONEER' | 'BIDDER';
export type LotStatus = 'SCHEDULED' | 'LIVE' | 'CLOSED' | 'CANCELED';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthSession {
  accessToken: string;
  user: SessionUser;
}

export interface ItemAttribute {
  label: string;
  value: string;
}

export interface LotResult {
  sold: boolean;
  finalPriceCents: number | null;
  winnerPseudonym: string | null;
}

export interface LotSummary {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string;
  attributes: ItemAttribute[];
  source: string;
  sourceUrl: string | null;
  status: LotStatus;
  settled: boolean;
  startingBidCents: number;
  minIncrementCents: number;
  startsAt: string;
  endsAt: string;
  originalEndsAt: string;
  extended: boolean;
  currentBidCents: number | null;
  minimumNextBidCents: number;
  bidCount: number;
  leaderPseudonym: string | null;
  sellerPseudonym: string;
  result: LotResult | null;
}

export interface PublicBid {
  sequence: number;
  amountCents: number;
  placedAt: string;
  bidderPseudonym: string;
  hash: string;
  prevHash: string;
}

export interface LotViewerState {
  role: Role;
  isOwner: boolean;
  pseudonym: string;
  isLeading: boolean;
  highestBidCents: number | null;
  position: number | null;
  receiptCode: string | null;
}

export interface LotDetail extends LotSummary {
  bids: PublicBid[];
  me: LotViewerState | null;
  serverNow: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  serverNow: string;
}

export interface WalletSummary {
  balanceCents: number;
  committedCents: number;
  availableCents: number;
}

export type WalletTransactionType = 'DEPOSIT' | 'PURCHASE_DEBIT' | 'SALE_CREDIT';

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  amountCents: number;
  balanceAfterCents: number;
  lotId: string | null;
  createdAt: string;
}

export interface Wallet extends WalletSummary {
  transactions: WalletTransaction[];
}

export interface PlaceBidResult {
  bid: PublicBid;
  lot: {
    id: string;
    currentBidCents: number;
    bidCount: number;
    minimumNextBidCents: number;
    endsAt: string;
    extended: boolean;
    leaderPseudonym: string;
  };
  wallet: WalletSummary;
}

export type ParticipationStatus = 'LEADING' | 'OUTBID' | 'WON' | 'LOST' | 'CANCELED';

export interface Participation {
  lot: LotSummary;
  status: ParticipationStatus;
  myHighestBidCents: number;
  receiptCode: string | null;
}

export interface SellerSummary {
  totalReceivedCents: number;
  soldCount: number;
  unsoldCount: number;
  liveCount: number;
  scheduledCount: number;
  canceledCount: number;
}

export interface CatalogItem {
  source: string;
  externalId: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  sourceUrl: string | null;
  attributes: ItemAttribute[];
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  degraded: boolean;
  notice: string | null;
}

export interface CreateLotInput {
  externalId: string;
  title?: string;
  description?: string;
  startingBidCents: number;
  minIncrementCents: number;
  startsAt: string;
  endsAt: string;
}

export interface IntegrityIssue {
  code: string;
  message: string;
  sequence?: number;
}

export interface IntegrityReport {
  status: 'INTACT' | 'TAMPERED';
  valid: boolean;
  checkedBids: number;
  headHash: string | null;
  issues: IntegrityIssue[];
  checkedAt: string;
  method: string;
}

export interface LotAudit {
  lot: LotSummary;
  bids: PublicBid[];
  integrity: IntegrityReport;
  serverNow: string;
}

export interface Receipt {
  code: string;
  lotId: string;
  issuedAt: string;
  finalPriceCents: number;
  bidCount: number;
  chainHeadHash: string;
  winnerPseudonym: string;
  sellerPseudonym: string;
  lot: LotSummary;
  integrity: IntegrityReport;
  serverNow: string;
}

/* ---------- Eventos em tempo real ---------- */

export interface LotBidEvent {
  lotId: string;
  bid: PublicBid;
  currentBidCents: number;
  bidCount: number;
  minimumNextBidCents: number;
  leaderPseudonym: string;
  endsAt: string;
  extended: boolean;
  serverNow: string;
}

export interface LotClosedEvent {
  lotId: string;
  sold: boolean;
  finalPriceCents: number | null;
  winnerPseudonym: string | null;
  serverNow: string;
}

export interface LotCanceledEvent {
  lotId: string;
  serverNow: string;
}

export interface OutbidEvent {
  lotId: string;
  lotTitle: string;
  newAmountCents: number;
}
