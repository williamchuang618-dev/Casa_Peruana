import Link from 'next/link';
import { Chakana } from '@/components/landing/scene';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from '@/components/auth-forms';

export const metadata = { title: 'Sign in — La Casa Peruana' };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/clubs');
  return (
    <main className="grid min-h-full place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Chakana className="mx-auto mb-4 h-9 w-9 fill-brand" />
          <h1 className="display text-3xl font-light text-ink-900">La Casa Peruana</h1>
          <p className="micro mt-2 text-ink-400">Asistencia y participación · Ayni</p>
        </div>
        <div className="card card-pad">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-sm text-ink-500">
          No account? <Link href="/signup" className="font-medium text-brand hover:underline">Create one</Link>
        </p>
      </div>
    </main>
  );
}
