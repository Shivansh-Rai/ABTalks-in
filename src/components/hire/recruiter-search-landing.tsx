"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const SEARCH_SUGGESTIONS = [
  "AI Engineer in Bangalore with 2+ years of experience and remote work",
  "AI Engineer in Delhi with 4+ years of experience in Agentic AI",
  "AI Engineer in Bangalore",
  "Full Stack Developer in Hyderabad with React and Node.js expertise",
  "Data Scientist in Mumbai with 3+ years in NLP and deep learning",
  "Product Designer in Pune with Figma and design systems experience",
  "DevOps Engineer in Bangalore with AWS and Kubernetes skills",
  "Backend Engineer in Chennai with Go and microservices architecture",
] as const;

const LANDING_FILTERS = [
  { key: "location", label: "Location" },
  { key: "experience", label: "Years of Experience" },
  { key: "role", label: "Role" },
  { key: "education", label: "Education Qualification" },
  { key: "skills", label: "Skills" },
] as const;

export type LandingSpoken = {
  location: boolean;
  experience: boolean;
  role: boolean;
  education: boolean;
  skills: boolean;
};

export function RecruiterSearchLanding({
  value,
  pending,
  spoken,
  onChange,
  onSubmit,
}: {
  value: string;
  pending: boolean;
  spoken: LandingSpoken;
  onChange: (next: string) => void;
  onSubmit: (query: string) => void;
}) {
  const [active, setActive] = useState(0);
  const canSearch = value.trim().length > 0 && !pending;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % SEARCH_SUGGESTIONS.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  function submit(query: string) {
    const next = query.trim();
    if (!next || pending) return;
    onSubmit(next);
  }

  return (
    <section className="rsearch" aria-label="Recruiter search">
      <h1 className="rsearch__title">Who are you looking for?</h1>

      <form
        className="rsearch__card"
        aria-busy={pending}
        onSubmit={(e) => {
          e.preventDefault();
          submit(value);
        }}
      >
        <div className="rsearch__controls">
          <label className="sr-only" htmlFor="recruiter-search">
            Describe the person you want to hire
          </label>
          <input
            id="recruiter-search"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Type here...."
            value={value}
            disabled={pending}
            maxLength={2000}
            onChange={(e) => onChange(e.target.value)}
            className="rsearch__input"
          />
          <button
            type="submit"
            className="rsearch__submit"
            disabled={!canSearch}
          >
            <svg
              className="rsearch__submit-icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M17.5 17.5L13.884 13.884M15.833 9.167a6.667 6.667 0 1 1-13.333 0 6.667 6.667 0 0 1 13.333 0Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            {pending ? "Searching" : "Search"}
          </button>
        </div>

        <ul className="rsearch__filters" aria-label="What this search can pick up">
          {LANDING_FILTERS.map((item) => (
            <li
              key={item.key}
              className={cn(
                "rsearch__filter",
                spoken[item.key] && "is-on",
              )}
            >
              <span aria-hidden="true">✓</span>
              {item.label}
            </li>
          ))}
        </ul>
      </form>

      <ul className="rsearch__suggest" aria-label="Suggested searches">
        {[0, 1, 2].map((offset) => {
          const suggestion =
            SEARCH_SUGGESTIONS[
              (active + offset) % SEARCH_SUGGESTIONS.length
            ]!;
          return (
            <li
              key={`${offset}-${suggestion}`}
              className={cn("rsearch__suggest-slot", `is-${offset}`)}
            >
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  onChange(suggestion);
                  submit(suggestion);
                }}
              >
                {offset === 0 && (
                  <span className="rsearch__suggest-arrow" aria-hidden="true">
                    →
                  </span>
                )}
                {suggestion}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
