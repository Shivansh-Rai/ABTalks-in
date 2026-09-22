# ABTalks architecture

Canonical production architecture after 078 migration Waves 1–3 (structural). Historical tables that still exist are listed under Historical archive — they are not current-state authority.

## Identity

```
User
UserRoleAssignment
CandidateProfile + structured children
  CandidateEducation
  CandidateExperience
  CandidateProjectEntry
  CandidateCertification
  CandidatePreference
  CandidateSkill
  Skill
CandidateVisibility
```

Recruiter discovery permission is `CandidateVisibility` (server-side). Searchable never exposes email/phone.

## Learning

```
ProgramCategory
LearningProgram / ProgramVersion / Cohort
Module / Activity / typed Activity configs
ProgramEnrollment
ActivityAttempt / ActivityEvaluation
ActivitySkill
SkillEvidence
```

`EnrollmentProgress` is a cache, not globally authoritative.

Challenge membership current-state is `ProgramEnrollment` (`pe_enr_<legacyEnrollmentId>` for historical rows). First-track order uses `ProgramEnrollment.joinedAt`, not `startedAt` (some `startedAt` values are cohort-calendar dates).

AI-cohort membership current-state is `ProgramEnrollment` (`pe_pm_<legacyProgramMemberId>`). Score/unlock/recommendation snapshots live on that row.

## Points

```
PointsAccount
PointsTransaction
```

`PointsTransaction` is the ledger. `PointsAccount.balance` is the wallet.

## Credentials

```
Credential
CandidateAchievement
```

Public verification and PDF use `Credential`. Historical `Certificate` rows remain for provenance only.

## Ambassador

```
CampusAmbassadorApplication
```

## Talent / recruiting

```
Organization / OrganizationMember
RecruiterProfile
TalentList / TalentListItem
CandidateNote
Job / JobApplication
AssessmentReport / AssessmentScore / AssessmentReportShare
```

Program-scoped live children (`ProgramCommitDay`, `ProgramInterview`, `GeneralInterview`, `ProgramProject`, …) reference `ProgramEnrollment.id` (`programEnrollmentId`). Recruiter shortlist candidate identity is `RecruiterShortlistItem.candidateUserId`.

Public/historical identifier strings stay stable:

```
pe_enr_<legacyEnrollmentId>
pe_pm_<legacyProgramMemberId>
aa_sub_<legacySubmissionId>
aa_qa_<legacyQuizAttemptId>
aa_ms_<legacyProgramMissionSubmissionId>
ABT-* Credential ids
```

## Historical archive

These tables are not current-state authority. They still exist in production Postgres because unique historical payloads and remaining readers have not finished moving. They are frozen or structural leftovers, not a dual-write control plane.

| Object | Status | Why retained |
| --- | --- | --- |
| `Enrollment` | RETAINED HISTORICAL + remaining operational readers/writers | Challenge create/status still mints/updates Enrollment; Submission/Certificate FKs; many admin readers |
| `ProgramMember` | RETAINED HISTORICAL + remaining identity readers | Inbound FKs dropped; `memberId` scalars remain; dashboard/talent still load the row |
| `StudentProfile` | RETAINED HISTORICAL | Identity frozen; compliance still scrubs; unique snapshot not archived |
| `Submission` | RETAINED HISTORICAL | Frozen W6; FK to Enrollment; some metadata not proven copied |
| `QuizAttempt` | RETAINED HISTORICAL | Raw `answers` JSON; `progress.ts` historical fallback |
| `ProgramMissionSubmission` | RETAINED HISTORICAL | Frozen W6; `programEnrollmentId` FK added; raw payload/feedback |
| `Certificate` | RETAINED HISTORICAL | Provenance for Credential/admin; public verify is Credential |
| `SynergyEvent` | RETAINED HISTORICAL | Frozen W1-B ledger leftover; unique context not archived |
| `User.synergyPoints` / `StudentProfile.synergyPoints` | RETAINED HISTORICAL columns | Frozen numeric snapshots |

## Runtime flags

Migration control-plane flags (`ENABLE_DUAL_WRITE`, `ENABLE_NEW_*`, `ENABLE_LEGACY_*_MIRROR`) are retired from runtime. Product flags (Databricks, recruiter auth, hire pool, …) remain.
