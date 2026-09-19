import Link from 'next/link';
import { TileRow, TopBar } from '@/components/ui';

export const metadata = { title: 'How to play · Yogurtland Daily Word' };

export default function HowToPlayPage() {
  return (
    <section className="screen">
      <TopBar left={{ href: '/', icon: '←', label: 'Back' }} />
      <div className="scroll">
        <h1 className="title">How to play</h1>
        <p className="intro">
          Guess the word in six tries. After each guess, the tiles show how close you were.
        </p>
        <div className="howrow">
          <TileRow letters="MANGO" marks={['correct', 'blank', 'blank', 'blank', 'blank']} sq />
          <p>
            <b>M</b> is in the word and in the right spot.
          </p>
        </div>
        <div className="howrow">
          <TileRow letters="BERRY" marks={['blank', 'present', 'blank', 'blank', 'blank']} sq />
          <p>
            <b>E</b> is in the word but in the wrong spot.
          </p>
        </div>
        <div className="howrow">
          <TileRow letters="SWIRL" marks={['blank', 'blank', 'absent', 'blank', 'blank']} sq />
          <p>
            <b>I</b> is not in the word at all.
          </p>
        </div>
        <Link className="btn lime" href="/play" style={{ marginTop: 'auto' }}>
          START GAME
        </Link>
      </div>
    </section>
  );
}
