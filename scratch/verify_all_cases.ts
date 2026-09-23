import assert from "node:assert";
import { normalizeParsedResume, normalizeUrl, normalizeGithubUrl } from "@/features/resume/normalize";
import { planResumeMerge } from "@/features/resume/merge/plan";
import type { CandidateDetail } from "@/repositories/candidate-detail";

const emptyDetail: CandidateDetail = {
  id: "cand_test_1",
  headline: null,
  summary: null,
  locationCity: null,
  linkedinUrl: null,
  githubUsername: null,
  portfolioUrl: null,
  resumeUrl: null,
  skills: [],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
};

console.log("==================================================");
console.log("RUNNING VERIFICATION OF ALL CASES A - L & NEGATIVES");
console.log("==================================================");

// Case A: Dedicated fields
{
  const raw = {
    projects: [{
      title: "Case A - Dedicated",
      github: "https://github.com/alice/project-a",
      demo: "https://project-a.vercel.app",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/alice/project-a");
  assert.strictEqual(norm.projects[0]?.demo, "https://project-a.vercel.app");
  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, "https://github.com/alice/project-a");
  assert.strictEqual(plan.projects.create[0]?.liveUrl, "https://project-a.vercel.app");
  console.log("✓ Case A (Dedicated fields) PASSED");
}

// Case B: Both URLs inline in description
{
  const raw = {
    projects: [{
      title: "Case B - Inline",
      description: "Implemented full-stack architecture. Code is at https://github.com/bob/project-b and live deployment is at https://project-b.netlify.app",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/bob/project-b");
  assert.strictEqual(norm.projects[0]?.demo, "https://project-b.netlify.app");
  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, "https://github.com/bob/project-b");
  assert.strictEqual(plan.projects.create[0]?.liveUrl, "https://project-b.netlify.app");
  console.log("✓ Case B (Inline URLs) PASSED");
}

// Case C: Scheme-less
{
  const raw = {
    projects: [{
      title: "Case C - Scheme-less",
      description: "Source: github.com/charlie/project-c | Demo: project-c.vercel.app",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/charlie/project-c");
  assert.strictEqual(norm.projects[0]?.demo, "https://project-c.vercel.app");
  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, "https://github.com/charlie/project-c");
  assert.strictEqual(plan.projects.create[0]?.liveUrl, "https://project-c.vercel.app");
  console.log("✓ Case C (Scheme-less URLs) PASSED");
}

// Case D: Parentheses
{
  const raw = {
    projects: [{
      title: "Case D - Parentheses (github.com/dana/project-d)",
      description: "Production version hosted at (https://project-d.pages.dev)",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/dana/project-d");
  assert.strictEqual(norm.projects[0]?.demo, "https://project-d.pages.dev");
  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, "https://github.com/dana/project-d");
  assert.strictEqual(plan.projects.create[0]?.liveUrl, "https://project-d.pages.dev");
  console.log("✓ Case D (Parentheses wrapped) PASSED");
}

// Case E: Trailing punctuation (commas, periods, brackets)
{
  const raw = {
    projects: [{
      title: "Case E - Punctuation",
      description: "View repository: https://github.com/elena/project-e, and live version: https://project-e.onrender.com.",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/elena/project-e");
  assert.strictEqual(norm.projects[0]?.demo, "https://project-e.onrender.com");
  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, "https://github.com/elena/project-e");
  assert.strictEqual(plan.projects.create[0]?.liveUrl, "https://project-e.onrender.com");
  console.log("✓ Case E (Trailing punctuation) PASSED");
}

// Case F: All deployment host types
{
  const hosts = [
    { text: "Hosted on frank-app.vercel.app", expected: "https://frank-app.vercel.app" },
    { text: "Deployed to frank-app.netlify.app", expected: "https://frank-app.netlify.app" },
    { text: "Hosted at https://frank-app.pages.dev/home", expected: "https://frank-app.pages.dev/home" },
    { text: "Backend running on frank-api.onrender.com", expected: "https://frank-api.onrender.com" },
    { text: "Live at frank-app.herokuapp.com", expected: "https://frank-app.herokuapp.com" },
    { text: "Interactive documentation: frank.github.io/app", expected: "https://frank.github.io/app" },
  ];
  for (const h of hosts) {
    const norm = normalizeParsedResume({
      projects: [{ title: "Deploy host test", description: h.text }],
    });
    assert.strictEqual(norm.projects[0]?.demo, h.expected, `Failed host test for ${h.text}`);
  }
  console.log("✓ Case F (All deployment hosts .vercel.app, .netlify.app, .pages.dev, .onrender.com, .herokuapp.com, .github.io) PASSED");
}

// Case G: Labeled custom domains
{
  const raw = {
    projects: [{
      title: "Case G - Custom Domain",
      description: "Real-time SaaS platform. Live demo: showcase.mycompany.io [Vue.js 3, Tailwind]",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.demo, "https://showcase.mycompany.io");
  console.log("✓ Case G (Labeled custom domain) PASSED");
}

// Case H: Tech-name false positives (Node.js, Express.js, React.js, Three.js)
{
  const raw = {
    projects: [{
      title: "Case H - Tech names",
      description: "Built microservices using Node.js, Express.js, Three.js and React.js. Live demo: https://app.vercel.app",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.demo, "https://app.vercel.app");
  assert.notStrictEqual(norm.projects[0]?.demo, "https://Node.js");
  assert.notStrictEqual(norm.projects[0]?.demo, "https://Express.js");
  assert.notStrictEqual(norm.projects[0]?.demo, "https://Three.js");
  assert.notStrictEqual(norm.projects[0]?.demo, "https://React.js");
  console.log("✓ Case H (Tech-name false positives avoided) PASSED");
}

// Case I: No-link project
{
  const raw = {
    projects: [{
      title: "Case I - Internal CLI Tool",
      description: "Developed proprietary command line utility in Go for database migrations.",
    }],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, null);
  assert.strictEqual(norm.projects[0]?.demo, null);
  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, null);
  assert.strictEqual(plan.projects.create[0]?.liveUrl, null);
  console.log("✓ Case I (No-link project remains null) PASSED");
}

// Case J: Multi-project isolation
{
  const raw = {
    projects: [
      {
        title: "Project Alpha",
        description: "Source: github.com/user/alpha | Live: alpha.vercel.app",
      },
      {
        title: "Project Beta",
        description: "Internal tool with no public repo or deployment.",
      },
      {
        title: "Project Gamma",
        description: "Live demo at https://gamma.netlify.app",
      },
    ],
  };
  const norm = normalizeParsedResume(raw);
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/user/alpha");
  assert.strictEqual(norm.projects[0]?.demo, "https://alpha.vercel.app");
  assert.strictEqual(norm.projects[1]?.github, null);
  assert.strictEqual(norm.projects[1]?.demo, null);
  assert.strictEqual(norm.projects[2]?.github, null);
  assert.strictEqual(norm.projects[2]?.demo, "https://gamma.netlify.app");

  const plan = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan.projects.create[0]?.repoUrl, "https://github.com/user/alpha");
  assert.strictEqual(plan.projects.create[0]?.liveUrl, "https://alpha.vercel.app");
  assert.strictEqual(plan.projects.create[1]?.repoUrl, null);
  assert.strictEqual(plan.projects.create[1]?.liveUrl, null);
  assert.strictEqual(plan.projects.create[2]?.repoUrl, null);
  assert.strictEqual(plan.projects.create[2]?.liveUrl, "https://gamma.netlify.app");
  console.log("✓ Case J (Multi-project link isolation) PASSED");
}

// Case K: Existing profile preservation
{
  // Sub-case 1: Already has both links -> neither is overwritten, no update needed
  const fullyPopulated: CandidateDetail = {
    ...emptyDetail,
    projects: [{
      id: "proj_existing_1",
      title: "Project Alpha",
      description: "My manually crafted description",
      techStack: ["React"],
      repoUrl: "https://github.com/user/existing-alpha",
      liveUrl: "https://existing-alpha.com",
    }],
  };
  const raw = {
    projects: [{
      title: "Project Alpha",
      description: "Updated description. Repo: github.com/user/new-alpha. Live: new-alpha.vercel.app",
    }],
  };
  const norm = normalizeParsedResume(raw);
  const plan1 = planResumeMerge(norm, fullyPopulated);
  assert.strictEqual(plan1.projects.create.length, 0);
  assert.strictEqual(plan1.projects.update.length, 0, "Fully populated project should not be mutated");

  // Sub-case 2: Existing project has repoUrl but no liveUrl -> fills liveUrl, preserves repoUrl
  const partiallyPopulated: CandidateDetail = {
    ...emptyDetail,
    projects: [{
      id: "proj_existing_2",
      title: "Project Beta",
      description: "Existing description",
      techStack: ["React"],
      repoUrl: "https://github.com/user/existing-beta",
      liveUrl: null,
    }],
  };
  const raw2 = {
    projects: [{
      title: "Project Beta",
      description: "Repo: github.com/user/new-beta. Live: new-beta.vercel.app",
    }],
  };
  const plan2 = planResumeMerge(normalizeParsedResume(raw2), partiallyPopulated);
  assert.strictEqual(plan2.projects.create.length, 0);
  assert.strictEqual(plan2.projects.update.length, 1);
  assert.strictEqual(plan2.projects.update[0]?.liveUrl, "https://new-beta.vercel.app");
  assert.strictEqual(plan2.projects.update[0]?.repoUrl, undefined, "Existing repoUrl must not be overwritten");

  console.log("✓ Case K (Existing profile preservation) PASSED");
}

// Case L: Idempotent re-upload
{
  const raw = {
    projects: [{
      title: "Project Alpha",
      description: "Source: github.com/user/alpha | Live: alpha.vercel.app",
    }],
  };
  const norm = normalizeParsedResume(raw);
  // First merge
  const plan1 = planResumeMerge(norm, emptyDetail);
  assert.strictEqual(plan1.projects.create.length, 1);

  // Simulate applied state
  const populatedDetail: CandidateDetail = {
    ...emptyDetail,
    projects: [{
      id: "proj_created_1",
      title: "Project Alpha",
      description: plan1.projects.create[0]!.description,
      techStack: plan1.projects.create[0]!.techStack,
      repoUrl: plan1.projects.create[0]!.repoUrl,
      liveUrl: plan1.projects.create[0]!.liveUrl,
    }],
  };

  // Re-upload same resume
  const plan2 = planResumeMerge(norm, populatedDetail);
  assert.strictEqual(plan2.projects.create.length, 0);
  assert.strictEqual(plan2.projects.update.length, 0);
  console.log("✓ Case L (Idempotent re-upload produces 0 diff) PASSED");
}

// Phase 6: Negative tests
{
  // 1. Language file extensions
  assert.strictEqual(normalizeUrl("Node.js"), null);
  assert.strictEqual(normalizeUrl("React.js"), null);
  assert.strictEqual(normalizeUrl("Three.js"), null);
  assert.strictEqual(normalizeUrl("script.py"), null);
  assert.strictEqual(normalizeUrl("style.css"), null);
  assert.strictEqual(normalizeUrl("main.go"), null);

  // 2. Banned non-URL strings
  assert.strictEqual(normalizeGithubUrl("GitHub"), null);
  assert.strictEqual(normalizeGithubUrl("github"), null);
  assert.strictEqual(normalizeGithubUrl("None"), null);
  assert.strictEqual(normalizeGithubUrl("none"), null);
  assert.strictEqual(normalizeGithubUrl("N/A"), null);
  assert.strictEqual(normalizeGithubUrl("n/a"), null);
  assert.strictEqual(normalizeGithubUrl("null"), null);

  assert.strictEqual(normalizeUrl("Live Demo"), null);
  assert.strictEqual(normalizeUrl("None"), null);
  assert.strictEqual(normalizeUrl("N/A"), null);
  assert.strictEqual(normalizeUrl("null"), null);

  // 3. GitHub does not become liveUrl and vice versa
  const norm = normalizeParsedResume({
    projects: [{
      title: "Negative cross-contamination test",
      description: "Source code: https://github.com/alice/project",
    }],
  });
  assert.strictEqual(norm.projects[0]?.github, "https://github.com/alice/project");
  assert.strictEqual(norm.projects[0]?.demo, null, "GitHub URL must not become liveUrl");

  const norm2 = normalizeParsedResume({
    projects: [{
      title: "Negative cross-contamination test 2",
      description: "Deployed on https://project.vercel.app",
    }],
  });
  assert.strictEqual(norm2.projects[0]?.github, null, "Live URL must not become repoUrl");
  assert.strictEqual(norm2.projects[0]?.demo, "https://project.vercel.app");

  console.log("✓ Phase 6 (All negative tests & cross-contamination guards) PASSED");
}

console.log("==================================================");
console.log("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!");
console.log("==================================================");
