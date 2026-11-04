import { describe, expect, it } from 'vitest';
import { isExportTruncated } from '../../lib/privacy/export';

describe('Export des données personnelles sans fausse complétude',()=>{
  it('détecte une collection de plus de mille lignes même quand Supabase ne renvoie que 1000',()=>{
    expect(isExportTruncated(1305,1000)).toBe(true);
  });
  it('déclare complète une collection dont le nombre exact correspond',()=>{
    expect(isExportTruncated(1000,1000)).toBe(false);
    expect(isExportTruncated(33,33)).toBe(false);
  });
  it('reste conservateur sans nombre exact',()=>{
    expect(isExportTruncated(null,1000)).toBe(true);
    expect(isExportTruncated(undefined,999)).toBe(false);
  });
});
