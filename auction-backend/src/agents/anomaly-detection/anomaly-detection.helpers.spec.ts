import { AuctionType } from '../../common/types';
import {
  selectLatestSuccessfulMetadata,
  shouldRaiseBelowRiskAlert,
} from './anomaly-detection.helpers';

describe('anomaly-detection.helpers', () => {
  it('should choose the newest metadata row backed by a successful agent run', () => {
    // Arrange
    const candidates = [
      {
        risk_threshold: 12_000,
        risk_note: 'newest but failed',
        confidence_level: 'HIGH',
        agent_run_id: 'run-failed',
        created_at: '2026-03-10T12:00:00.000Z',
      },
      {
        risk_threshold: 11_000,
        risk_note: 'latest successful',
        confidence_level: 'HIGH',
        agent_run_id: 'run-success',
        created_at: '2026-03-10T11:59:00.000Z',
      },
    ];

    // Act
    const result = selectLatestSuccessfulMetadata(candidates, new Set(['run-success']));

    // Assert
    expect(result).toEqual(candidates[1]);
  });

  it('should reject below-risk alerts when the bid is above the threshold', () => {
    // Arrange
    const latestBidAmount = 15_000;
    const riskThreshold = 12_000;

    // Act
    const result = shouldRaiseBelowRiskAlert(
      AuctionType.REVERSE,
      latestBidAmount,
      riskThreshold,
    );

    // Assert
    expect(result).toBe(false);
  });

  it('should reject below-risk alerts for non-reverse auctions', () => {
    // Arrange
    const latestBidAmount = 11_000;
    const riskThreshold = 12_000;

    // Act
    const result = shouldRaiseBelowRiskAlert(
      AuctionType.FORWARD,
      latestBidAmount,
      riskThreshold,
    );

    // Assert
    expect(result).toBe(false);
  });

  it('should allow below-risk alerts when a reverse-auction bid is lower than the threshold', () => {
    // Arrange
    const latestBidAmount = 11_000;
    const riskThreshold = 12_000;

    // Act
    const result = shouldRaiseBelowRiskAlert(
      AuctionType.REVERSE,
      latestBidAmount,
      riskThreshold,
    );

    // Assert
    expect(result).toBe(true);
  });
});
