const MASCOT_SRC = {
  hello: '/mascots/hello.webp',
  wave: '/mascots/wave.webp',
  celebrate: '/mascots/celebrate.webp',
  love: '/mascots/love.webp',
  think: '/mascots/think.webp',
  cry: '/mascots/cry.webp',
  cool: '/mascots/cool.webp',
  surprised: '/mascots/surprised.webp',
  search: '/mascots/search.webp',
  thumbsup: '/mascots/thumbsup.webp',
  tired: '/mascots/tired.webp',
  laptop: '/mascots/laptop.webp',
  guideQuestion: '/mascots/guide-question.webp',
  shieldCheck: '/mascots/shield-check.webp',
  invoiceCoin: '/mascots/invoice-coin.webp',
  magnifierPro: '/mascots/magnifier-pro.webp',
  supportHeadset: '/mascots/support-headset.webp',
  workLaptop: '/mascots/work-laptop.webp',
  boostRocket: '/mascots/boost-rocket.webp',
  qualityChecklist: '/mascots/quality-checklist.webp',
  payoutWallet: '/mascots/payout-wallet.webp',
  alertWarning: '/mascots/alert-warning.webp',
  successConfetti: '/mascots/success-confetti.webp',
  waitingSad: '/mascots/waiting-sad.webp',
} as const;

export type MascotName = keyof typeof MASCOT_SRC;

/**
 * Талисман TaskHunt для эмоциональных моментов (успех, пусто, приветствие) —
 * там, где ещё нет своей кастомной SVG-иконки. PNG с настоящей прозрачностью
 * (вырезаны по альфа-каналу из листа стикеров), поэтому рендерим как есть —
 * никакой подложки не нужно, только лёгкая тень для объёма.
 */
export function Mascot({
  name,
  size = 'h-16 w-16',
  className = '',
}: {
  name: MascotName;
  size?: string;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={MASCOT_SRC[name]}
      alt=""
      className={`inline-block shrink-0 animate-mascot-pop object-contain drop-shadow-md ${size} ${className}`}
    />
  );
}
