import { describe, expect, it } from 'vitest';
import { collectPages, listPrivateFiles } from '../../lib/privacy/export';

describe('Export privé paginé', () => {
  it('continue même si la limite serveur est inférieure à la taille demandée', async () => {
    const source = Array.from({ length: 1305 }, (_, id) => ({ id }));
    const offsets: number[] = [];
    const result = await collectPages(async (offset, size) => {
      offsets.push(offset);
      return { data: source.slice(offset, offset + Math.min(size, 200)), count: source.length, error: null };
    });
    expect(result).toHaveLength(1305);
    expect(offsets).toEqual([0,200,400,600,800,1000,1200]);
  });
  it('refuse une réponse vide alors que le décompte annonce encore des données', async () => {
    await expect(collectPages(async () => ({ data: [], count: 1, error: null }))).rejects.toThrow();
  });
  it('échoue explicitement si un plafond de sécurité est atteint', async () => {
    await expect(collectPages(async () => ({ data: [{ id: 1 }], count: 3, error: null }), 2)).rejects.toThrow();
  });
  it('énumère fichiers et sous dossiers sans émettre de lien signé', async () => {
    const visited: string[] = [];
    const files = await listPrivateFiles('verification-media','owner',async (prefix, offset) => {
      visited.push(`${prefix}:${offset}`);
      if(prefix === 'owner' && offset === 0) return { data: [{id:'file',name:'x.png',metadata:{size:12}},{id:null,name:'nested',metadata:null}], error:null };
      if(prefix === 'owner/nested' && offset === 0) return { data: [{id:'other',name:'y.png',metadata:{size:9}}], error:null };
      return {data:[],error:null};
    });
    expect(files.map(file=>file.path)).toEqual(['owner/x.png','owner/nested/y.png']);
    expect(visited).toContain('owner:2');
    expect(JSON.stringify(files)).not.toContain('http');
  });
  it('refuse les chemins sortant du préfixe propriétaire', async () => {
    await expect(listPrivateFiles('deal-contracts','owner',async()=>({data:[{id:'x',name:'../other'}],error:null}))).rejects.toThrow();
  });
});
