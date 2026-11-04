import { describe,expect,it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { buildRegistryPdf } from '../../lib/archive/pdf';
describe('Registre de collaborations informatif',()=>{
  it('conserve un PDF lisible et pagine les longs registres',async()=>{
    const rows=Array.from({length:30},(_,i)=>({id:'collaboration-'+i,brand_name:'Marque été '+i,start_date:'2026-11-04',end_date:null,archived_at:null,hash_sha256:null}));
    const bytes=await buildRegistryPdf(rows);
    const pdf=await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toContain('Registre');
    expect(pdf.getSubject()).toContain('non certifie');
    expect(pdf.getPages().length).toBeGreaterThan(1);
  });
});
