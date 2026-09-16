import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RejectSubmissionButton } from "@/components/admin/reject-submission-button";
import { StudentActionPanel } from "@/components/admin/student-action-panel";
import { GrantSynergyDialog } from "@/components/admin/grant-synergy-dialog";
import { DeleteUserAccountDialog } from "@/components/admin/delete-user-account-dialog";
import { AccountOpsDialog } from "@/components/admin/account-ops-dialog";
import { StudentRemarksPanel } from "@/components/admin/student-remarks-panel";
import { RecruiterReviewPanel } from "@/components/admin/recruiter-review-panel";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { CandidateCareerSections } from "@/components/admin/candidate-career-sections";
import { formatDateIST, formatDateTimeIST } from "@/lib/date-utils";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminCandidateDetail } from "@/features/admin/get-admin-candidate-detail";
import { getRecruiterReview } from "@/features/recruiter/get-recruiter-review";
import { cn } from "@/lib/utils";
import type { ChallengeStudentDetail, HackathonStudentDetail } from "@/features/admin/get-student-detail";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function domainBadgeClass(domain: string): string {
  if (domain === "AI") return "border-domains-ai/50 bg-domains-ai-bg text-domains-ai";
  if (domain === "DS") return "border-domains-ds/50 bg-domains-ds-bg text-domains-ds";
  if (domain === "HACKATHON")
    return "border-border bg-muted text-muted-foreground";
  return "border-domains-se/50 bg-domains-se-bg text-domains-se";
}

export default async function AdminStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getAdminCandidateDetail(id);
  if (!detail) notFound();

  const { account, ops } = detail;
  const review =
    ops?.kind === "challenge" ? await getRecruiterReview(id) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/students"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
      >
        <ArrowLeft className="size-4" />
        Candidates
      </Link>

      <AdminPageHeader
        title={account.name}
        description={`${account.email} · Joined ${formatDateIST(account.joinedAt)}`}
        actions={
          ops?.kind === "challenge" ? (
            <StudentActionPanel
              studentId={ops.student.userId}
              studentName={ops.student.fullName}
              isReadyForInterview={ops.student.isReadyForInterview}
              isActive={ops.student.enrollmentStatus === "ACTIVE"}
              disabledAt={account.disabledAt ? account.disabledAt.toISOString() : null}
            />
          ) : (
            <GenericAccountOps
              userId={account.userId}
              name={account.name}
              disabledAt={account.disabledAt}
            />
          )
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Avatar className="size-14">
          {account.image ? <AvatarImage src={account.image} alt="" /> : null}
          <AvatarFallback>{initials(account.name)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-2">
          {ops?.kind === "hackathon" ? (
            <>
              <Badge variant="outline" className={domainBadgeClass("HACKATHON")}>
                HACKATHON
              </Badge>
              <Badge>{ops.hackathon.entryType}</Badge>
            </>
          ) : ops?.kind === "challenge" ? (
            <>
              {ops.profile.domain ? (
                <Badge variant="outline" className={domainBadgeClass(ops.profile.domain)}>
                  {ops.profile.domain}
                </Badge>
              ) : (
                <Badge variant="outline">—</Badge>
              )}
              <Badge>{ops.enrollment?.status ?? "UNASSIGNED"}</Badge>
              {ops.profile.isReadyForInterview ? (
                <Badge variant="secondary">Ready for Interview</Badge>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      <CandidateCareerSections detail={detail} />

      {ops?.kind === "hackathon" ? <HackathonCard data={ops} /> : null}

      {ops?.kind === "challenge" && review ? (
        <ChallengeOps data={ops} review={review} />
      ) : null}
    </div>
  );
}

function GenericAccountOps({
  userId,
  name,
  disabledAt,
}: {
  userId: string;
  name: string;
  disabledAt: Date | null;
}) {
  return (
    <div className="flex flex-col items-start gap-2 md:items-end">
      <GrantSynergyDialog studentId={userId} studentName={name} />
      <DeleteUserAccountDialog userId={userId} userName={name} />
      <AccountOpsDialog
        targetUserId={userId}
        targetName={name}
        op="disable"
        disabled={Boolean(disabledAt)}
      />
      <AccountOpsDialog
        targetUserId={userId}
        targetName={name}
        op="restore"
        disabled={!disabledAt}
      />
      <AccountOpsDialog targetUserId={userId} targetName={name} op="secure" />
    </div>
  );
}

function HackathonCard({ data }: { data: HackathonStudentDetail }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hackathon registration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>
          <span className="text-muted-foreground">Full name:</span> {data.hackathon.fullName}
        </p>
        <p>
          <span className="text-muted-foreground">Email:</span> {data.hackathon.email}
        </p>
        <p>
          <span className="text-muted-foreground">Phone:</span>{" "}
          <a
            className="text-primary underline"
            href={`tel:${encodeURIComponent(data.hackathon.phone)}`}
          >
            {data.hackathon.phone}
          </a>
        </p>
        <p>
          <span className="text-muted-foreground">College:</span> {data.hackathon.college}
        </p>
        <p>
          <span className="text-muted-foreground">Graduation year:</span>{" "}
          {data.hackathon.graduationYear}
        </p>
        <p>
          <span className="text-muted-foreground">Entry type:</span> {data.hackathon.entryType}
        </p>
        {data.hackathon.entryType === "TEAM" ? (
          <p>
            <span className="text-muted-foreground">Team name:</span>{" "}
            {data.hackathon.teamName ?? "-"}
          </p>
        ) : null}
        <p>
          <span className="text-muted-foreground">Team code:</span> {data.hackathon.teamCode}
        </p>
        <p>
          <span className="text-muted-foreground">Registered:</span>{" "}
          {formatDateIST(data.hackathon.createdAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function ChallengeOps({
  data,
  review,
}: {
  data: ChallengeStudentDetail;
  review: Awaited<ReturnType<typeof getRecruiterReview>>;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Progress Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Days Completed:</span>{" "}
            {data.progress.daysCompleted} / {data.progress.totalDays}
          </p>
          <p>
            <span className="text-muted-foreground">Current Streak:</span>{" "}
            {data.progress.currentStreak}
          </p>
          <p>
            <span className="text-muted-foreground">Longest Streak:</span>{" "}
            {data.progress.longestStreak}
          </p>
          <p>
            <span className="text-muted-foreground">On-time submissions:</span>{" "}
            {data.progress.onTimeCount}
          </p>
          <p>
            <span className="text-muted-foreground">Last Submitted Day:</span>{" "}
            {data.progress.lastSubmittedDay ?? "-"}
          </p>
          <p>
            <span className="text-muted-foreground">Synergy Points:</span>{" "}
            {data.user.synergyPoints}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="quizzes">Quiz Attempts</TabsTrigger>
          <TabsTrigger value="admin-actions">Admin Actions</TabsTrigger>
          <TabsTrigger value="recruiter">Recruiter Profile</TabsTrigger>
          <TabsTrigger value="remarks">Remarks</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>GitHub</TableHead>
                  <TableHead>LinkedIn</TableHead>
                  <TableHead>Submitted At</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.submissions.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.dayNumber}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      {row.githubUrl ? (
                        <a
                          href={row.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.linkedinUrl ? (
                        <a
                          href={row.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTimeIST(row.submittedAt)}</TableCell>
                    <TableCell className="text-right">
                      <RejectSubmissionButton
                        submissionId={row.id}
                        dayNumber={row.dayNumber}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="quizzes">
          {data.quizAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quizzes attempted yet</p>
          ) : (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead>Quiz</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quizAttempts.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.weekNumber}</TableCell>
                      <TableCell>{row.quizTitle}</TableCell>
                      <TableCell>{row.score}</TableCell>
                      <TableCell>{formatDateTimeIST(row.attemptedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="admin-actions">
          {data.adminActions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions for this user</p>
          ) : (
            <div className="space-y-2">
              {data.adminActions.map((row) => (
                <Card key={row.id}>
                  <CardContent className="space-y-1 pt-4 text-sm">
                    <p className="font-medium">
                      {row.adminName} · {row.actionType}
                    </p>
                    <p className="text-muted-foreground">
                      Reason: {row.reason?.trim() || "-"}
                    </p>
                    <p className="text-muted-foreground">
                      Metadata: {row.metadata ? JSON.stringify(row.metadata) : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTimeIST(row.createdAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recruiter">
          <RecruiterReviewPanel
            studentId={data.student.userId}
            studentName={data.student.fullName}
            review={review}
          />
        </TabsContent>

        <TabsContent value="remarks">
          <StudentRemarksPanel
            studentId={data.student.userId}
            studentName={data.student.fullName}
            remarks={data.remarks}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
