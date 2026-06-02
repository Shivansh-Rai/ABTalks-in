# 001 — Fix "Too small: expected string to have >=1 characters" on profile update

## 1. Goal
Fix the profile-update bug where editing GitHub username (or any other optional
field) on `/profile` fails with toast `"Too small: expected string to have >=1
characters"` and prevents saving. Bonus: surface a useful error message that
names the failing field instead of the bare Zod default.

## 2. Current behavior
- User opens `/profile`, the form is rendered by `profile-form.tsx` with
  `defaultValues: initialProfile`, where `initialProfile.userType` is
  `"STUDENT"` or `"PROFESSIONAL"`.
- The Zod resolver is `updateStudentProfileSchema` or
  `updateProfessionalProfileSchema` from `src/lib/validations/profile.ts`.
- **Neither schema declares `userType`**. So when `zodResolver` parses form
  values it **strips `userType`** from the output (Zod's default for unknown
  keys on `z.object`). RHF then calls `onSubmit(parsedValues)` where
  `values.userType` is `undefined`.
- `onSubmit` in `profile-form.tsx` (lines ~84–91) reads `values.userType` to
  decide which conditional fields to append:
  ```ts
  if (userType === "STUDENT" && values.userType === "STUDENT") {
    fd.append("college", values.college);
    fd.append("graduationYear", String(values.graduationYear));
  } else if (values.userType === "PROFESSIONAL") {
    fd.append("organization", values.organization);
    fd.append("role", values.role);
    fd.append("yearsExperience", String(values.yearsExperience));
  }
  ```
  Because `values.userType` is `undefined`, **both branches are skipped**, and
  `college`/`graduationYear` (or `organization`/`role`/`yearsExperience`) are
  never appended to the FormData.
- Server-side, `updateProfileAction` reads
  `String(formData.get("college") ?? "")` → `""`, then `updateProfile()` runs
  `updateStudentProfileSchema.safeParse({ ..., college: "" })`. The
  `college: z.string().trim().min(1).max(200)` check fails. The action returns
  `parsed.error.issues[0]?.message`, which is Zod v4's default:
  `"Too small: expected string to have >=1 characters"`.
- The user, who was actually typing in the GitHub Username field, sees this
  toast and concludes the bug is about GitHub.
- For PROFESSIONAL users the same symptom comes from empty
  `organization`/`role`/`yearsExperience`.

This is reproducible on any clean profile: open `/profile`, edit ONLY
`githubUsername` (or `linkedinUrl`, or `phone`), click Save → toast errors
because the conditional fields never reach the server.

## 3. Files to touch
- `src/lib/validations/profile.ts` — `[edit]` add `userType` literal to both
  schemas so RHF's parsed `values` preserves it, and make sure
  `ProfileFormValues` keeps the discriminated shape.
- `src/app/profile/profile-form.tsx` — `[edit]` drop the brittle
  `values.userType` check in `onSubmit`; key off the closure `userType`
  prop (which is already the source of truth for which inputs are rendered).
- `src/features/profile/update-profile.ts` — `[edit]` improve the error
  message: prepend the failing field path (e.g. `"college: Too small …"`) so
  future bugs surface the actual field. Behaviour otherwise unchanged.
- `src/app/actions/profile-actions.ts` — `[edit]` no logic change, but ensure
  it still trusts `profile.userType` from the DB (don't trust the form), and
  pass any empty `college` / `organization` as `""` for the schema (current
  behaviour, just keep it).

No new files. No schema migration. No new dependencies.

## 4. Server vs Client
- `profile-form.tsx` — **Client** (`"use client"`). Edits are inside the
  component; no Server → Client prop changes.
- `profile-actions.ts` — **Server** (Server Action). Unchanged interface.
- `update-profile.ts` — **Server** module. Unchanged interface, only error
  string formatting changes.
- `validations/profile.ts` — runs in both. Adding `userType` literal to each
  object schema is backwards compatible for the server (server constructs the
  parse input itself; passing an extra `userType` key is harmless).

No Server → Client prop changes. No icons/functions/Date instances crossing
the boundary.

## 5. Step-by-step changes

### 5.1 `src/lib/validations/profile.ts`
1. Add `userType` as a literal to each schema so the resolver preserves it:
   ```ts
   export const updateStudentProfileSchema = z.object({
     userType: z.literal("STUDENT"),
     ...profileCommonFields,
     college: z.string().trim().min(1, "College is required").max(200),
     graduationYear: z.coerce.number().int().min(2020).max(2035),
   });

   export const updateProfessionalProfileSchema = z.object({
     userType: z.literal("PROFESSIONAL"),
     ...profileCommonFields,
     organization: z.string().trim().min(1, "Organization is required").max(200),
     role: z.string().trim().min(1, "Role is required").max(200),
     yearsExperience: z.coerce.number().int().min(0).max(60),
   });
   ```
2. Add explicit error messages on the `.min(1)` checks so any future failure
   tells the user which field, not the Zod default:
   - `fullName`: `"Full name is required"`
   - `skills` item: `"Skills cannot be blank"`
   - `college`: `"College is required"`
   - `organization`: `"Organization is required"`
   - `role`: `"Role is required"`
3. Re-export `ProfileFormValues` — since both schemas now include `userType`,
   the discriminated union you already had works without the manual
   `& { userType: "STUDENT" }` intersection. Either:
   - keep the manual intersection (still type-compatible), OR
   - simplify to `z.input<typeof updateStudentProfileSchema> | z.input<typeof updateProfessionalProfileSchema>`.
   Pick the simpler form.

### 5.2 `src/app/profile/profile-form.tsx`
1. In `onSubmit`, do **not** read `values.userType` — trust the closure
   `userType` prop:
   ```ts
   async function onSubmit(values: ProfileFormValues) {
     const fd = new FormData();
     fd.append("fullName", values.fullName);
     fd.append("skills", JSON.stringify(values.skills));
     fd.append("linkedinUrl", values.linkedinUrl ?? "");
     fd.append("resumeUrl", values.resumeUrl ?? "");
     fd.append("phone", values.phone ?? "");
     fd.append("githubUsername", values.githubUsername ?? "");

     if (userType === "STUDENT") {
       // values is StudentProfileFormValues here — userType is part of the schema now
       const v = values as Extract<ProfileFormValues, { userType: "STUDENT" }>;
       fd.append("college", v.college);
       fd.append("graduationYear", String(v.graduationYear));
     } else {
       const v = values as Extract<ProfileFormValues, { userType: "PROFESSIONAL" }>;
       fd.append("organization", v.organization);
       fd.append("role", v.role);
       fd.append("yearsExperience", String(v.yearsExperience));
     }

     const result = await updateProfileAction(fd);
     if (!result.ok) {
       toast.error(result.message);
       return;
     }
     toast.success("Profile updated");
     router.refresh();
   }
   ```
   The `Extract<...>` narrows `values` without `any`. Because `userType` is
   now in the schema, RHF's parsed `values` will carry it, but we still key
   off the closure prop (single source of truth — matches which inputs are
   rendered).
2. No JSX changes. No new imports beyond what's already there.

### 5.3 `src/features/profile/update-profile.ts`
1. Replace the bare `parsed.error.issues[0]?.message ?? "Invalid input"` with
   a field-aware string in both branches:
   ```ts
   if (!parsed.success) {
     const issue = parsed.error.issues[0];
     const field = issue?.path?.[0];
     const message = issue?.message ?? "Invalid input";
     return {
       ok: false,
       message: field ? `${String(field)}: ${message}` : message,
     };
   }
   ```
2. No behavioural change to the Prisma update or to the return shape.

### 5.4 `src/app/actions/profile-actions.ts`
1. Keep using `profile.userType` from the DB as the source of truth.
2. When building the input for `updateProfile`, also pass `userType` (which
   is already there). No structural change. Just confirm the existing fields
   match the new schema shape (they do — adding `userType` to the schema is
   purely additive).

## 6. Guardrails for Cursor (DO NOT)
- DO NOT add `userType` to the form by registering `<input
  name="userType">` — keep it as `defaultValues` only. Account type is fixed
  per the page copy.
- DO NOT touch `src/lib/validations/register.ts` or any registration code.
  That schema already handles `userType` via `z.discriminatedUnion` — we are
  intentionally NOT switching `profile.ts` to `discriminatedUnion` because
  the client passes one schema or the other to RHF (not both), and the
  current shape is fine once `userType` is a literal in each.
- DO NOT add `passthrough()`/`strip()`/`catchall()` calls — the explicit
  `userType` literal solves the strip-on-parse problem.
- DO NOT change Prisma queries or add new `select` fields. The Prisma
  update path is correct.
- DO NOT introduce `any`. Use `Extract<ProfileFormValues, { userType: ... }>`
  for narrowing in `onSubmit`.
- DO NOT add Lucide icons, Dates, or functions to props. No new Server →
  Client crossings — this is all inside one client component plus a server
  action.
- DO NOT add this feature path to `middleware.ts` — `/profile` is already
  covered by the existing `protectedPaths` array.
- DO NOT use `console.error` for the new branch in `update-profile.ts`. If
  you need to log, use `lib/logger.ts` (existing pattern).
- DO NOT remove the existing `.transform()` / `.pipe()` chains on
  `githubUsername`, `linkedinUrl`, etc. They are correct and handle empty
  string → undefined.

## 7. DB safety
Not applicable — no schema or data changes.

## 8. Verification
Manual test (local dev, `ENABLE_DEV_AUTH=true`):
1. `npm run dev`.
2. Log in as `arjun@abtalks.dev` / `test` (STUDENT) — they have a complete
   profile.
3. Go to `/profile`. Edit ONLY the GitHub username field → "octocat". Save.
   - **Before fix:** toast `"Too small: expected string to have >=1
     characters"`.
   - **After fix:** toast `"Profile updated"`, GitHub username persists on
     refresh.
4. Edit ONLY the LinkedIn URL → valid URL. Save. Toast success.
5. Edit ONLY the phone number → `+91 9876543210`. Save. Toast success.
6. Clear the GitHub username (leave blank). Save. Toast success — field
   stored as `null` in DB.
7. Type an invalid GitHub username (e.g. `bad user!`). Save. Toast should
   read something like
   `"githubUsername: GitHub username may only contain letters, numbers, and hyphens"`
   (field-prefixed thanks to step 5.3).
8. Clear the college field entirely. Save. Toast should read
   `"college: College is required"` (field-prefixed; not the bare Zod
   default).
9. Repeat 3–8 logged in as a PROFESSIONAL test user (if seeded; otherwise
   manually flip one in the DB or add a PROFESSIONAL seed). Confirm
   organization/role/yearsExperience round-trip correctly.

Build / typecheck:
- `npm run lint` — must pass.
- `tsc --noEmit` (via `next build` or your editor) — must pass.
- `npm run build` — must compile cleanly. Pay attention: the
  `ProfileFormValues` type change may surface elsewhere; fix if so.

Files that should be modified (and only these):
- `src/lib/validations/profile.ts`
- `src/app/profile/profile-form.tsx`
- `src/features/profile/update-profile.ts`
- (optional, only if needed for typing) `src/app/actions/profile-actions.ts`

No new files. No deletions.

## 9. Commit message
```
fix(profile): preserve userType through zodResolver so updates save

The profile update form was silently dropping conditional fields (college,
graduationYear for students; organization, role, yearsExperience for
professionals) because the Zod schemas didn't declare `userType` and
zodResolver stripped it from the parsed values. The conditional FormData
appends in onSubmit then never ran, and the server saw empty required
fields, returning the unhelpful "Too small: expected string to have >=1
characters" toast — usually while the user thought they were just editing
GitHub username.

Adds `userType` as a literal to both profile schemas, switches onSubmit
to trust the closure prop, and prefixes server-side validation errors
with the failing field name for clearer feedback.
```
