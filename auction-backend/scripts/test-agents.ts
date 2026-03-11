/**
 * Standalone agent smoke test.
 * Bypasses NestJS entirely — calls the agent runner functions directly.
 *
 * At startup, the script discovers existing seeded auctions from Supabase by title
 * fragment so that every agent runs against real, persistent data — no data is
 * created or destroyed by this script.
 *
 *   Agent 1 (Price Intelligence)   → Auction A (OPEN REVERSE, office-supplies)
 *   Agent 2 (Vendor Shortlisting)  → Auction A (OPEN REVERSE, office-supplies)
 *   Agent 3 (Anomaly Detection)    → Auction A (OPEN, has collusion-pattern bids)
 *   Agent 4 (Award Recommendation) → Auction B (CLOSED FORWARD, stationery)
 *
 * Expected seed state (run tests/seed.py first if any check fails):
 *   - An auction whose title contains "Auction A" with status OPEN must exist
 *   - An auction whose title contains "Auction B" with status CLOSED must exist
 *   - Auction A must have ≥ 3 ACCEPTED bids (for meaningful anomaly analysis)
 *   - Auction A must have ≥ 1 ACCEPTED vendor invitation (for shortlisting)
 *
 * Run:
 *   node --env-file=.env node_modules/.bin/tsx scripts/test-agents.ts
 *
 * Optional env overrides:
 *   AGENT=price           → run only Price Intelligence
 *   AGENT=shortlist       → run only Vendor Shortlisting
 *   AGENT=anomaly         → run only Anomaly Detection
 *   AGENT=award           → run only Award Recommendation
 *   TEST_AUCTION_ID=...   → override the open auction ID (Agents 1, 2, 3)
 *   TEST_AUCTION_B_ID=... → override the closed auction ID (Agent 4)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runPriceIntelligenceAgent } from '../src/agents/price-intelligence/price-intelligence.agent.js';
import { runVendorShortlistAgent } from '../src/agents/vendor-shortlist/vendor-shortlist.agent.js';
import { runAnomalyDetectionAgent } from '../src/agents/anomaly-detection/anomaly-detection.agent.js';
import { runAwardRecommendationAgent } from '../src/agents/award-recommendation/award-recommendation.agent.js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_AUCTION_ID, TEST_AUCTION_B_ID, AGENT } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR  Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR  Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Auction row shape (only what we need)
// ---------------------------------------------------------------------------

interface AuctionRow {
  id: string;
  title: string;
  category: string;
  ceiling_price: number;
  status: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Discover seeded auctions from Supabase at startup
// ---------------------------------------------------------------------------

async function findAuction(db: SupabaseClient, titleFragment: string, status: string): Promise<AuctionRow | null> {
  const { data } = await db
    .from('auctions')
    .select('id, title, category, ceiling_price, status, type')
    .ilike('title', `%${titleFragment}%`)
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(1);

  return (data?.[0] as AuctionRow | undefined) ?? null;
}

async function findLatestBidAmount(
  db: SupabaseClient,
  auctionId: string,
  ceilingPrice: number,
): Promise<number> {
  const { data } = await db
    .from('bids')
    .select('amount')
    .eq('auction_id', auctionId)
    .eq('status', 'ACCEPTED')
    .order('submitted_at', { ascending: false })
    .limit(1);

  // Fall back to 80% of ceiling so the agent has a realistic amount to analyse
  // even if the auction has no bids yet (e.g. in a fresh seed environment).
  return (data?.[0] as { amount: number } | undefined)?.amount ?? Math.floor(ceilingPrice * 0.8);
}

// ---------------------------------------------------------------------------
// Pre-flight data readiness check
// ---------------------------------------------------------------------------

async function checkDataReadiness(
  db: SupabaseClient,
  openAuctionId: string,
): Promise<void> {
  const [bidsResult, invitationsResult] = await Promise.all([
    db
      .from('bids')
      .select('id', { count: 'exact', head: true })
      .eq('auction_id', openAuctionId)
      .eq('status', 'ACCEPTED'),
    db
      .from('vendor_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('auction_id', openAuctionId)
      .eq('status', 'ACCEPTED'),
  ]);

  const bidCount = bidsResult.count ?? 0;
  const invitationCount = invitationsResult.count ?? 0;

  const bidStatus = bidCount >= 3 ? '✓' : `⚠  (${bidCount} found — run tests/seed.py for richer anomaly data)`;
  const invStatus = invitationCount >= 1 ? '✓' : `⚠  (0 found — shortlist agent will find no accepted candidates)`;

  console.log(`\n  Data readiness (Auction A):`);
  console.log(`    Accepted bids       : ${bidCount}  ${bidStatus}`);
  console.log(`    Accepted invitations: ${invitationCount}  ${invStatus}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function header(title: string): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function printResult(label: string, result: unknown): void {
  console.log(`\n[OK]  ${label}`);
  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// Agent test functions — each receives the resolved auction context
// ---------------------------------------------------------------------------

async function testPriceIntelligence(
  auctionId: string,
  category: string,
  ceiling: number,
  auctionType: 'REVERSE' | 'FORWARD' | 'SEALED_BID',
): Promise<void> {
  header('Agent 1 — Price Intelligence');
  console.log(`auctionId=${auctionId}  category=${category}  type=${auctionType}  ceiling=${ceiling} paise (₹${ceiling / 100})`);
  const result = await runPriceIntelligenceAgent(
    db,
    auctionId,
    `Smoke Test ${category}`,
    category,
    ceiling,
    auctionType,
  );
  printResult(`output  (tokens=${result.tokensUsed}  tools=${result.toolCalls.length})`, result);
}

async function testVendorShortlist(auctionId: string, category: string): Promise<void> {
  header('Agent 2 — Vendor Shortlisting');
  // Split category string into keywords (e.g. "office-supplies" → ["office", "supplies"])
  const keywords = category.split(/[-,\s]+/).filter(Boolean);
  console.log(`auctionId=${auctionId}  keywords=${keywords.join(', ')}`);
  const result = await runVendorShortlistAgent(db, auctionId, keywords);
  printResult(`output  (tokens=${result.tokensUsed}  tools=${result.toolCalls.length})`, result);
}

async function testAnomalyDetection(auctionId: string, latestBidAmount: number): Promise<void> {
  header('Agent 3 — Anomaly Detection');
  console.log(`auctionId=${auctionId}  latestBid=${latestBidAmount} paise (₹${latestBidAmount / 100})`);
  const result = await runAnomalyDetectionAgent(db, auctionId, 'smoke-test-run', latestBidAmount);
  printResult(`output  (tokens=${result.tokensUsed}  tools=${result.toolCalls.length})`, result);
}

async function testAwardRecommendation(auctionId: string): Promise<void> {
  header('Agent 4 — Award Recommendation');
  console.log(`auctionId=${auctionId}`);
  const result = await runAwardRecommendationAgent(db, auctionId);
  printResult(`output  (tokens=${result.tokensUsed}  tools=${result.toolCalls.length})`, result);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`\nAuction Engine — Agent Smoke Test`);
  console.log(`  Querying Supabase for seeded test auctions...`);

  // Resolve open auction (Agents 1, 2, 3): env override → seeded Auction A → error
  let openAuction: AuctionRow | null = null;
  if (TEST_AUCTION_ID) {
    const { data } = await db
      .from('auctions')
      .select('id, title, category, ceiling_price, status, type')
      .eq('id', TEST_AUCTION_ID)
      .single();
    openAuction = (data as AuctionRow | null);
    if (!openAuction) {
      console.error(`ERROR  TEST_AUCTION_ID=${TEST_AUCTION_ID} not found in DB`);
      process.exit(1);
    }
  } else {
    openAuction = await findAuction(db, 'Auction A', 'OPEN');
    if (!openAuction) {
      console.error('ERROR  Could not find "Auction A" (OPEN) in Supabase.');
      console.error('       Run tests/seed.py first, or set TEST_AUCTION_ID=<uuid>');
      process.exit(1);
    }
  }

  // Resolve closed auction (Agent 4): env override → seeded Auction B → error
  let closedAuction: AuctionRow | null = null;
  if (TEST_AUCTION_B_ID) {
    const { data } = await db
      .from('auctions')
      .select('id, title, category, ceiling_price, status, type')
      .eq('id', TEST_AUCTION_B_ID)
      .single();
    closedAuction = (data as AuctionRow | null);
    if (!closedAuction) {
      console.error(`ERROR  TEST_AUCTION_B_ID=${TEST_AUCTION_B_ID} not found in DB`);
      process.exit(1);
    }
  } else {
    closedAuction = await findAuction(db, 'Auction B', 'CLOSED');
    if (!closedAuction) {
      console.error('ERROR  Could not find "Auction B" (CLOSED) in Supabase.');
      console.error('       Run tests/seed.py first, or set TEST_AUCTION_B_ID=<uuid>');
      process.exit(1);
    }
  }

  const latestBid = await findLatestBidAmount(db, openAuction.id, openAuction.ceiling_price);

  await checkDataReadiness(db, openAuction.id);

  console.log(`\n  [OPEN auction]   id=${openAuction.id}`);
  console.log(`                   title="${openAuction.title}"`);
  console.log(`                   category=${openAuction.category}  ceiling=${openAuction.ceiling_price}`);
  console.log(`                   latestBid=${latestBid} paise`);
  console.log(`  [CLOSED auction] id=${closedAuction.id}`);
  console.log(`                   title="${closedAuction.title}"`);
  console.log(`  agent filter     : ${AGENT ?? 'all'}\n`);

  try {
    switch (AGENT) {
      case 'price':
        await testPriceIntelligence(openAuction.id, openAuction.category, openAuction.ceiling_price, openAuction.type as 'REVERSE' | 'FORWARD' | 'SEALED_BID');
        break;
      case 'shortlist':
        await testVendorShortlist(openAuction.id, openAuction.category);
        break;
      case 'anomaly':
        await testAnomalyDetection(openAuction.id, latestBid);
        break;
      case 'award':
        await testAwardRecommendation(closedAuction.id);
        break;
      default:
        await testPriceIntelligence(openAuction.id, openAuction.category, openAuction.ceiling_price, openAuction.type as 'REVERSE' | 'FORWARD' | 'SEALED_BID');
        await testVendorShortlist(openAuction.id, openAuction.category);
        await testAnomalyDetection(openAuction.id, latestBid);
        await testAwardRecommendation(closedAuction.id);
    }
    console.log('\n[DONE]  All selected agents completed.\n');
  } catch (err) {
    console.error('\n[FAIL]  Unexpected error:', err);
    process.exit(1);
  }
}

void main();
