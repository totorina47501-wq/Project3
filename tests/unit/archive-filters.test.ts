import { describe,expect,it } from 'vitest';
import { archiveFiltersSchema,archivePageHref } from '../../lib/archive/filters';
describe('Filtres des archives privées',()=>{
  it('conserve les filtres dans les liens de pagination',()=>{
    const filters=archiveFiltersSchema.parse({platform:'instagram',status:'accepted',q:'Crème été',from:'2026-11-01',to:'2026-11-04'});
    const href=archivePageHref(filters,2);
    const params=new URL(href,'https://local.test').searchParams;
    expect(params.get('q')).toBe('Crème été');
    expect(params.get('platform')).toBe('instagram');
    expect(params.get('page')).toBe('2');
    expect(params.get('from')).toBe('2026-11-01');
  });
  it('rejette les dates impossibles, intervalles inversés et jokers SQL',()=>{
    for(const filters of [{from:'2026-02-30'},{from:'2026-11-04',to:'2026-11-01'},{page:'-1'},{q:'%'},{platform:'unknown'},{status:'certified'}]) {
      expect(archiveFiltersSchema.safeParse(filters).success).toBe(false);
    }
  });
});
