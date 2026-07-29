import { NetworkIcon, TokenIcon } from '@web3icons/react/dynamic';
import type { PayoutNetwork } from '@taskhunt/shared-types';

/**
 * Настоящие лого сетей (пакет @web3icons/react, MIT) — не рисуем сами.
 * Большинство сетей — через NetworkIcon (id из networks.json пакета),
 * пара чистых монет без своей сети (DOGE/LTC) — через TokenIcon.
 */
const NETWORK_ICON_ID: Record<PayoutNetwork, string> = {
  TRC20: 'tron',
  ERC20: 'ethereum',
  BEP20: 'binance-smart-chain',
  SOL: 'solana',
  TON: 'ton',
  BTC: 'bitcoin',
  MATIC: 'polygon',
  ARB: 'arbitrum-one',
  OP: 'optimism',
  AVAX: 'avalanche',
  BASE: 'base',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  XRP: 'xrp',
  ADA: 'cardano',
  DOT: 'polkadot',
  ATOM: 'cosmos',
  NEAR: 'near-protocol',
  ALGO: 'algorand',
  FTM: 'fantom',
};

const TOKEN_ONLY: Partial<Record<PayoutNetwork, boolean>> = { LTC: true, DOGE: true };

export function NetworkLogo({ network, size = 24, className }: { network: string; size?: number; className?: string }) {
  const id = NETWORK_ICON_ID[network as PayoutNetwork];
  const fallback = (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-stone-200 text-[9px] font-semibold text-stone-600 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      {network.slice(0, 3)}
    </span>
  );

  if (!id) return fallback;

  return TOKEN_ONLY[network as PayoutNetwork] ? (
    <TokenIcon id={id} size={size} variant="branded" className={className} fallback={fallback} />
  ) : (
    <NetworkIcon id={id} size={size} variant="branded" className={className} fallback={fallback} />
  );
}
