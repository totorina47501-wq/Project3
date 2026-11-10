import { expect,it } from 'vitest';
import { acceptableRegistrationPassword } from '../../lib/security/password-policy';
it('refuse les mots de passe courts, faibles ou sans diversité',()=>{
 for(const pw of ['1234567890123456','abcdefghijkL','abcdefghijk1','SHORT!A1','password1234','aaaaaaaaAAAA1111'])
   expect(acceptableRegistrationPassword(pw)).toBe(false);
});
it('accepte une phrase longue avec trois familles sans dictionnaire externe',()=>{
 expect(acceptableRegistrationPassword('une-Phrase de passe 2030')).toBe(true);
 expect(acceptableRegistrationPassword('a'.repeat(201)+'1A!')).toBe(false);
});
