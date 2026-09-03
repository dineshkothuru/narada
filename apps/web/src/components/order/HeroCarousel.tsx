import { useEffect, useRef, useState, type ReactNode } from "react";

// Zomato-style auto-rotating hero: swipeable snap cards + dots.
export default function HeroCarousel({ children }: { children: ReactNode[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const count = children.length;

  useEffect(() => {
    if (count < 2) return;
    const iv = setInterval(() => {
      if (pausedRef.current) return;
      const track = trackRef.current;
      if (!track) return;
      const next = (Math.round(track.scrollLeft / track.clientWidth) + 1) % count;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, 3800);
    return () => clearInterval(iv);
  }, [count]);

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  if (count === 0) return null;

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={onScroll}
        onTouchStart={() => (pausedRef.current = true)}
        onTouchEnd={() => (pausedRef.current = false)}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {children.map((child, i) => (
          <div key={i} className="w-full shrink-0 snap-center px-4">
            {child}
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5">
          {children.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-5 bg-white" : "w-1.5 bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
