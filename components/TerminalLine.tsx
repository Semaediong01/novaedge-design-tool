// components/TerminalLine.tsx — a small "terminal" that types out the Nova Edge steps, one after another.
// Shows the full text without animation for people who prefer reduced motion.
"use client";

import { useEffect, useState } from "react";

const LINES = ["pick a piece", "make it yours", "we print on demand", "shipped to your door"];

export default function TerminalLine() {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(LINES[0].length);
  const [still, setStill] = useState(true); // starts static so server and browser match; switches on after load

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the motion preference once after hydration
    setStill(reduce);
    if (reduce) return;
    let i = 0;
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const line = LINES[i];
      if (n < line.length) {
        n += 1;
        setIndex(i);
        setTyped(n);
        timer = setTimeout(tick, 55);
      } else {
        timer = setTimeout(() => {
          i = (i + 1) % LINES.length;
          n = 0;
          setIndex(i);
          setTyped(0);
          timer = setTimeout(tick, 250);
        }, 1500);
      }
    };
    n = 0;
    setTyped(0);
    timer = setTimeout(tick, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <p className="term" aria-label={LINES.join(", ")}>
      <span className="term-prompt" aria-hidden>&gt;</span>
      <span aria-hidden>{still ? LINES.join(" · ") : LINES[index].slice(0, typed)}</span>
      {!still && <span className="term-caret" aria-hidden />}
    </p>
  );
}
