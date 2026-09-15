import { Outfit } from "next/font/google";
import "./welcome-screen.css";

/*
 * Candidate "Welcome Back" interstitial between sign-in and the dashboard
 * (Figma Abtalks node 1899:777). Server Component: the only motion is the
 * CSS ellipse loop, so it ships no client JavaScript. Geometry and effects
 * are documented in welcome-screen.css.
 */

// The root layout loads Outfit 400–700; this screen needs Light (300) too.
const outfit = Outfit({ subsets: ["latin"], weight: ["300", "500"] });

const ELLIPSES = [1, 2, 3, 4] as const;
const COLUMNS = Array.from({ length: 19 }, (_, i) => i);
// Band tops in the frame's 900px height, back to front.
const ROW_TOPS = [0, 104, 204, 304, 404, 504, 600, 700, 800] as const;

export function WelcomeScreen() {
  return (
    <div aria-busy="true" className="cwelcome">
      {ELLIPSES.map((n) => (
        <div key={n} aria-hidden className={`cwelcome__ellipse cwelcome__ellipse--${n}`} />
      ))}

      <div aria-hidden className="cwelcome__backdrop" />

      <div aria-hidden className="cwelcome__grid">
        {COLUMNS.map((i) => (
          <div key={i} className="cwelcome__col" style={{ left: `${(i * 100) / 19}%` }} />
        ))}
      </div>

      <div aria-hidden className="cwelcome__grid">
        {ROW_TOPS.map((top) => (
          <div key={top} className="cwelcome__row" style={{ top: `${(top * 100) / 900}%` }} />
        ))}
      </div>

      <div className="cwelcome__frame">
        <h1 className={`cwelcome__text ${outfit.className}`}>
          <span className="cwelcome__title">Welcome Back</span>
          <span className="cwelcome__subtitle">Your dashboard will be ready soon</span>
        </h1>
      </div>
    </div>
  );
}
