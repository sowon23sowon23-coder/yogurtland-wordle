'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar, tierLabel } from '@/components/ui';
import { claimReward } from '@/lib/client-api';
import type { RewardTier } from '@/lib/types';

type View =
  | { kind: 'loading' }
  | { kind: 'assigned'; code: string; expiresAt: string | null; tier: RewardTier }
  | { kind: 'sold_out' }
  | { kind: 'error' };

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RewardPage() {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  // The server returns the same code if this game already claimed one, so retrying is safe.
  const claim = useCallback(async () => {
    setView({ kind: 'loading' });
    const r = await claimReward();
    if (r.status === 'assigned') {
      setView({ kind: 'assigned', code: r.code, expiresAt: r.expiresAt, tier: r.tier });
    } else if (r.status === 'sold_out') {
      setView({ kind: 'sold_out' });
    } else if (r.reason === 'not_a_winner' || r.reason === 'no_game_today') {
      router.replace('/');
    } else {
      setView({ kind: 'error' });
    }
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void claim();
  }, [claim]);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; the code is on screen anyway.
    }
  };

  return (
    <section className="screen">
      <TopBar left={{ href: '/result', icon: '←', label: 'Back' }} />
      <div className="scroll">
        {view.kind === 'loading' && (
          <div className="state">
            <b>Getting your reward…</b>
          </div>
        )}

        {view.kind === 'assigned' && (
          <>
            <div className="ticket">
              <div className="eyebrow">Your reward code</div>
              <div className="t">{tierLabel(view.tier)}</div>
              <div className="ccode">{view.code}</div>
              <div className="note">
                {view.expiresAt ? `Valid through ${formatDate(view.expiresAt)} · ` : ''}One use
              </div>
              <div className="secure">
                <span />
                Reward ready
              </div>
            </div>
            <button className="btn white" style={{ marginTop: 22 }} onClick={() => copy(view.code)}>
              {copied ? 'COPIED!' : 'COPY CODE'}
            </button>
            <p className="tiny">Show this code at the register.</p>
            <Link className="link" href="/" style={{ marginTop: 'auto' }}>
              Back home
            </Link>
          </>
        )}

        {view.kind === 'sold_out' && (
          <div className="state">
            <b>Today&apos;s rewards are all gone</b>
            <p>Every reward has been claimed for now. Play again tomorrow for another chance!</p>
            <Link className="btn" href="/">
              BACK HOME
            </Link>
          </div>
        )}

        {view.kind === 'error' && (
          <div className="state">
            <b>Couldn&apos;t get your reward</b>
            <p>Something went wrong. Your win is saved, so you can try again.</p>
            <button className="btn" onClick={claim}>
              TRY AGAIN
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
