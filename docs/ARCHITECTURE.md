# ABTalks architecture

Canonical production architecture. Unique history lives only in explicit `Historical*` archives. There is no dual-write, no legacy operational table, and no 078 migration control plane.

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

Challenge membership current-state is `ProgramEnrollment` (`pe_enr_*`). First-track order uses `ProgramEnrollment.joinedAt`.

AI-cohort membership current-state is `ProgramEnrollment` (`pe_pm_*`). Score/unlock/recommendation snapshots live on that row.

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

Public verification and PDF use `Credential`. Historical certificate provenance is `HistoricalCertificate`.

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

Original operational tables (`StudentProfile`, `Enrollment`, `ProgramMember`, `Certificate`, `Submission`, `QuizAttempt`, `ProgramMissionSubmission`, `SynergyEvent`) and `User.synergyPoints` are dropped in production. Unique history lives only in explicit archive models. Those archives are immutable except compliance PII scrub.

| Object | Status |
| --- | --- |
| `HistoricalQuizAttempt` | ARCHIVE — raw quiz `answers` JSON |
| `HistoricalProgramMission` | ARCHIVE — mission payload/verdict |
| `HistoricalCertificate` | ARCHIVE — certificate provenance |
| `HistoricalSubmission` | ARCHIVE — submission metadata |
| `HistoricalSynergyEvent` | ARCHIVE — legacy points events |
| `HistoricalStudentProfile` | ARCHIVE — identity snapshot |

`dual-write.ts` is deleted. There is no Enrollment/ProgramMember current-state path.

## Runtime flags

Migration control-plane flags (`ENABLE_DUAL_WRITE`, `ENABLE_NEW_*`, `ENABLE_LEGACY_*_MIRROR`) are retired from runtime. Product flags (Databricks, recruiter auth, hire pool, …) remain.
