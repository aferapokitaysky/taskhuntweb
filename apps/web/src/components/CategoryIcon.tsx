import { CodeIcon } from './icons/illustrated/CodeIcon';
import { HouseholdIcon } from './icons/illustrated/HouseholdIcon';
import { DesignIcon } from './icons/illustrated/DesignIcon';
import { MarketingIcon } from './icons/illustrated/MarketingIcon';
import { TextIcon } from './icons/illustrated/TextIcon';
import { BuildIcon } from './icons/illustrated/BuildIcon';

const ICON_BY_SLUG_PREFIX: { prefix: string; Icon: (props: { className?: string }) => JSX.Element }[] = [
  { prefix: 'it-и-разработка', Icon: CodeIcon },
  { prefix: 'бытовые-услуги', Icon: HouseholdIcon },
  { prefix: 'дизайн', Icon: DesignIcon },
  { prefix: 'маркетинг', Icon: MarketingIcon },
  { prefix: 'тексты-и-переводы', Icon: TextIcon },
];

/** Иконка категории по её slug — top-level категории имеют свою иллюстрацию,
 * для всего остального (новые категории, добавленные админом) — нейтральный BuildIcon. */
export function CategoryIcon({ slug, className }: { slug: string; className?: string }) {
  const match = ICON_BY_SLUG_PREFIX.find((entry) => slug.startsWith(entry.prefix));
  const Icon = match?.Icon ?? BuildIcon;
  return <Icon className={className} />;
}
