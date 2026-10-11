import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { imageUrl } from "../../lib/api";

const INTERVAL = 5000;

function SlideLink({ to, className, children }) {
  if (!to) return null;
  return /^https?:\/\//.test(to)
    ? <a href={to} className={className} target="_blank" rel="noopener noreferrer">{children}</a>
    : <Link to={to} className={className}>{children}</Link>;
}

export default function HeroCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = slides.length;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const go = useCallback((i) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused || reduceMotion) return;
    const id = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(id);
  }, [index, count, paused, reduceMotion, go]);

  useEffect(() => { if (index >= count) setIndex(0); }, [count, index]);

  if (!count) {
    return <section className="h-[60vh] min-h-[420px] bg-gradient-to-br from-burgundy to-burgundy-dark" aria-label="Featured" />;
  }

  return (
    <section
      data-testid="hero-carousel"
      aria-roledescription="carousel"
      aria-label="Featured offers"
      className="relative h-[64vh] sm:h-[72vh] min-h-[420px] max-h-[760px] overflow-hidden bg-stone-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      {slides.map((s, i) => (
        <div
          key={s.id || i}
          role="group"
          aria-roledescription="slide"
          aria-label={`${i + 1} of ${count}`}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === index ? "opacity-100 z-10" : "opacity-0 z-0"}`}
        >
          <img src={imageUrl(s.image)} alt="" className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[6000ms] ease-out ${i === index && !reduceMotion ? "scale-105" : "scale-100"}`} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/5" />
          <div className="relative h-full max-w-7xl mx-auto px-6 sm:px-10 flex items-center">
            <div className="max-w-xl text-white">
              {s.title && <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl leading-tight mb-4">{s.title}</h2>}
              {s.subtitle && <p className="font-body text-base sm:text-lg text-white/85 mb-8 max-w-md">{s.subtitle}</p>}
              <SlideLink to={s.cta_link} className="inline-flex items-center gap-3 bg-white text-burgundy px-8 py-4 text-xs tracking-[0.2em] uppercase font-body font-semibold hover:bg-gold hover:text-white transition-colors">
                {s.cta_text || "Shop Now"} <ArrowRight className="w-4 h-4" />
              </SlideLink>
            </div>
          </div>
        </div>
      ))}

      {count > 1 && (
        <>
          <button onClick={() => go(index - 1)} aria-label="Previous slide" className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/40">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => go(index + 1)} aria-label="Next slide" className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/40">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((s, i) => (
              <button key={s.id || i} onClick={() => go(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === index}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-8 bg-white" : "w-3 bg-white/50 hover:bg-white/80"}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
