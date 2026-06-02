import { cslList } from '../bib/cslList';
import { langList, langListRaw } from '../bib/cslLangList';

import type { CslSearchOption } from './CslSearchField';

export function searchCSL(inputValue: string): CslSearchOption[] {
  const q = inputValue.trim();
  if (!q) return [];
  return cslList.search(q).map((res) => res.item);
}

export function searchCSLLangs(inputValue: string): CslSearchOption[] {
  const q = inputValue.trim();
  if (!q) {
    return langListRaw.map((item) => ({
      value: item.value,
      label: item.label,
    }));
  }
  return langList.search(q).map((res) => ({
    value: res.item.value,
    label: res.item.label,
  }));
}
