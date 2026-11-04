import {test,expect} from '@playwright/test';
// Un test HTTP de refus, sans suppression, sans appel IA et sans secret.
test('la route interne de purge refuse les requêtes publiques',async({request})=>{
  const response=await request.post('/api/internal/media-retention');
  expect([401,503]).toContain(response.status());
  const body=await response.json() as {eligible?:number; removed?:number};
  expect(body.removed).toBeUndefined();
});
