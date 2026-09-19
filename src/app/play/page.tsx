'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TileRow, TopBar } from '@/components/ui';
import { fetchToday, postGuess, type ClientGuessResponse } from '@/lib/client-api';
import { MAX_ATTEMPTS, type GuessRecord, type TileMark } from '@/lib/types';

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const RANK: Record<TileMark, number> = { absent: 1, present: 2, correct: 3 };

function errorMessage(reason: Extract<ClientGuessResponse, { ok: false }>['reason']): string {
  switch (reason) {
    case 'invalid_length':
      return 'Not enough letters';
    case 'invalid_characters':
      return 'Letters only';
    case 'not_in_wordlist':
      return 'Not in word list';
    case 'no_word_today':
      return 'No word today yet';
    case 'network':
      return 'Connection problem';
    default:
      return 'Something went wrong';
  }
}

/** Best mark seen so far for each letter, for coloring the keyboard. */
function letterStates(guesses: GuessRecord[]): Record<string, TileMark> {
  const best: Record<string, TileMark> = {};
  for (const { guess, marks } of guesses) {
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i];
      const mark = marks[i];
      if (!letter || !mark) continue;
      const prev = best[letter];
      if (!prev || RANK[mark] > RANK[prev]) best[letter] = mark;
    }
  }
  return best;
}

export default function PlayPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [current, setCurrent] = useState('');
  const [toast, setToast] = useState('');
  const [shake, setShake] = useState(false);
  const [flipIdx, setFlipIdx] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const load = useCallback(async () => {
    setPhase('loading');
    const r = await fetchToday();
    if (!r.ok) return setPhase('error');
    if (r.data.status === 'won' || r.data.status === 'lost') {
      router.replace('/result');
      return;
    }
    setGuesses(r.data.guesses);
    setPhase('ready');
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const flash = useCallback(
    (msg: string) => {
      setToast(msg);
      setShake(true);
      later(() => setShake(false), 400);
      later(() => setToast((t) => (t === msg ? '' : t)), 2000);
    },
    [later]
  );

  const submit = useCallback(async () => {
    if (busy || finished || phase !== 'ready') return;
    if (current.length < 5) return flash('Not enough letters');

    setBusy(true);
    const res = await postGuess(current);
    setBusy(false);

    if (!res.ok) {
      if (res.reason === 'already_finished') {
        router.replace('/result');
        return;
      }
      flash(errorMessage(res.reason));
      return;
    }

    setFlipIdx(guesses.length);
    setGuesses((g) => [...g, { guess: current, marks: res.marks }]);
    setCurrent('');

    if (res.status === 'won' || res.status === 'lost') {
      setFinished(true);
      later(() => router.push('/result'), 900);
    }
  }, [busy, finished, phase, current, guesses.length, flash, later, router]);

  const press = useCallback(
    (key: string) => {
      if (phase !== 'ready' || finished) return;
      if (key === 'ENTER') void submit();
      else if (key === 'DEL') setCurrent((c) => c.slice(0, -1));
      else setCurrent((c) => (c.length < 5 ? c + key : c));
    },
    [phase, finished, submit]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') press('ENTER');
      else if (e.key === 'Backspace') press('DEL');
      else if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toUpperCase());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  const states = useMemo(() => letterStates(guesses), [guesses]);

  const rows = [];
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const g = guesses[i];
    if (g) rows.push(<TileRow key={i} letters={g.guess} marks={g.marks} flip={i === flipIdx} />);
    else if (i === guesses.length && !finished) rows.push(<TileRow key={i} letters={current} cursor />);
    else rows.push(<TileRow key={i} />);
  }

  return (
    <section className="screen dark">
      <TopBar
        light
        left={{ href: '/', icon: '←', label: 'Back' }}
        right={{ href: '/how-to-play', icon: '?', label: 'How to play' }}
      />
      <div className="attempt">
        <span className="pill">
          Attempt <b>{Math.min(guesses.length + 1, MAX_ATTEMPTS)}</b> of {MAX_ATTEMPTS}
        </span>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
      <div className="boardwrap">
        <div className={`grid${shake ? ' shake' : ''}`}>{rows}</div>
        {phase === 'error' && (
          <div className="notice" role="alert">
            <b>Couldn&apos;t load today&apos;s word</b>
            <span>Check your connection and try again.</span>
            <button className="btn" onClick={load}>
              RETRY
            </button>
          </div>
        )}
      </div>
      <div className="kb">
        {KEY_ROWS.map((line, i) => {
          const keys = line.split('').map((c) => (
            <button key={c} className={`key ${states[c] ?? ''}`} onClick={() => press(c)}>
              {c}
            </button>
          ));
          if (i === 1) {
            return (
              <div key={i} className="kr pad">
                {keys}
              </div>
            );
          }
          if (i === 2) {
            return (
              <div key={i} className="kr">
                <button className="key wide" onClick={() => press('ENTER')}>
                  ENTER
                </button>
                {keys}
                <button className="key wide" onClick={() => press('DEL')} aria-label="Delete">
                  ⌫
                </button>
              </div>
            );
          }
          return (
            <div key={i} className="kr">
              {keys}
            </div>
          );
        })}
      </div>
    </section>
  );
}
