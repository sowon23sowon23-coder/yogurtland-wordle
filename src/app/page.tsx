'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TileRow, TopBar } from '@/components/ui';
import { fetchToday } from '@/lib/client-api';
import type { GameStatus } from '@/lib/types';

const SPLASH_KEY = 'yl_splash_seen';
const SPRINKLE_COLORS = ['#C10F5E', '#A8D84B', '#FFC93C', '#4E3AA8', '#E02B45', '#7A4A2B'];

type Sprinkle = { left: number; w: number; h: number; color: string; duration: number; delay: number };

function Splash({ onStart }: { onStart: () => void }) {
  const [sprinkles, setSprinkles] = useState<Sprinkle[]>([]);

  // Random values are generated after mount so server and client markup match.
  useEffect(() => {
    setSprinkles(
      Array.from({ length: 22 }, (_, i) => ({
        left: Math.random() * 100,
        w: 4 + Math.random() * 3,
        h: 11 + Math.random() * 7,
        color: SPRINKLE_COLORS[i % SPRINKLE_COLORS.length] as string,
        duration: 5 + Math.random() * 5,
        delay: -Math.random() * 8,
      }))
    );
  }, []);

  return (
    <section
      className="screen s-splash"
      role="button"
      tabIndex={0}
      aria-label="Tap to start"
      onClick={onStart}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onStart();
      }}
    >
      <div className="sprinkles" aria-hidden="true">
        {sprinkles.map((s, i) => (
          <i
            key={i}
            className="sprinkle"
            style={{
              left: `${s.left}%`,
              width: s.w,
              height: s.h,
              background: s.color,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="logo" style={{ fontSize: 26, position: 'relative', zIndex: 2 }}>
        Yogurtland<small>get real.</small>
      </div>
      <h1 className="splash-title">
        <span className="a">DAILY</span>
        <span className="b">WORD</span>
      </h1>
      <div className="swirl">
        <svg viewBox="0 0 120 120" width="150" height="150" aria-hidden="true">
          <ellipse cx="60" cy="104" rx="34" ry="9" fill="#C10F5E" opacity=".18" />
          <path d="M28 66h64l-7 34a8 8 0 0 1-8 7H43a8 8 0 0 1-8-7z" fill="#fff" stroke="#E9C9D8" strokeWidth="2" />
          <path
            d="M60 12c-9 4-13 12-9 17-11 1-16 10-10 16-12 2-16 13-6 18 3 2 8 3 13 3h24c14 0 20-9 12-16 9-6 4-16-8-17 5-6 0-14-9-18-2-1-5-2-7-3z"
            fill="#FFFDFB"
            stroke="#EFD9E3"
            strokeWidth="2"
          />
          <circle cx="44" cy="60" r="7" fill="#E02B45" />
          <circle cx="42" cy="57" r="2" fill="#fff" opacity=".6" />
          <circle cx="76" cy="58" r="6" fill="#4E3AA8" />
          <circle cx="74" cy="56" r="1.8" fill="#fff" opacity=".5" />
          <circle cx="60" cy="64" r="6.5" fill="#8CC63F" />
          <rect x="82" y="66" width="11" height="11" rx="3" fill="#FFC93C" transform="rotate(12 87 71)" />
          <circle cx="34" cy="70" r="5.5" fill="#7A4A2B" />
        </svg>
      </div>
      <div className="tapstart">TAP TO START</div>
    </section>
  );
}

function dateLabel(playDate: string | undefined): string {
  if (!playDate) return 'Today';
  const d = new Date(`${playDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'Today';
  return `Today · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function Home() {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [playDate, setPlayDate] = useState<string>();

  useEffect(() => {
    let live = true;
    fetchToday().then((r) => {
      if (!live || !r.ok) return;
      setStatus(r.data.status);
      setPlayDate(r.data.playDate);
    });
    return () => {
      live = false;
    };
  }, []);

  const finished = status === 'won' || status === 'lost';
  const cta = finished
    ? { href: '/result', label: 'SEE RESULT' }
    : status === 'in_progress'
      ? { href: '/play', label: 'CONTINUE' }
      : { href: '/play', label: 'PLAY' };

  return (
    <section className="screen">
      <TopBar right={{ href: '/how-to-play', icon: '?', label: 'How to play' }} />
      <div className="scroll">
        <h1 className="home-title">
          <span className="a">DAILY</span>
          <span className="b">WORD</span>
        </h1>
        <div className="day">
          <span className="eyebrow">{dateLabel(playDate)}</span>
        </div>
        <p className="sub">Guess the five-letter word in six tries</p>
        <div className="hero-card">
          <TileRow letters="TODAY" marks={Array(5).fill('correct')} sq />
          <div className="eyebrow">Today&apos;s prizes</div>
          <div className="prize">
            <i>🍦</i>Solve in 3<b>free topping</b>
          </div>
          <div className="prize">
            <i>🎟️</i>Solve in 4–6<b>10% off</b>
          </div>
        </div>
        <div className="home-actions">
          <Link className="btn" href={cta.href}>
            {cta.label}
          </Link>
          <Link className="btn white" href="/how-to-play">
            HOW TO PLAY
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  // null until we've checked sessionStorage, so returning visitors don't see a splash flash.
  const [stage, setStage] = useState<'splash' | 'home' | null>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SPLASH_KEY) === '1';
    } catch {
      // Storage can be blocked (private mode); just show the splash.
    }
    setStage(seen ? 'home' : 'splash');
  }, []);

  const start = () => {
    try {
      sessionStorage.setItem(SPLASH_KEY, '1');
    } catch {
      // ignore
    }
    setStage('home');
  };

  if (stage === null) return null;
  return stage === 'splash' ? <Splash onStart={start} /> : <Home />;
}
