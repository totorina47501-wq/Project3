import {afterEach, expect, it, vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import Home from '../../app/page';

afterEach(()=>vi.unstubAllEnvs());
it('ne promet ni IA ni paiement quand la plateforme est en mode sans crédit',()=>{
 vi.stubEnv('OPENAI_PAUSED','true');
 vi.stubEnv('OPENAI_API_KEY','sk-secret-fixture-must-not-leak');
 vi.stubEnv('BILLING_ENABLED','false');
 const html=renderToStaticMarkup(createElement(Home));
 expect(html).toContain('Repérez les mentions commerciales');
 expect(html).toContain('Le contrôle de légende sans IA reste accessible');
 expect(html).toContain('sans utiliser de crédit IA');
 expect(html).toContain('Les tarifs sont indicatifs et les abonnements payants ne sont pas encore ouverts');
 expect(html).not.toContain('sk-secret-fixture-must-not-leak');
 expect(html).not.toContain('L&#x27;IA qui check');
});
it('affiche seulement les capacités disponibles avec clé serveur et opt-in IA',()=>{
 vi.stubEnv('OPENAI_PAUSED','false');
 vi.stubEnv('OPENAI_TEXT_ENABLED','true');
 vi.stubEnv('OPENAI_API_KEY','sk-fixture-server-only');
 vi.stubEnv('BILLING_ENABLED','false');
 const html=renderToStaticMarkup(createElement(Home));
 expect(html).toContain('IA qui check vos mentions légales');
 expect(html).not.toContain('Les analyses IA sont temporairement indisponibles');
 expect(html).not.toContain('sk-fixture-server-only');
});
