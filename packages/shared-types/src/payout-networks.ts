/**
 * Сети для вывода средств — источник правды один на бэк и фронт, чтобы
 * не разъезжались валидация (@IsIn на бэке) и пикер сети на фронте.
 * Порядок — самые популярные первыми (это же порядок отображения в UI).
 */
export const PAYOUT_NETWORKS = [
  'TRC20',
  'ERC20',
  'BEP20',
  'SOL',
  'TON',
  'BTC',
  'MATIC',
  'ARB',
  'OP',
  'AVAX',
  'BASE',
  'LTC',
  'DOGE',
  'XRP',
  'ADA',
  'DOT',
  'ATOM',
  'NEAR',
  'ALGO',
  'FTM',
] as const;

export type PayoutNetwork = (typeof PAYOUT_NETWORKS)[number];
