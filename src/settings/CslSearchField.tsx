import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

import { t } from '../lang/helpers';

export type CslSearchOption = { value: string; label: string };

const RESULT_LIMIT = 40;

interface CslSearchFieldProps {
  initialOption?: CslSearchOption | null;
  placeholder: string;
  search: (query: string) => CslSearchOption[];
  /** Liste affichée au focus sans requête (ex. toutes les langues). */
  listOnEmptyFocus?: boolean;
  emptyNoQuery?: string;
  emptyNoMatch?: string;
  onSelect: (option: CslSearchOption | null) => void;
}

export function CslSearchField({
  initialOption,
  placeholder,
  search,
  listOnEmptyFocus = false,
  emptyNoQuery = t('Type to search CSL styles'),
  emptyNoMatch = t('No matching CSL styles'),
  onSelect,
}: CslSearchFieldProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<CslSearchOption | null>(
    initialOption ?? null
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CslSearchOption[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (!trimmed && listOnEmptyFocus) {
        setResults(search('').slice(0, RESULT_LIMIT));
        return;
      }
      if (!trimmed) {
        setResults([]);
        return;
      }
      setResults(search(trimmed).slice(0, RESULT_LIMIT));
    },
    [search, listOnEmptyFocus]
  );

  useEffect(() => {
    if (!menuOpen) return;
    const handle = window.setTimeout(() => runSearch(query), 120);
    return () => window.clearTimeout(handle);
  }, [query, menuOpen, runSearch]);

  const pick = (opt: CslSearchOption) => {
    setSelected(opt);
    setQuery('');
    setResults([]);
    setMenuOpen(false);
    onSelect(opt);
  };

  const clear = () => {
    setSelected(null);
    setQuery('');
    setResults([]);
    onSelect(null);
    inputRef.current?.focus();
  };

  const showMenu =
    menuOpen &&
    (results.length > 0 ||
      query.trim().length > 0 ||
      (listOnEmptyFocus && !query.trim()));

  return (
    <div className="pwc-csl-search">
      {selected ? (
        <div className="pwc-csl-search__selected">
          <span className="pwc-csl-search__selected-label">{selected.label}</span>
          <button
            type="button"
            className="clickable-icon pwc-csl-search__clear"
            aria-label={t('Clear selection')}
            onClick={clear}
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="pwc-csl-search__field">
        <input
          ref={inputRef}
          type="search"
          className="pwc-csl-search__input"
          value={query}
          placeholder={placeholder}
          aria-expanded={showMenu}
          aria-controls={showMenu ? listId : undefined}
          aria-autocomplete="list"
          onChange={(e) => setQuery(e.currentTarget.value)}
          onFocus={() => {
            setMenuOpen(true);
            if (listOnEmptyFocus && !query.trim()) {
              runSearch('');
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setMenuOpen(false), 160);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setMenuOpen(false);
              setResults([]);
            }
          }}
        />

        {showMenu ? (
          <ul id={listId} className="pwc-csl-search__list" role="listbox">
            {results.length === 0 ? (
              <li className="pwc-csl-search__empty" role="option">
                {query.trim() ? emptyNoMatch : emptyNoQuery}
              </li>
            ) : (
              results.map((opt) => (
                <li key={opt.value} role="presentation">
                  <button
                    type="button"
                    className="pwc-csl-search__option"
                    role="option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt)}
                  >
                    {opt.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
