import { AuctionType, TrafficLightStatus } from '../common/types';

/**
 * Computes the traffic light status for a vendor's bid relative to the current best price.
 *
 * GREEN:  vendor is within greenPct% of the best price (competitive)
 * YELLOW: vendor is within yellowPct% of the best price (marginal)
 * RED:    vendor is further than yellowPct% from the best price (not competitive)
 * DISABLED: sealed bid or no current best price
 *
 * Direction is inverted per auction type:
 *  - REVERSE: lower bids are better — gap = how much higher vendor is than best
 *  - FORWARD: higher bids are better — gap = how much lower vendor is than best
 */
export function computeTrafficLight(
  auctionType: AuctionType,
  vendorBidAmount: number,
  currentBestPrice: number,
  greenPct: number,
  yellowPct: number,
): TrafficLightStatus {
  if (!currentBestPrice) return TrafficLightStatus.DISABLED;
  if (auctionType === AuctionType.SEALED_BID) return TrafficLightStatus.DISABLED;

  let gapPct: number;
  if (auctionType === AuctionType.REVERSE) {
    // REVERSE: vendor wants to be low — gap = how much higher vendor bid is than best
    gapPct = ((vendorBidAmount - currentBestPrice) / currentBestPrice) * 100;
  } else {
    // FORWARD: vendor wants to be high — gap = how much lower vendor bid is than best
    gapPct = ((currentBestPrice - vendorBidAmount) / currentBestPrice) * 100;
  }

  if (gapPct <= greenPct) return TrafficLightStatus.GREEN;
  if (gapPct <= yellowPct) return TrafficLightStatus.YELLOW;
  return TrafficLightStatus.RED;
}
