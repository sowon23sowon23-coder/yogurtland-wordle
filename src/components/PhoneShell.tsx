'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Phone-shaped frame on desktop (scaled to fit the window); full screen on real phones. */
export function PhoneShell({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      el.style.transform =
        window.innerWidth > 430 ? `scale(${Math.min(1, (window.innerHeight - 36) / 800)})` : '';
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="phone" ref={ref}>
      <div className="notch" />
      <div id="app">{children}</div>
    </div>
  );
}
