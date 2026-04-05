const WALLETS = [
  '0x6049761986af66Cd8E78997C940766Bd69C7F14f',
  '0x33aB58E55895f39619815D31dFc92d90d65F9523'
];

const DATA_API = 'https://data-api.polymarket.com';
const RPC_URLS = [
  'https://polygon-rpc.com',
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic'
];

const TOKENS = [
  { symbol: 'USDC.e', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
  { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 }
];

const ERC20_BALANCE_OF_SIG = '0x70a08231';
const SNAPSHOT_BLOB_PATH = 'polymarket-snapshots.json';
const SNAPSHOT_MIN_INTERVAL_MS = 60_000;
const SNAPSHOT_MAX_ITEMS = 10_000;

module.exports = {
  WALLETS,
  DATA_API,
  RPC_URLS,
  TOKENS,
  ERC20_BALANCE_OF_SIG,
  SNAPSHOT_BLOB_PATH,
  SNAPSHOT_MIN_INTERVAL_MS,
  SNAPSHOT_MAX_ITEMS
};
