'use client';

import { useState } from 'react';

interface TagAutocompleteProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
  maxSuggestions?: number;
  showChips?: boolean;
  chipClassName?: string;
  inputClassName?: string;
}

/**
 * Тег/стек-инпут с живым поиском по словарю (обычно — навыки/технологии из
 * /skills). В отличие от навыков профиля теги — просто string[] без своей
 * модели в БД, поэтому "нет совпадения" не блокирует — Enter всё равно
 * добавит введённый текст как есть.
 */
export function TagAutocomplete({
  value,
  onChange,
  suggestions,
  placeholder = 'Начните вводить...',
  maxSuggestions = 8,
  showChips = true,
  chipClassName = 'rounded-full bg-card-sand px-3 py-1.5 text-xs font-semibold text-stone-700 hover:line-through',
  inputClassName = 'field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm',
}: TagAutocompleteProps) {
  const [query, setQuery] = useState('');

  const matches = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(q)).slice(0, maxSuggestions);
  })();

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || value.includes(trimmed)) {
      setQuery('');
      return;
    }
    onChange([...value, trimmed]);
    setQuery('');
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  return (
    <div>
      <div className="relative">
        <input
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || !query.trim()) return;
            e.preventDefault();
            addTag(matches[0] ?? query);
          }}
          className={inputClassName}
        />
        {query.trim() && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-2xl border border-stone-100 bg-white shadow-lg">
            {matches.length > 0 ? (
              matches.map((s) => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(s);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-brand/10 hover:text-brand"
                >
                  {s}
                </button>
              ))
            ) : (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(query);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-stone-500"
              >
                Нет такого — нажмите Enter, чтобы добавить «{query.trim()}»
              </button>
            )}
          </div>
        )}
      </div>
      {showChips && value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <button key={tag} type="button" onClick={() => removeTag(tag)} className={chipClassName}>
              {tag} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
