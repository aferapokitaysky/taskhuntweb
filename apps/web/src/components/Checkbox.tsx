import { CheckIcon } from '@/components/icons/CheckIcon';

/** Кастомный чекбокс вместо нативного — квадрат со скруглением и галочкой в стиле остальной иконографии. */
export function Checkbox({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
}) {
  return (
    <label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors duration-150 ${
          checked ? 'border-brand bg-brand' : 'border-stone-300 bg-white'
        }`}
      >
        {checked && <CheckIcon className="h-3.5 w-3.5 text-white" />}
      </button>
      {label && <span className="text-sm text-stone-700">{label}</span>}
    </label>
  );
}
