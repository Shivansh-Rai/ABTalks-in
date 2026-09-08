"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { HACKATHON } from "@/components/hackathon/hackathon-config";
import { CountdownV2 } from "@/components/hackathon-v2/countdown-v2";
import { RegistrationDialogTrigger } from "@/components/hackathon-v2/registration-dialog-trigger";
import { useUnlock } from "@/components/hackathon-v2/unlock-provider";

type Props = {
  registrationOpen: boolean;
  isAuthed: boolean;
  initialEmail: string | null;
  initialName: string;
};

const CELLS = [
  { c: 1, r: 1, kind: "soft" },
  { c: 2, r: 1, kind: "faint" },
  { c: 3, r: 2, kind: "soft" },
  { c: 7, r: 1, kind: "faint" },
  { c: 10, r: 1, kind: "soft" },
  { c: 12, r: 2, kind: "faint" },
  { c: 2, r: 4, kind: "soft" },
  { c: 5, r: 5, kind: "faint" },
  { c: 9, r: 5, kind: "soft" },
  { c: 13, r: 4, kind: "faint" },
  { c: 12, r: 6, kind: "soft" },
  { c: 4, r: 6, kind: "faint" },
] as const;

const SPARK_PATHS = [
  { d: "M0 180H159L261 246H524L546 282H780", reverse: true, dur: 5.4, delay: 0 },
  { d: "M0 209H44L128 150H283L503 328H780", reverse: true, dur: 6.1, delay: 1.3 },
  { d: "M0 242H137L234 311H780", reverse: true, dur: 4.8, delay: 2.6 },
  { d: "M0 328H73L213 218H780", reverse: true, dur: 5.7, delay: 0.7 },
  { d: "M830 218H1364L1459 288H1611", reverse: false, dur: 5.1, delay: 0.35 },
  { d: "M860 262H986L1117 338H1282L1349 259H1611", reverse: false, dur: 5.9, delay: 2.1 },
  { d: "M830 308H1019L1192 164H1451L1539 224H1611", reverse: false, dur: 6.3, delay: 1 },
  { d: "M830 334H1068L1156 262H1305L1402 334H1611", reverse: false, dur: 5.5, delay: 3.1 },
];

export function Hero(props: Props) {
  const { registrationOpen, isAuthed, initialEmail, initialName } = props;
  const { unlocked, registered, tryCode } = useUnlock();

  const heroRef = useRef<HTMLElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);
  const lockBtnRef = useRef<HTMLButtonElement | null>(null);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = tryCode(codeInput);
    if (!ok) {
      setCodeError("That code isn't quite right — check your inbox.");
      return;
    }
    setCodeError(null);
    setMsgOpen(false);
  }

  // Sync the mask fade line to the lock's bottom edge (mock behaviour).
  useEffect(() => {
    const hero = heroRef.current;
    const bg = bgRef.current;
    const lockBtn = lockBtnRef.current;
    if (!hero || !bg || !lockBtn) return;

    function syncFade() {
      if (!hero || !bg || !lockBtn) return;
      const h = hero.getBoundingClientRect();
      const l = lockBtn.getBoundingClientRect();
      if (!h.height) return;
      const pct = ((l.bottom - h.top) / h.height) * 100;
      bg.style.setProperty(
        "--hk-fade-start",
        `${Math.max(0, Math.min(100, pct)).toFixed(2)}%`,
      );
    }

    syncFade();
    const ro = new ResizeObserver(syncFade);
    ro.observe(hero);
    window.addEventListener("resize", syncFade);
    if (document.fonts?.ready) void document.fonts.ready.then(syncFade);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncFade);
    };
  }, []);

  // Escape closes the lock message.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && msgOpen) {
        setMsgOpen(false);
        lockBtnRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [msgOpen]);

  const openMsg = () => setMsgOpen(true);

  return (
    <section
      className={`hk-hero${msgOpen ? " is-msg-open" : ""}`}
      aria-labelledby="hk-hero-title"
      ref={heroRef}
    >
      <div className="hk-hero__bg" aria-hidden ref={bgRef}>
        <div className="hk-hero__field">
          <div className="hk-hero__lines" />
          <div className="hk-hero__cells">
            {CELLS.map((cell, i) => (
              <i
                key={i}
                className={`cell cell--${cell.kind}`}
                style={
                  {
                    ["--c" as string]: String(cell.c),
                    ["--r" as string]: String(cell.r),
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </div>

      <div className="hk-hero__head">
        <p className="hk-sponsor">
          <span className="hk-sponsor__label">Sponsored by</span>
          <a
            className="hk-sponsor__brand"
            href={HACKATHON.sponsor.siteUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="hk-sponsor__mark"
              src="/hackathon-v2/breeth-mark.png"
              alt=""
              width={128}
              height={129}
              unoptimized
              priority
            />
            <Image
              className="hk-sponsor__word"
              src="/hackathon-v2/breeth-word.png"
              alt="Breeth"
              width={452}
              height={81}
              unoptimized
              priority
            />
          </a>
        </p>

        <h1 className="hk-hero__title" id="hk-hero-title">
          <em>Vicodathon 2.0</em> registrations are live
        </h1>
        <p className="hk-hero__sub">
          A 48-hour hackathon to build real solutions, solve meaningful problems
          and shape what&rsquo;s next.
        </p>

        <CountdownV2 targetIso={HACKATHON.kickoffUtc} />

        <div className="hk-cta">
          <RegistrationDialogTrigger
            registered={registered}
            registrationOpen={registrationOpen}
            isAuthed={isAuthed}
            initialEmail={initialEmail}
            initialName={initialName}
            className="ab-btn ab-btn--primary hk-cta__primary"
            labelWhenRegister="Register"
            labelWhenRegistered="Open dashboard →"
            labelWhenClosed="Registration closed"
          />
          <Link
            className="ab-btn ab-btn--ghost hk-cta__secondary"
            href="#hk-how"
          >
            Learn more
            <svg viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </div>

      <div className="hk-hero__stage">
        <div className="hk-hero__scene">
          <svg
            className="hk-circuit"
            viewBox="0 0 1611 393"
            preserveAspectRatio="none"
            aria-hidden
            focusable="false"
          >
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              vectorEffect="non-scaling-stroke"
            >
              <path d="M0 180H159L261 246H524L546 282H780" />
              <path d="M0 209H44L128 150H283L503 328H780" />
              <path d="M0 242H137L234 311H780" />
              <path d="M0 328H73L213 218H780" />
              <path d="M830 218H1364L1459 288H1611" />
              <path d="M860 262H986L1117 338H1282L1349 259H1611" />
              <path d="M830 308H1019L1192 164H1451L1539 224H1611" />
              <path d="M830 334H1068L1156 262H1305L1402 334H1611" />
            </g>
          </svg>

          <svg
            className="hk-circuit hk-sparks"
            viewBox="0 0 1611 393"
            preserveAspectRatio="none"
            aria-hidden
            focusable="false"
          >
            <g>
              {SPARK_PATHS.map((p, i) => (
                <circle
                  key={i}
                  className="hk-spark"
                  r={3.2}
                  style={
                    {
                      ["--path" as string]: `path('${p.d}')`,
                      ["--dir" as string]: p.reverse ? "reverse" : undefined,
                      ["--dur" as string]: `${p.dur}s`,
                      ["--delay" as string]: `${p.delay}s`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </g>
          </svg>

          <button
            className="hk-lock-btn"
            type="button"
            data-state={unlocked ? "unlocked" : "locked"}
            aria-describedby="hk-lock-msg"
            aria-expanded={msgOpen}
            aria-label={
              unlocked
                ? "The hackathon details are unlocked."
                : "The hackathon details are locked. Show why."
            }
            ref={lockBtnRef}
            onPointerEnter={openMsg}
            onFocus={openMsg}
            onClick={(e) => {
              e.preventDefault();
              openMsg();
              // If the code input is showing, focus it so the user can type.
              window.setTimeout(() => {
                codeInputRef.current?.focus();
              }, 0);
            }}
          >
            <svg
              className="hk-lock"
              viewBox="0 0 340 324"
              aria-hidden
              focusable="false"
            >
              <defs>
                <linearGradient
                  id="hkShackle"
                  gradientUnits="userSpaceOnUse"
                  x1="67"
                  y1="0"
                  x2="273"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#6E747A" />
                  <stop offset="3%" stopColor="#9AA1A7" />
                  <stop offset="8.3%" stopColor="#FAFCFD" />
                  <stop offset="12%" stopColor="#E2E7EA" />
                  <stop offset="17%" stopColor="#AEB5BB" />
                  <stop offset="24%" stopColor="#868D94" />
                  <stop offset="38%" stopColor="#767D84" />
                  <stop offset="50%" stopColor="#8B9299" />
                  <stop offset="62%" stopColor="#767D84" />
                  <stop offset="76%" stopColor="#868D94" />
                  <stop offset="83%" stopColor="#AEB5BB" />
                  <stop offset="88%" stopColor="#E2E7EA" />
                  <stop offset="91.7%" stopColor="#FAFCFD" />
                  <stop offset="97%" stopColor="#9AA1A7" />
                  <stop offset="100%" stopColor="#6E747A" />
                </linearGradient>
                <linearGradient
                  id="hkShackleRim"
                  gradientUnits="userSpaceOnUse"
                  x1="67"
                  y1="0"
                  x2="273"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#4A5057" />
                  <stop offset="50%" stopColor="#5E656C" />
                  <stop offset="100%" stopColor="#464C53" />
                </linearGradient>
                <linearGradient
                  id="hkSpec"
                  gradientUnits="userSpaceOnUse"
                  x1="60"
                  y1="0"
                  x2="290"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".85" />
                  <stop offset="30%" stopColor="#FFFFFF" stopOpacity=".18" />
                  <stop offset="70%" stopColor="#FFFFFF" stopOpacity=".10" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity=".35" />
                </linearGradient>
                <linearGradient id="hkPlate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FBFCFD" />
                  <stop offset="16%" stopColor="#E4E8EB" />
                  <stop offset="46%" stopColor="#C3C9CE" />
                  <stop offset="78%" stopColor="#A0A7AD" />
                  <stop offset="100%" stopColor="#7C8389" />
                </linearGradient>
                <linearGradient id="hkPlateSide" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3B4147" stopOpacity=".40" />
                  <stop offset="12%" stopColor="#3B4147" stopOpacity="0" />
                  <stop offset="88%" stopColor="#3B4147" stopOpacity="0" />
                  <stop offset="100%" stopColor="#3B4147" stopOpacity=".40" />
                </linearGradient>
                <linearGradient id="hkBody" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3D3F43" />
                  <stop offset="22%" stopColor="#2A2C30" />
                  <stop offset="62%" stopColor="#1D1F22" />
                  <stop offset="100%" stopColor="#0D0E10" />
                </linearGradient>
                <linearGradient id="hkSide" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6A6E74" />
                  <stop offset="45%" stopColor="#4C5056" />
                  <stop offset="100%" stopColor="#33373C" />
                </linearGradient>
                <linearGradient id="hkSideR" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#33373C" />
                  <stop offset="55%" stopColor="#4C5056" />
                  <stop offset="100%" stopColor="#5C6066" />
                </linearGradient>
                <linearGradient id="hkAO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                  <stop offset="100%" stopColor="#000000" stopOpacity=".55" />
                </linearGradient>
                <radialGradient id="hkSheen" cx="34%" cy="18%" r="78%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity=".14" />
                  <stop offset="55%" stopColor="#FFFFFF" stopOpacity=".03" />
                  <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                </radialGradient>
                <pattern
                  id="hkBrush"
                  width="3"
                  height="6"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="1" height="6" fill="#FFFFFF" opacity=".05" />
                  <rect x="2" width="1" height="6" fill="#000000" opacity=".07" />
                </pattern>
                <filter
                  id="hkBlurLg"
                  x="-30%"
                  y="-60%"
                  width="160%"
                  height="260%"
                >
                  <feGaussianBlur stdDeviation="7" />
                </filter>
                <filter
                  id="hkBlurSm"
                  x="-60%"
                  y="-120%"
                  width="220%"
                  height="380%"
                >
                  <feGaussianBlur stdDeviation="3" />
                </filter>
                <clipPath id="hkBodyClip">
                  <rect x="10" y="178" width="320" height="130" rx="13" />
                </clipPath>
              </defs>

              <ellipse
                cx="172"
                cy="313"
                rx="126"
                ry="11"
                fill="#0F172A"
                opacity=".22"
                filter="url(#hkBlurLg)"
              />

              <g>
                <path
                  d="M84 192V109a86 86 0 0 1 172 0v83"
                  fill="none"
                  stroke="url(#hkShackleRim)"
                  strokeWidth="39"
                />
                <path
                  d="M84 192V109a86 86 0 0 1 172 0v83"
                  fill="none"
                  stroke="url(#hkShackle)"
                  strokeWidth="33"
                />
                <path
                  d="M100.5 192V109a69.5 69.5 0 0 1 139 0v83"
                  fill="none"
                  stroke="#2E343A"
                  strokeWidth="4.5"
                  opacity=".42"
                />
                <path
                  d="M71 192V109a99 99 0 0 1 198 0v83"
                  fill="none"
                  stroke="url(#hkSpec)"
                  strokeWidth="3.4"
                />
              </g>

              <g clipPath="url(#hkBodyClip)">
                <rect x="10" y="178" width="320" height="130" fill="url(#hkBody)" />
                <rect x="10" y="178" width="54" height="130" fill="url(#hkSide)" />
                <rect x="276" y="178" width="54" height="130" fill="url(#hkSideR)" />
                <rect x="58" y="178" width="7" height="130" fill="#08090A" opacity=".85" />
                <rect x="275" y="178" width="7" height="130" fill="#08090A" opacity=".85" />
                <rect x="10" y="178" width="320" height="130" fill="url(#hkBrush)" opacity=".55" />
                <rect x="10" y="178" width="320" height="130" fill="url(#hkSheen)" />
                <rect x="10" y="248" width="320" height="60" fill="url(#hkAO)" />
                <rect x="10" y="178" width="320" height="3.5" fill="#8A8E94" opacity=".55" />
                <rect x="10" y="303" width="320" height="3" fill="#4A4E54" opacity=".5" />
              </g>
              <rect
                x="10.6"
                y="178.6"
                width="318.8"
                height="128.8"
                rx="12.6"
                fill="none"
                stroke="#000000"
                opacity=".45"
              />

              <rect x="6" y="146" width="328" height="46" rx="13" fill="url(#hkPlate)" />
              <rect x="6" y="146" width="328" height="46" rx="13" fill="url(#hkPlateSide)" />
              <rect x="9" y="147.5" width="322" height="5" rx="2.5" fill="#FDFEFE" opacity=".92" />
              <rect x="8" y="183" width="324" height="8" rx="4" fill="#6E747A" opacity=".5" />
              <ellipse cx="84" cy="150" rx="23" ry="6" fill="#0B0E12" opacity=".38" filter="url(#hkBlurSm)" />
              <ellipse cx="256" cy="150" rx="23" ry="6" fill="#0B0E12" opacity=".38" filter="url(#hkBlurSm)" />
              <rect x="12" y="190" width="316" height="12" fill="#000000" opacity=".38" filter="url(#hkBlurSm)" clipPath="url(#hkBodyClip)" />

              <g className="hk-lock__leds">
                <g>
                  <circle cx="134" cy="243" r="7" fill="#08090A" opacity=".8" />
                  <circle cx="134" cy="243" r="5" />
                </g>
                <g>
                  <circle cx="158" cy="243" r="7" fill="#08090A" opacity=".8" />
                  <circle cx="158" cy="243" r="5" />
                </g>
                <g>
                  <circle cx="182" cy="243" r="7" fill="#08090A" opacity=".8" />
                  <circle cx="182" cy="243" r="5" />
                </g>
                <g>
                  <circle cx="206" cy="243" r="7" fill="#08090A" opacity=".8" />
                  <circle cx="206" cy="243" r="5" />
                </g>
              </g>
            </svg>
          </button>

          <div className="hk-lock-msg" id="hk-lock-msg" role="note">
            <span className="hk-lock-msg__badge" aria-hidden>
              <svg viewBox="0 0 24 24" focusable="false">
                <rect x="4" y="10.5" width="16" height="10.5" rx="2.4" />
                <path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" />
              </svg>
            </span>
            <div className="hk-lock-msg__body">
              {unlocked ? (
                <p className="hk-lock-msg__text">
                  {registered ? (
                    <>
                      You&rsquo;re registered and unlocked. The full details
                      are below and your{" "}
                      <Link href="/hackathon/dashboard">
                        <strong>dashboard is open</strong>
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Unlocked. Register any time to keep your spot on the
                      roster.
                    </>
                  )}
                </p>
              ) : (
                <>
                  <p className="hk-lock-msg__text">
                    You&rsquo;ll get a <b>4-character secret code</b> in your
                    email after registering. Enter it here to unlock how it
                    works, the timeline, the rules and the Discord.
                  </p>
                  <form
                    className="hk-code-form"
                    onSubmit={onCodeSubmit}
                    noValidate
                  >
                    <label className="ab-sr" htmlFor="hk-code-input">
                      Unlock code
                    </label>
                    <input
                      id="hk-code-input"
                      ref={codeInputRef}
                      className="hk-code-form__input"
                      type="text"
                      inputMode="text"
                      autoComplete="off"
                      autoCapitalize="characters"
                      maxLength={8}
                      placeholder="VC••"
                      value={codeInput}
                      onChange={(e) => {
                        setCodeInput(e.target.value);
                        if (codeError) setCodeError(null);
                      }}
                      aria-invalid={codeError ? true : undefined}
                    />
                    <button
                      type="submit"
                      className="hk-code-form__btn"
                      disabled={codeInput.trim().length === 0}
                    >
                      Unlock
                    </button>
                  </form>
                  {codeError ? (
                    <p className="hk-code-form__error" role="alert">
                      {codeError}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <button className="ab-chat" type="button" aria-label="Open chat support">
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    </section>
  );
}
