import { expect,it } from 'vitest';
import { renderEmail } from '../../lib/email/templates';
it('rend les alertes, bilans et confirmations des trois offres sans envoi ni texte de publication',()=>{
  const siteOrigin='https://mentioncheck.fr';
  const alert=renderEmail({kind:'critical-compliance',siteOrigin,verificationId:'10000000-0000-4000-8000-000000000001',signals:3});
  expect(alert.text).toContain('3 signal(s)');expect(alert.html).toContain('/dashboard/archive/');
  const monthly=renderEmail({kind:'monthly-report',siteOrigin,period:'11/2026',checks:30,risks:5});
  expect(monthly.text).toContain('5 signal(s)');
  for(const plan of ['solo','pro','studio'] as const)expect(renderEmail({kind:'subscription-confirmed',siteOrigin,plan}).text).toContain('est enregistrée');
  expect(()=>renderEmail({kind:'monthly-report',siteOrigin,period:'<script>',checks:30,risks:5})).toThrow();
  expect(()=>renderEmail({kind:'critical-compliance',siteOrigin,verificationId:'secret',signals:3})).toThrow();
});
