import { PasswordResetRequestForm } from '@/components/PasswordRecoveryForms';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return <PasswordResetRequestForm invalidLink={params.error === 'invalid_link'} />;
}
