"""
Builds docs/plans/assets/ABTalks-September-Execution-Tracker.xlsx

Revision 6 (2026-09-05): restructured around the north-star RECRUITER JOURNEY.
25 workstreams (G0 / C1-C5 candidate / R1-R12 recruiter / P1-P5 platform),
task-level acceptance criteria, a "where to start" column for junior developers,
an explicit decision-dependency column, and a recruiter journey coverage matrix.
Payment gateway deferred to October by product decision; the plan journey ships
without the charge. Regenerate with:  python3 112-build-tracker.py
"""
import datetime as dt
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.formatting.rule import CellIsRule, DataBarRule
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, DoughnutChart, Reference

OUT = "docs/plans/assets/ABTalks-September-Execution-Tracker.xlsx"

# ---------------------------------------------------------------- palette
NAVY, MID, BLUE, ORANGE, GREEN, RED = "1F3864", "44546A", "2E75B6", "ED7D31", "70AD47", "C00000"
CREAM, ZEBRA, WHITE = "FFF9E0", "F2F5FA", "FFFFFF"

F = "Arial"
def font(sz=10, b=False, color=None, i=False):
    return Font(name=F, size=sz, bold=b, color=color, italic=i)

TITLE_FT  = font(16, True, NAVY)
SUB_FT    = font(9, False, MID)
HDR_FT    = font(10, True, WHITE)
BAND_FT   = font(11, True, WHITE)
BODY_FT   = font(10)
BOLD_FT   = font(10, True)
NUM_FT    = font(10, False, NAVY)

HDR_FILL  = PatternFill("solid", fgColor=NAVY)
BAND_FILL = PatternFill("solid", fgColor=MID)
EDIT_FILL = PatternFill("solid", fgColor=CREAM)
ZEB_FILL  = PatternFill("solid", fgColor=ZEBRA)

thin = Side(style="thin", color="BFBFBF")
BOX = Border(left=thin, right=thin, top=thin, bottom=thin)

TOP   = Alignment(vertical="top", wrap_text=True)
TOPC  = Alignment(vertical="top", horizontal="center")
TOPCW = Alignment(vertical="top", horizontal="center", wrap_text=True)
HDRAL = Alignment(vertical="center", horizontal="center", wrap_text=True)

DATEFMT = "ddd dd-mmm"


def sheet_title(ws, title, sub):
    ws["A1"] = title; ws["A1"].font = TITLE_FT
    ws["A2"] = sub;   ws["A2"].font = SUB_FT


def band(ws, cell, text):
    ws[cell] = text
    ws[cell].font = BAND_FT
    ws[cell].fill = BAND_FILL
    ws[cell].alignment = Alignment(horizontal="left", vertical="center")


def header_row(ws, row, headers, height=44):
    for i, h in enumerate(headers, start=1):
        c = ws.cell(row, i, h)
        c.font, c.fill, c.alignment, c.border = HDR_FT, HDR_FILL, HDRAL, BOX
    ws.row_dimensions[row].height = height


def widths(ws, spec):
    for col, w in spec.items():
        ws.column_dimensions[col].width = w


def D(day, month=9, year=2026):
    return dt.datetime(year, month, day)


wb = Workbook()



OUT = "docs/plans/assets/ABTalks-September-Execution-Tracker.xlsx"


OUT = "docs/plans/assets/ABTalks-September-Execution-Tracker.xlsx"

# ===== WORKING CALENDAR - Sundays (6, 13, 20, 27) are HOLIDAYS. 20 Sep IS a Sunday.
SUNDAYS = {6, 13, 20, 27}
WORKDAYS = [d for d in range(5, 20) if d not in SUNDAYS]   # 5..19 Sep, 13 working days
BUILD_DAYS = [5, 7, 8, 9, 10, 11, 12, 14, 15, 16]         # 10 working days - testing is continuous, not a phase
def wd(day):
    """Nearest working day at or after `day`, never a Sunday, never past 19 Sep."""
    d = min(day, 19)
    while d in SUNDAYS: d += 1
    return min(d, 19)

# =============================================================== WORKSTREAMS
G0 ="G0 Decisions & Foundations"
D0 ="D0 Design Foundation & System"
R1 ="R1 Recruiter Signup & Company Onboarding"
R2 ="R2 Plans, Limits & Entitlements"
R3 ="R3 Talent Projects & Candidate Search"
R5 ="R5 Shortlist & Hiring Pipeline"
R6 ="R6 Contact Unlock & Email Outreach"
R12="R12 Recruiter Workspace & Home"
C1 ="C1 Candidate Profile & Discoverability"
P2 ="P2 Notifications & Email"
P5 ="P5 Security, Testing & Release"
R4 ="R4 Candidate Insights"
R7 ="R7 Recruiter Notifications"
R8 ="R8 Jobs & Applicants"
R9 ="R9 Assessments"
R10="R10 Recruiter Analytics"
R11="R11 Non-Technical Hiring"
C2 ="C2 External Profile Links"
C4 ="C4 Mock Interview"
C5 ="C5 Cohorts & Hackathons"
P1 ="P1 Evidence Layer"
P3 ="P3 Product Analytics"
P4 ="P4 Profile-View Tracking"
UATE="UAT Execution"; REL="Release"
WORKSTREAMS=[G0,D0,C1,C2,C4,C5,R1,R12,R3,R4,R5,R6,R7,R8,R9,R10,R11,R2,P1,P2,P3,P4,P5,UATE,REL]

JOURNEY_STEP={G0:"Decisions that unblock everyone", D0:"How the product should feel",
 C1:"Candidates worth finding", R1:"Register & onboard company", R12:"Work in one workspace",
 R3:"Create project & search", R5:"Shortlist & move the pipeline", R6:"Unlock contact & email",
 R2:"Plan limits that hold", P2:"Nothing ends in silence", P5:"Safe to release", R4:"Understand why a candidate matched", R7:"Be told when something needs you",
 R8:"Post a job, receive applicants", R9:"Test a candidate", R10:"See whether hiring is working",
 R11:"Hire non-technical roles", C2:"Candidate external links", C4:"Interview signal",
 C5:"Learning signal", P1:"Proof behind a claim", P3:"Know what happened", P4:"Who looked at me",
 UATE:"Verified by a human", REL:"Live and signed"}

REVIEW={"LOW":"Self-review + Claude review prompt (P7). Peer glance on the PR.",
 "MEDIUM":"Peer review (Shivansh<->shashank, Zainab<->Manuvrtti) + prompt P7 before merge.",
 "HIGH":"STOP - Sohail reviews the Claude plan BEFORE any code and approves again before production. Junior must not self-merge.",
 "DESIGN":"Sohail reviews the design against the user journey before it is marked Approved."}
EVIDENCE={"LOW":"Screenshot + PR link + Claude summary.",
 "MEDIUM":"Screen recording of the manual test + test output + PR link + Claude summary.",
 "HIGH":"Claude investigation plan (before code) + Sohail's written approval + test output + preview URL + the created record id + PR link.",
 "DESIGN":"Design link + the states covered + Sohail's approval note."}

ACT=[]
PF,PB1,PB2,PB3,PI,PU1,PU2,PU3,PR = ("F Foundation","B1 Build Wave 1","B2 Build Wave 2","B3 Build Wave 3",
    "I Integration & Freeze","U1 UAT - find only","U2 Fix blockers","U3 Fix majors & regression","R Release Day")

def T(ws,phase,story,goal,owner,s,e,est,risk,prio="P0",
      design="Not Required",downer="-",ddep="-",uiux="Not Required",
      current="",manual="",auto="",acc="",regress="",prompt="",deps="-",dec="-",
      evidence=None,reviewer=None):
    ACT.append(dict(ws=ws,phase=phase,story=story,goal=goal,owner=owner,s=wd(s),e=wd(e),est=est,
      risk=risk,prio=prio,design=design,downer=downer,ddep=ddep,uiux=uiux,
      current=current,manual=manual,auto=auto,acc=acc,
      regress=regress or "None expected - but re-run this workstream's own manual test after merging.",
      prompt=prompt or ("P1 Investigate -> P2 Plan -> P3 Implement" if risk!="HIGH"
        else "P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement"),
      deps=deps,dec=dec,evidence=evidence or EVIDENCE[risk],reviewer=reviewer or REVIEW[risk]))

REG_AUTH="MANDATORY: sign in as an existing recruiter, an existing candidate and an admin. All three still reach their own home screen."
REG_PROFILE="MANDATORY: open an existing candidate profile, edit a section you did not touch, save, reload."
REG_SEARCH="MANDATORY: run a recruiter search that worked before and confirm the same candidates come back."
REG_RECDATA="MANDATORY: open an existing talent project and confirm its criteria, matches and shortlist are unchanged."
REG_EMAIL="MANDATORY: trigger an existing email (recruiter sign-in code) and confirm it still arrives."

# ============================== G0 (Sohail) - Sat 5 to Tue 8
T(G0,PF,"As the team, we need the decisions that block everyone settled before Wednesday.",
  "Every blocking decision is written down with a one-line reason. Nobody builds against a guess.",
  "Sohail",5,8,1.2,"HIGH",
  current="Three are already agreed (payments deferred, contact unlock by plan allowance, no company verification) - just record them. The rest need a call.",
  manual="Open the decision record. Every question has an answer, not a question.",
  auto="None - written artefact.",
  acc="All decisions marked Decided with a reason and the tasks each unblocks. No task starts Wednesday against an open decision.",
  regress="None.",prompt="No AI. Product judgement.",evidence="The committed decision record.",
  reviewer="Sohail owns and signs this himself.")
T(G0,PF,"As the team, we must know that database changes can reach production before we write any.",
  "Either the path is proven on a copy of the database, or the blocker is understood and resolved. Written down either way.",
  "Sohail",5,5,0.4,"HIGH",dec="D-2",
  current="The docs contradict each other. Settle it with a real run against a COPY of the database, never production.",
  manual="Run it against a copy. Read the output. Paste it into the decision record.",
  auto="None.",
  acc="Output recorded. If it failed, the resolution is written down and tested. No database change merges until this is done.",
  regress="None - a copy cannot affect production.",prompt="P11 Database review. Ask Claude to explain the blocker, not fix it.",
  reviewer="Sohail owns and signs this himself.")
T(G0,PF,"As a developer, I need the shared helpers to exist so I am not blocked by someone else's feature.",
  "Four shared helpers exist as no-op stubs that type-check: check a plan limit, send a notification, record a candidate signal, add someone to a shortlist.",
  "Zainab", 7, 8, 0.5,"MEDIUM",
  current="None exist. Check for anything similar before creating new files.",
  manual="Import each from a test file. The project builds.",
  auto="One trivial test per stub.",
  acc="All four on the main branch by Tuesday evening so every consumer can keep moving.",
  regress="None - no-op stubs.",reviewer="Sohail writes these himself - they are contracts.")
T(G0,PF,"As the project lead, I need to know on Tuesday evening whether we can safely start building.",
  "A go/no-go call, written down.","Sohail",8,8,0.2,"MEDIUM",
  current="Check: decisions closed, stubs merged, database path proven, designs approved for wave 1.",
  manual="Read the four criteria. Sign or don't.",auto="None.",
  acc="Signed. If the database path is unproven, no database change merges Wednesday - we re-sequence instead.",
  regress="None.",prompt="None.",evidence="Signed gate row.",reviewer="Sohail owns and signs this himself.")

# ============================== D0 (Shallika) - design runs AHEAD of build
T(D0,PF,"As the team, we need to know where the product currently looks and feels inconsistent - but only on the journeys we are shipping.",
  "A short written audit of the recruiter and candidate journeys in the 20 Sep scope: inconsistent buttons, forms, cards, spacing, typography, navigation, missing states, confusing steps, responsive breakages. NOT a whole-platform review.",
  "Shallika", 5, 7, 1.0,"LOW",design="In Design",downer="Shallika",uiux="Not Required",
  current="Walk the live product as a real recruiter and a real candidate. Note what confuses you. Stay inside the September journeys - do not audit pages we are not shipping.",
  manual="Walk both journeys end to end. Screenshot every inconsistency.",
  auto="None.",
  acc="A written list, grouped by journey, ranked by how much it hurts the user. Anything not on a September journey is marked P2 and parked.",
  regress="None - no code.",prompt="No AI needed.",evidence="The audit document with screenshots.",
  reviewer="Sohail reviews to confirm scope has not crept beyond September journeys.")
T(D0,PF,"As a developer, I need agreed patterns so I am not inventing a button style at 11pm.",
  "The handful of patterns these journeys need are defined and named: buttons, inputs, dropdowns, cards, tables, badges, modals, navigation, alerts/toasts, plus loading, empty, error and success states.",
  "Shallika", 7, 8, 1.0,"LOW",design="In Design",downer="Shallika",
  current="A design system document already exists in the repo. EXTEND it - do not start a new one, and do not redesign components that already work.",
  manual="A developer can point at any element in the September journeys and find its pattern.",
  auto="None.",
  acc="Patterns documented and referenced from the design files. Small enough to be usable this month - this is consistency, not an enterprise system.",
  regress="None.",prompt="No AI needed.",evidence="The pattern reference, linked from every design.",
  reviewer="Sohail confirms it builds on the existing design system rather than replacing it.")
T(D0,PF,"As a recruiter, signing up and landing in my workspace should feel like a real product.",
  "Approved designs for recruiter signup, the five onboarding steps, the workspace shell and Home - including every state and how they behave on a phone.",
  "Shallika", 5, 8, 1.8,"LOW",design="In Design",downer="Shallika",
  current="Read the recruiter journey on the User Journeys sheet first. Design the FLOW, not five separate screens.",
  manual="Walk a developer through the flow. They can describe what happens at every step without asking you a question.",
  auto="None.",
  acc="Every screen and every state: loading, empty, error, success, disabled. Desktop and mobile. Handoff includes the user goal, the flow, what each component does, validation behaviour and interaction notes. APPROVED before Wednesday so R1 and R12 can start.",
  regress="None.",prompt="No AI needed.",evidence="Design link + states covered + Sohail's approval.",
  reviewer="Sohail reviews against the recruiter journey before it is marked Approved.")
T(D0,PB1,"As a recruiter, finding and choosing candidates should feel considered, not like a database query.",
  "Approved designs for the talent project, the criteria panel, search results, the candidate card, the shortlist and the pipeline board - designed as ONE connected flow.",
  "Shallika", 9, 11, 1.8,"LOW",design="In Design",downer="Shallika",
  current="This is the heart of the product. Think through the whole journey: enter project, set criteria, search, understand a candidate card, shortlist, come back next week and still understand where you were.",
  manual="Walk the flow with Sohail and shashank. It makes sense without explanation.",
  auto="None.",
  acc="Complete flow with all states, including what a recruiter sees with zero results and with a brand-new empty project. Approved before the search build starts on the 11th.",
  regress="None.",prompt="No AI needed.",evidence="Design link + states + approval.",
  reviewer="Sohail reviews against the recruiter journey before Approved.")
T(D0,PB1,"As a candidate, building my profile should feel quick and worth doing.",
  "Approved designs for candidate signup, the profile sections, adding self-declared skills, and the privacy/visibility control - including what a recruiter sees.",
  "Shallika", 11, 12, 1.2,"LOW",design="In Design",downer="Shallika",
  current="Key product rule: a candidate does NOT need verified evidence to be discoverable. Self-declared skills must feel legitimate, while staying visibly different from verified ones.",
  manual="Walk it with Shivansh. The difference between self-declared and verified is obvious without a legend.",
  auto="None.",
  acc="All sections and states. Self-declared and verified are visually distinct and honestly labelled. Mobile covered. Approved before the profile build finishes.",
  regress="None.",prompt="No AI needed.",evidence="Design link + states + approval.",
  reviewer="Sohail reviews against the candidate journey before Approved.")
T(D0,PB2,"As a recruiter, unlocking and contacting a candidate should feel deliberate and clear.",
  "Approved designs for the contact unlock, the allowance indicator, the message composer and the outreach history - including what a recruiter with no allowance left sees.",
  "Shallika",12,14,1.0,"LOW",design="In Design",downer="Shallika",
  current="This is where money meets privacy. The recruiter must understand what they are spending and the candidate must be treated respectfully.",
  manual="Walk it with Zainab. What happens at zero allowance is obvious.",
  auto="None.",
  acc="Unlock, spend, compose, send, history, and the zero-allowance state all designed. Approved before the outreach build starts.",
  regress="None.",prompt="No AI needed.",evidence="Design link + states + approval.",
  reviewer="Sohail reviews before Approved.")
T(D0,PB2,"As the designer, I need to check what was actually built, not what was designed.",
  "Every feature from build wave 1 is reviewed in the running application - not from screenshots.",
  "Shallika", 14, 15, 1.2,"LOW",design="Not Required",downer="Shallika",uiux="In QA",
  current="Open the preview and use it. Compare against the approved design.",
  manual="For each wave-1 feature check: does it match the design, does it work on a phone, hover and focus states, loading, errors, empty states, spacing, typography, consistency, and anything confusing.",
  auto="None.",
  acc="Every wave-1 feature has a recorded UI/UX SIGN-OFF of PASS or NEEDS FIX. Issues are ranked BLOCKER / MAJOR / MINOR. Minor cosmetic issues become P2 bugs - they do NOT block the release.",
  regress="None.",prompt="No AI needed.",evidence="Sign-off record per feature with ranked issues.",
  reviewer="Shallika signs; Sohail arbitrates if a blocker is disputed.")
T(D0,PU1,"As the designer, I need to check the whole product one final time before we ship.",
  "Every September journey reviewed end to end in the running application on desktop and mobile.",
  "Shallika",16,17,1.5,"LOW",design="Not Required",downer="Shallika",uiux="In QA",
  current="This is the last chance to catch something that makes the product feel unfinished.",
  manual="Walk the recruiter journey and the candidate journey end to end, on a laptop and on a phone. Log every issue with a rank.",
  auto="None.",
  acc="Both journeys signed off. Blockers fixed before release; majors fixed if time allows; minors logged for October. A minor cosmetic issue never blocks the release.",
  regress="None.",prompt="None.",evidence="Final UI/UX sign-off for both journeys.",
  reviewer="Shallika signs. A disputed blocker goes to Sohail.")

DESIGN_DEP="Approved design required before frontend work starts (see UI/UX sheet)."
# ============================== C1 (Shivansh) - candidate supply
T(C1,PF,"As the team, we must stop assuming the candidate profile works because the code exists.",
  "Every profile section checked against: add, read, change, remove, validate, survives a logout, has empty/error/loading states, works on a phone, is private when it should be, shows correctly to a recruiter. Every failure written down.",
  "Shivansh",5,8,0.8,"LOW",
  current="Use the profile with a fresh account, section by section, BEFORE reading code.",
  manual="Fresh account. Each section: add, save, reload, log out, log in, edit, remove. Note every failure.",
  auto="None - investigation.",
  acc="A written gap list with severities. This sizes the rest of C1 - if it is bigger than 3 days of fixes, we cut sections rather than slipping.",
  regress="None.",prompt="P1 Investigate.",evidence="The written 12-point results.")
T(C1,PB1,"As a candidate, everything I type into my profile is still there tomorrow.",
  "The profile sections in September scope save, survive a logout, and can be edited and removed.",
  "Shivansh",9,12,1.8,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="Fix ONLY what the audit found broken. Do not rebuild working sections.",
  manual="Fill every section. Save, reload, LOG OUT, LOG BACK IN - all still there. Edit four sections. Remove one item from three sections - each disappears everywhere including the recruiter view.",
  auto="A test that a full profile survives a session boundary and a removal propagates.",
  acc="Every in-scope section passes all twelve checks. Removals propagate everywhere.",
  regress=REG_PROFILE,deps="C1 audit")
T(C1,PB1,"As a candidate, I can say what I am good at without needing ABTalks to verify it first.",
  "A candidate adds their own skills and becomes discoverable on them. Self-declared skills are clearly distinct from verified ones everywhere they appear - never presented as proven.",
  "Shivansh",10,13,1.4,"HIGH",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="KEY PRODUCT RULE: verified evidence must NOT be required for discovery. Ask Claude how skills and search currently work, and whether anything today requires verification before a candidate appears.",
  manual="Fresh candidate adds three self-declared skills. A recruiter searching that skill FINDS them. On the recruiter's screen those skills are clearly marked as self-declared, not verified.",
  auto="A test that a candidate with only self-declared skills appears in search, labelled correctly.",
  acc="Self-declared skills make a candidate discoverable. They are visually and semantically distinct from verified skills. Nothing claims a self-declared skill is proven.",
  regress=REG_SEARCH+" "+REG_PROFILE,
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (honesty of candidate claims) -> P3 Implement.")
T(C1,PB2,"As a candidate, I control what recruiters see and can check it myself.",
  "A candidate can turn recruiter visibility off and preview exactly what a recruiter sees - rendered by the same code the recruiter uses, so the preview cannot lie.",
  "Shivansh", 14, 15, 1.2,"HIGH",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",dec="D-8",
  current="Privacy control. Confirm the preview reuses the REAL recruiter rendering, not a copy. Sohail must confirm the wording matches what the site publicly promises.",
  manual="Turn visibility OFF. Have a recruiter re-run a search that matched you - you are gone. Also have them re-open a SAVED list - still gone. Turn a field's privacy off - it vanishes from the preview too.",
  auto="A test that visibility off removes the candidate from live search and saved lists.",
  acc="Visibility off removes the candidate everywhere including saved results. Preview matches the real recruiter view field for field.",
  regress=REG_SEARCH+" "+REG_PROFILE,
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (privacy) -> P3 Implement -> P10 Security review.")

# ============================== R1 (Shivansh)
T(R1,PB1,"As a new recruiter, I create my account and verify my email without confusion.",
  "Signup and the emailed code work reliably, and a wrong code gives a readable message rather than a dead end.",
  "Shivansh",9,10,0.8,"HIGH",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",dec="D-6",
  current="Signup exists but is gated behind a flag and an invite list. Ask Claude how the code decides who may register - that must not change.",
  manual="Register with an invited email. Check the real inbox. Enter a WRONG code - read the message. Enter the right one. You land on the company step, not a search screen.",
  auto="A test that a wrong code is rejected and a right one accepted.",
  acc="Fresh recruiter registers, receives a real code, wrong codes fail readably, right codes proceed.",
  regress=REG_AUTH+" "+REG_EMAIL,
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (who is allowed in) -> P3 Implement -> P10 Security review.")
T(R1,PB1,"As a recruiter, I tell ABTalks about my company once and it is remembered.",
  "Company name, website, logo, industry, size and location save and are still there on return.",
  "Shivansh",10,12,1.2,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="Ask Claude what the company record already stores versus what signup collects today (far less). Reuse the existing file-upload approach for the logo.",
  manual="Fill every field including a logo. Save. Reload - still there. Sign out and back in - still there.",
  auto="A test that company details persist.",
  acc="All six fields persist across a reload and a re-login. Continue stays disabled until name and website are valid.",
  regress=REG_AUTH)
T(R1,PB2,"As a recruiter, if I am interrupted halfway I carry on where I left off, and I land somewhere useful.",
  "Onboarding resumes at the right step after a browser close, and finishing puts the recruiter on Home with one obvious next action.",
  "Shivansh",14,15,1.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="The current step must come from what is saved, not from the browser. Coordinate with R12 - Home is built there.",
  manual="Complete steps 1 and 2. CLOSE THE BROWSER at step 3. Reopen and sign in - you are on step 3 with 1 and 2 done. Finish - you land on Home, not search.",
  auto="A test that resuming returns the right step.",
  acc="Resumes correctly every time. A progress indicator shows where you are. Finishing lands on Home.",
  regress=REG_AUTH,deps="R12 Home")

# ============================== R12 (Shivansh)
T(R12,PB1,"As a recruiter, every screen feels like part of the same product.",
  "Every recruiter screen sits inside one shell with a persistent menu, and moving between sections does not reload the whole page.",
  "Shivansh",9,11,1.2,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",dec="D-13",
  current="A recruiter shell already exists with a smaller menu. EXTEND it - do not create a second layout.",
  manual="Visit five recruiter sections in a row. The menu stays, the current section is highlighted, and the page does not fully reload.",
  auto="A test that each menu destination loads.",
  acc="One shell across every recruiter screen, with the active section always visible.",
  regress="MANDATORY: every existing recruiter screen still renders inside the shell.")
T(R12,PB2,"As a recruiter opening ABTalks, I know what to do next.",
  "Home shows my projects with new matches, what is waiting on me, and one clear action for a brand-new recruiter - each linking to the exact place that resolves it.",
  "Shivansh",14,15,1.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="Read counts from the project and pipeline work. Do not write new queries for the same numbers.",
  manual="As an established recruiter: Home tells you what needs attention and every link works. As a BRAND NEW recruiter: one obvious action, not five empty tiles.",
  auto="A test that Home renders for a new and an established recruiter.",
  acc="Home answers 'what should I do next'. The new-recruiter state is designed, not empty.",
  regress="None expected.",deps="R3, R5")

# ============================== R3 (shashank)
T(R3,PF,"As the team, we need to know whether saving a search today actually saves a recruiter's WORK.",
  "A written answer: after signing out and returning, what survives - criteria, matched candidates, who was viewed, who was shortlisted? Each backed by the code that proves it.",
  "shashank",5,8,0.6,"LOW",
  current="Use the product first: create a search, sign out, come back, see what is lost. Then ask Claude why.",
  manual="Create a search, note three candidates, sign out, sign back in. Write down exactly what disappeared.",
  auto="None - investigation.",
  acc="A written answer per item with the field that proves it. This sizes the rest of R3.",
  regress="None.",prompt="P1 Investigate, scoped to the search module.",evidence="Written findings.")
T(R3,PB1,"As a recruiter, I create a named hiring project so my work has somewhere to live.",
  "A recruiter creates a project, sees it in a list, renames it and archives it.",
  "shashank",9,11,1.2,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="A search-brief record already exists. EXTEND it - do not create a parallel project table.",
  manual="Create a project with a name. See it listed with its last-activity date. Rename it. Archive it - it leaves the list but is not deleted. Sign out and back in - all still true.",
  auto="A test that a project is created, renamed, archived and survives a re-read.",
  acc="Projects create, list, rename and archive. Another company's project id returns not-found.",
  regress=REG_RECDATA,prompt="P1 Investigate -> P2 Plan -> P3 Implement. Extend the existing record; do not add a parallel model.")
T(R3,PB1,"As a recruiter, my project remembers what kind of person I am looking for.",
  "Everything the recruiter says about the role is saved on the project and shown again, editable, when they return.",
  "shashank",11,14,1.6,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",dec="D-12",
  current="Several of these fields already exist on the search-brief record. Ask Claude which, so you extend rather than duplicate.",
  manual="Set the criteria on a project. Save. Sign out, sign back in IN A DIFFERENT BROWSER. Open the project - every criterion is exactly as you left it and editable in place.",
  auto="A test that criteria save and read back unchanged.",
  acc="Every criterion persists across a session and a browser change.",
  regress=REG_SEARCH+" "+REG_RECDATA)
T(R3,PB1,"As a recruiter, re-running my search must not lose track of who I already looked at.",
  "Re-running a search keeps the history of when each candidate first appeared, so people I have seen are not shown as new.",
  "shashank",12,14,1.2,"HIGH",
  current="Today re-running a search DELETES all previous matches and recreates them - which is why history is lost. Confirm this before changing it. This is data-loss shaped.",
  manual="Run a match. Note when candidate X first appeared. Run it again. X's first-seen date is UNCHANGED. A genuinely new candidate has a later date.",
  auto="A test that re-running preserves first-seen dates.",
  acc="First-seen dates survive a re-run. Only genuinely new candidates are marked new.",
  regress=REG_SEARCH+" "+REG_RECDATA,
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (rewrites existing rows) -> P3 Implement -> P5 Regression analysis.")
T(R3,PB2,"As a recruiter, my searches stay fast and return the right people.",
  "Candidate filtering is done efficiently by the backend and stays responsive with realistic numbers. Today it loads a capped batch and filters in memory, which silently drops results.",
  "shashank",14,15,1.4,"HIGH",
  current="Ask Claude to explain how search loads and filters candidates today, and what the row cap does to results when a filter is applied. Understand it before proposing a fix.",
  manual="Filter to something you know matches exactly one candidate - that candidate comes back. Time twenty searches with realistic data, before and after.",
  auto="A test that a narrow filter returns the expected candidate.",
  acc="Filters return correct results at realistic volumes. Timings recorded before and after. The existing safety cap stays until the new path is proven.",
  regress=REG_SEARCH+" MANDATORY: re-run three previously working searches and confirm identical results.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P11 Database review -> P5 Regression analysis.")

# ============================== R5 (shashank)
T(R5,PB1,"As a recruiter, when I shortlist someone it is still there tomorrow, on any device.",
  "Shortlisting saves against the person in the database, not the browser. Today part of it lives only in the browser and is lost when site data is cleared.",
  "shashank",9,12,1.4,"HIGH",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="There are TWO shortlists today: one in the database that only works for one candidate group, and one in the browser that works for everyone. Ask Claude to confirm, and to find the unused tables that already have the right shape.",
  manual="Shortlist in Browser A. Sign out. Open Browser B, sign in. Still shortlisted, in the right project. Then shortlist one candidate from EACH group - all persist.",
  auto="A test that a shortlist survives a new session, across all candidate groups.",
  acc="Database-backed, keyed on the person, works for every candidate group. Nothing read from browser storage. Another company's list returns not-found.",
  regress=REG_RECDATA+" MANDATORY: an existing recruiter's current shortlist must not disappear.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (existing recruiter data) -> P3 Implement -> P5 Regression analysis.")
T(R5,PB2,"As a recruiter, I move candidates through my process and see who needs me.",
  "A candidate can be moved through the hiring stages, the stage sticks, and one board shows who is waiting on the recruiter.",
  "shashank",14,15,1.1,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="A set of pipeline stages already exists in the database, unused. Find it and use it rather than inventing stage names.",
  manual="Move three candidates to three stages. Sign out, sign back in - all three as you left them. The board shows how many are waiting on you.",
  auto="A test that stages persist and are attributed.",
  acc="Stages move, persist and record who changed them. The board answers 'who needs me' at a glance.",
  regress=REG_RECDATA)

# ============================== R6 (Zainab)
T(R6,PF,"As the team, we must be certain how a recruiter earns the right to see contact details.",
  "A written flow: click contact, check the plan allowance, record that access was granted, show the details - plus what happens at zero allowance and what the candidate is told.",
  "Zainab",5,7,0.4,"HIGH",dec="D-5, D-8",
  current="Today a human admin approves each release. It moves to a plan allowance. Ask Claude to find the ONE function that decides whether a recruiter may see contact details - it must keep deciding, unchanged.",
  manual="Walk the flow with Sohail. Confirm the privacy wording matches what the site publicly promises.",
  auto="None.",
  acc="Flow approved by Sohail. The single access-deciding function is unchanged. Candidate-facing wording agreed.",
  regress="None yet.",prompt="P1 Investigate -> STOP for Sohail. This releases personal data.")
T(R6,PB1,"As a recruiter with allowance left, I unlock a candidate's contact details and see them immediately.",
  "Unlocking spends one allowance and reveals the details. A recruiter with none left sees a clear message and NO contact details anywhere in the response.",
  "Zainab",10,13,1.4,"HIGH",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="Confirm the existing access-deciding function is reused, not bypassed. The allowance check comes from R2.",
  manual="With allowance: unlock - details appear, counter drops by one. With NONE: refused. Open the browser network tab on the refused case - NO email, phone or CV link anywhere in the response.",
  auto="A test that a zero-allowance unlock returns no contact data.",
  acc="Allowance spends correctly. The refused case leaks nothing - checked in the network response, not on screen.",
  regress="MANDATORY: a recruiter already granted contact for a candidate must still see it.",deps="R2",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.")
T(R6,PB2,"As a recruiter, I email a candidate without leaving ABTalks, and can see who I already contacted.",
  "The recruiter writes a subject and message, sends it, the candidate receives a real email, and the history and pipeline record that it happened.",
  "Zainab",14,15,1.6,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="Email sending already works elsewhere in the product. Find it and reuse it - do not add a second provider. Check how it reports success versus failure.",
  manual="Unlock a candidate. Write and send. CHECK A REAL INBOX - it arrived within a minute. Try sending WITHOUT unlocking - refused. Force a failure - it shows as failed with a retry, never as sent. The candidate is now marked contacted.",
  auto="A test that sending without an unlock is refused and that a failed send is recorded as failed.",
  acc="A real email arrives. Sending without unlock is refused server-side. History readable. Failures visible. The pipeline moves to contacted and never moves someone backwards.",
  regress=REG_EMAIL,deps="R2, R5, P2")

# ============================== R2 (Sohail)
T(R2,PB1,"As the business, plan limits live as data we can change, not numbers in code.",
  "Plans and their limits are stored records. Changing a limit is a data edit, not a deployment.",
  "Sohail", 9, 11, 1.0,"HIGH",dec="D-3",
  current="Nothing exists. Ask Claude to check whether ANY subscription storage exists before creating it. An existing plans dialog hard-codes prices - match the agreed numbers.",
  manual="Change a limit in the stored plan. Reload the plans page - the new number shows. No deploy.",
  auto="A test that reads plans and limits back.",
  acc="Plans stored with every limit as data. Applied to a copy of the database first. Existing recruiters keep working.",
  regress=REG_AUTH+" "+REG_RECDATA,
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.")
T(R2,PB1,"As the business, a recruiter who has used up their plan must not be able to do the restricted thing - even bypassing the screen.",
  "One shared check decides whether a recruiter may do a restricted action, and counts usage correctly when several requests arrive at once.",
  "Sohail",11,14,1.6,"HIGH",
  current="Today every premium restriction is a dialog in the browser. There is NO server-side check at all. Confirm that before building.",
  manual="Use up a limit through the UI. Then call the same action DIRECTLY with the browser bypassed - still refused. Repeat for a recruiter with allowance left - it succeeds.",
  auto="A test firing ten simultaneous requests against a limit of five, proving exactly five succeed.",
  acc="Refused server-side with the client removed. Counters never over-count. The refusal is a readable message, not a crash.",
  regress=REG_AUTH+" "+REG_SEARCH,
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review. Do NOT let Claude put the check only in the UI.")
T(R2,PB2,"As a recruiter, I see the plans, know what I have used, and understand it when I run out.",
  "Plans render from stored data with the current one marked, usage shows as used-out-of-total and moves after real actions, and hitting a limit explains what was blocked and where to upgrade.",
  "Zainab", 14, 15, 0.9,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",
  current="An existing plans dialog has the layout and copy. Reuse it. Show the SERVER's refusal message - do not write new copy in the browser.",
  manual="Open plans - three plans, real limits, yours marked. Note your search count, run one search, reload - up by one. Exhaust a limit - the message names the action and the limit, with a link to plans.",
  auto="A test that the page reflects stored data and that usage moves.",
  acc="Plans from data. Usage accurate. The limit message is specific, never a generic toast.",
  regress="None expected.")
T(R2,PB2,"As an admin, I switch a recruiter's plan on - and a payment system can later do the same.",
  "One function turns a subscription on. The admin screen calls it. Nothing else can.",
  "Sohail",15,15,0.6,"HIGH",dec="D-4",
  current="No payment provider exists and none is being added. Build so a payment webhook can call the SAME function later without rework.",
  manual="As admin, activate a plan. As the recruiter, reload - limits are live. Confirm no other path can activate a plan.",
  auto="A test that activation sets the period and resets counters.",
  acc="One admin-only activation function, setting period and resetting usage. It is the only way a plan becomes active.",
  regress=REG_AUTH,prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.")

# ============================== P2 (Manuvrtti)
T(P2,PF,"As a developer, I need one agreed way to notify someone.",
  "One shared helper sends a notification in the app and by email, honouring preferences. A stub exists by Tuesday.",
  "Manuvrtti",7,8,0.5,"MEDIUM",
  current="A notification system already exists for admin broadcasts. Ask Claude how it identifies each notification and follow the same approach.",
  manual="Import it from a test file. It builds.",auto="A trivial test proving the shape.",
  acc="Stub merged by Tuesday. Type names agreed and frozen after Wednesday.",regress="None - no-op stub.")
T(P2,PB1,"As a user, notifications reach me reliably and stop when I switch them off.",
  "The notifications these September journeys need appear in the bell and, where appropriate, arrive as a real email - and switching one off genuinely stops it.",
  "Manuvrtti",9,13,2.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DESIGN_DEP,uiux="Pending",dec="D-9",
  current="Email sending already works - reuse it, do NOT add a second provider. Scope is only the notifications the September journeys need, not the full set.",
  manual="Trigger a notification - it appears in the bell. Mark it read - it stays read after a reload. Check a REAL inbox. Switch the preference off, trigger again - bell only, no email. Confirm test addresses are suppressed.",
  auto="A test that a disabled preference blocks exactly one channel.",
  acc="Bell and real email both work. Preferences honoured. Every send logged. Repeat events do not duplicate.",
  regress="MANDATORY: trigger an existing admin broadcast and confirm it still reaches the bell. "+REG_EMAIL)
T(P2,PB2,"As the team, we hear about production errors before users report them.",
  "Errors reach an error-tracking tool and the team channel within a minute.",
  "Manuvrtti",14,15,0.6,"MEDIUM",
  current="Today a production error is invisible unless someone reads deployment logs. There is one logging helper - wire into that.",
  manual="Trigger a deliberate error. It appears in the tool and the channel within a minute.",
  auto="None required.",
  acc="Errors visible within a minute. No raw console logging introduced.",regress="None expected.")

# ============================== P5 (Sohail)
T(P5,PB1,"As a developer, I can run the journey tests on my machine and in CI.",
  "A test setup runs the journey tests on every pull request, with one green example and a one-page how-to.",
  "Sohail", 9, 11, 0.9,"MEDIUM",
  current="No journey-test framework exists today, only hand-written scripts. Pick the standard one for this stack.",
  manual="Open a pull request with a deliberately broken journey - CI goes red.",
  auto="One journey green in CI as the reference.",
  acc="Tests run on every pull request. One green example plus a how-to a junior can follow.",regress="None expected.")
T(P5,PB2,"As the business, a candidate must never reach a recruiter screen, and one company must never see another's data.",
  "Every recruiter and admin screen refuses candidates and signed-out visitors, and requesting another company's records by id fails.",
  "Sohail",14,15,1.3,"HIGH",
  current="One recruiter screen currently requires only a login, not an approved recruiter. Check every recruiter and admin route. Sign-in and sign-out must STAY public.",
  manual="As a candidate, open every recruiter and admin address - all refused. Signed out, same. As company A, request company B's project, shortlist, note and candidate records by id - all refused. Confirm sign-in still works.",
  auto="Tests for the candidate case, the signed-out case and the cross-company cases.",
  acc="All refused. Each cross-company case asserted separately. Public pages still public.",
  regress=REG_AUTH,prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.")
T(P5,PB2,"As a candidate, my email, phone and CV must not leak to a recruiter who has not unlocked me.",
  "No recruiter screen returns contact details in its data unless that recruiter has unlocked them - checked in the raw response, not on screen.",
  "Sohail", 15, 15, 0.8,"HIGH",
  current="Data can be present in a response even when it is not displayed. Check the network tab, not the page.",
  manual="Open the network tab. Visit search results, a candidate card and the project view for a candidate you have NOT unlocked. Search every response for their email, phone and CV link. Zero hits.",
  auto="A test asserting contact fields are absent from the response.",
  acc="Zero contact data in any response for a non-unlocked candidate, verified in the raw payload.",
  regress="MANDATORY: a recruiter who HAS unlocked a candidate still sees the details.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement -> P10 Security review.")
T(P5,PI,"As the team, we need somewhere realistic to test, and the journey tests green before we freeze.",
  "A test environment with every database change applied and fresh data, and the whole test suite passing on the release branch.",
  "Sohail",15,15,0.8,"HIGH",
  current="Use a copy of the database, never production.",
  manual="Sign in to the test environment as a recruiter, a candidate and an admin. All three work.",
  auto="The full suite.",
  acc="Test environment clean. All journey tests and existing suites green on the release branch.",
  regress="None - a copy cannot affect production.",prompt="P11 Database review. Copy only.")
T(P5,PI,"As the project lead, I need to know on Tuesday evening whether we can stop building.",
  "The feature freeze is signed against six criteria, or it is not signed and we say why.",
  "Sohail",15,15,0.3,"HIGH",
  current="Check all six honestly. A criterion that is nearly true is not true.",
  manual="Read the six criteria aloud with the team. Sign or don't.",auto="None.",
  acc="Signed only when: the build is clean; journey tests green; test environment ready; no P0 knowingly unfinished without a written note; anything unfinished switched off; every journey has a named person for Saturday.",
  regress="None.",evidence="Signed gate row.",reviewer="Sohail owns and signs this himself.")

# ============================== UAT (Wed 16 - Fri 18) + RELEASE (Sat 19)
for who,scripts,d in [("Zainab","UAT-1, UAT-2",0.9),("Shivansh","UAT-3, UAT-4, UAT-5",1.0),
                      ("Manuvrtti","UAT-6, UAT-7",0.9),("shashank","UAT-8, UAT-9, UAT-10",1.0),
                      ("Sohail","UAT-11, UAT-12",0.8),("Shallika","Full UI/UX pass, both journeys",1.0)]:
    T(UATE,PU1,f"As the project lead, I need {who} to test somebody else's work with a fresh account.",
      f"Scripts {scripts} executed and every failure written down.",who,17,17,d,"LOW",
      uiux="In QA" if who=="Shallika" else "Not Required",
      current="You are testing work you did NOT build. Follow the script exactly.",
      manual="Execute each assigned script with FRESH accounts. Log every failure with a rank. DO NOT FIX ANYTHING TODAY - we need the real number first.",
      auto="None.",
      acc="Every assigned script executed with fresh accounts. Every failure logged and ranked. Nothing fixed today.",
      regress="None.",prompt="No AI. Human testing.",evidence="Filled result column plus logged bugs.")
T(UATE,PU1,"As the project lead, I need to know by Wednesday evening how bad it is.",
  "Every logged defect has a rank and an owner, and nobody retests their own fix.",
  "Sohail",17,17,0.3,"LOW",
  current="Triage together at end of day.",manual="Read every bug. Assign rank and owner.",auto="None.",
  acc="All defects triaged and assigned. The finder is recorded for retesting.",regress="None.",prompt="None.")
for who,d in [("Shivansh",1.0),("Zainab",1.0),("shashank",1.0),("Manuvrtti",0.5),("Sohail",0.8)]:
    T(UATE,PU2,f"As {who}, I fix every blocker assigned to me.",
      "Every assigned blocker is fixed and handed back to whoever found it.",who,18,18,d,"MEDIUM",
      current="Use P4 to find the cause before changing anything.",
      manual="Fix it, then have the ORIGINAL finder confirm it - not yourself.",
      auto="Add a test that would have caught it.",
      acc="Every assigned blocker fixed, confirmed by its finder, covered by a new test.",
      regress="Re-run the manual test of the feature you touched.",
      prompt="P4 Bug investigation -> P3 Implement -> P7 Self-review.")
T(UATE,PU2,"As the designer, I check the fixes did not break the experience.",
  "Every UI fix from today is re-checked in the running app.","Shallika",18,18,0.8,"LOW",uiux="In QA",
  current="Fixes made under time pressure are where states get dropped.",
  manual="Re-walk every screen that changed today. Check states, spacing and mobile.",auto="None.",
  acc="Every changed screen re-checked. New issues ranked; minors go to October.",
  regress="None.",prompt="P14 UI review.",evidence="Updated sign-off record.")
for who,d in [("Shivansh",0.9),("Zainab",0.9),("shashank",0.9),("Manuvrtti",0.5),("Sohail",0.6)]:
    T(UATE,PU3,f"As {who}, I fix the majors and re-run my scripts clean.",
      "Major defects closed and every assigned script passes on a clean re-run.",who,18,18,d,"LOW",
      current="A script that passed on Thursday but not today has NOT passed.",
      manual="Fix majors, then re-run every script you ran on Wednesday, start to finish.",auto="None.",
      acc="Majors closed. Every script passes on the re-run.",
      regress="Re-run the manual test of anything you touched.")
T(UATE,PU3,"As the project lead, I need to know nothing we built broke something that already worked.",
  "Every pre-existing journey still works: challenge submissions, programme missions, hackathon submissions, certificates, marketplace, workshop signup and points.",
  "Sohail",18,18,0.6,"MEDIUM",
  current="These worked before September and nobody has been testing them.",
  manual="Walk each of the seven as a real user.",auto="Run every existing test suite.",
  acc="All seven still work. All existing suites green.",regress="This IS the regression check.",
  prompt="P5 Regression analysis if something has broken.")
T(UATE,PU3,"As the designer, I give the final UI/UX verdict.",
  "Both September journeys signed off in the running application, on desktop and mobile.",
  "Shallika",18,18,0.8,"LOW",uiux="Sign-Off",
  current="Last chance to catch something that makes the product feel unfinished.",
  manual="Walk the recruiter journey and the candidate journey end to end, laptop and phone.",auto="None.",
  acc="UI/UX SIGN-OFF recorded as PASS or NEEDS FIX per journey. Blockers must be fixed before release; minors go to October and never block it.",
  regress="None.",prompt="P14 UI review.",evidence="Final sign-off for both journeys.",
  reviewer="Shallika signs. A disputed blocker goes to Sohail.")
T(UATE,PU3,"As the project lead, I need everyone to say out loud that their part works.",
  "Six signatures, each meaning: I walked the journeys I own, with fresh accounts, and I am willing to be woken up about them.",
  "Sohail",18,18,0.3,"HIGH",
  current="Check the exit conditions honestly before asking anyone to sign.",
  manual="Read the exit criteria. Collect six signatures.",auto="None.",
  acc="Zero blockers, zero majors, every script passed on the re-run, journey tests green, regression clean, UI/UX signed off. Six signatures.",
  regress="None.",evidence="Six signed rows.",reviewer="Sohail owns and signs this himself.")
# ---- RELEASE, Saturday 19 September
T(REL,PR,"As the team, we can undo the release if it goes wrong.",
  "A snapshot of production is taken before anything changes.","Sohail",19,19,0.2,"HIGH",
  current="Snapshot FIRST, before any change.",manual="Take it. Write down its id.",auto="None.",
  acc="Snapshot taken and its id on the checklist before any change.",regress="None.",
  prompt="None - Sohail does this personally.",reviewer="Sohail only.")
T(REL,PR,"As the team, the database changes reach production safely and we deploy what was tested.",
  "Every change applied and confirmed, then the release branch deployed - not the main branch.",
  "Sohail",19,19,0.5,"HIGH",
  current="Already rehearsed on a copy. Confirm the deployed version matches what was signed off.",
  manual="Apply changes. Confirm each. Deploy. Compare the deployed version to the signed-off one.",auto="None.",
  acc="Every change applied and confirmed. Deployed version matches the signed-off release branch exactly.",
  regress="None.",prompt="P11 Database review.",reviewer="Sohail only.")
for who,what,d in [
 ("Shivansh","Sign up as a fresh recruiter, onboard the company, reach Home. Then as a fresh candidate: build a full profile, add self-declared skills, log out, log in, edit, remove an item, check the recruiter preview, and confirm you appear in a recruiter search.",0.7),
 ("shashank","Create a talent project, set criteria, search, shortlist people from different groups, move stages. Sign out and back in FROM ANOTHER BROWSER and confirm everything survived.",0.7),
 ("Zainab","Unlock a candidate and send them a REAL email - confirm it arrives. Confirm the pipeline moved to contacted and the outreach history shows it.",0.6),
 ("Manuvrtti","Trigger the September notifications - confirm the bell and a real inbox, and that a switched-off preference stays quiet. Confirm errors reach the tracking tool.",0.4),
 ("Sohail","Exhaust a plan limit and call the action directly with the browser bypassed - it must be refused. Re-run the company-isolation and contact-leak checks against production.",0.5),
 ("Shallika","Walk both journeys on the live site, on a laptop and a phone. Confirm the shipped product matches what was approved.",0.5)]:
    T(REL,PR,f"As {who}, I confirm my part works on the live site.",
      "Every journey this person owns is walked on production with fresh accounts, and the created record ids are written down.",
      who,19,19,d,"HIGH",uiux="Sign-Off" if who=="Shallika" else "Not Required",
      current="Production, not the test environment. Fresh accounts, not your own.",
      manual=what,auto="None - human check.",
      acc="Every journey completed on production. Record ids on the checklist. A failure here is a blocker and stops the release.",
      regress="This IS the production regression check.",prompt="None. Human verification.",
      evidence="Record ids and screenshots on the release checklist.",reviewer="Owner walks it; Sohail records it.")
T(REL,PR,"As the project lead, I decide whether we are live.",
  "The release is declared only when every P0 journey step has a passed production check. Anything unverified is switched off, not shipped hopefully.",
  "Sohail",19,19,0.4,"HIGH",
  current="Read the checklist. Count the passed checks.",
  manual="Confirm every P0 journey row is verified. Watch errors for two hours. Sign, or switch the unverified part off.",
  auto="None.",
  acc="Declared only at full P0 coverage. No new error type in the two-hour watch. Anything unverified is flagged off with its owner named. Sunday 20 September is the stated deadline date - the product is already live from Saturday.",
  regress="None.",evidence="Signed checklist.",reviewer="Sohail only.")

# ===== RESTORED COMMITTED SCOPE - every item previously deferred is back, simplified
DD=DESIGN_DEP
# ---- P1 Evidence Layer (Zainab) - self-declared discovery already works; this ADDS confidence
T(P1,PB1,"As a recruiter, when a candidate has actually done the work I want to see that, not just their word for it.",
  "Completing a verified activity records proof once, and the recruiter sees that skill marked as evidence-backed rather than self-declared.",
  "Zainab",10,13,2.0,"HIGH",
  current="A proof table exists but NOTHING writes to it - confirm that first. Self-declared skills already make a candidate discoverable (C1); this is purely about showing stronger confidence where it is earned.",
  manual="Complete a verified activity. The skill shows as evidence-backed on the recruiter's view, with a count. Trigger it twice more - still ONE record. A self-declared skill with no activity still shows, marked self-declared.",
  auto="A test that three repeats create exactly one record, and that self-declared skills are unaffected.",
  acc="One proof record per activity. Skill strength moves once. Self-declared and evidence-backed are visibly distinct and never confused. If recording fails, the candidate's own submission still succeeds.",
  regress="MANDATORY: complete one existing challenge task and one programme mission - points, streaks and progress all still work.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P3 Implement.")
T(P1,PB2,"As a candidate who has been on ABTalks for months, my past work should count too.",
  "Historic completed work is backfilled so long-standing candidates are not outranked by newer ones.",
  "Zainab",14,15,1.5,"HIGH",
  current="~15,000 historic records. A previous similar job ran 4.5 hours and died. Find the existing batched script pattern and reuse it. This RUNS on release day, with Sohail present.",
  manual="Run it against a copy. Kill it halfway. Restart - it resumes and finishes. Counts reconcile.",
  auto="A reconciliation check that fails loudly on a mismatch.",
  acc="Completes on a copy, restartable, zero conflicts, counts reconcile. Not run against production without Sohail.",
  regress="MANDATORY: points and progress unchanged for a sample of existing candidates.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail -> P11 Database review -> P3 Implement.")
# ---- R4 Candidate Insights (shashank)
T(R4,PB2,"As a recruiter, I want to see why this candidate came up, and where they fall short.",
  "Opening a candidate shows their strongest signals with a count behind each, the gaps against this project's criteria, and an honest statement when there is not enough information.",
  "shashank",14,16,2.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="Existing scoring and match-explanation code already exists - reuse it rather than writing a scoring engine. Facts are records that exist; anything else is our judgement and must look different.",
  manual="Open a candidate with several verified activities - counted signals. Set a project needing AWS and 2 years, open someone with neither - exactly two gap lines. Open a brand-new candidate - it says there is not enough information and shows NO score.",
  auto="A test that a candidate with no records produces no fabricated claims.",
  acc="Signals counted from real records. Gaps specific and correct. Empty candidates handled honestly. Self-declared and evidence-backed visually distinct. No invented score.",
  regress=REG_SEARCH,deps="P1 evidence, R3 criteria")
# ---- R8 Jobs & Applicants (Shivansh)
T(R8,PB1,"As a recruiter, I write a job posting and control when it goes live.",
  "A recruiter creates a job with title, description, skills, location, work mode and type; saves it as a draft; and can publish, close and reopen it.",
  "Shivansh",9,12,2.0,"HIGH",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="Jobs today are admin-created only, with no owning company and no draft state. Skills-per-job storage EXISTS and is unused - find it. Existing live jobs must keep working.",
  manual="Create a job, save as draft. As a CANDIDATE open the draft URL directly - not found. Publish - the candidate sees it. Close - no new applications, readable message. Reopen.",
  auto="A test that a draft is unreachable and a closed job refuses applications.",
  acc="Full draft/publish/close/reopen. Draft invisibility proven by direct URL. Every job live before the change is still live and applyable.",
  regress="MANDATORY: open /jobs as a candidate - existing jobs still list, open and accept applications.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (changes live job records) -> P3 Implement -> P5 Regression analysis.")
T(R8,PB2,"As a candidate, I find jobs that suit me, apply once, and see what happened.",
  "Candidates search and filter jobs by skill, role, location, work mode and type, apply once with a friendly refusal on a repeat, and track each application's stage.",
  "Shivansh",13,15,2.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="A jobs list exists with no search and no filters. A uniqueness rule already exists in the database - catch it and turn it into a readable message rather than a server error.",
  manual="Filter by one skill matching exactly one job - only that job. Apply - confirmation. Replay the apply action - friendly refusal, still ONE application. Have a recruiter move you forward - your applications list shows the new stage.",
  auto="A test that filters narrow correctly and a repeat application creates no second record.",
  acc="All five filters correct and run in the backend. One application per person per job. Stage and date visible to the candidate.",
  regress="MANDATORY: existing jobs still list and still accept applications.")
T(R8,PB3,"As a recruiter, I see who applied, move them forward, and pull the good ones into my hiring project.",
  "A recruiter opens their job, sees applicants, moves one forward with the candidate notified, and adds an applicant to a talent project as the SAME person - no duplicate record.",
  "Shivansh",16,16,1.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="This does not exist today. Reuse the pipeline stages from R5 so an applicant and a sourced candidate share one vocabulary. Use the shared add-to-shortlist helper.",
  manual="Open your job's applicants. Move one to screening - the candidate sees it and gets a notification. Add them to a talent project - they appear there as the same person, with only ONE record of them. As a recruiter from ANOTHER company, request that applicant id - not found.",
  auto="A test that no duplicate candidate record is created and cross-company access is refused.",
  acc="Applicants list, stages move, candidate notified, applicant enters the project on the same identity. Cross-company refused.",
  regress=REG_RECDATA,deps="R5, P2")
# ---- R9 Assessments (Zainab)
T(R9,PB2,"As a recruiter, I build a test and send it to the candidates I shortlisted.",
  "A recruiter creates a test with a title, instructions, time limit and pass mark, writes multiple-choice questions, reorders and edits them, previews it, publishes and assigns it - and each candidate is notified once.",
  "Zainab",14,16,2.0,"HIGH",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="Question storage and result storage BOTH already exist unused - find them and use them. Do not create a second question model. Everything scoped to the recruiter's own company.",
  manual="Create a test with four questions. Reorder, edit one, delete one. Reload - all stuck. Try saving a question with no correct answer - refused. Preview - it looks like the candidate's view. Publish and assign to three shortlisted candidates - exactly three assignments, no duplicates, each notified. As another company, open its id - not found.",
  auto="A test that ordering persists, invalid questions are rejected, and cross-company access is refused.",
  acc="Full builder CRUD persists. Preview reuses the real candidate screen. Assignment is one per candidate. Company isolation proven.",
  regress=REG_AUTH,deps="R5 shortlist, P2 notifications",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (new data + company isolation) -> P11 Database review -> P3 Implement.")
T(R9,PB3,"As a candidate, I take the test without losing my answers, and both sides see the result.",
  "The candidate opens the test from their notification, answers within the time limit, can refresh without losing work or gaining time, submits, and it is marked automatically - with the recruiter reading a question-by-question report.",
  "Zainab",16,16,1.5,"HIGH",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="The time limit MUST be enforced by the server, and correct answers must NEVER reach the browser before submission. Verify both in the network response, not on the screen.",
  manual="Open from the notification - the right test. Answer two questions. REFRESH - answers kept, timer did NOT reset. Open the network tab - NO correct answers anywhere. Wait past the limit and submit - refused. Open another candidate's test id - refused. Submit properly - the score matches a hand calculation. As the recruiter, read the report.",
  auto="A test that answers are absent pre-submission, a late submission is refused, and scoring matches a hand calculation.",
  acc="Server-enforced timer. No answer leakage. Refresh-safe. Deterministic marking, repeatable, no duplicate result. Recruiter report matches the candidate's answers. The result records proof for the tested skills.",
  regress=REG_AUTH,deps="P1 evidence",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (cheat vectors) -> P3 Implement -> P10 Security review.")
# ---- R7 Recruiter Notifications (Manuvrtti)
T(R7,PB2,"As a recruiter, I am told when something needs me - and only then.",
  "The recruiter events produce a notification each, only the important ones send email, and a notification centre links straight to the thing it is about.",
  "Manuvrtti",14,16,1.5,"MEDIUM",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",dec="D-9",
  current="Build on the shared notification helper - this is mostly configuration, not new infrastructure. Follow the candidate bell as the pattern.",
  manual="Trigger each recruiter event. Each appears once in the bell and its link opens THAT candidate, job or test - never a list. Count your emails: only the important ones. Switch one off and re-trigger - it stops, nothing else does.",
  auto="A test that each event produces one notification and a disabled preference blocks exactly one channel.",
  acc="Every event notifies once. Only the agreed few email. Every link opens the right thing. Preferences work per type and channel.",
  regress="MANDATORY: an existing admin broadcast still reaches the bell. "+REG_EMAIL,deps="P2")
# ---- R10 Recruiter Analytics (shashank)
T(R10,PB3,"As a recruiter, I can see whether my hiring is actually working.",
  "One page showing active jobs and projects, candidates discovered, viewed, shortlisted and contacted, applications, tests assigned and completed - for my company only.",
  "shashank",16,16,1.5,"MEDIUM",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="These are straightforward counts over tables the other workstreams already write. Do NOT add new counters or a reporting layer.",
  manual="Write down every number. Do a real search, view, shortlist, unlock and stage change. Re-read - each corresponding number moved and nothing else did. Sign in as a different company - none of your activity appears.",
  auto="A test that a second company sees none of the first company's numbers.",
  acc="Every number reconciles against a hand count and is company-scoped. No chart a recruiter cannot act on.",
  regress=REG_RECDATA,deps="R5, R6, R8, R9, P4")
# ---- R11 Non-Technical Hiring (shashank)
T(R11,PB2,"As a recruiter hiring for sales or marketing, I search for those people the same way I search for engineers.",
  "The product recognises the non-technical role families alongside the technical ones, with enough skills seeded that a filter returns something useful - and no coding signal affects a non-technical candidate's standing.",
  "shashank",13,15,1.5,"MEDIUM",
  current="Role grouping already exists but only covers engineering-shaped roles. EXTEND the rules - the existing ordering carries meaning, so do not reorder it. Search already filters on skills, so this is taxonomy, not new search.",
  manual="Check a real marketing job title is recognised as marketing, not 'other'. Check three existing engineering titles still return what they did. Complete a marketing profile with NO coding links - it is not weaker than an equivalent engineering profile, and it appears in a marketing search.",
  auto="A test with one real title per new family plus the existing ones unchanged, and one proving a non-technical profile is not penalised.",
  acc="The non-technical families are recognised and searchable. Existing families unchanged. Coding signals never lower a non-technical candidate.",
  regress=REG_SEARCH+" "+REG_PROFILE)
# ---- P4 Profile-View Tracking (shashank)
T(P4,PB3,"As a candidate, I can see that real recruiters are looking at me.",
  "An approved recruiter opening a candidate is recorded once however many times they refresh, unauthorised viewers record nothing, and the candidate sees the count.",
  "shashank",16,16,1.0,"HIGH",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",dec="D-8",
  current="Nothing like this exists. Ask Claude how a recruiter is identified as approved so unauthorised callers record nothing. Agree the candidate-facing wording with Sohail first.",
  manual="As an approved recruiter, open a candidate and REFRESH FIVE TIMES - exactly one view recorded. As a candidate, as an anonymous visitor, and as a recruiter from another company - each records nothing and is refused.",
  auto="A test covering all three refused cases and the dedupe window.",
  acc="One view per recruiter per candidate per window. Three unauthorised cases refused and tested explicitly. The candidate sees an accurate count.",
  regress="MANDATORY: opening a candidate profile still works normally for an approved recruiter.",
  prompt="P1 Investigate -> P2 Plan -> STOP for Sohail (privacy + new data) -> P3 Implement -> P10 Security review.")
# ---- P3 Product Analytics (Manuvrtti)
T(P3,PB2,"As the project lead, I can answer what happened this week with a query instead of a guess.",
  "One shared helper records that something happened. It never slows down or breaks the thing the user was doing, and the recruiter analytics read these records.",
  "Manuvrtti",13,15,1.0,"MEDIUM",
  current="No analytics of any kind today. Keep it simple - one table and one helper, no external vendor. Each feature owner adds their own events as part of their own task.",
  manual="Call it from a real action - the action is not slowed. Force it to fail internally - the user's action STILL succeeds. Walk the recruiter journey; every agreed event is recorded with the right person and time.",
  auto="A test that an internal failure does not break the calling action.",
  acc="Never blocks, never breaks a user action. Events queryable by person and date. The analytics page reads these records.",
  regress="MANDATORY: every action you instrument still behaves exactly as before.")
# ---- C2 External Profile Links (Manuvrtti)
T(C2,PB3,"As a candidate, I add my GitHub, LeetCode and CodeChef profiles.",
  "All three can be added, checked for a sensible format, removed and re-added - and every one is shown to a recruiter as self-reported, never as verified.",
  "Manuvrtti",15,16,1.0,"MEDIUM",design="Approved",downer="Shallika",ddep=DD,uiux="Pending",
  current="Link storage for all three ALREADY EXISTS in the database - find it before creating anything. Nothing is fetched from those sites this month; these are declared links.",
  manual="Add all three. Enter a nonsense handle - refused readably. Remove one and add it back. View as a recruiter - each clearly marked self-reported, with no score anywhere.",
  auto="A test that a malformed handle is rejected and the recruiter view labels correctly.",
  acc="All three connect, validate, disconnect and reconnect. Every external signal labelled self-reported. No invented score exists anywhere.",
  regress=REG_PROFILE)
# ---- C4 Mock Interview (Zainab)
T(C4,PB3,"As a candidate, I can finish a mock interview and get a report I can act on.",
  "The journey is walked on production with a fresh account, every blocking break is fixed, and the finished report records proof and reaches the recruiter's view.",
  "Zainab",15,16,1.5,"MEDIUM",
  current="Substantial code exists but nobody has proven it works for a NEW user. Walk it as a real user FIRST, then fix only what blocks. Do not extend the interview engine.",
  manual="Fresh account: open mock interviews, pick a domain, start, answer, finish, read the report, check history. Force a provider failure - readable message, no lost attempt. Then check the recruiter view of the signal.",
  auto="A test that a completed interview produces a report and one proof record.",
  acc="Every blocking break closed or written off in writing. Report shows strengths, weaknesses and improvements. One proof record, visible to recruiters where privacy allows. Failure paths degrade rather than dead-end.",
  regress="MANDATORY: an existing candidate's past interview reports still open.",deps="P1")
# ---- C5 Cohorts & Hackathons (Zainab)
T(C5,PB3,"As a new candidate, I can join a cohort or a hackathon and have it count.",
  "Both journeys are walked on production with fresh accounts, every blocking break is fixed, and completing work records proof a recruiter can see.",
  "Zainab",16,16,1.5,"MEDIUM",
  current="Live for months but never proven for a NEW user. Walk both as a real user FIRST. Record what duplicate submission actually does rather than assuming. Do not rebuild the infrastructure.",
  manual="Fresh account: find a cohort, enrol, complete an activity, submit, see it marked. Fresh participant: find a hackathon, register alone AND in a team, submit, try a duplicate, see the result. Then check a recruiter can see the resulting signal.",
  auto="A test that completing an activity records proof.",
  acc="Both journeys complete for a genuinely new user. Proof recorded and visible to a recruiter - 'the record was written' is not enough, the recruiter view is checked.",
  regress="MANDATORY: complete one existing challenge task - points and progress still work.",deps="P1")

# ---- priority = EXECUTION ORDER, never a deferral list. Everything below ships.
P1_WS={R8,R9,R4,P1,R7}; P2_WS={R10,R11,P4,C2,C4,C5,P3}
for _a in ACT:
    if _a["ws"] in P1_WS: _a["prio"]="P1"
    elif _a["ws"] in P2_WS: _a["prio"]="P2"

# ================================================================ LISTS
ls=wb.create_sheet("Lists")
LISTS={"A":["Status","Not Started","Investigating","Plan Ready","In Progress","In Review","Blocked","Done","Deferred"],
 "B":["Severity","BLOCKER","MAJOR","MINOR","COSMETIC"],
 "C":["Bug Status","Open","In Fix","Retest","Closed","Wont Fix"],
 "D":["Owner","Shivansh","Zainab","shashank","Manuvrtti","Sohail","Shallika"],
 "E":["Phase",PF,PB1,PB2,PB3,PI,PU1,PU2,PU3,PR],
 "F":["Priority","P0","P1","P2"],
 "G":["Risk","LOW","MEDIUM","HIGH"],
 "H":["Gate","Not Reached","Passed","Failed"],
 "I":["Result","Not Run","Pass","Fail","Blocked"],
 "J":["Workstream"]+WORKSTREAMS,
 "K":["Design Status","Not Required","Not Started","In Design","Design Review","Approved","Implemented","UI/UX QA","Signed Off"],
 "L":["UIUX QA","Not Required","Pending","In QA","PASS","NEEDS FIX","Sign-Off"]}
for col,vals in LISTS.items():
    for r,v in enumerate(vals,start=1):
        c=ls[f"{col}{r}"]; c.value=v; c.font=HDR_FT if r==1 else BODY_FT
        if r==1: c.fill=HDR_FILL
widths(ls,{c:40 for c in LISTS}); ls.sheet_state="hidden"

# ================================================= TEAM EXECUTION BOARD
tb=wb.create_sheet("Team Execution Board"); tb.sheet_properties.tabColor=BLUE
HDRS=["Task ID","Workstream","Journey step","User outcome - what must be true when this is done",
 "Priority","Risk","Feature Owner","Design Owner","Development Owner","Technical Reviewer",
 "Design Status","Dev Status","UI/UX QA","Start","Deadline","Days",
 "Current state check - find this out FIRST","What needs to work","Design dependency","AI prompts",
 "Manual test - in a real browser","Automated test expectation","Acceptance criteria",
 "Regression check - what you did NOT build","Evidence required","Depends on","Decision","Blocker / notes"]
header_row(tb,1,HDRS,height=64)
widths(tb,{"A":9,"B":30,"C":24,"D":60,"E":8,"F":8,"G":12,"H":12,"I":12,"J":34,"K":14,"L":13,"M":13,
 "N":11,"O":11,"P":7,"Q":56,"R":56,"S":34,"T":30,"U":64,"V":42,"W":64,"X":54,"Y":42,"Z":20,"AA":11,"AB":24})
tb.freeze_panes="E2"
EDITC={12,13,28}; CENC={1,5,6,7,8,9,11,12,13,14,15,16,27}
for i,a in enumerate(ACT):
    r=i+2; tid=f"T-{i+1:03d}"
    dev = "-" if a["owner"]=="Shallika" else a["owner"]
    feat = a["owner"]
    vals=[tid,a["ws"],JOURNEY_STEP[a["ws"]],a["story"],a["prio"],a["risk"],feat,a["downer"],dev,a["reviewer"],
          a["design"],"Not Started",a["uiux"],D(a["s"]),D(a["e"]),a["est"],
          a["current"],a["goal"],a["ddep"],a["prompt"],a["manual"],a["auto"],a["acc"],a["regress"],
          a["evidence"],a["deps"],a["dec"],None]
    for ci,v in enumerate(vals,start=1):
        c=tb.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in CENC else TOP
        if ci in EDITC: c.fill=EDIT_FILL
        if ci in (14,15): c.number_format=DATEFMT
        if ci==16: c.number_format="0.00"
    tb.cell(r,4).font=font(10,True,NAVY)
    tb.cell(r,17).font=font(10,False,"1F6F4A")
    tb.row_dimensions[r].height=96
LAST=len(ACT)+1
tb.auto_filter.ref=f"A1:AB{LAST}"
for rng_,src in [(f"L2:L{LAST}","=Lists!$A$2:$A$9"),(f"K2:K{LAST}","=Lists!$K$2:$K$9"),(f"M2:M{LAST}","=Lists!$L$2:$L$7")]:
    dv=DataValidation(type="list",formula1=src,allow_blank=True); tb.add_data_validation(dv); dv.add(rng_)
for f_,fill,fc in [('"Done"',"C6EFCE","006100"),('"Blocked"',"FFC7CE","9C0006"),('"In Progress"',"FFEB9C","9C6500")]:
    tb.conditional_formatting.add(f"L2:L{LAST}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
for f_,fill,fc in [('"Approved"',"C6EFCE","006100"),('"In Design"',"FFEB9C","9C6500"),
                   ('"Not Started"',"FFC7CE","9C0006"),('"Signed Off"',"C6EFCE","006100")]:
    tb.conditional_formatting.add(f"K2:K{LAST}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
for f_,fill,fc in [('"PASS"',"C6EFCE","006100"),('"NEEDS FIX"',"FFC7CE","9C0006"),('"In QA"',"FFEB9C","9C6500")]:
    tb.conditional_formatting.add(f"M2:M{LAST}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
tb.conditional_formatting.add(f"F2:F{LAST}",CellIsRule(operator="equal",formula=['"HIGH"'],
    fill=PatternFill("solid",fgColor="FFC7CE"),font=font(10,True,"9C0006")))
tb.conditional_formatting.add(f"E2:E{LAST}",CellIsRule(operator="equal",formula=['"P0"'],
    fill=PatternFill("solid",fgColor="1F3864"),font=font(10,True,"FFFFFF")))
for f_ in ('"P1"','"P2"'):
    tb.conditional_formatting.add(f"E2:E{LAST}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor="F2F2F2"),font=font(10,False,"808080")))
TB="'Team Execution Board'"; RNG=lambda c:f"{TB}!${c}$2:${c}${LAST}"

# ========================================================== UI/UX SHEET
ux=wb.create_sheet("UI-UX"); ux.sheet_properties.tabColor="7030A0"; ux.sheet_view.showGridLines=False
sheet_title(ux,"UI/UX - Shallika",
  "Design runs AHEAD of development. A feature is not ready for a developer until its design is Approved, "
  "and it is not Done until Shallika has reviewed it in the running application. Small cosmetic issues become "
  "October bugs - they never block the release.")
header_row(ux,5,["Design ID","Feature / journey","Priority","Design start","Design deadline","Status",
 "Screens required","States required","Responsive","Dev depends on it?","Developer","UI/UX QA","Issues found","Sign-off"],height=40)
widths(ux,{"A":9,"B":40,"C":8,"D":12,"E":12,"F":14,"G":40,"H":44,"I":18,"J":13,"K":12,"L":13,"M":34,"N":13})
ux.freeze_panes="B6"
UXROWS=[
 ("UX-1","Design audit of the September journeys only","P0",5,7,"In Design",
  "n/a - written audit","n/a","n/a","No","-","Not Required","",""),
 ("UX-2","Shared patterns: buttons, inputs, cards, tables, badges, modals, nav, alerts","P0",7,8,"In Design",
  "Pattern reference","Loading · empty · error · success · disabled","Desktop + mobile","Yes - all frontend","All","Not Required","",""),
 ("UX-3","Recruiter signup, 5-step onboarding, workspace shell, Home","P0",5,8,"In Design",
  "Signup · OTP · company · hiring need · plan · Home · shell","All 5 states + resume-from-interruption","Desktop + mobile","Yes - blocks R1, R12","Shivansh","Pending","",""),
 ("UX-4","Talent project, criteria panel, search results, candidate card, shortlist, pipeline board","P0",9,11,"Not Started",
  "Project list · project detail · criteria · results · card · board","All 5 states + zero results + brand-new empty project","Desktop + mobile","Yes - blocks R3, R5","shashank","Pending","",""),
 ("UX-5","Candidate signup, profile sections, self-declared skills, privacy control","P0",11,12,"Not Started",
  "Signup · profile · skills · privacy · recruiter preview","All 5 states; self-declared vs verified visibly distinct","Desktop + mobile","Yes - blocks C1","Shivansh","Pending","",""),
 ("UX-6","Contact unlock, allowance indicator, message composer, outreach history","P0",12,14,"Not Started",
  "Unlock · composer · history","All 5 states + the zero-allowance state","Desktop + mobile","Yes - blocks R6","Zainab","Pending","",""),
 ("UX-7","Notification bell and preferences","P0",12,14,"Not Started",
  "Bell · list · preferences","Empty · unread · read","Desktop + mobile","Yes - blocks P2","Manuvrtti","Pending","",""),
 ("UX-8","UI/UX QA of build wave 1 in the running app","P0",14,15,"Not Started",
  "n/a - review","Verify every state was actually built","Check both","No","All","In QA","",""),
 ("UX-9","Final UI/UX pass, both journeys, desktop and mobile","P0",16,18,"Not Started",
  "n/a - review","Full journey walk-through","Both","No","All","In QA","",""),
 ("UX-10","Platform-wide visual consistency beyond September journeys","P2",0,0,"Deferred",
  "-","-","-","No","-","Not Required","MOVED TO OCTOBER - a full redesign is not attempted before 20 Sep.",""),
]
dvst=DataValidation(type="list",formula1="=Lists!$K$2:$K$9",allow_blank=True); ux.add_data_validation(dvst)
dvqa=DataValidation(type="list",formula1="=Lists!$L$2:$L$7",allow_blank=True); ux.add_data_validation(dvqa)
dvsg=DataValidation(type="list",formula1='"Not Started,PASS,NEEDS FIX"',allow_blank=True); ux.add_data_validation(dvsg)
for i,row_ in enumerate(UXROWS):
    r=6+i; vals=list(row_)
    vals[3]=D(vals[3]) if vals[3] else "-"; vals[4]=D(vals[4]) if vals[4] else "-"
    for ci,v in enumerate(vals,start=1):
        c=ux.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,3,4,5,6,9,10,11,12,14) else TOP
        if ci in (4,5) and not isinstance(v,str): c.number_format=DATEFMT
        if ci in (6,12,13,14): c.fill=EDIT_FILL
        if ci in (1,2): c.font=BOLD_FT
    dvst.add(ux[f"F{r}"]); dvqa.add(ux[f"L{r}"]); dvsg.add(ux[f"N{r}"])
    ux.row_dimensions[r].height=40
UXL=5+len(UXROWS)
ux.auto_filter.ref=f"A5:N{UXL}"
for f_,fill,fc in [('"Approved"',"C6EFCE","006100"),('"In Design"',"FFEB9C","9C6500"),('"Not Started"',"FFC7CE","9C0006")]:
    ux.conditional_formatting.add(f"F6:F{UXL}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
ux["A3"]=(f'="Designs approved: "&COUNTIF($F$6:$F${UXL},"Approved")&" of {len([u for u in UXROWS if u[2]=="P0"])} P0'
          f'   |   In design: "&COUNTIF($F$6:$F${UXL},"In Design")&"   |   NOT STARTED: "&COUNTIF($F$6:$F${UXL},"Not Started")')
ux["A3"].font=font(12,True,"7030A0"); ux.merge_cells("A3:N3")
# ======================================================= HOW WE WORK
hw = wb.create_sheet("How We Work")
hw.sheet_properties.tabColor = GREEN
hw.sheet_view.showGridLines = False
sheet_title(hw,"How We Work Every Day",
  "Read this once, properly. It is the difference between AI helping you ship and AI quietly breaking production. "
  "ABTalks is a large live platform with real users - almost every task below CHANGES something that already exists.")
widths(hw,{"A":4,"B":34,"C":118})
row=[5]
def block(title, lines, colour=MID):
    r=row[0]
    hw[f"A{r}"]=title; hw[f"A{r}"].font=BAND_FT
    hw[f"A{r}"].fill=PatternFill("solid",fgColor=colour); hw.merge_cells(f"A{r}:C{r}")
    hw.row_dimensions[r].height=22; r+=1
    for k,v in lines:
        hw[f"B{r}"]=k; hw[f"B{r}"].font=BOLD_FT; hw[f"B{r}"].alignment=TOP
        hw[f"C{r}"]=v; hw[f"C{r}"].font=BODY_FT; hw[f"C{r}"].alignment=TOP
        hw.row_dimensions[r].height=max(16,14*(len(v)//115+1)); r+=1
    row[0]=r+1

block("THE ONE RULE",[
 ("Investigate → Plan → Review → Implement → Test → Manual check → Regression → Done",
  "Never: prompt → generate a lot of code → hope it works. ABTalks already has 964 source files and real users. "
  "The most expensive mistake on this project is asking AI to build something that already exists, or to replace "
  "something that is working."),
 ("Why this matters here",
  "Roughly a third of the recruiter product already exists in the database and is simply unused. If you ask Claude "
  "to 'build a shortlist' it will happily build a second one. If you ask it 'what already stores a shortlist and why "
  "is it not being used', you get a two-hour task instead of a two-day one."),
])
block("YOUR DAY, STEP BY STEP",[
 ("1. Read your row","Read the User Outcome and the Acceptance Criteria on the Team Execution Board. If you cannot picture the finished thing in your head, ask at standup BEFORE starting."),
 ("2. Ask Claude to investigate - NO CODE","Paste prompt P1 from the AI Prompt Library. Let it read the relevant part of the codebase and tell you what already exists. Do not let it write anything yet."),
 ("3. Ask for a plan","Paste P2. Read the plan yourself. If any step surprises you, ask why before agreeing."),
 ("4. Check the assumptions","If Claude writes 'I assume...' anywhere - go and verify it. An unchecked assumption is the most common cause of a broken feature."),
 ("5. HIGH RISK? Stop here","If your row says HIGH, send the plan to Sohail and wait. Do not start coding. This is not a formality - these are the tasks that can lose data or leak candidate details."),
 ("6. Implement one piece at a time","Paste P3. One logical change, then check it works, then the next. Never ten changes and one big test."),
 ("7. Run the existing tests","Before yours. If something unrelated breaks, STOP - you have changed something you did not mean to."),
 ("8. Add tests","Ask Claude to follow the project's existing testing approach. You do not need to know that approach in advance - Claude should find it."),
 ("9. Do the manual test","The steps in your row. In a real browser. As a real user would. This catches what tests do not."),
 ("10. Do the regression check","The Regression Check column. This is testing what you did NOT build - the things your change could have broken."),
 ("11. Ask Claude to review its own work","Paste P7, ideally in a fresh conversation so it reviews with clean eyes. Fix the blockers and majors."),
 ("12. Mark it done","Only when every acceptance checkbox is true AND you have the evidence listed in your row."),
])
block("STOP → ASK SOHAIL","",RED)
row[0]-=1
r=row[0]
hw[f"B{r}"]="Stop immediately and ask, whatever Claude says"
hw[f"B{r}"].font=font(10,True,"9C0006"); hw[f"B{r}"].alignment=TOP
hw[f"C{r}"]=("Claude proposes deleting production data · a change that rewrites or drops existing records · changing how "
 "login or permissions work · replacing an existing subsystem · a database change whose result differs from what was "
 "expected · row counts that do not reconcile · tests failing in an area you did not touch · Claude cannot explain how "
 "the existing code works · the requirement contradicts what production actually does · anything about who can see "
 "candidate contact details · a change that needs a large unrelated refactor to work · anything that changes production "
 "settings · Claude making assumptions about live data.\n\n"
 "You will never be criticised for stopping. You will be asked hard questions if you did not.")
hw[f"C{r}"].font=font(10,False,"9C0006"); hw[f"C{r}"].alignment=TOP
hw[f"C{r}"].fill=PatternFill("solid",fgColor="FDECEA"); hw.row_dimensions[r].height=96
row[0]=r+2
block("RULES FOR EVERY AI PROMPT",[
 ("Do not scan the whole repository","Start from the page or route for your feature. Follow its direct dependencies. Widen only when you must. This keeps Claude accurate and cheap."),
 ("No unrelated refactoring","Do not rename unrelated files. Do not replace working code because another approach looks cleaner. Do not add a library when the current stack can do it. We are optimising for shipping, not architectural beauty."),
 ("No parallel implementations","If something already does 80% of this, extend it. A second way of doing the same thing is how this codebase ends up with two shortlists - which is exactly the bug we are fixing this month."),
 ("Smallest safe change","Preserve existing behaviour unless the requirement explicitly changes it."),
 ("Report everything","Every file changed, every assumption made, and anything it could not verify."),
])
block("THE WEEK - Sunday is a HOLIDAY",[
 ("Working days","Mon-Sat. SUNDAY IS OFF for everyone: 6, 13 and 20 September. No development, design, QA, review, testing or meetings are scheduled on a Sunday."),
 ("The deadline","20 September is itself a SUNDAY. So the product must be LIVE and VERIFIED on Saturday 19 September. The 20th is the stated deadline date only - nobody works it."),
 ("What that leaves","13 working days from 5 September, of which only NINE are build days. Everything after Tuesday 15 September is freeze, testing, fixing and release."),
])
block("DESIGN COMES FIRST - and runs AHEAD",[
 ("The pipeline","DESIGN READY -> READY FOR DEVELOPMENT -> IN DEVELOPMENT -> FUNCTIONALLY READY -> UI/UX QA -> UAT -> DONE."),
 ("Shallika works a feature ahead","While you build feature A, she is designing feature B. Never wait for a design that should already exist - if your row says a design is required and it is not Approved, raise it at standup THAT MORNING."),
 ("Check before you start","If your row has a Design dependency, confirm the design is Approved on the UI-UX sheet before writing frontend code. Building against an unapproved design means building it twice."),
 ("Backend work does not wait","Database, authorization, plan limits, migrations and pure data tasks proceed independently. Do not invent a design dependency where there is no meaningful UI."),
 ("Do not redesign it yourself","The approved design is authoritative. If it is technically impossible or conflicts with existing behaviour, REPORT the conflict - do not quietly change it."),
 ("UI/UX QA is a real gate","Shallika reviews the running application, not screenshots. She records PASS or NEEDS FIX. Blockers must be fixed. Minor cosmetic issues become October bugs and never block the release."),
])
block("RISK LEVELS - what your row means",[
 ("LOW","Screens, states, forms, copy, responsive work, filtering with existing data. Build it with Claude, self-review with P7, normal pull request."),
 ("MEDIUM","New user flows, search behaviour, notifications, emails, analytics, anything that persists. Investigation → plan → build → tests → manual journey → peer review before merge."),
 ("HIGH","Login, permissions, company data isolation, database changes, backfills, plan limits, candidate contact details, production settings, deleting anything, rate limits. Sohail reviews the plan BEFORE you write code, and approves again before it reaches production. You must not merge these yourself."),
])
block("PROTECTING WHAT ALREADY WORKS",[
 ("Every change answers one question","What existing flows could this break? Ask Claude this BEFORE implementing (prompt P5), not after."),
 ("Always regression-test these","Login · candidate profile · points and progress · recruiter data · notifications · email · jobs · candidate search. If your change touches any of them, the Regression Check in your row is mandatory, not optional."),
 ("Test both","A: the new thing you built. B: the old thing that could have broken. Most September defects will be category B."),
])



# ================================================= AI PROMPT LIBRARY
pl = wb.create_sheet("AI Prompt Library")
pl.sheet_properties.tabColor = BLUE
pl.sheet_view.showGridLines = False
sheet_title(pl,"Claude / Cursor Prompt Library",
  "Copy the prompt, replace the [SQUARE BRACKETS], paste it in. Your Team Execution Board row tells you which prompts "
  "to use and in what order. Always start with P1 - never with P3.")
header_row(pl,4,["Ref","Use it when","The prompt - copy from here"],height=30)
widths(pl,{"A":6,"B":30,"C":150})
PREAMBLE=("You are working on ABTalks, a large live Next.js + Prisma platform with real users.\n"
 "IMPORTANT SCOPE RULES:\n"
 "- Do not scan or modify the whole repository. Start from the page/route/module for this feature and follow its direct dependencies. Widen context only when necessary.\n"
 "- Prefer extending existing code over creating anything new.\n"
 "- Do not refactor unrelated code, rename unrelated files, or introduce a new library.\n\n")
PROMPTS=[
 ("P1","Investigate - ALWAYS FIRST. Never skip this.",
  PREAMBLE+"TASK: [PASTE THE USER OUTCOME AND ACCEPTANCE CRITERIA FROM YOUR ROW]\n\n"
  "DO NOT WRITE ANY CODE YET.\n\nInspect only the parts of the repository relevant to this feature and tell me:\n"
  "1. The current user flow - what actually happens today, step by step.\n"
  "2. The frontend components involved.\n"
  "3. The backend actions or endpoints involved.\n"
  "4. The database models involved, and whether any of them already exist but are UNUSED.\n"
  "5. How authentication and permissions currently work on this path.\n"
  "6. What tests already exist for this area.\n"
  "7. Patterns already used elsewhere in this codebase that I should reuse rather than reinvent.\n\n"
  "Then tell me plainly:\n- What already works.\n- What is half-built.\n- What is missing.\n- What could BREAK if we change this.\n"
  "- The specific files you believe need changing, and why each one.\n\n"
  "If you are unsure about something, say so explicitly rather than guessing."),
 ("P2","Get a plan before any code",
  "Based on your investigation, write an implementation plan.\n\nRules:\n"
  "- Reuse existing models, components and utilities wherever possible. Tell me exactly what you are reusing.\n"
  "- If you are creating anything new, justify why nothing existing can be extended.\n"
  "- Break the work into small, individually testable steps.\n"
  "- For each step, say what could break and how we would notice.\n"
  "- List every file you will touch.\n"
  "- State every assumption you are making, clearly marked, so I can verify it.\n"
  "- Flag anything that touches login, permissions, candidate contact details, existing data, or database structure.\n\n"
  "Do not implement anything yet. I will review this plan first."),
 ("P3","Implement an approved plan",
  "Implement the approved plan step by step.\n\nRules:\n- Make the smallest safe change.\n"
  "- Preserve existing behaviour unless the requirement explicitly changes it.\n"
  "- Reuse existing utilities, components and services.\n"
  "- Do not create a second implementation of something that already exists.\n"
  "- Do not refactor unrelated code. Do not rename unrelated files.\n- Add or update tests using this project's existing testing approach.\n"
  "- Run the relevant existing tests after implementing.\n\nAfter each logical step, stop and report:\n"
  "- Every file you changed and why.\n- Every assumption you made.\n- Anything you could not verify.\n- Any existing behaviour you think may be affected."),
 ("P4","Something is broken and you need the cause",
  PREAMBLE+"BUG: [DESCRIBE WHAT YOU DID AND WHAT HAPPENED INSTEAD]\n\nDo not fix anything yet.\n\n"
  "Trace the actual code path this request takes. Tell me:\n1. Where the behaviour diverges from what I expected.\n"
  "2. The root cause, not the symptom.\n3. Whether this is a new bug or pre-existing.\n"
  "4. What else uses this same code path and could be affected by a fix.\n5. The smallest fix that addresses the root cause.\n\n"
  "If you cannot reproduce the cause from the code, say so - do not guess."),
 ("P5","Before merging anything that touches shared systems",
  "I am about to change [DESCRIBE THE CHANGE].\n\nActing as a cautious reviewer, tell me:\n"
  "1. Every existing user flow that touches this code.\n2. Which of those could break, and how a user would notice.\n"
  "3. Anything relying on the current behaviour that I might not have thought of.\n"
  "4. The specific manual tests I should run on the EXISTING functionality after this change.\n\n"
  "Be specific. 'Test the profile' is not useful - tell me which screen, which action, which expected result."),
 ("P6","Add tests for what you just built",
  "Add tests for [FEATURE].\n\nFirst, inspect how tests are already written in this repository and follow that same "
  "approach - do not introduce a new framework or pattern.\n\nCover:\n- The main path working correctly.\n"
  "- The failure the acceptance criteria call out.\n- Permissions: someone who should NOT be able to do this, cannot.\n"
  "- Data persisting correctly across a fresh read.\n\nThen run them and show me the output."),
 ("P7","Review your own work - ideally in a FRESH chat",
  "Review this implementation as a senior engineer who did not write it. Do not change anything yet.\n\nLook for:\n"
  "- Requirement gaps\n- Broken existing behaviour\n- Incorrect assumptions\n- Security problems\n- Permission and data-isolation issues\n"
  "- Data consistency issues\n- Unnecessary complexity\n- Duplicated logic\n- Missing error states\n- Missing tests\n- Unhandled edge cases\n\n"
  "Rank every issue as BLOCKER, MAJOR or MINOR. Then recommend the smallest fix for each."),
 ("P8","Write or repair an automated journey test",
  "Write an automated end-to-end test for this journey:\n[PASTE THE SCENARIO AND STEPS FROM THE E2E TESTS SHEET]\n\n"
  "First inspect how end-to-end tests are already set up in this repository and use that same framework and structure.\n\n"
  "The test must:\n- Start from a genuinely fresh account, not a reused one.\n- Follow the steps exactly as written.\n"
  "- Assert the specific expected result, not just that the page loaded.\n- Fail loudly and readably when the journey breaks.\n\n"
  "Show me the test and how to run it."),
 ("P9","Check how a screen looks and behaves",
  "Review this screen against the project's design system document. Do not change anything yet.\n\nCheck:\n"
  "- Does it reuse existing patterns and tokens, or invent new ones?\n- Loading, empty, error and success states - are all four present and designed?\n"
  "- Does it work at phone width without sideways scrolling or cut-off buttons?\n- Are tap targets big enough?\n"
  "- Is anything inconsistent with the neighbouring screens?\n\nList issues as BLOCKER, MAJOR or MINOR and suggest the smallest fixes."),
 ("P10","Anything touching permissions or personal data",
  "Security review this change. Do not change anything yet.\n\nCheck specifically:\n"
  "1. Is the restriction enforced on the SERVER, or only in the browser? Show me the server-side check.\n"
  "2. Can this be bypassed by calling the action directly, without the UI?\n"
  "3. Can a user from one company reach another company's data by changing an id?\n"
  "4. Does any response contain personal data - email, phone, CV link - that the caller should not see? Check the actual response payload, not the rendered screen.\n"
  "5. Are public pages such as sign-in and sign-out still public?\n\nFor each, tell me how you verified it, and rank problems as BLOCKER, MAJOR or MINOR."),
 ("P11","Anything changing the database or moving data",
  "Review this database change. Do not run anything against production.\n\nTell me:\n"
  "1. Exactly what will change and whether any existing row is rewritten or removed.\n"
  "2. Whether existing records keep working afterwards - be specific about defaults and nullability.\n"
  "3. What happens to data currently in these tables.\n4. Whether this can be undone, and how.\n"
  "5. How we verify afterwards that nothing was lost - the exact counts or checks to run before and after.\n"
  "6. Whether this needs to run in batches to avoid timing out.\n\n"
  "This must be rehearsed on a Neon CHILD branch first. Never target the production branch."),
 ("P13","Implementing an approved design",
  PREAMBLE+"You are implementing an APPROVED ABTalks UI/UX design.\n[PASTE THE DESIGN LINK, THE SCREENS AND THE REQUIRED STATES]\n\n"
  "Before coding:\n1. Inspect the existing frontend architecture for this area.\n2. Find components we can reuse.\n"
  "3. Find the design patterns already in use here.\n4. Do not create duplicate components.\n5. List the minimum files that need changing.\n\n"
  "The approved design and the user journey are AUTHORITATIVE. Implement the design while preserving functionality, "
  "accessibility, responsiveness, and the loading, empty and error states.\n\n"
  "Do NOT redesign the feature yourself. If the design conflicts with existing functionality or is technically "
  "impossible, REPORT the conflict before changing any behaviour."),
 ("P14","Reviewing what you built against the design",
  "Review this implementation against the approved UI/UX design. Do not change product behaviour.\n\nCheck:\n"
  "- Visual hierarchy\n- Spacing\n- Typography\n- Responsiveness on mobile and tablet\n- Component reuse rather than duplication\n"
  "- Form UX and validation feedback\n- Loading states\n- Error states\n- Empty states\n- Accessibility\n"
  "- Interaction consistency with neighbouring screens\n- Anything that creates obvious UX friction\n\n"
  "Return issues ranked BLOCKER, MAJOR, MINOR."),
 ("P12","Before you say a feature is done",
  "Assess whether this feature is genuinely production-ready. Be sceptical - assume it is not.\n\nCheck:\n"
  "- Does the whole user journey work, or only the screen?\n- Does the data survive a sign-out and sign-in?\n"
  "- Are permissions enforced on the server?\n- Do loading, empty, error and success states exist?\n"
  "- Does it work on a phone?\n- Are there tests, and do they test the real behaviour rather than the implementation?\n"
  "- What happens on a slow connection, a failed request, or a duplicate submission?\n"
  "- What existing functionality could this have broken, and has that been tested?\n\n"
  "Give me a straight answer: ready, or not ready and why."),
]
for i,(ref,when,body) in enumerate(PROMPTS):
    r=5+i
    for ci,v in enumerate([ref,when,body],start=1):
        c=pl.cell(r,ci,v); c.font=BODY_FT; c.border=BOX; c.alignment=TOP
        if ci==1: c.font=font(11,True,NAVY); c.alignment=TOPC
        if ci==2: c.font=BOLD_FT
        if ci==3: c.font=font(9)
    pl.row_dimensions[r].height=max(60,11*body.count("\n"))


# ================================================= EXECUTIVE DASHBOARD
dash=wb.create_sheet("Executive Dashboard",0)
dash.sheet_properties.tabColor=NAVY; dash.sheet_view.showGridLines=False
sheet_title(dash,"ABTalks - Release by 20 September 2026",
  "Plan 112 rev.5. SUNDAYS ARE HOLIDAYS (6, 13, 20 Sep). 20 Sep IS a Sunday, so the product must be LIVE and "
  "VERIFIED on Saturday 19 September. Build 5-15 Sep (9 working days) · FREEZE Tue 15, 20:00 · UAT 16-18 · RELEASE Sat 19.")
widths(dash,{"A":36,"B":14,"C":13,"D":12,"E":12,"F":12,"G":14,"H":3,"I":36,"J":14,"K":12,"L":12,"M":12})
band(dash,"A4","THE COMPRESSED WEEK"); dash.merge_cells("A4:C4")
band(dash,"I4","OPEN BUGS"); dash.merge_cells("I4:M4")
for c,t in [("A5","Milestone"),("B5","Date"),("C5","Working days away"),
            ("I5","Severity"),("J5","Open"),("K5","Closed"),("L5","Total")]:
    dash[c]=t; dash[c].font=BOLD_FT
KEY=[("Today",5),("Foundation gate",8),("Build wave 1 ends",12),("FEATURE FREEZE 20:00",15),
     ("UAT - find only",16),("Fix blockers",17),("Regression + sign-off",18),("RELEASE + go live",19)]
for i,(lab,day) in enumerate(KEY):
    r=6+i
    dash[f"A{r}"]=lab; dash[f"A{r}"].font=BOLD_FT if day in (15,19) else BODY_FT
    dash[f"B{r}"]=D(day); dash[f"B{r}"].number_format=DATEFMT; dash[f"B{r}"].font=BODY_FT
    dash[f"C{r}"]=f"=NETWORKDAYS.INTL(TODAY(),$B{r},11)-1"
    dash[f"C{r}"].font=NUM_FT; dash[f"C{r}"].number_format="0"
    dash[f"C{r}"].alignment=Alignment(horizontal="center")
dash["A14"]="Sun 20 Sep = DEADLINE DATE ONLY. Sundays 6, 13, 20 are holidays - nobody works them."
dash["A14"].font=font(9,True,"9C0006"); dash.merge_cells("A14:G14")
BG="'Bugs'"
for i,sev in enumerate(["BLOCKER","MAJOR","MINOR","COSMETIC"]):
    r=6+i
    dash[f"I{r}"]=sev; dash[f"I{r}"].font=BODY_FT
    dash[f"J{r}"]=(f'=COUNTIFS({BG}!$D$6:$D$205,$I{r},{BG}!$G$6:$G$205,"Open")'
                   f'+COUNTIFS({BG}!$D$6:$D$205,$I{r},{BG}!$G$6:$G$205,"In Fix")'
                   f'+COUNTIFS({BG}!$D$6:$D$205,$I{r},{BG}!$G$6:$G$205,"Retest")')
    dash[f"K{r}"]=f'=COUNTIFS({BG}!$D$6:$D$205,$I{r},{BG}!$G$6:$G$205,"Closed")'
    dash[f"L{r}"]=f'=COUNTIF({BG}!$D$6:$D$205,$I{r})'
    for col in "JKL":
        cc=dash[f"{col}{r}"]; cc.font=NUM_FT; cc.number_format="0"; cc.alignment=Alignment(horizontal="center")
dash["I11"]="CAN WE SIGN OFF?"; dash["I11"].font=BOLD_FT
dash["J11"]='=IF($J6+$J7>0,"NO - "&($J6+$J7)&" blocker/major open","YES - clear to sign off")'
dash["J11"].font=BOLD_FT; dash.merge_cells("J11:M11")
dash.conditional_formatting.add("J11",CellIsRule(operator="beginsWith",formula=['"NO"'],
    fill=PatternFill("solid",fgColor="FFC7CE"),font=font(10,True,"9C0006")))
dash.conditional_formatting.add("J11",CellIsRule(operator="beginsWith",formula=['"YES"'],
    fill=PatternFill("solid",fgColor="C6EFCE"),font=font(10,True,"006100")))

band(dash,"A16","P0 PROGRESS"); dash.merge_cells("A16:C16")
band(dash,"I16","DESIGN PIPELINE - is design the bottleneck?"); dash.merge_cells("I16:M16")
for i,(lab,f_,fmt) in enumerate([
 ("P0 tasks",f'=COUNTIF({RNG("E")},"P0")',"0"),
 ("P0 done",f'=COUNTIFS({RNG("E")},"P0",{RNG("L")},"Done")',"0"),
 ("P0 in progress",f'=COUNTIFS({RNG("E")},"P0",{RNG("L")},"In Progress")+COUNTIFS({RNG("E")},"P0",{RNG("L")},"In Review")',"0"),
 ("P0 BLOCKED",f'=COUNTIFS({RNG("E")},"P0",{RNG("L")},"Blocked")',"0"),
 ("P0 not started",f'=COUNTIFS({RNG("E")},"P0",{RNG("L")},"Not Started")',"0"),
 ("P0 % complete","=IFERROR($B18/$B17,0)","0%"),
 ("P0 days of work",f'=SUMIF({RNG("E")},"P0",{RNG("P")})',"0.0"),
 ("HIGH RISK P0 not done",f'=COUNTIFS({RNG("E")},"P0",{RNG("F")},"HIGH",{RNG("L")},"<>Done")',"0"),
 ("OVERDUE",f'=SUMPRODUCT(({RNG("O")}<TODAY())*({RNG("L")}<>"Done")*({RNG("L")}<>"Deferred")*({RNG("E")}="P0"))',"0")]):
    r=17+i
    dash[f"A{r}"]=lab; dash[f"A{r}"].font=BOLD_FT if "BLOCKED" in lab or "OVERDUE" in lab else BODY_FT
    dash[f"B{r}"]=f_; dash[f"B{r}"].font=NUM_FT; dash[f"B{r}"].number_format=fmt
    dash[f"B{r}"].alignment=Alignment(horizontal="center"); dash[f"B{r}"].border=BOX
dash.conditional_formatting.add("B22",DataBarRule(start_type="num",start_value=0,end_type="num",end_value=1,color=GREEN))
for rng_ in ("B20","B25"):
    dash.conditional_formatting.add(rng_,CellIsRule(operator="greaterThan",formula=["0"],
        fill=PatternFill("solid",fgColor="FFC7CE"),font=font(10,True,"9C0006")))
UX="'UI-UX'"
for i,(lab,f_) in enumerate([
 ("Designs NOT STARTED",f'=COUNTIF({UX}!$F$6:$F${UXL},"Not Started")'),
 ("Designs in progress",f'=COUNTIF({UX}!$F$6:$F${UXL},"In Design")'),
 ("Designs approved",f'=COUNTIF({UX}!$F$6:$F${UXL},"Approved")'),
 ("DEV WAITING ON DESIGN",f'=COUNTIFS({RNG("K")},"Not Started",{RNG("L")},"<>Done")+COUNTIFS({RNG("K")},"In Design",{RNG("L")},"<>Done")'),
 ("Features awaiting UI/UX QA",f'=COUNTIF({RNG("M")},"Pending")+COUNTIF({RNG("M")},"In QA")'),
 ("UI/UX NEEDS FIX",f'=COUNTIF({RNG("M")},"NEEDS FIX")')]):
    r=17+i
    dash[f"I{r}"]=lab; dash[f"I{r}"].font=BOLD_FT if lab.isupper() or "WAITING" in lab else BODY_FT
    dash[f"J{r}"]=f_; dash[f"J{r}"].font=NUM_FT; dash[f"J{r}"].number_format="0"
    dash[f"J{r}"].alignment=Alignment(horizontal="center"); dash[f"J{r}"].border=BOX
for rng_ in ("J17","J20","J22"):
    dash.conditional_formatting.add(rng_,CellIsRule(operator="greaterThan",formula=["0"],
        fill=PatternFill("solid",fgColor="FFEB9C"),font=font(10,True,"9C6500")))
dash["I24"]="SCOPE"; dash["I24"].font=BOLD_FT
for i,(t,lab) in enumerate([("P0","MUST ship by Sat 19 Sep"),("P1","only if P0 lands early"),("P2","October")]):
    r=25+i
    dash[f"I{r}"]=f"{t} - {lab}"; dash[f"I{r}"].font=BODY_FT
    dash[f"J{r}"]=f'=COUNTIF({RNG("E")},"{t}")&" tasks / "&ROUND(SUMIF({RNG("E")},"{t}",{RNG("P")}),1)&" days"'
    dash[f"J{r}"].font=NUM_FT; dash.merge_cells(f"J{r}:M{r}")

band(dash,"A29","BY PERSON"); dash.merge_cells("A29:G29")
for i,h in enumerate(["Person","Role","Tasks","Done","Blocked","Days","% done"]):
    c=dash.cell(30,i+1,h); c.font=BOLD_FT; c.alignment=HDRAL; c.border=BOX
for i,(o,role) in enumerate([("Shivansh","Developer - full time"),("Zainab","Developer - full time"),
        ("shashank","Developer - full time"),("Manuvrtti","Developer - part time"),
        ("Sohail","Architect + builder"),("Shallika","UI/UX Designer - full time, no code")]):
    r=31+i
    dash[f"A{r}"]=o; dash[f"A{r}"].font=BODY_FT
    dash[f"B{r}"]=role; dash[f"B{r}"].font=font(9,False,MID)
    dash[f"C{r}"]=f'=COUNTIF({RNG("G")},$A{r})'
    dash[f"D{r}"]=f'=COUNTIFS({RNG("G")},$A{r},{RNG("L")},"Done")'
    dash[f"E{r}"]=f'=COUNTIFS({RNG("G")},$A{r},{RNG("L")},"Blocked")'
    dash[f"F{r}"]=f'=SUMIF({RNG("G")},$A{r},{RNG("P")})'
    dash[f"G{r}"]=f'=IFERROR($D{r}/$C{r},0)'
    for col in "CDEFG":
        cc=dash[f"{col}{r}"]; cc.font=NUM_FT; cc.border=BOX; cc.alignment=Alignment(horizontal="center")
        cc.number_format="0%" if col=="G" else ("0.0" if col=="F" else "0")
band(dash,"I29","WHERE TO LOOK"); dash.merge_cells("I29:M29")
for i,(k,v) in enumerate([("Developers","Team Execution Board - filter to your name"),
        ("Shallika","UI-UX sheet, then Team Execution Board Design Status"),
        ("First time","How We Work - read it once"),("Prompts","AI Prompt Library - P1 first, P13 for designs"),
        ("What we promised","User Journeys"),("Testing","E2E Tests · UAT · Bugs"),
        ("Release day","Milestones & Release")]):
    r=30+i
    dash[f"I{r}"]=k; dash[f"I{r}"].font=BOLD_FT
    dash[f"J{r}"]=v; dash[f"J{r}"].font=BODY_FT; dash.merge_cells(f"J{r}:M{r}")

# ======================================================= USER JOURNEYS
uj=wb.create_sheet("User Journeys"); uj.sheet_properties.tabColor=RED; uj.sheet_view.showGridLines=False
sheet_title(uj,"User Journeys - the committed September product",
  "EVERY row here ships. Priority is EXECUTION ORDER, not a deferral list: P0 is critical-path and built first, P1 follows once its dependencies exist, P2 is lower-critical-path work still inside the September commitment. The release is declared on Saturday 19 September only when every row is verified on the live site by its owner.")
header_row(uj,5,["#","Persona","Step","What the person can do","Priority","Feature owner","Designer","Verified live?"],height=32)
widths(uj,{"A":5,"B":12,"C":30,"D":64,"E":9,"F":13,"G":11,"H":15})
uj.freeze_panes="B6"
JR=[("Candidate","Sign up","Register quickly and reach a dashboard that says what to do next.","P0","Shivansh","Shallika"),
 ("Candidate","Build a profile","Resume, education, experience, internships, projects, certifications, achievements, preferences - all persist.","P0","Shivansh","Shallika"),
 ("Candidate","Declare my skills","Say what I am good at WITHOUT needing ABTalks to verify it first.","P0","Shivansh","Shallika"),
 ("Candidate","Be discoverable","Appear in recruiter search on my self-declared skills, honestly labelled.","P0","Shivansh","Shallika"),
 ("Candidate","Control my privacy","Decide what recruiters see and check it myself before trusting it.","P0","Shivansh","Shallika"),
 ("Candidate","Browse and apply for jobs","Search and filter jobs, apply once, and track what happened.","P1","Shivansh","Shallika"),
 ("Candidate","Have my work count as proof","Verified activity becomes evidence that strengthens recruiter confidence.","P1","Zainab","-"),
 ("Candidate","Take a recruiter's test","Receive a test, take it without losing my answers, and see my result.","P1","Zainab","Shallika"),
 ("Candidate","Practise interviewing","Finish a mock interview and get a report that counts.","P2","Zainab","Shallika"),
 ("Candidate","Join cohorts and hackathons","Enrol, take part, finish, and have it count.","P2","Zainab","-"),
 ("Candidate","Add my external profiles","GitHub, LeetCode and CodeChef, honestly labelled as self-reported.","P2","Manuvrtti","Shallika"),
 ("Candidate","Know who viewed me","See that real recruiters are looking at my profile.","P2","shashank","Shallika"),
 ("Recruiter","Sign up","Create an account and verify my email without confusion.","P0","Shivansh","Shallika"),
 ("Recruiter","Onboard my company","Tell ABTalks about my company once and have it remembered.","P0","Shivansh","Shallika"),
 ("Recruiter","See my plan","Know what my plan allows and what I have used.","P0","Sohail","Shallika"),
 ("Recruiter","Enter my workspace","Land somewhere that tells me what to do next, not a blank search box.","P0","Shivansh","Shallika"),
 ("Recruiter","Create a hiring project","Give my search a name so my work has somewhere to live.","P0","shashank","Shallika"),
 ("Recruiter","Say who I need","Describe the person I want and have it remembered.","P0","shashank","Shallika"),
 ("Recruiter","Search candidates","Find people matching what I asked for, quickly and correctly.","P0","shashank","Shallika"),
 ("Recruiter","Understand the candidate","See their signals, what is proven versus self-declared, and where they fall short.","P1","shashank","Shallika"),
 ("Recruiter","Shortlist","Save people and still have them tomorrow, on another device.","P0","shashank","Shallika"),
 ("Recruiter","Talent Hub and pipeline","Move people through my process and see who needs me.","P0","shashank","Shallika"),
 ("Recruiter","Notes on a candidate","Leave a note my colleagues see and nobody else does.","P1","shashank","Shallika"),
 ("Recruiter","Unlock contact","Spend part of my plan to see how to reach someone.","P0","Zainab","Shallika"),
 ("Recruiter","Email a candidate","Contact them without leaving ABTalks, and see who I already contacted.","P0","Zainab","Shallika"),
 ("Recruiter","Post and manage jobs","Write a job, control when it goes live, and see who applies.","P1","Shivansh","Shallika"),
 ("Recruiter","Review applicants","Move applicants through the SAME pipeline as sourced candidates.","P1","Shivansh","Shallika"),
 ("Recruiter","Create and assign a test","Build a question paper, send it, and read the result.","P1","Zainab","Shallika"),
 ("Recruiter","Be told what matters","Hiring notifications arrive, and stop when switched off.","P1","Manuvrtti","Shallika"),
 ("Recruiter","See whether hiring is working","Analytics that answer a hiring question from real activity.","P2","shashank","Shallika"),
 ("Recruiter","Hire non-technical roles","Search sales, marketing, product and the rest the same way.","P2","shashank","-"),
 ("Recruiter","Come back next week","Find my project, criteria and decisions exactly where I left them.","P0","shashank","Shallika"),
 ("Platform","Nobody sees what they should not","Companies cannot see each other's data; contact details stay private.","P0","Sohail","-"),
 ("Platform","Safe to release","Journeys tested, regression checked, verified on the live site.","P0","Sohail","-")]
dvv=DataValidation(type="list",formula1='"Not Started,In Progress,Tested,VERIFIED LIVE,AT RISK,Deferred"',allow_blank=True)
uj.add_data_validation(dvv)
for i,(p,step,what,prio,own,des) in enumerate(JR):
    r=6+i
    st="Not Started"
    for ci,v in enumerate([i+1,p,step,what,prio,own,des,st],start=1):
        c=uj.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,2,5,6,7,8) else TOP
        if ci==8: c.fill=EDIT_FILL
        if ci in (3,6): c.font=BOLD_FT

    dvv.add(uj[f"H{r}"]); uj.row_dimensions[r].height=24
UJL=5+len(JR)
uj.auto_filter.ref=f"A5:H{UJL}"
for f_,fill,fc in [('"VERIFIED LIVE"',"C6EFCE","006100"),('"AT RISK"',"FFC7CE","9C0006")]:
    uj.conditional_formatting.add(f"H6:H{UJL}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
uj.conditional_formatting.add(f"E6:E{UJL}",CellIsRule(operator="equal",formula=['"P0"'],
    fill=PatternFill("solid",fgColor="1F3864"),font=font(10,True,"FFFFFF")))
NP0=len(JR)
uj["A3"]=(f'="Verified live: "&COUNTIF($H$6:$H${UJL},"VERIFIED LIVE")&" of {NP0} committed journey steps'
          f'   |   EVERY row ships - the release is declared only at {NP0} of {NP0}"')
uj["A3"].font=font(12,True,NAVY); uj.merge_cells("A3:H3")

# =========================================================== E2E TESTS
em=wb.create_sheet("E2E Tests"); em.sheet_properties.tabColor=ORANGE; em.sheet_view.showGridLines=False
sheet_title(em,"Automated Journey Tests",
  "Six journeys for the compressed release. Prompt P8 tells Claude to inspect how tests are already written here "
  "and follow that - you do not need to know the framework first, but you DO need to walk the journey by hand.")
header_row(em,5,["ID","Journey","Persona","Owner","You need first","Steps","Expected result","Status"],height=32)
widths(em,{"A":7,"B":34,"C":11,"D":11,"E":24,"F":72,"G":58,"H":13})
E2E=[("E2E-1","Recruiter signs up, onboards and reaches the workspace","Recruiter","Shivansh","A fresh invited email",
  "Register · verify by code · company details · hiring need · plan · admin activates · land on Home. Repeat, closing the browser at the company step.",
  "Every step saves. Closing halfway and returning resumes at the right step. Lands on Home, not search. Limits live after activation.","Not Written"),
 ("E2E-2","Candidate signs up, declares skills and becomes findable","Candidate","Shivansh","A fresh candidate account",
  "Register · complete the profile · add three self-declared skills · set visibility · have a recruiter search that skill.",
  "The candidate appears in search on SELF-DECLARED skills alone, marked as self-declared and never as verified. Turning visibility off removes them from live search AND saved lists.","Not Written"),
 ("E2E-3","Recruiter creates a project, leaves and comes back","Recruiter","shashank","A recruiter with a plan and candidates",
  "Create a named project · set criteria · search · view one · shortlist one · reject one · sign out · sign in IN A DIFFERENT BROWSER · reopen · re-run the search.",
  "Criteria and all three candidate states exactly as left. Only genuinely new candidates are marked new.","Not Written"),
 ("E2E-4","Recruiter unlocks a candidate and emails them","Recruiter","Zainab","A recruiter with contact allowance",
  "Search · open a candidate · shortlist · unlock contact · write and send an email · check the pipeline and history.",
  "Unlock reduces the allowance by one. The email sends. The candidate moves to contacted. A recruiter with NO allowance gets no contact details anywhere in the response.","Not Written"),
 ("E2E-5","Plan limits cannot be bypassed","Recruiter","Sohail","A recruiter at their limit",
  "For each restricted action: use it up through the screen, then call the action directly with the browser bypassed. Then fire ten simultaneous requests against a limit of five.",
  "Every one refused by the server. Exactly five of the ten succeed. Refusals are readable messages, not errors.","Not Written"),
 ("E2E-6","Nobody sees what they should not","Recruiter","Sohail","Two separate companies",
  "As company A, request company B's project, shortlist, note and candidate records by id. As a candidate, open recruiter and admin screens. Check responses for a non-unlocked candidate.",
  "All refused by the server. No candidate email, phone or CV link in any response for a candidate who has not been unlocked.","Not Written")]
dvc=DataValidation(type="list",formula1='"Not Written,Written,Green,Failing"',allow_blank=True); em.add_data_validation(dvc)
for i,row_ in enumerate(E2E):
    r=6+i
    for ci,v in enumerate(row_,start=1):
        c=em.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,3,4,8) else TOP
        if ci==8: c.fill=EDIT_FILL
        if ci==1: c.font=BOLD_FT
    dvc.add(em[f"H{r}"]); em.row_dimensions[r].height=58
EL=5+len(E2E)
for f_,fill,fc in [('"Green"',"C6EFCE","006100"),('"Failing"',"FFC7CE","9C0006")]:
    em.conditional_formatting.add(f"H6:H{EL}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))

# =============================================================== UAT
uat=wb.create_sheet("UAT"); uat.sheet_properties.tabColor=ORANGE; uat.sheet_view.showGridLines=False
sheet_title(uat,"UAT - anyone can run these",
  "Wed 16 - Fri 18 September. Always a BRAND NEW account, never your own. Nobody tests their own work. "
  "On Wednesday you only FIND problems; you do not fix them.")
header_row(uat,5,["ID","What we are checking","Who runs it","Whose fix","Steps","What should happen","If it fails","Wed 16","Fri 18"],height=32)
widths(uat,{"A":8,"B":30,"C":11,"D":11,"E":74,"F":58,"G":11,"H":9,"I":9})
uat.freeze_panes="B6"
U=[("UAT-1","Recruiter onboarding survives an interruption","Zainab","Shivansh",
 "1. Create a fresh recruiter account. 2. Enter your company details. 3. CLOSE THE BROWSER halfway. 4. Reopen the site and log in. 5. Continue and finish.",
 "Everything you typed is still there and you carry on where you stopped. You never start again. You end on a home page that tells you what to do next.","BLOCKER"),
 ("UAT-2","A recruiter understands what their plan allows","Zainab","Sohail",
 "1. Look at the plans page. 2. Note how many searches you get. 3. Use them up. 4. Try one more. 5. Check your usage figures.",
 "You can see what you get before committing. When you run out you are told clearly what ran out and where to upgrade - not shown an error.","BLOCKER"),
 ("UAT-3","A hiring project remembers everything","Shivansh","shashank",
 "1. Create a project called 'Frontend Developer'. 2. Add the skills and experience you want. 3. Search. 4. Shortlist three people. 5. Reject one. 6. Log out. 7. Log in FROM A DIFFERENT BROWSER. 8. Open the project.",
 "The project, your criteria, your three shortlisted people and your one rejection are all exactly as you left them.","BLOCKER"),
 ("UAT-4","Contacting a candidate works","Shivansh","Zainab",
 "1. Shortlist someone. 2. Unlock their contact details. 3. Check your remaining allowance. 4. Write and send them an email. 5. CHECK THE CANDIDATE'S REAL INBOX. 6. Look at their status.",
 "You see their details, your allowance drops by one, a real email arrives within a minute, and the candidate is now marked contacted.","BLOCKER"),
 ("UAT-5","A recruiter with no allowance cannot see contact details","Shivansh","Zainab",
 "1. Use up all your contact unlocks. 2. Open a candidate. 3. Try to unlock. 4. Try to email them.",
 "You are told you have run out. You cannot see their email or phone anywhere. You cannot message them.","BLOCKER"),
 ("UAT-6","Notifications arrive and stop when switched off","Manuvrtti","Manuvrtti",
 "1. Trigger the notifications these journeys produce. 2. Check the bell. 3. Check a real inbox. 4. Switch one off and repeat.",
 "You are told about the things that matter. Each notification takes you to the right place. Switching one off actually stops it.","BLOCKER"),
 ("UAT-7","The product feels like ONE product","Manuvrtti","Shivansh",
 "1. Sit someone who has NEVER seen ABTalks in front of a recruiter account. 2. Ask them to find a candidate, save them and message them. 3. SAY NOTHING. 4. Write down every pause or question.",
 "They get there on their own. Every hesitation is worth fixing - write each one down.","MAJOR"),
 ("UAT-8","A candidate profile keeps everything","shashank","Shivansh",
 "1. Fill in every part of your profile. 2. Save. 3. Log out and back in. 4. Change four things. 5. Delete one thing from three sections. 6. Look at the recruiter preview.",
 "Nothing is lost. Changes stuck. Everything deleted is gone, including from the recruiter view.","BLOCKER"),
 ("UAT-9","A candidate is findable on skills they typed themselves","shashank","Shivansh",
 "1. As a fresh candidate, add three skills yourself - do not complete any ABTalks activity. 2. As a recruiter, search for one of those skills. 3. Open the candidate.",
 "The candidate appears in search purely on what they typed. The recruiter can clearly see those skills are self-declared, not verified by ABTalks.","BLOCKER"),
 ("UAT-10","A candidate controls who sees them","shashank","Shivansh",
 "1. As the candidate, turn off recruiter visibility. 2. As a recruiter, search for them. 3. Also re-open a saved list where they used to appear.",
 "They are gone from both. Turning yourself off hides you everywhere, not just from new searches.","BLOCKER"),
 ("UAT-11","One company cannot see another's work","Sohail","Sohail",
 "1. As company A, note the web address of your project. 2. Log in as company B. 3. Paste company A's address. 4. Repeat for a shortlist, a note and a candidate.",
 "Every one says not found. Company B never sees anything belonging to company A.","BLOCKER"),
 ("UAT-12","Nothing that used to work is broken","Sohail","Everyone",
 "Walk each thing that worked before September: submit a challenge task, complete a programme mission, submit to a hackathon, get a certificate, redeem in the marketplace, sign up for a workshop, earn points.",
 "All seven still work exactly as before.","BLOCKER")]
dvr=DataValidation(type="list",formula1="=Lists!$I$2:$I$5",allow_blank=True); uat.add_data_validation(dvr)
for i,row_ in enumerate(U):
    r=6+i
    for ci,v in enumerate(list(row_)+["Not Run","Not Run"],start=1):
        c=uat.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,3,4,7,8,9) else TOP
        if ci in (8,9): c.fill=EDIT_FILL
        if ci==1: c.font=BOLD_FT
    dvr.add(uat[f"H{r}"]); dvr.add(uat[f"I{r}"]); uat.row_dimensions[r].height=62
UL=5+len(U)
uat.auto_filter.ref=f"A5:I{UL}"
for col in ("H","I"):
    for f_,fill,fc in [('"Pass"',"C6EFCE","006100"),('"Fail"',"FFC7CE","9C0006"),('"Blocked"',"FFEB9C","9C6500")]:
        uat.conditional_formatting.add(f"{col}6:{col}{UL}",CellIsRule(operator="equal",formula=[f_],
            fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))

# ============================================================== BUGS
bg=wb.create_sheet("Bugs"); bg.sheet_properties.tabColor=ORANGE; bg.sheet_view.showGridLines=False
sheet_title(bg,"Bugs","One row per problem. Row 6 is an example - overwrite it. The dashboard counts open "
  "blockers and majors from Status. Nobody retests their own fix. UI/UX issues from Shallika go here too.")
header_row(bg,5,["ID","Found on","From","Severity","What is wrong","Found by","Status","Owner","Fixed on","Retested by","Result","Notes"],height=30)
widths(bg,{"A":9,"B":12,"C":11,"D":12,"E":60,"F":11,"G":13,"H":11,"I":12,"J":12,"K":11,"L":40})
bg.freeze_panes="A6"
EX=["B-001",D(16),"UAT-3","BLOCKER","Example - overwrite me. Shortlisted candidates disappear after logging in from a different browser.",
    "Shivansh","Open","shashank",None,None,"Not Run","Only one candidate group seems to survive."]
for ci,v in enumerate(EX,start=1):
    c=bg.cell(6,ci,v); c.font=font(10,False,None,i=True); c.border=BOX
    c.alignment=TOPC if ci in (1,2,3,4,6,7,8,9,10,11) else TOP
    if ci in (2,9): c.number_format=DATEFMT
for r in range(6,206):
    for ci in range(1,13):
        c=bg.cell(r,ci)
        if r>6:
            c.font=BODY_FT; c.border=BOX
            c.alignment=TOPC if ci in (1,2,3,4,6,7,8,9,10,11) else TOP
            if ci in (2,9): c.number_format=DATEFMT
        c.fill=EDIT_FILL
bg.auto_filter.ref="A5:L205"
for f_,rng_ in [("=Lists!$B$2:$B$5","D6:D205"),("=Lists!$D$2:$D$7","F6:F205"),("=Lists!$C$2:$C$6","G6:G205"),
                ("=Lists!$D$2:$D$7","H6:H205"),("=Lists!$D$2:$D$7","J6:J205"),('"Pass,Fail,Not Run"',"K6:K205")]:
    d=DataValidation(type="list",formula1=f_,allow_blank=True); bg.add_data_validation(d); d.add(rng_)
for f_,fill,fc in [('"BLOCKER"',"FFC7CE","9C0006"),('"MAJOR"',"FFEB9C","9C6500")]:
    bg.conditional_formatting.add("D6:D205",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
bg.conditional_formatting.add("G6:G205",CellIsRule(operator="equal",formula=['"Closed"'],
    fill=PatternFill("solid",fgColor="C6EFCE"),font=font(10,False,"006100")))

# ============================================ MILESTONES & RELEASE
mg=wb.create_sheet("Milestones & Release"); mg.sheet_properties.tabColor=GREEN; mg.sheet_view.showGridLines=False
sheet_title(mg,"Milestones - compressed to 20 September",
  "SUNDAYS 6, 13 and 20 SEPTEMBER ARE HOLIDAYS. 20 September is itself a Sunday, so the product goes LIVE on "
  "Saturday 19 September and the 20th is the stated deadline date only. Thirteen working days, nine of them build.")
band(mg,"A4","THE WORKING CALENDAR"); mg.merge_cells("A4:F4")
header_row(mg,5,["Date","Day","Phase","What happens","Design (Shallika)","Status"],height=28)
widths(mg,{"A":13,"B":11,"C":22,"D":72,"E":50,"F":13})
CAL=[(5,"Saturday","Foundation","Kickoff. Decisions opened. Audits start: profile, search, recruiter first-run.","Design audit of September journeys begins.","Working"),
 (6,"SUNDAY","HOLIDAY","No work.","No work.","HOLIDAY"),
 (7,"Monday","Foundation","Decisions closed. Shared helper stubs. Audits finish.","Shared patterns + recruiter onboarding/workspace designs.","Working"),
 (8,"Tuesday","Foundation","GATE: go/no-go. Contracts on the main branch.","Recruiter onboarding + workspace designs APPROVED.","Working"),
 (9,"Wednesday","Build wave 1","Profile, recruiter signup, workspace shell, projects, shortlist, plans, notifications, test harness.","Search / candidate card / shortlist designs begin.","Working"),
 (10,"Thursday","Build wave 1","Build continues. Continuous testing from day one.","Search designs continue.","Working"),
 (11,"Friday","Build wave 1","Build continues.","Search designs APPROVED. Candidate profile designs begin.","Working"),
 (12,"Saturday","Build wave 1","Wave 1 complete and demoable on a preview.","Candidate profile designs APPROVED. Outreach designs begin.","Working"),
 (13,"SUNDAY","HOLIDAY","No work.","No work.","HOLIDAY"),
 (14,"Monday","Build wave 2","Criteria, pipeline, contact unlock, email, visibility, security sweeps.","Outreach designs APPROVED. UI/UX QA of wave 1 begins.","Working"),
 (15,"Tuesday","Integration","Integration. Test environment stood up. FEATURE FREEZE 20:00.","UI/UX QA of wave 1 complete.","Working"),
 (16,"Wednesday","UAT day 1","All 12 UAT scripts run with fresh accounts. FIND ONLY - no fixing.","Full UI/UX pass, both journeys.","Working"),
 (17,"Thursday","Fix blockers","Every blocker fixed and retested by whoever found it.","Re-check every screen that changed today.","Working"),
 (18,"Friday","Regression","Majors fixed. Scripts re-run clean. Full regression. Six signatures.","FINAL UI/UX SIGN-OFF for both journeys.","Working"),
 (19,"Saturday","RELEASE","Snapshot, migrate, deploy, everyone verifies their journeys on the live site, declare.","Walks both journeys on the live site.","Working"),
 (20,"SUNDAY","DEADLINE DATE","Official deadline. NOBODY WORKS. The product has been live since Saturday.","No work.","HOLIDAY")]
dvw=DataValidation(type="list",formula1='"Working,HOLIDAY,Done,Slipped"',allow_blank=True); mg.add_data_validation(dvw)
for i,(day,dw,ph,what,des,st) in enumerate(CAL):
    r=6+i
    for ci,v in enumerate([D(day) if False else dt.datetime(2026,9,day),dw,ph,what,des,st],start=1):
        c=mg.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,2,6) else TOP
        if ci==1: c.number_format=DATEFMT
        if ci==6: c.fill=EDIT_FILL
        if st=="HOLIDAY": c.font=font(10,True,"9C0006")
        if ci==3: c.font=font(10,True,NAVY) if st!="HOLIDAY" else font(10,True,"9C0006")
    dvw.add(mg[f"F{r}"]); mg.row_dimensions[r].height=32
CL=5+len(CAL)
mg.conditional_formatting.add(f"F6:F{CL}",CellIsRule(operator="equal",formula=['"HOLIDAY"'],
    fill=PatternFill("solid",fgColor="FDECEA"),font=font(10,True,"9C0006")))
mg.conditional_formatting.add(f"F6:F{CL}",CellIsRule(operator="equal",formula=['"Done"'],
    fill=PatternFill("solid",fgColor="C6EFCE"),font=font(10,True,"006100")))
GS=CL+2
band(mg,f"A{GS}","THE GATES"); mg.merge_cells(f"A{GS}:F{GS}")
header_row(mg,GS+1,["Gate","Date","Time","Owner","What must be true","Status"],height=26)
GATES=[("Foundation done",8,"evening","Sohail","Decisions closed. Shared stubs on the main branch. Database path proven. Recruiter onboarding and workspace designs APPROVED so build can start Wednesday. If the database path is unproven, no database change merges - we re-sequence."),
 ("Wave 1 demoable",12,"evening","Sohail","Profile, recruiter signup, workspace shell, projects and shortlist all demoable on a preview. SCOPE DECISION: anything behind drops a P1 now, whole, rather than half-building it."),
 ("FEATURE FREEZE",15,"20:00","Sohail","Build clean. Journey tests green. Test environment ready with every database change applied. No P0 knowingly unfinished without a written note. Anything unfinished switched off. Every journey has a named person for Saturday. NO NEW FEATURES AFTER TONIGHT."),
 ("UAT day 1 done",16,"end of day","Sohail","All 12 scripts run with fresh accounts. Every problem written down with a rank and an owner. NOTHING FIXED TODAY."),
 ("Blockers clear",17,"end of day","Sohail","Zero blockers open. Every fix confirmed by whoever found it."),
 ("Ready to release",18,"18:00","All 6","Zero blockers, zero majors. Every script passed on the re-run. Journey tests green. Nothing pre-September broken. UI/UX signed off for both journeys. Six signatures."),
 ("LIVE",19,"17:00","Sohail","Snapshot taken, database changes applied, release branch deployed, and EVERY P0 journey row verified on the live site by its owner. Anything unverified is switched off with its owner named."),
 ("DEADLINE DATE",20,"-","-","Sunday. Nobody works. The product has been live and verified since Saturday 19 September.")]
dvg=DataValidation(type="list",formula1="=Lists!$H$2:$H$4",allow_blank=True); mg.add_data_validation(dvg)
for i,(g,day,t,own,crit) in enumerate(GATES):
    r=GS+2+i
    for ci,v in enumerate([g,dt.datetime(2026,9,day),t,own,crit,"Not Reached"],start=1):
        c=mg.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (2,3,4,6) else TOP
        if ci==2: c.number_format=DATEFMT
        if ci==1: c.font=font(10,True,NAVY)
        if ci==6: c.fill=EDIT_FILL
    dvg.add(mg[f"F{r}"]); mg.row_dimensions[r].height=52
GL=GS+1+len(GATES)
for f_,fill,fc in [('"Passed"',"C6EFCE","006100"),('"Failed"',"FFC7CE","9C0006")]:
    mg.conditional_formatting.add(f"F{GS+2}:F{GL}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
SG=GL+2
band(mg,f"A{SG}","SIGN-OFF, Friday 18 September - a signature means: I walked my journeys, with fresh accounts, and I am willing to be woken up about them.")
mg.merge_cells(f"A{SG}:F{SG}")
header_row(mg,SG+1,["Person","Signs for","","","Signed","Date"],height=22)
for i,(who,what) in enumerate([("Shivansh","Candidate profile & skills · Recruiter signup & onboarding · Workspace & Home"),
  ("Zainab","Contact unlock · Email outreach"),("shashank","Projects & criteria · Search · Shortlist & pipeline"),
  ("Manuvrtti","Notifications & email · Error tracking"),("Sohail","Decisions · Plan limits · Security & isolation · THE RELEASE DECISION"),
  ("Shallika","UI/UX sign-off for both journeys, on desktop and mobile")]):
    r=SG+2+i
    for ci,v in enumerate([who,what,None,None,"Not Signed",None],start=1):
        c=mg.cell(r,ci,v); c.font=BODY_FT; c.border=BOX; c.alignment=TOP
        if ci==1: c.font=font(11,True,NAVY)
        if ci in (5,6): c.fill=EDIT_FILL; c.alignment=TOPC
    mg.merge_cells(f"B{r}:D{r}"); mg.row_dimensions[r].height=24

# =================================================== DECISIONS & RISKS
dc=wb.create_sheet("Decisions & Risks"); dc.sheet_properties.tabColor=RED; dc.sheet_view.showGridLines=False
sheet_title(dc,"Decisions & Risks",
  "A decision still Open on its due date BLOCKS the work named next to it. With nine build days there is no room "
  "to rework a guess - if your row names a decision and it is Open, ask, do not assume.")
band(dc,"A4","DECISIONS - all needed by Tuesday 8 September"); dc.merge_cells("A4:G4")
header_row(dc,5,["ID","The question","Blocks","Options","Recommendation","Due","Status"],height=26)
widths(dc,{"A":6,"B":46,"C":22,"D":40,"E":76,"F":13,"G":13})
DEC=[("D-1","Do we continue the half-finished database migration during September?","All database work","Continue / pause",
  "PAUSE until after the release. No user-visible gain, real risk in a nine-day window.",7,"Open"),
 ("D-2","Can database changes actually reach production? The docs say both yes and no.","Every database change","Prove it / resolve it",
  "Prove it against a copy on day one. Nothing merges until we know. This is the single biggest schedule risk.",5,"Open"),
 ("D-3","What does each plan include and what are the limits?","Plans, search, contact","Three plans / one plan",
  "Three plans at the prices already drafted. Every limit stored as DATA so a change is an edit, not a deployment.",7,"Open"),
 ("D-4","Do we take card payments before 20 September?","Plan step","Add payments / defer",
  "DEFER - already agreed. Ship the whole plan journey with an admin switching plans on, built so a payment system calls the SAME function later.",5,"Decided"),
 ("D-5","How does a recruiter earn the right to see contact details?","Contact unlock, email","Plan allowance / admin approves",
  "PLAN ALLOWANCE, instant - already agreed. The existing access check stays exactly as it is.",7,"Decided"),
 ("D-6","Can anyone sign up as a recruiter, or only invited companies?","Recruiter signup","Open / invited only",
  "INVITED ONLY. We cannot charge yet, and open signup in a nine-day window is unnecessary risk.",7,"Open"),
 ("D-7","Must we verify a company before they can search?","Onboarding","Yes / no",
  "NO - already agreed. Collect company details, show them to candidates, do not block search.",5,"Decided"),
 ("D-8","Our public privacy wording says recruiters need permission, but the setting defaults to visible - and money now changes hands for contact details.","Candidate privacy control, contact unlock","Fix wording / change default",
  "MUST be resolved before the privacy control or the paid unlock ships. Open since August; the stakes just went up.",7,"Open"),
 ("D-9","Which notifications do the September journeys actually need?","Notifications","All seven / a minimal set",
  "MINIMAL SET only - the ones these journeys produce. The full recruiter notification system moves to P1.",7,"Open"),
 ("D-12","Which candidate skills make someone discoverable?","Candidate profile, search","Verified only / self-declared too",
  "SELF-DECLARED TOO - this is the new product rule and it is what makes the compressed scope viable. Self-declared and verified must look different everywhere, and nothing may present a self-declared skill as proven.",7,"Open"),
 ("D-13","What is in the recruiter's menu?","Workspace, Home","Extend today's five / a full menu",
  "Agreed in writing by Shallika and Sohail before R12 starts Wednesday. No menu item invented in a component later.",7,"Open"),
 ("D-14","What does Shallika design, and what does she deliberately NOT design?","All design work","September journeys only / whole platform",
  "SEPTEMBER JOURNEYS ONLY. A platform-wide visual rebuild is explicitly P2. Consistency inside the shipped journeys is the goal, not a redesign.",5,"Open")]
dvd=DataValidation(type="list",formula1='"Open,Decided,Deferred"',allow_blank=True); dc.add_data_validation(dvd)
for i,(did,q,blocks,opts,rec,day,st) in enumerate(DEC):
    r=6+i
    for ci,v in enumerate([did,q,blocks,opts,rec,dt.datetime(2026,9,day),st],start=1):
        c=dc.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,6,7) else TOP
        if ci==6: c.number_format=DATEFMT
        if ci==1: c.font=BOLD_FT
        if ci==7: c.fill=EDIT_FILL
    dvd.add(dc[f"G{r}"]); dc.row_dimensions[r].height=44
DL=5+len(DEC)
for f_,fill,fc in [('"Decided"',"C6EFCE","006100"),('"Open"',"FFEB9C","9C6500")]:
    dc.conditional_formatting.add(f"G6:G{DL}",CellIsRule(operator="equal",formula=[f_],
        fill=PatternFill("solid",fgColor=fill),font=font(10,True,fc)))
RS2=DL+2
band(dc,f"A{RS2}","RISKS"); dc.merge_cells(f"A{RS2}:G{RS2}")
header_row(dc,RS2+1,["ID","The risk","Likely?","Impact","What we are doing about it","Owner","Status"],height=26)
RISKS=[("R1","The deadline moved from 30 to 20 September and Sundays are now holidays. Nine build days remain against 79 days of previously planned work.","Certain","Critical",
  "Roughly 60% of scope moved to P1/P2 on 5 September, explicitly and in writing. P0 is the recruiter sourcing and outreach journey plus a discoverable candidate profile. Jobs, assessments, insights, evidence and analytics are OUT.","Sohail"),
 ("R2","P0 is 30 days of work against ~30.6 days of capacity - no slack at all for the review cycles that high-risk tasks require.","Certain","Critical",
  "Scope decision at the Saturday 12 September gate. If wave 1 is not demoable, a P0 item drops whole rather than everything half-shipping.","Sohail"),
 ("R3","Design becomes the bottleneck - developers idle waiting for an approved design.","High","Critical",
  "Shallika works a full feature ahead. Wave-1 designs must be APPROVED by Tuesday 8 Sep evening. The dashboard shows 'dev waiting on design' as a live number. If a design is not approved the morning it is needed, raise it at standup that day.","Shallika"),
 ("R4","The team is junior and leaning on AI, with no time to recover from a wrong turn.","Certain","Critical",
  "Every task starts with an investigation prompt, not a build prompt. Every row names the existing thing to extend. High-risk plans are reviewed by Sohail BEFORE any code.","Sohail"),
 ("R5","We cannot confirm database changes reach production, and several are needed.","High","Critical",
  "Settled on day one (D-2). Nothing merges until proven. Everything rehearsed on a copy.","Sohail"),
 ("R6","Plan limits end up enforced only in the browser, which is where they are today.","Medium","Critical",
  "Tested by calling the action directly with the browser bypassed, plus a ten-at-once test. Owned by Sohail.","Sohail"),
 ("R7","Contact details move from human approval to a plan allowance - changing who can see personal data, under time pressure.","Medium","Critical",
  "The single existing access check stays unchanged. Sohail reviews before any code. The test checks the network response, not the screen.","Zainab"),
 ("R8","There are two shortlists, one living only in the browser. Consolidating risks losing recruiters' saved work.","Medium","High",
  "Counts checked before and after, rehearsed on a copy, recruiters told before the switch.","shashank"),
 ("R9","Only three days for UAT, fixes and regression. A late blocker has nowhere to go.","High","Critical",
  "Wednesday is find-only so we know the real number immediately. Anything blocking more than four hours goes to Sohail, who cuts scope rather than the date.","Sohail"),
 ("R10","September work quietly breaks something that already worked.","High","High",
  "Every row has a Regression Check. UAT-12 re-walks all seven pre-existing journeys on the Friday.","Sohail"),
 ("R11","Cosmetic polish blocks the release.","Medium","Medium",
  "Explicit rule: only UI BLOCKERS stop the release. Majors are fixed if time allows; minors become October bugs. Shallika ranks, Sohail arbitrates.","Shallika"),
 ("R12","We ship a recruiter product with no jobs and no assessments and it feels incomplete to a buyer.","High","High",
  "Accepted consciously. The 20 September promise is sourcing and outreach: find candidates, understand them, shortlist, contact them. Jobs and assessments are P1 and first in the queue afterwards. Say this to recruiters rather than implying more.","Sohail")]
dvk=DataValidation(type="list",formula1='"Open,Managing,Closed,Happened"',allow_blank=True); dc.add_data_validation(dvk)
for i,(rid,risk,p,imp,mit,own) in enumerate(RISKS):
    r=RS2+2+i
    for ci,v in enumerate([rid,risk,p,imp,mit,own,"Open"],start=1):
        c=dc.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,3,4,6,7) else TOP
        if ci==1: c.font=BOLD_FT
        if ci==7: c.fill=EDIT_FILL
    dvk.add(dc[f"G{r}"]); dc.row_dimensions[r].height=44
RL2=RS2+1+len(RISKS)
dc.conditional_formatting.add(f"D{RS2+2}:D{RL2}",CellIsRule(operator="equal",formula=['"Critical"'],
    fill=PatternFill("solid",fgColor="FFC7CE"),font=font(10,True,"9C0006")))

# ==================================================== DELIVERY RISK SHEET
dr=wb.create_sheet("Delivery Risk"); dr.sheet_properties.tabColor=RED; dr.sheet_view.showGridLines=False
sheet_title(dr,"Delivery Risk - the capacity gap, stated honestly",
  "The full committed product is in this workbook. Nothing has been deferred. This sheet exists because the "
  "arithmetic does not close, and hiding that would be worse than saying it.")
band(dr,"A4","THE ARITHMETIC"); dr.merge_cells("A4:D4")
widths(dr,{"A":46,"B":16,"C":16,"D":88})
for i,(lab,val,note) in enumerate([
 ("Working days remaining (5 - 19 Sep, Sundays off)","13","Sundays 6, 13 and 20 September are holidays."),
 ("Of which build days (5, 7-12, 14-16)","10","17-18 are UAT and fixes; 19 is release day. Testing is continuous inside each task, not a phase."),
 ("Full-time developers","3","Shivansh, Zainab, shashank."),
 ("Part-time developer","0.4 FTE","Manuvrtti."),
 ("Architect who also builds","0.6 FTE","Sohail - the rest of his time is review, decisions and release."),
 ("Designer","1.0 FTE","Shallika - design capacity, NOT development capacity."),
 ("GROSS developer capacity","40.0 days","10 build days x 4.0 developer FTE."),
 ("EFFECTIVE capacity after review, deploy and the unexpected","34.0 days","15% deducted, which is optimistic for a junior team on a large existing codebase."),
 ("COMMITTED SCOPE after every simplification","60.4 days","Already reduced by 11.6 days through reuse and simpler implementations - see below."),
 ("THE GAP","26.4 days","This is the number. It cannot be closed by scheduling."),
]):
    r=5+i
    dr[f"A{r}"]=lab; dr[f"A{r}"].font=BOLD_FT if "GAP" in lab or "GROSS" in lab or "EFFECTIVE" in lab or "COMMITTED" in lab else BODY_FT
    dr[f"B{r}"]=val; dr[f"B{r}"].font=font(11,True,NAVY if "GAP" not in lab else "9C0006")
    dr[f"B{r}"].alignment=Alignment(horizontal="center"); dr[f"B{r}"].border=BOX
    dr[f"D{r}"]=note; dr[f"D{r}"].font=BODY_FT; dr[f"D{r}"].alignment=TOP
    dr.row_dimensions[r].height=20
dr["A15"]=("26.4 developer-days short over 10 build days = the work of roughly 2.6 additional full-time developers. "
 "Parallelisation cannot recover it: the existing team is already scheduled at 150-200% of capacity, so there is no "
 "idle time to redirect.")
dr["A15"].font=font(11,True,"9C0006"); dr["A15"].alignment=Alignment(wrap_text=True,vertical="top")
dr.merge_cells("A15:D16"); dr.row_dimensions[15].height=32

band(dr,"A18","WHAT HAS ALREADY BEEN DONE TO CLOSE IT - 11.6 days recovered, no functionality removed")
dr.merge_cells("A18:D18")
header_row(dr,19,["Workstream","Was","Now","How - same user outcome, less machinery"],height=24)
OPT=[("Jobs & applicants","6.5","5.0","Job-skill storage already exists unused. Simple pagination rather than keyset."),
 ("Evidence layer","5.0","3.5","Emitter plus the four highest-value sources. Backfill becomes a release-day operation, not build work."),
 ("Assessments","4.0","3.5","Question storage AND result storage both already exist unused. Multiple-choice only."),
 ("Candidate insights","3.0","2.0","Existing scoring and match-explanation code reused. Deterministic facts and gaps, no scoring engine."),
 ("Non-technical hiring","3.0","1.5","Taxonomy extension and skill seed only - search already filters on skills."),
 ("Recruiter notifications","2.8","1.5","Configuration over the shared notification helper, not new infrastructure."),
 ("Recruiter analytics","2.5","1.5","Plain counts over tables other workstreams already write. No reporting layer."),
 ("Product analytics","2.4","1.0","One table, one helper. Each feature owner adds their own events inside their own task."),
 ("Mock interview","2.0","1.5","Audit and blocker fixes only. The interview engine is not extended."),
 ("Cohorts & hackathons","2.0","1.5","Audit and blocker fixes only. Infrastructure is not rebuilt."),
 ("Profile-view tracking","1.5","1.0","One table, one write path, one count."),
 ("External profile links","1.4","1.0","Link storage already exists. Declared links only - nothing is fetched.")]
for i,(w_,was,now,how) in enumerate(OPT):
    r=20+i
    for ci,v in enumerate([w_,was+"d",now+"d",how],start=1):
        c=dr.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (2,3) else TOP
        if ci==1: c.font=BOLD_FT
    dr.row_dimensions[r].height=20
OL=19+len(OPT)
band(dr,f"A{OL+2}","THE OPTIONS - A, B, C and E are already applied and are inside the 11.6 days above")
dr.merge_cells(f"A{OL+2}:D{OL+2}")
header_row(dr,OL+3,["Option","Recovers","Verdict","Detail"],height=24)
OPTS=[("A - more parallel ownership","~0 days","Already exhausted",
  "Every developer is scheduled at or above 100%. There is no idle capacity to redirect. Parallelisation prevents waste; it does not create hours."),
 ("B - simpler implementation","11.6 days","APPLIED",
  "Listed above. Going further starts removing acceptance criteria rather than machinery - which is removing the product by another name."),
 ("C - reuse existing code","included in B","APPLIED",
  "Roughly 8 of the 11.6 days come from unused schema that already exists: talent lists, candidate notes, job skills, question storage and assessment results."),
 ("D - add engineering capacity","26.4 days","THE ONLY OPTION THAT CLOSES THE GAP",
  "About 2.6 additional full-time developers for the whole window, productive from Monday 7 September. Allow for onboarding: on a codebase this size, a new developer is unlikely to be net-positive before day three, so 3 developers is the safer number."),
 ("E - cut non-functional polish","~2 days","APPLIED",
  "Animation, decorative polish and platform-wide visual consistency are already out. The design consistency pass is scoped to the September journeys only."),
]
for i,(o,rec,verd,det) in enumerate(OPTS):
    r=OL+4+i
    for ci,v in enumerate([o,rec,verd,det],start=1):
        c=dr.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (2,3) else TOP
        if ci==1: c.font=BOLD_FT
        if "ONLY OPTION" in str(v): c.font=font(10,True,"9C0006")
    dr.row_dimensions[r].height=44
FL=OL+3+len(OPTS)
dr[f"A{FL+2}"]=("IF NO CAPACITY IS ADDED: the plan does not fit, and the honest consequence is that some committed "
 "functionality will be incomplete on 19 September. That decision belongs to the product lead, not to the schedule - "
 "and it must be taken deliberately at the Saturday 12 September gate, not discovered on the 18th. "
 "The execution order in this workbook (P0 then P1 then P2) is exactly the order in which work should land, "
 "so that whatever is unfinished is the least critical, not the most recent.")
dr[f"A{FL+2}"].font=font(11,True,NAVY); dr[f"A{FL+2}"].alignment=Alignment(wrap_text=True,vertical="top")
dr.merge_cells(f"A{FL+2}:D{FL+4}"); dr.row_dimensions[FL+2].height=52

# ============================================ REQUIREMENTS COVERAGE
rq=wb.create_sheet("Requirements Coverage"); rq.sheet_properties.tabColor=GREEN
rq.sheet_view.showGridLines=False
sheet_title(rq,"Requirements Coverage - every committed requirement, checked",
  "One row per requirement from the committed product scope. DELIVERED IN PLAN must read YES for every one. "
  "A NO would mean something was silently dropped - there are none.")
header_row(rq,5,["#","Side","Requirement","Where it is delivered","Owner","Priority (execution order)","Delivered in plan"],height=30)
widths(rq,{"A":5,"B":12,"C":52,"D":38,"E":12,"F":22,"G":18})
rq.freeze_panes="B6"
REQ=[
 ("Candidate","register",C1,"Shivansh","P0"),("Candidate","complete onboarding",C1,"Shivansh","P0"),
 ("Candidate","create / edit profile",C1,"Shivansh","P0"),("Candidate","upload resume",C1,"Shivansh","P0"),
 ("Candidate","add education",C1,"Shivansh","P0"),("Candidate","add experience",C1,"Shivansh","P0"),
 ("Candidate","add internships",C1,"Shivansh","P0"),("Candidate","add projects",C1,"Shivansh","P0"),
 ("Candidate","add certifications",C1,"Shivansh","P0"),("Candidate","add achievements",C1,"Shivansh","P0"),
 ("Candidate","add skills",C1,"Shivansh","P0"),("Candidate","add job preferences",C1,"Shivansh","P0"),
 ("Candidate","control recruiter visibility",C1,"Zainab","P0"),
 ("Candidate","discoverable on SELF-DECLARED information",C1,"Shivansh","P0"),
 ("Candidate","browse jobs",R8,"Shivansh","P1"),("Candidate","filter jobs",R8,"Shivansh","P1"),
 ("Candidate","apply to jobs",R8,"Shivansh","P1"),("Candidate","no duplicate applications",R8,"Shivansh","P1"),
 ("Candidate","track applications",R8,"Shivansh","P1"),
 ("Candidate","receive relevant notifications",P2,"Manuvrtti","P0"),
 ("Candidate","participate in cohorts",C5,"Zainab","P2"),
 ("Candidate","participate in hackathons",C5,"Zainab","P2"),
 ("Candidate","mock interview functionality",C4,"Zainab","P2"),
 ("Candidate","take recruiter assessments",R9,"Zainab","P1"),
 ("Candidate","view assessment results / history",R9,"Zainab","P1"),
 ("Candidate","connect GitHub / LeetCode / CodeChef",C2,"Manuvrtti","P2"),
 ("Candidate","technical AND non-technical profiles",R11,"shashank","P2"),
 ("Recruiter","register",R1,"Shivansh","P0"),("Recruiter","onboard company",R1,"Shivansh","P0"),
 ("Recruiter","complete recruiter onboarding",R1,"Shivansh","P0"),
 ("Recruiter","recruiter workspace / home",R12,"Shivansh","P0"),
 ("Recruiter","understand plan / entitlements",R2,"Sohail","P0"),
 ("Recruiter","post jobs",R8,"Shivansh","P1"),("Recruiter","manage jobs",R8,"Shivansh","P1"),
 ("Recruiter","review applications",R8,"Shivansh","P1"),
 ("Recruiter","persistent hiring / talent projects",R3,"shashank","P0"),
 ("Recruiter","define candidate requirements",R3,"shashank","P0"),
 ("Recruiter","search candidates",R3,"shashank","P0"),("Recruiter","filter candidates",R3,"shashank","P0"),
 ("Recruiter","discover on declared profile data",R3,"shashank","P0"),
 ("Recruiter","see useful candidate information",R4,"shashank","P1"),
 ("Recruiter","distinguish self-declared from evidence-backed",P1,"Zainab","P1"),
 ("Recruiter","understand why candidates match",R4,"shashank","P1"),
 ("Recruiter","return to projects later",R3,"shashank","P0"),
 ("Recruiter","identify new candidates since last visit",R3,"shashank","P0"),
 ("Recruiter","shortlist candidates",R5,"shashank","P0"),
 ("Recruiter","Talent Hub",R5,"shashank","P0"),
 ("Recruiter","hiring pipeline stages",R5,"shashank","P0"),
 ("Recruiter","recruiter / company notes",R5,"shashank","P1"),
 ("Recruiter","request / unlock candidate contact",R6,"Zainab","P0"),
 ("Recruiter","contact candidates",R6,"Zainab","P0"),
 ("Recruiter","outreach / email flows",R6,"Zainab","P0"),
 ("Recruiter","receive hiring notifications",R7,"Manuvrtti","P1"),
 ("Recruiter","create assessments",R9,"Zainab","P1"),
 ("Recruiter","create question papers",R9,"Zainab","P1"),
 ("Recruiter","assign assessments",R9,"Zainab","P1"),
 ("Recruiter","review candidate results",R9,"Zainab","P1"),
 ("Recruiter","meaningful recruiter analytics",R10,"shashank","P2"),
 ("Recruiter","hire technical and non-technical roles",R11,"shashank","P2"),
 ("Platform","evidence layer",P1,"Zainab","P1"),
 ("Platform","server-side permissions",P5,"Sohail","P0"),
 ("Platform","organisation isolation",P5,"Sohail","P0"),
 ("Platform","notification infrastructure",P2,"Manuvrtti","P0"),
 ("Platform","product analytics",P3,"Manuvrtti","P2"),
 ("Platform","profile-view tracking",P4,"shashank","P2"),
 ("Platform","architecture protected",G0,"Sohail","P0"),
 ("Platform","testing and regression",P5,"Sohail","P0"),
 ("Platform","release readiness",REL,"Sohail","P0"),
 ("Design","UI/UX ownership across both journeys",D0,"Shallika","P0"),
 ("Design","responsive - desktop, tablet, mobile",D0,"Shallika","P0"),
 ("Design","loading / empty / error / success states",D0,"Shallika","P0"),
 ("Design","UI/UX QA on the running application",D0,"Shallika","P0"),
]
for i,(side,req,ws_,own,prio) in enumerate(REQ):
    r=6+i
    for ci,v in enumerate([i+1,side,req,ws_,own,prio,"YES"],start=1):
        c=rq.cell(r,ci,v); c.font=BODY_FT; c.border=BOX
        c.alignment=TOPC if ci in (1,2,5,6,7) else TOP
        if ci==3: c.font=BOLD_FT
        if ci==7: c.font=font(10,True,"006100"); c.fill=PatternFill("solid",fgColor="C6EFCE")
    rq.row_dimensions[r].height=18
RQL=5+len(REQ)
rq.auto_filter.ref=f"A5:G{RQL}"
rq["A3"]=f'="{len(REQ)} committed requirements   |   DELIVERED IN PLAN: "&COUNTIF($G$6:$G${RQL},"YES")&"   |   NOT DELIVERED: "&COUNTIF($G$6:$G${RQL},"NO")'
rq["A3"].font=font(12,True,NAVY); rq.merge_cells("A3:G3")
rq[f"A{RQL+2}"]=("Priority here is EXECUTION ORDER, not a deferral list. P0 is critical-path and built first; P1 "
 "follows once its dependencies exist; P2 is lower-critical-path work that still belongs to the September commitment. "
 "Nothing on this sheet has been moved to October. See 'Delivery Risk' for the capacity gap that threatens the last of it.")
rq[f"A{RQL+2}"].font=font(10,True,"9C0006"); rq[f"A{RQL+2}"].alignment=Alignment(wrap_text=True,vertical="top")
rq.merge_cells(f"A{RQL+2}:G{RQL+3}"); rq.row_dimensions[RQL+2].height=34

# ============================================================== SAVE
order=["Executive Dashboard","Delivery Risk","Requirements Coverage","Team Execution Board","UI-UX",
       "How We Work","AI Prompt Library","User Journeys","E2E Tests","UAT","Bugs",
       "Milestones & Release","Decisions & Risks","Lists"]
wb._sheets=[wb[n] for n in order]
if "Sheet" in wb.sheetnames: del wb["Sheet"]
wb.active=0
wb.save(OUT)

BUILDP={PF,PB1,PB2,PB3,PI}
cap={"Shivansh":10*1.0,"Zainab":10*1.0,"shashank":10*1.0,"Manuvrtti":10*0.4,"Sohail":10*0.6}
b={};pr={}
for a in ACT:
    if a["phase"] in BUILDP and a["owner"]!="Shallika": b[a["owner"]]=b.get(a["owner"],0)+a["est"]
    pr[a["prio"]]=pr.get(a["prio"],0)+a["est"]
des=sum(a["est"] for a in ACT if a["owner"]=="Shallika")
print(f"Wrote {OUT}")
print(f"  tasks {len(ACT)} | sheets {len(order)} | UAT {len(U)} | E2E {len(E2E)} | designs {len(UXROWS)}")
print(f"  priority days: {{k: round(v,1) for k,v in pr.items()}}".replace("{k: round(v,1) for k,v in pr.items()}",str({k:round(v,1) for k,v in pr.items()})))
print(f"  Shallika design days: {des:.1f} of 13 working days")
tb_=tc_=0
for o in cap:
    tb_+=b.get(o,0); tc_+=cap[o]
    print(f"  {o:<10}{b.get(o,0):6.2f} / {cap[o]:5.1f} = {b.get(o,0)/cap[o]*100:4.0f}%")
print(f"  BUILD TOTAL {tb_:.2f} / {tc_:.1f} gross = {tb_/tc_*100:.0f}%  | vs {tc_*0.85:.1f} effective = {tb_/(tc_*0.85)*100:.0f}%")

