"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { JobStatus, JobType, JobWorkMode } from "@prisma/client";
import {
  Briefcase,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { JOB_TYPE_LABEL, WORK_MODE_LABEL } from "@/components/jobs/job-ui";

export type RecruiterJobBoardRow = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  workMode: JobWorkMode | null;
  type: JobType;
  status: JobStatus;
  applicantCount: number;
  updatedLabel: string;
};

type Tab = "ALL" | JobStatus | "ARCHIVED";

const TABS: { id: Tab; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "DRAFT", label: "Drafts" },
  { id: "PUBLISHED", label: "Published" },
  { id: "CLOSED", label: "Closed" },
  { id: "ARCHIVED", label: "Archived" },
];

const WORK_MODE_FILTERS: { id: JobWorkMode | "ALL"; label: string }[] = [
  { id: "ALL", label: "Any mode" },
  { id: "REMOTE", label: "Remote" },
  { id: "HYBRID", label: "Hybrid" },
  { id: "ONSITE", label: "On-site" },
];

function statusLabel(status: JobStatus) {
  if (status === "DRAFT") return "Draft";
  if (status === "PUBLISHED") return "Published";
  return "Closed";
}

export function RecruiterJobsBoard({ jobs }: { jobs: RecruiterJobBoardRow[] }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");
  const [workMode, setWorkMode] = useState<JobWorkMode | "ALL">("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return jobs.filter((job) => {
      if (tab === "ARCHIVED") return false;
      if (tab !== "ALL" && job.status !== tab) return false;
      if (workMode !== "ALL" && job.workMode !== workMode) return false;
      if (!q) return true;
      const hay = [
        job.title,
        job.company,
        job.location ?? "",
        job.workMode ? WORK_MODE_LABEL[job.workMode] : "",
        JOB_TYPE_LABEL[job.type],
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, query, tab, workMode]);

  const emptyAll = jobs.length === 0;
  const emptyFilter = !emptyAll && filtered.length === 0;

  return (
    <div className="hire-jobs">
      <nav className="hire-jobs__crumb" aria-label="Breadcrumb">
        <span>Hiring</span>
        <span aria-hidden="true">›</span>
        <span aria-current="page">Jobs</span>
      </nav>

      <div className="hire-jobs__head">
        <div>
          <h1>Your jobs</h1>
          <p>
            Draft roles stay private until you publish them. Close a role to
            stop accepting applications; reopen it any time.
          </p>
        </div>
        <Link href="/hire/jobs/new" className="hire-jobs__btn">
          <Plus aria-hidden="true" />
          New job
        </Link>
      </div>

      <div className="hire-jobs__toolbar">
        <div className="hire-jobs__tabs" role="tablist" aria-label="Job status">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="hire-jobs__tools">
          <label className="hire-jobs__search">
            <Search aria-hidden="true" />
            <span className="sr-only">Search jobs</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search jobs…"
            />
          </label>
          <button
            type="button"
            className="hire-jobs__iconbtn"
            aria-expanded={filtersOpen}
            aria-controls="hire-jobs-filters"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal aria-hidden="true" />
            <span className="sr-only">Filters</span>
          </button>
        </div>
      </div>

      {filtersOpen ? (
        <div id="hire-jobs-filters" className="hire-jobs__filters">
          <p>Work mode</p>
          <div>
            {WORK_MODE_FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={workMode === item.id ? "is-active" : undefined}
                onClick={() => setWorkMode(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {emptyAll ? (
        <div className="hire-jobs__empty">
          <div className="hire-jobs__empty-art" aria-hidden="true">
            <span className="hire-jobs__empty-blob" />
            <span className="hire-jobs__empty-card">
              <Briefcase />
            </span>
            <span className="hire-jobs__spark hire-jobs__spark--a" />
            <span className="hire-jobs__spark hire-jobs__spark--b" />
            <span className="hire-jobs__spark hire-jobs__spark--c" />
          </div>
          <h2>No jobs yet</h2>
          <p>
            Create your first job to start receiving applications from talented
            candidates.
          </p>
          <Link href="/hire/jobs/new" className="hire-jobs__btn">
            <Plus aria-hidden="true" />
            New job
          </Link>
          <div className="hire-jobs__or">
            <span>OR</span>
          </div>
          <button
            type="button"
            className="hire-jobs__textlink"
            onClick={() => setGuideOpen((v) => !v)}
            aria-expanded={guideOpen}
          >
            Learn how hiring works
            <span aria-hidden="true">→</span>
          </button>
          {guideOpen ? (
            <ol className="hire-jobs__guide">
              <li>
                <strong>Draft</strong> stays private. Only you can see it.
              </li>
              <li>
                <strong>Publish</strong> lists the role for candidates and
                starts accepting applications.
              </li>
              <li>
                <strong>Close</strong> stops new applications. Reopen it any
                time.
              </li>
            </ol>
          ) : null}
        </div>
      ) : emptyFilter ? (
        <div className="hire-jobs__empty hire-jobs__empty--filter">
          <h2>No matching jobs</h2>
          <p>Try another tab, clear search, or reset filters.</p>
          <button
            type="button"
            className="hire-jobs__btn hire-jobs__btn--ghost"
            onClick={() => {
              setTab("ALL");
              setQuery("");
              setWorkMode("ALL");
              setFiltersOpen(false);
            }}
          >
            <X aria-hidden="true" />
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="hire-jobs__list">
          {filtered.map((job) => (
            <li key={job.id}>
              <Link href={`/hire/jobs/${job.id}`} className="hire-jobs__card">
                <div>
                  <div className="hire-jobs__card-top">
                    <h2>{job.title}</h2>
                    <span
                      className={`hire-jobs__pill hire-jobs__pill--${job.status.toLowerCase()}`}
                    >
                      {statusLabel(job.status)}
                    </span>
                  </div>
                  <p className="hire-jobs__meta">
                    {job.company}
                    {job.location ? ` · ${job.location}` : null}
                    {job.workMode ? ` · ${WORK_MODE_LABEL[job.workMode]}` : null}
                    {` · ${JOB_TYPE_LABEL[job.type]}`}
                  </p>
                  <p className="hire-jobs__apps">
                    {job.applicantCount}{" "}
                    {job.applicantCount === 1 ? "applicant" : "applicants"}
                  </p>
                </div>
                <p className="hire-jobs__updated">Updated {job.updatedLabel}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
