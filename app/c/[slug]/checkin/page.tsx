import Link from 'next/link';
import { requireClub } from '@/lib/club-context';
import { CheckInForm } from '@/components/checkin-form';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'Check in — La Casa Peruana' };

export default async function CheckInPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClub(slug);

  return (
    <div className="mx-auto max-w-sm">
      <PageHeader eyebrow="Registro de entrada" title="Check in" subtitle={ctx.club.name} />
      <div className="card card-pad">
        <p className="mb-4 text-sm text-ink-500">
          Enter the code shown at the meeting. Checking in more than ten minutes after the start time
          records you as Late.
        </p>
        <CheckInForm slug={slug} />
      </div>
      <p className="mt-4 text-center text-sm">
        <Link href={`/c/${slug}/me`} className="text-brand hover:underline">View my attendance</Link>
      </p>
    </div>
  );
}
