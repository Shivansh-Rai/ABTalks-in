"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

/*
 * The persistent frame behind the four story screens. It owns the ground and
 * the background photo, so moving between steps morphs the room instead of
 * reloading it:
 *
 *   light sweep   the next photo is revealed through a soft diagonal edge that
 *                 travels left → right, the way the window light falls in
 *                 every photo, with a warm band of light riding the edge
 *   focus pull    the old room drifts out of focus (blur + slight push-in)
 *                 while the new one pulls into focus
 *
 * The shell starts the morph from its Next click (see onboarding-shell.tsx);
 * back/forward navigation morphs too, from the pathname change alone.
 */

export const STORY_BACKGROUNDS: Record<string, string> = {
  "/recruiter-onboarding": "/recruiter-onboarding/desk-define.png",
  "/recruiter-onboarding/discover": "/recruiter-onboarding/desk-discover.png",
  "/recruiter-onboarding/connect": "/recruiter-onboarding/desk-connect.png",
  "/recruiter-onboarding/assess": "/recruiter-onboarding/desk-assess.png",
};

const SWEEP_DURATION = 2.6;
const SWEEP_EASE = [0.65, 0, 0.35, 1] as const;
// Mask stop positions in %, wide enough that the soft edge starts and ends
// fully off-screen.
const SWEEP_FROM = -40;
const SWEEP_TO = 140;
const SWEEP_SOFTNESS = 32;

type Story = {
  /** Starts morphing the background to `href`'s photo; no-op off the story. */
  morphTo: (href: string) => void;
  reducedMotion: boolean;
};

const StoryContext = createContext<Story | null>(null);

/** Null outside the story layout, where screens navigate as plain links. */
export function useOnboardingStory() {
  return useContext(StoryContext);
}

type Layer = { id: number; src: string; sweep: boolean };

export function OnboardingStoryFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion() ?? false;
  const nextId = useRef(1);
  const [layers, setLayers] = useState<Layer[]>(() => {
    const src = STORY_BACKGROUNDS[pathname];
    return src ? [{ id: 0, src, sweep: false }] : [];
  });

  const morphTo = useCallback(
    (href: string) => {
      const src = STORY_BACKGROUNDS[href];
      if (!src) return;
      const id = nextId.current++;
      setLayers((current) => {
        if (current[current.length - 1]?.src === src) return current;
        const layer = { id, src, sweep: !reducedMotion };
        // Only the outgoing photo is kept underneath; without motion there is
        // nothing to reveal, so the new photo simply replaces it.
        return reducedMotion ? [layer] : [...current.slice(-1), layer];
      });
    },
    [reducedMotion],
  );

  // Back/forward lands here without a Next click: morph to wherever we are.
  // After a Next click the photo already matches, so this is a no-op.
  useEffect(() => {
    morphTo(pathname);
  }, [pathname, morphTo]);

  const settle = useCallback((id: number) => {
    setLayers((current) => current.filter((layer) => layer.id >= id));
  }, []);

  const story = useMemo(() => ({ morphTo, reducedMotion }), [morphTo, reducedMotion]);

  return (
    <StoryContext.Provider value={story}>
      <div className="relative isolate h-svh overflow-hidden bg-[linear-gradient(90deg,#F1F1F1_0%,#F5F5F5_55%,#FAFAFA_100%)]">
        {/* Behind the screen (isolate + -z-10). Desktop: fills the area under
            the 55px header, anchored bottom-right so the desk stays in view.
            Below lg a portrait screen would crop the wide photo to a close-up
            behind the copy, so it is a full-width strip at its natural
            1920×845 ratio along the bottom, its top edge faded into the ground. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 aspect-[1920/845] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_45%)] lg:top-[55px] lg:aspect-auto lg:[mask-image:none]"
        >
          {layers.map((layer, i) => (
            <BackgroundLayer
              key={layer.id}
              layer={layer}
              covered={i < layers.length - 1}
              onSettled={settle}
            />
          ))}
        </div>

        {/* Warm every photo up front so a sweep never reveals an unloaded image. */}
        <div aria-hidden className="pointer-events-none absolute size-px overflow-hidden opacity-0">
          {Object.values(STORY_BACKGROUNDS).map((src) => (
            <div key={src} className="relative size-px">
              <Image src={src} alt="" fill sizes="100vw" loading="eager" />
            </div>
          ))}
        </div>

        {children}
      </div>
    </StoryContext.Provider>
  );
}

const FOCUSED = { scale: 1, filter: "blur(0px)" };
const DEFOCUSED = { scale: 1.06, filter: "blur(6px)" };

function BackgroundLayer({
  layer,
  covered,
  onSettled,
}: {
  layer: Layer;
  covered: boolean;
  onSettled: (id: number) => void;
}) {
  const sweep = useMotionValue(layer.sweep ? SWEEP_FROM : SWEEP_TO);
  const peak = useTransform(sweep, (v) => v + SWEEP_SOFTNESS / 2);
  const edge = useTransform(sweep, (v) => v + SWEEP_SOFTNESS);
  const mask = useMotionTemplate`linear-gradient(105deg, #000 ${sweep}%, transparent ${edge}%)`;
  const beam = useMotionTemplate`linear-gradient(105deg, transparent ${sweep}%, rgba(255, 244, 224, 0.8) ${peak}%, transparent ${edge}%)`;
  const glow = useTransform(sweep, [SWEEP_FROM, 0, 100, SWEEP_TO], [0, 1, 1, 0]);

  useEffect(() => {
    if (!layer.sweep) return;
    const controls = animate(sweep, SWEEP_TO, {
      duration: SWEEP_DURATION,
      ease: SWEEP_EASE,
      onComplete: () => onSettled(layer.id),
    });
    return () => controls.stop();
  }, [layer.id, layer.sweep, onSettled, sweep]);

  return (
    <>
      <motion.div
        className="absolute inset-0"
        style={layer.sweep ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        <motion.div
          className="absolute inset-0 origin-[70%_85%]"
          initial={layer.sweep ? DEFOCUSED : false}
          animate={covered ? DEFOCUSED : FOCUSED}
          transition={{ duration: SWEEP_DURATION, ease: SWEEP_EASE }}
        >
          <Image
            src={layer.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-bottom-right"
          />
        </motion.div>
      </motion.div>
      {layer.sweep && (
        <motion.div
          className="absolute inset-0 mix-blend-screen"
          style={{ backgroundImage: beam, opacity: glow }}
        />
      )}
    </>
  );
}
