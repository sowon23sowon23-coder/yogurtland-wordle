'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#C10F5E', '#A8D84B', '#FFC93C', '#FF8FB8', '#fff'];

type Piece = { left: number; color: string; duration: number; delay: number };

/** Falls once and removes itself. Pieces are generated after mount so server and client markup match. */
export function Confetti() {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setPieces(
      Array.from({ length: 44 }, (_, i) => ({
        left: Math.random() * 100,
        color: COLORS[i % COLORS.length] as string,
        duration: 1.8 + Math.random() * 1.6,
        delay: Math.random() * 0.5,
      }))
    );
    const t = setTimeout(() => setDone(true), 4200);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          className="conf"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
