// Protection complémentaire sur le point d'inscription ; ne remplace pas Supabase Auth.
export function acceptableRegistrationPassword(password:string):boolean {
  if(typeof password!=='string'||password.length<12||password.length>200)return false;
  // Pas d'interdiction de phrases de passe longues ; seulement trois familles.
  const classes=[/[a-z]/.test(password),/[A-Z]/.test(password),/[0-9]/.test(password),/[^\da-zA-Z\s]/.test(password)];
  return classes.filter(Boolean).length>=3;
}
