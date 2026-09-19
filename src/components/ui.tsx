import Link from 'next/link';
import type { TileMark } from '@/lib/types';

export function Logo({ light, size = 17 }: { light?: boolean; size?: number }) {
  return (
    <div className={`logo${light ? ' lt' : ''}`} style={{ fontSize: size }}>
      Yogurtland<small>get real.</small>
    </div>
  );
}

export type BarButton = { href: string; icon: string; label: string };

export function TopBar({
  left,
  right,
  light,
}: {
  left?: BarButton;
  right?: BarButton;
  light?: boolean;
}) {
  const btn = (b?: BarButton) =>
    b ? (
      <Link className="back" href={b.href} aria-label={b.label}>
        {b.icon}
      </Link>
    ) : (
      <span className="sp" />
    );
  return (
    <div className="topbar">
      {btn(left)}
      <Logo light={light} />
      {btn(right)}
    </div>
  );
}

type TileRowProps = {
  letters?: string;
  marks?: (TileMark | 'blank')[];
  /** Square tiles (used outside the game board, where height isn't set by the grid). */
  sq?: boolean;
  flip?: boolean;
  /** Highlight typed-but-unsubmitted letters. */
  cursor?: boolean;
};

export function TileRow({ letters = '', marks, sq, flip, cursor }: TileRowProps) {
  return (
    <div className={`row${sq ? ' sq' : ''}`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const ch = letters[i] ?? '';
        let cls = '';
        if (marks) cls = ` ${marks[i] ?? 'blank'}${flip ? ' flip' : ''}`;
        else if (cursor && ch) cls = ' cursor';
        return (
          <div key={i} className={`tile${cls}`}>
            {ch}
          </div>
        );
      })}
    </div>
  );
}

export function tierLabel(tier: 'free_topping' | 'ten_percent' | null | undefined): string {
  return tier === 'free_topping' ? 'One free topping' : '10% off your order';
}
