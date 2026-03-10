import { AuctionType } from '../../common/types';
import {
  buildHistoricalAuctionResults,
  selectFinalAcceptedBidAmount,
} from './price-intelligence.helpers';

describe('price-intelligence.helpers', () => {
  it('should use the lowest accepted bid for reverse auctions', () => {
    // Arrange
    const acceptedAmounts = [9_900, 9_500, 10_100];

    // Act
    const result = selectFinalAcceptedBidAmount(AuctionType.REVERSE, acceptedAmounts);

    // Assert
    expect(result).toBe(9_500);
  });

  it('should use the highest accepted bid for forward auctions', () => {
    // Arrange
    const acceptedAmounts = [9_900, 9_500, 10_100];

    // Act
    const result = selectFinalAcceptedBidAmount(AuctionType.FORWARD, acceptedAmounts);

    // Assert
    expect(result).toBe(10_100);
  });

  it('should build historical auction results with type-correct final bid amounts', () => {
    // Arrange
    const auctions = [
      { id: 'reverse-auction', title: 'Reverse', ceiling_price: 20_000, type: AuctionType.REVERSE },
      { id: 'forward-auction', title: 'Forward', ceiling_price: 20_000, type: AuctionType.FORWARD },
    ];
    const bids = [
      { auction_id: 'reverse-auction', amount: 18_500 },
      { auction_id: 'reverse-auction', amount: 17_250 },
      { auction_id: 'forward-auction', amount: 18_500 },
      { auction_id: 'forward-auction', amount: 19_750 },
    ];

    // Act
    const result = buildHistoricalAuctionResults(auctions, bids);

    // Assert
    expect(result).toEqual([
      expect.objectContaining({ id: 'reverse-auction', final_bid_amount: 17_250 }),
      expect.objectContaining({ id: 'forward-auction', final_bid_amount: 19_750 }),
    ]);
  });
});
