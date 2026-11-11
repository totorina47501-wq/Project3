import { expect, it } from 'vitest';
import { acceptableRegistrationPassword } from '../../lib/security/password-policy';

it('refuse les mots de passe courts, faibles ou incomplets face aux règles Supabase', () => {
  for (const password of [
    '1234567890123456',
    'abcdefghijkL',
    'abcdefghijk1',
    'SHORT!A1',
    'password1234',
    'aaaaaaaaAAAAaaaa',
    'phraseTest2026',          // pas de symbole
    'phrase-test2026',         // pas de majuscule
    'PHRASE-TEST2026',         // pas de minuscule
    'phrase-Test-Extra',       // pas de chiffre
    'une Phrase É 2026',      // une lettre accentuée ne remplace pas un symbole reconnu par Supabase
    'a'.repeat(201) + 'A1!', // longueur maximale
  ]) {
    expect(acceptableRegistrationPassword(password)).toBe(false);
  }
});

it('accepte les quatre familles de caractères dont un symbole reconnu', () => {
  for (const password of ['une-Phrase de passe 2030', 'Mot!dePasse2026', 'Abcdefg12345#']) {
    expect(acceptableRegistrationPassword(password)).toBe(true);
  }
});
