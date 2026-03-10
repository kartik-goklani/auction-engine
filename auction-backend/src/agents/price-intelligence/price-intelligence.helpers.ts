import { AuctionType } from '../../common/types';

interface HistoricalAuctionRow {
  id: string;
  title: string;
  ceiling_price: number;
  type: string;
}

interface HistoricalBidRow {
  auction_id: string;
  amount: number;
}

interface HistoricalAuctionResult extends HistoricalAuctionRow {
  final_bid_amount: number | null;
  ceiling_utilisation_pct: number | null;
}

function isMinorUnitAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseAuctionType(value: string): AuctionType | null {
  switch (value) {
    case AuctionType.REVERSE:
      return AuctionType.REVERSE;
    case AuctionType.FORWARD:
      return AuctionType.FORWARD;
    case AuctionType.SEALED_BID:
      return AuctionType.SEALED_BID;
    default:
      return null;
  }
}

export function selectFinalAcceptedBidAmount(
  auctionType: AuctionType,
  acceptedAmounts: ReadonlyArray<number>,
): number | null {
  const validAmounts = acceptedAmounts.filter(isMinorUnitAmount);
  if (validAmounts.length === 0) {
    return null;
  }

  if (auctionType === AuctionType.FORWARD) {
    return Math.max(...validAmounts);
  }

  return Math.min(...validAmounts);
}

export function buildHistoricalAuctionResults(
  auctions: ReadonlyArray<HistoricalAuctionRow>,
  bids: ReadonlyArray<HistoricalBidRow>,
): HistoricalAuctionResult[] {
  const amountsByAuctionId = new Map<string, number[]>();

  for (const bid of bids) {
    if (!isMinorUnitAmount(bid.amount)) {
      continue;
    }

    const existingAmounts = amountsByAuctionId.get(bid.auction_id) ?? [];
    existingAmounts.push(bid.amount);
    amountsByAuctionId.set(bid.auction_id, existingAmounts);
  }

  return auctions.map((auction) => {
    const auctionType = parseAuctionType(auction.type);
    const finalBidAmount = auctionType
      ? selectFinalAcceptedBidAmount(auctionType, amountsByAuctionId.get(auction.id) ?? [])
      : null;

    return {
      ...auction,
      final_bid_amount: finalBidAmount,
      ceiling_utilisation_pct:
        finalBidAmount != null && auction.ceiling_price > 0
          ? Math.round((finalBidAmount / auction.ceiling_price) * 100)
          : null,
    };
  });
}
