const {
  WALLETS,
  DATA_API,
  RPC_URLS,
  TOKENS,
  ERC20_BALANCE_OF_SIG
} = require('./constants');

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', ...(options.headers || {}) },
    ...options
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.json();
}

async function rpcCallWithFallback(method, params) {
  let lastError = null;

  for (const url of RPC_URLS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params
        })
      });

      if (!response.ok) {
        throw new Error(`RPC HTTP ${response.status} from ${url}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(`${url}: ${json.error.message || 'RPC error'}`);
      }

      return json.result;
    } catch (error) {
      lastError = error;
      console.warn('RPC failed:', url, error?.message || error);
    }
  }

  throw lastError || new Error('All RPCs failed');
}

function encodeBalanceOf(address) {
  const clean = address.toLowerCase().replace(/^0x/, '');
  return ERC20_BALANCE_OF_SIG + clean.padStart(64, '0');
}

async function fetchTokenBalance(walletAddress, tokenAddress, decimals = 6) {
  const data = encodeBalanceOf(walletAddress);
  const hex = await rpcCallWithFallback('eth_call', [{ to: tokenAddress, data }, 'latest']);

  if (!hex || hex === '0x') return 0;

  const raw = BigInt(hex);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = raw % scale;

  return Number(whole) + Number(frac) / Number(scale);
}

async function fetchAllCashBalances(address) {
  const balances = {};

  for (const token of TOKENS) {
    try {
      balances[token.symbol] = await fetchTokenBalance(address, token.address, token.decimals);
    } catch (error) {
      console.warn(`Failed to fetch ${token.symbol} for ${address}:`, error?.message || error);
      balances[token.symbol] = 0;
    }
  }

  balances.totalCash = (balances['USDC.e'] || 0) + (balances['USDC'] || 0);
  return balances;
}

async function fetchPositions(address) {
  const limit = 500;
  const sizeThreshold = 0;
  let offset = 0;
  const out = [];

  while (true) {
    const batch = await fetchJSON(
      `${DATA_API}/positions?user=${address}&sizeThreshold=${sizeThreshold}&limit=${limit}&offset=${offset}&sortBy=CURRENT&sortDirection=DESC`
    );

    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return out;
}

async function fetchPositionValue(address) {
  const result = await fetchJSON(`${DATA_API}/value?user=${address}`);

  if (Array.isArray(result) && result.length) return Number(result[0].value || 0);
  if (result && typeof result === 'object' && 'value' in result) return Number(result.value || 0);
  return 0;
}

async function buildCurrentMetrics() {
  const results = await Promise.all(
    WALLETS.map(async (address) => {
      const [positions, cashBreakdown, positionValue] = await Promise.all([
        fetchPositions(address),
        fetchAllCashBalances(address),
        fetchPositionValue(address).catch((error) => {
          console.warn(`Value fetch failed for ${address}:`, error?.message || error);
          return 0;
        })
      ]);

      return {
        address,
        positions: Array.isArray(positions) ? positions : [],
        cashBreakdown: cashBreakdown || { 'USDC.e': 0, USDC: 0, totalCash: 0 },
        cash: Number(cashBreakdown?.totalCash || 0),
        positionValue: Number(positionValue || 0)
      };
    })
  );

  const allPositions = results.flatMap((item) => item.positions);
  const totalCash = results.reduce((sum, item) => sum + Number(item.cash || 0), 0);
  const totalPositionValue = results.reduce((sum, item) => sum + Number(item.positionValue || 0), 0);
  const totalPortfolio = totalCash + totalPositionValue;

  const totalUnrealized = allPositions.reduce((sum, p) => sum + Number(p.cashPnl || 0), 0);
  const totalRealized = allPositions.reduce((sum, p) => sum + Number(p.realizedPnl || 0), 0);
  const totalPnl = totalUnrealized + totalRealized;

  return {
    totalPortfolio,
    totalCash,
    totalPositionValue,
    totalUnrealized,
    totalRealized,
    totalPnl,
    walletCount: WALLETS.length,
    positionCount: allPositions.length,
    wallets: results.map((item) => ({
      address: item.address,
      cash: Number(item.cash || 0),
      positions: Number(item.positionValue || 0),
      usdc_e: Number(item.cashBreakdown?.['USDC.e'] || 0),
      usdc: Number(item.cashBreakdown?.USDC || 0)
    }))
  };
}

function buildSnapshotFromMetrics(metrics, ts = new Date().toISOString()) {
  return {
    ts,
    totalPortfolio: Number(metrics.totalPortfolio || 0),
    totalCash: Number(metrics.totalCash || 0),
    totalPositionValue: Number(metrics.totalPositionValue || 0),
    totalUnrealized: Number(metrics.totalUnrealized || 0),
    totalRealized: Number(metrics.totalRealized || 0),
    totalPnl: Number(metrics.totalPnl || 0),
    wallets: Array.isArray(metrics.wallets) ? metrics.wallets : []
  };
}

module.exports = {
  buildCurrentMetrics,
  buildSnapshotFromMetrics
};
