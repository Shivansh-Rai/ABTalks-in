"use client";

import type { ReactNode } from "react";
import type {
  ProfileReview,
  ReviewBlock,
  ReviewCard,
  ReviewIconKey,
} from "@/features/profile/build-review";

/**
 * The report card — the profile as a recruiter sees it.
 *
 * Everything it renders arrives as plain data from `buildProfileReview` on the
 * server. Anything filled in stacks at the top; the rest waits below its own
 * rule, and each card's Add / Edit opens the wizard step that owns it.
 */

const RV_ICON: Record<ReviewIconKey, ReactNode> = {
  basic: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  career: (
    <>
      <path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z" />
      <path d="M10 7V5h4v2" />
    </>
  ),
  education: (
    <>
      <path d="m22 9-10-5L2 9l10 5 10-5Z" />
      <path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5" />
    </>
  ),
  skills: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  experience: (
    <>
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="M16 20V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15" />
    </>
  ),
  projects: (
    <>
      <path d="m16 18 5-6-5-6" />
      <path d="m8 6-5 6 5 6" />
    </>
  ),
  summary: (
    <>
      <path d="M4 5h16" />
      <path d="M4 10h16" />
      <path d="M4 15h11" />
      <path d="M4 20h7" />
    </>
  ),
  certifications: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M15.5 13.5 17 22l-5-2.8L7 22l1.5-8.5" />
    </>
  ),
  links: (
    <>
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7L12.5 20" />
    </>
  ),
  resume: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </>
  ),
};

function Chips({ items }: { items: string[] }) {
  return (
    <div className="pw-rv-chips">
      {items.map((t) => (
        <span className="pw-rv-chip" key={t}>
          {t}
        </span>
      ))}
    </div>
  );
}

function Block({ block }: { block: ReviewBlock }) {
  switch (block.kind) {
    case "sub":
      return <div className="pw-rv-sub">{block.text}</div>;
    case "text":
      return <p className="pw-rv-item-body pw-rv-tight">{block.text}</p>;
    case "chips":
      return <Chips items={block.items} />;
    case "file":
      return (
        <div className="pw-rv-file">
          <span className="pw-rv-file-name">{block.name}</span>
          <span className="pw-rv-file-meta">{block.meta}</span>
        </div>
      );
    case "pairs":
      return (
        <>
          {block.pairs.map((pair) => (
            <div className="pw-rv-pair" key={`${pair.label}-${pair.value}`}>
              <span className="pw-rv-k">{pair.label}</span>
              {pair.url ? (
                <a
                  className="pw-rv-v pw-rv-a"
                  href={pair.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pair.value}
                </a>
              ) : (
                <span className="pw-rv-v">{pair.value}</span>
              )}
            </div>
          ))}
        </>
      );
    case "items":
      return (
        <>
          {block.items.map((item, i) => (
            <div className="pw-rv-item" key={`${item.title}-${i}`}>
              <div className="pw-rv-item-title">{item.title}</div>
              {item.sub ? <div className="pw-rv-item-sub">{item.sub}</div> : null}
              {item.meta ? (
                <div className="pw-rv-item-meta">{item.meta}</div>
              ) : null}
              {item.body ? <p className="pw-rv-item-body">{item.body}</p> : null}
              {item.chips.length > 0 ? <Chips items={item.chips} /> : null}
              {item.links.length > 0 ? (
                <div className="pw-rv-links">
                  {item.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </>
      );
  }
}

function Card({
  card,
  onOpen,
}: {
  card: ReviewCard;
  onOpen: (stepIndex: number) => void;
}) {
  return (
    <section className={`pw-rv-card${card.filled ? "" : " pw-is-empty"}`}>
      <div className="pw-rv-card-head">
        <span className="pw-rv-ico" aria-hidden>
          <svg viewBox="0 0 24 24">{RV_ICON[card.icon]}</svg>
        </span>
        <h3>{card.title}</h3>
        {card.count > 1 ? <span className="pw-rv-count">{card.count}</span> : null}
        <button
          type="button"
          className="pw-rv-add"
          onClick={() => onOpen(card.stepIndex)}
        >
          {card.filled ? "Edit" : "Add"}
          <span className="pw-sr-only"> {card.title}</span>
        </button>
      </div>
      <div className="pw-rv-card-body">
        {card.filled ? (
          card.blocks.map((block, i) => <Block block={block} key={i} />)
        ) : (
          <p className="pw-rv-empty">{card.emptyHint}</p>
        )}
      </div>
    </section>
  );
}

export function ProfileReviewCard({
  review,
  media,
  onOpen,
}: {
  review: ProfileReview;
  /** The ring / avatar / photo editor, rendered into the hero. */
  media: ReactNode;
  onOpen: (stepIndex: number) => void;
}) {
  const filled = review.cards.filter((c) => c.filled);
  const empty = review.cards.filter((c) => !c.filled);
  const gaps = empty.filter((c) => !c.noGap).map((c) => c.title);
  const basicStep = review.cards[0]?.stepIndex ?? 0;

  return (
    <section className="pw-form-card pw-review-card">
      <div className="pw-review-body">
        <section className="pw-rv-hero">
          <div className="pw-rv-hero-top">
            {media}
            <div className="pw-rv-hero-copy">
              <h2>{review.name}</h2>
              {review.headline ? (
                <p className="pw-rv-headline">{review.headline}</p>
              ) : (
                <p className="pw-rv-headline pw-rv-muted">
                  Add a headline so recruiters know what you do.
                </p>
              )}
              <div className="pw-rv-meta">
                {review.openToWork ? (
                  <span className="pw-rv-meta-i pw-open-to-work">
                    Open to work
                  </span>
                ) : null}
                {review.meta.map((m) => (
                  <span className="pw-rv-meta-i" key={m}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <button
              type="button"
              className="pw-rv-add"
              onClick={() => onOpen(basicStep)}
            >
              Edit
              <span className="pw-sr-only"> basic information</span>
            </button>
          </div>

          <div className="pw-rv-progress">
            <div className="pw-rv-progress-top">
              <span>Profile strength</span>
              <strong>{review.score}%</strong>
            </div>
            <div
              className="pw-rv-bar"
              role="progressbar"
              aria-valuenow={review.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile strength"
            >
              <i style={{ width: `${review.score}%` }} />
            </div>
          </div>
        </section>

        {gaps.length > 0 ? (
          <div className="pw-rv-gaps">
            <span className="pw-rv-gaps-k">Still missing</span>
            <span className="pw-rv-gaps-v">{gaps.join(" · ")}</span>
          </div>
        ) : null}

        {filled.map((card) => (
          <Card card={card} key={card.title} onOpen={onOpen} />
        ))}

        {empty.length > 0 ? (
          <>
            <div className="pw-rv-divider">
              <span>{filled.length > 0 ? "Not added yet" : "Start anywhere"}</span>
            </div>
            {empty.map((card) => (
              <Card card={card} key={card.title} onOpen={onOpen} />
            ))}
          </>
        ) : null}
      </div>
    </section>
  );
}
