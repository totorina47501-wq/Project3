// Protection complémentaire à Supabase Auth, qui conserve l'autorité sur le mot de passe.
// Configuration Production : 12 caractères min., minuscules + majuscules + chiffres + symbole autorisé.
const allowedSymbols = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export function acceptableRegistrationPassword(password: string): boolean {
  if (typeof password !== 'string' || password.length < 12 || password.length > 200) return false;
  return /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && [...password].some((character) => allowedSymbols.includes(character));
}
