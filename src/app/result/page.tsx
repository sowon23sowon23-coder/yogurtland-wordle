'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Confetti } from '@/components/Confetti';
import { TileRow, TopBar, tierLabel } from '@/components/ui';
import { fetchToday } from '@/lib/client-api';
import { MAX_ATTEMPTS, type TodayResponse } from '@/lib/types';

const EMOJI = { correct: '🟩', present: '🟨', absent: '⬛' } as const;

function shareText(data: TodayResponse): string {
  const won = data.status === 'won';
  const grid = data.guesses.map((g) => g.marks.map((m) => EMOJI[m]).join('')).join('\n');
  return `Yogurtland Daily Word ${won ? data.attempts : 'X'}/${MAX_ATTEMPTS}\n${grid}`;
}

export default function ResultPage() {
  const router = useRouter();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let live = true;
    fetchToday().then((r) => {
      if (!live) return;
      if (!r.ok) return setFailed(true);
      if (r.data.status !== 'won' && r.data.status !== 'lost') {
        router.replace('/play');
        return;
      }
      setData(r.data);
    });
    return () => {
      live = false;
    };
  }, [router]);

  const share = async () => {
    if (!data) return;
    const text = shareText(data);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard blocked: nothing useful to report.
    }
  };

  const bar = (
    <div className="abs-top">
      <TopBar light left={{ href: '/', icon: '✕', label: 'Close' }} />
    </div>
  );

  if (failed) {
    return (
      <section className="screen dark" style={{ justifyContent: 'center' }}>
        {bar}
        <div className="card">
          <h3>Oops</h3>
          <p className="msg">Couldn&apos;t load your result. Check your connection and try again.</p>
          <button className="btn" onClick={() => location.reload()}>
            RETRY
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="screen dark">
        {bar}
      </section>
    );
  }

  const won = data.status === 'won';
  const answer = data.answer ?? '';
  const winRate = data.stats.plays > 0 ? Math.round((data.stats.wins / data.stats.plays) * 100) : 0;

  return (
    <section className="screen dark" style={{ justifyContent: 'center' }}>
      {bar}
      {won && <Confetti />}
      <div className="card">
        <h3>{won ? 'Nice one!' : 'So close!'}</h3>
        <p className="msg">
          {won
            ? `Solved in ${data.attempts} ${data.attempts === 1 ? 'try' : 'tries'}`
            : "Today's word was"}
        </p>
        <TileRow letters={answer} marks={Array(5).fill(won ? 'correct' : 'absent')} sq />
        {won ? (
          <div className="prizebox">
            <div className="eyebrow" style={{ color: '#5C7F15' }}>
              You won
            </div>
            <div className="t">{tierLabel(data.rewardTier)}</div>
            <div className="s">Claim your code on the next screen</div>
          </div>
        ) : (
          <div className="prizebox soft">
            <div className="eyebrow">Next word</div>
            <div className="t">
              A new word is
              <br />
              waiting tomorrow
            </div>
          </div>
        )}
        <div className="stats">
          <div className="pill">
            <div className="v">{data.stats.plays}</div>
            <div className="k">Played</div>
          </div>
          <div className="pill">
            <div className="v">{data.stats.streak}</div>
            <div className="k">Streak</div>
          </div>
          <div className="pill">
            <div className="v">{winRate}%</div>
            <div className="k">Win rate</div>
          </div>
        </div>
        {won ? (
          <Link className="btn lime" href="/reward">
            GET MY REWARD
          </Link>
        ) : (
          <Link className="btn" href="/">
            BACK HOME
          </Link>
        )}
        <button className="link" onClick={share}>
          {shared ? 'Copied to clipboard!' : 'Share result'}
        </button>
      </div>
    </section>
  );
}
