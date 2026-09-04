'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AndesScene, Chakana, Greca } from './scene';

interface Props {
  signedIn: boolean;
  entryHref: string;
  stats: { members: number; events: number; attendance: number };
}

export function Landing({ signedIn, entryHref, stats }: Props) {
  const [scroll, setScroll] = useState(0);
  const heroRef = useRef<HTMLElement>(null);

  // One rAF-throttled scroll listener drives every parallax layer; separate
  // listeners per element is how these pages end up janky.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setScroll(window.scrollY);
        frame = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Sections rise into place as they enter, mirroring the reference's cuts.
  useEffect(() => {
    const targets = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-in')),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.12 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const heroH = heroRef.current?.offsetHeight ?? 800;
  const p = Math.min(1, scroll / Math.max(1, heroH));
  const past = scroll > heroH * 0.72;

  return (
    <div className="bg-noche">
      <Cursor />
      <TopBar past={past} signedIn={signedIn} entryHref={entryHref} />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative h-[100svh] min-h-[620px] overflow-hidden">
        <div className="absolute inset-0" style={{ transform: `scale(${1 + p * 0.08})` }}>
          <AndesScene
            far={scroll * 0.06}
            mid={scroll * 0.12}
            peak={scroll * 0.19}
            terrace={scroll * 0.27}
            mist={scroll * 0.14}
          />
        </div>
        <div className="rule-grid absolute inset-0" aria-hidden />
        {/* Scrim runs left-to-right, not top-to-bottom: the headline needs a
            dark bed, but flattening the whole frame would kill the dawn. */}
        <div className="absolute inset-0 bg-gradient-to-r from-noche/90 via-noche/35 to-transparent" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-b from-noche/55 via-transparent to-noche/45" aria-hidden />

        <div className="relative flex h-full flex-col justify-end px-5 pb-24 sm:px-8 sm:pb-28 lg:px-12">
          <p className="micro reveal text-[#f0d59a]">Tawantinsuyu · desde 1438</p>
          <h1
            className="reveal reveal-delay-1 display mt-4 max-w-4xl text-[clamp(2.9rem,9vw,7.5rem)] font-light leading-[0.92] tracking-[-0.02em] text-[#f6f1e7]"
            style={{ transform: `translateY(${p * -40}px)`, opacity: 1 - p * 0.8 }}
          >
            La Casa
            <br />
            Peruana
          </h1>
          <p className="reveal reveal-delay-2 mt-6 max-w-md text-sm leading-relaxed text-[#f6f1e7]/70">
            Una casa se sostiene como se sostiene un muro inca — piedra sobre piedra, sin argamasa,
            cada una cargando el peso de la siguiente.
          </p>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-5 sm:px-8 lg:px-12">
          <span className="micro text-[#f6f1e7]/45">13°09′48″S 72°32′44″W</span>
          <span className="micro flex items-center gap-2 text-[#f6f1e7]/45">
            Desliza
            <span className="block h-8 w-px bg-[#f6f1e7]/30">
              <span className="block h-3 w-px animate-pulse bg-[#e8c268]" />
            </span>
          </span>
        </div>
      </section>

      {/* ── Statement panel ──────────────────────────────────────────────── */}
      <Panel tone="brand" label="Ayni · Reciprocidad">
        <h2 className="display max-w-3xl text-[clamp(2rem,5.5vw,4.2rem)] font-light leading-[1.02] tracking-[-0.015em]">
          Hoy por ti,
          <br />
          mañana por mí.
        </h2>
        <div className="mt-10 grid max-w-3xl gap-8 sm:grid-cols-2">
          <p className="text-sm leading-relaxed opacity-80">
            <span className="micro mb-2 block opacity-60">El principio</span>
            Ayni is the Andean law of reciprocity: what the community gives you, you give back. A club
            runs on exactly that. Showing up is not paperwork — it is the debt you settle with everyone
            who showed up for you.
          </p>
          <p className="text-sm leading-relaxed opacity-80">
            <span className="micro mb-2 block opacity-60">La práctica</span>
            So attendance here is not a punishment ledger. It is a record of who is holding the wall up,
            kept honestly, visible to everyone, and never acted on automatically.
          </p>
        </div>
      </Panel>

      {/* ── Full-bleed masonry ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-noche py-32 sm:py-44">
        <Masonry offset={scroll} />
        <div className="rule-grid absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-5 sm:px-8 lg:px-12">
          <p className="micro reveal text-[#e8c268]/80">Sillería · Cantería inca</p>
          <h2 className="reveal reveal-delay-1 display mt-4 max-w-3xl text-[clamp(1.9rem,5vw,3.8rem)] font-light leading-[1.05] text-[#f6f1e7]">
            Cada piedra sostiene
            <br />a la siguiente.
          </h2>
          <p className="reveal reveal-delay-2 mt-6 max-w-lg text-sm leading-relaxed text-[#f6f1e7]/65">
            Inca walls hold without mortar because every stone is cut to the ones around it. Remove one
            and the course above sags. That is the whole argument for tracking participation — and the
            whole reason removing someone is a decision a person makes, never a number.
          </p>
        </div>
      </section>

      {/* ── The three laws ───────────────────────────────────────────────── */}
      <Panel tone="night" label="Las tres leyes">
        <h2 className="display max-w-2xl text-[clamp(1.9rem,5vw,3.6rem)] font-light leading-[1.05]">
          Lo que se nos pide.
        </h2>
        <ul className="mt-12 grid gap-px overflow-hidden border-y border-[#f6f1e7]/15 sm:grid-cols-3">
          {[
            ['Ama sua', 'No robes', 'Do not take from the house what you did not give it — the roster is honest or it is nothing.'],
            ['Ama llulla', 'No mientas', 'Every mark is signed and time-stamped. If a record is wrong, it gets corrected in the open.'],
            ['Ama quella', 'No seas ocioso', 'Show up. Three absences and the board reviews your standing — with your full history in front of them.'],
          ].map(([quechua, spanish, body], i) => (
            <li key={quechua} className={`reveal reveal-delay-${i + 1} py-8 sm:px-7 sm:first:pl-0`}>
              <p className="display text-2xl text-[#e8c268]">{quechua}</p>
              <p className="micro mt-1 opacity-55">{spanish}</p>
              <p className="mt-4 text-sm leading-relaxed opacity-75">{body}</p>
            </li>
          ))}
        </ul>
      </Panel>

      {/* ── Counters ─────────────────────────────────────────────────────── */}
      <section className="border-y border-line bg-canvas py-20">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 sm:grid-cols-3 sm:px-8">
          <Counter value={stats.members} label="Miembros activos" hint="En la casa" />
          <Counter value={stats.events} label="Eventos este semestre" hint="Reuniones, talleres, sociales" />
          <Counter value={stats.attendance} suffix="%" label="Asistencia del club" hint="Promedio registrado" />
        </div>
      </section>

      {/* ── Entry ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand px-5 py-28 text-[#f6f1e7] sm:px-8">
        <Chakana className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 fill-[#f6f1e7]/10" />
        <div className="relative mx-auto max-w-5xl">
          <p className="micro reveal opacity-70">Entra a la casa</p>
          <h2 className="reveal reveal-delay-1 display mt-4 max-w-2xl text-[clamp(2rem,5.5vw,4rem)] font-light leading-[1.02]">
            {signedIn ? 'Tu casa te espera.' : 'Toma asistencia en un minuto.'}
          </h2>
          <div className="reveal reveal-delay-2 mt-10 flex flex-wrap items-center gap-3">
            <Link
              href={entryHref}
              data-cursor="grow"
              className="btn rounded-full bg-[#f6f1e7] px-7 py-3.5 text-sm text-[#221a12] transition-transform hover:scale-[1.03] hover:bg-white"
            >
              {signedIn ? 'Ir al panel' : 'Entrar'}
            </Link>
            {!signedIn ? (
              <Link
                href="/signup"
                data-cursor="grow"
                className="btn rounded-full border border-[#f6f1e7]/40 px-7 py-3.5 text-sm text-[#f6f1e7] hover:bg-[#f6f1e7]/10"
              >
                Crear cuenta
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="bg-noche text-[#f6f1e7]">
        <Greca className="h-5 w-full text-[#e8c268]/25" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-10 sm:px-8">
          <span className="flex items-center gap-3">
            <Chakana className="h-6 w-6 fill-[#e8c268]" />
            <span className="display text-lg">La Casa Peruana</span>
          </span>
          <span className="micro opacity-45">Asistencia y participación · Ayni</span>
        </div>
      </footer>
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────────────── */

function TopBar({ past, signedIn, entryHref }: { past: boolean; signedIn: boolean; entryHref: string }) {
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4 transition-colors duration-500 sm:px-8 lg:px-12 ${
        past ? 'bg-canvas/90 text-ink-900 backdrop-blur-md' : 'text-[#f6f1e7]'
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5" data-cursor="grow">
        <Chakana className={`h-5 w-5 transition-colors ${past ? 'fill-brand' : 'fill-[#e8c268]'}`} />
        <span className="micro">La Casa Peruana</span>
      </Link>
      <Link
        href={entryHref}
        data-cursor="grow"
        className={`micro rounded-full border px-4 py-2 transition-colors ${
          past ? 'border-ink-900/25 hover:bg-ink-900 hover:text-canvas' : 'border-[#f6f1e7]/40 hover:bg-[#f6f1e7] hover:text-noche'
        }`}
      >
        {signedIn ? 'Panel' : 'Entrar'}
      </Link>
    </header>
  );
}

function Panel({
  tone, label, children,
}: { tone: 'brand' | 'night'; label: string; children: React.ReactNode }) {
  const skin =
    tone === 'brand' ? 'bg-brand text-[#f6f1e7]' : 'bg-[#120c07] text-[#f6f1e7]';
  return (
    <section className={`${skin} px-5 py-28 sm:px-8 sm:py-36`}>
      <div className="mx-auto max-w-6xl">
        <p className="micro reveal mb-6 opacity-60">{label}</p>
        <div className="reveal reveal-delay-1">{children}</div>
      </div>
    </section>
  );
}

/**
 * Polygonal masonry, the way the Inca actually cut it — irregular many-sided
 * blocks fitted without mortar, not a running brick bond. Corner jitter comes
 * from a deterministic hash of the block index rather than Math.random, so the
 * server and the client draw the identical wall and React never complains.
 */
function Masonry({ offset }: { offset: number }) {
  const jitter = (n: number, amp: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return (v - Math.floor(v) - 0.5) * 2 * amp;
  };

  const courses = [
    { y: 0, h: 78, widths: [232, 178, 312, 146, 262, 198, 174, 288], dir: 1 },
    { y: 78, h: 64, widths: [162, 298, 212, 252, 188, 322, 228], dir: -1 },
    { y: 142, h: 92, widths: [278, 196, 242, 328, 166, 274, 216], dir: 1 },
    { y: 234, h: 60, widths: [204, 258, 182, 302, 238, 192, 278], dir: -1 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.14]" aria-hidden>
      <svg viewBox="0 0 1800 294" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        {courses.map((c, ci) => {
          let x = -240;
          const blocks = c.widths.concat(c.widths).map((w, bi) => {
            const k = ci * 31 + bi;
            const left = x;
            x += w;
            const top = c.y + 4;
            const bot = c.y + c.h - 4;
            const right = left + w - 5;
            // Every vertex drifts a little, and the long edges bow, which is
            // what makes a polygonal wall look cut rather than moulded.
            const pts = [
              [left + 5 + jitter(k, 5), top + jitter(k + 1, 4)],
              [left + w * 0.42, top + jitter(k + 2, 6)],
              [right + jitter(k + 3, 5), top + 3 + jitter(k + 4, 5)],
              [right + jitter(k + 5, 4), bot - 4 + jitter(k + 6, 5)],
              [left + w * 0.55, bot + jitter(k + 7, 6)],
              [left + 5 + jitter(k + 8, 5), bot - 2 + jitter(k + 9, 4)],
            ];
            return (
              <polygon
                key={bi}
                points={pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ')}
                fill="#f6f1e7"
                fillOpacity={bi % 3 === 0 ? 0.46 : bi % 3 === 1 ? 0.3 : 0.36}
                stroke="#f6f1e7"
                strokeOpacity="0.18"
                strokeWidth="1"
              />
            );
          });
          return (
            <g key={ci} transform={`translate(${((offset * 0.05 * c.dir) % 360) - 180} 0)`}>
              {blocks}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Counter({
  value, label, hint, suffix = '',
}: { value: number; label: string; hint: string; suffix?: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / 1100);
          setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="reveal border-t border-ink-900/15 pt-5">
      <p className="display text-5xl font-light tabular-nums text-brand">
        {shown}
        {suffix}
      </p>
      <p className="mt-2 text-sm font-medium text-ink-900">{label}</p>
      <p className="micro mt-1 text-ink-400">{hint}</p>
    </div>
  );
}

/** A thin gold ring that trails the pointer and swells over anything clickable. */
function Cursor() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = ref.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let tx = x;
    let ty = y;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      const over = (e.target as Element | null)?.closest?.('a,button,[data-cursor]');
      if (over) el.setAttribute('data-grow', '');
      else el.removeAttribute('data-grow');
    };
    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    el.style.opacity = '1';
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-50 hidden h-8 w-8 rounded-full border border-[#e8c268] opacity-0 transition-[width,height,opacity] duration-200 lg:block data-[grow]:h-14 data-[grow]:w-14"
    />
  );
}
