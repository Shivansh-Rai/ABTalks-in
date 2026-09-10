import importlib.util, io, contextlib, datetime as dt
spec=importlib.util.spec_from_file_location("bt","docs/plans/assets/112-build-tracker.py")
m=importlib.util.module_from_spec(spec)
with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(m)
ACT=list(m.ACT)
for i,a in enumerate(m.ACT): a["id"]=f"T-{i+1:03d}"
PEOPLE=["Shallika","Shivansh","Zainab","shashank","Manuvrtti","Sohail"]
SUN={6,13,20}
PH={5:("FOUNDATION","Decisions, contracts and finding out what already exists."),
 7:("FOUNDATION","Decisions close. Wave-1 designs must be approved by tomorrow evening."),
 8:("FOUNDATION","Go/no-go gate tonight."),
 9:("BUILD WAVE 1","The main build window opens. Continuous testing from today."),
 10:("BUILD WAVE 1",""),11:("BUILD WAVE 1",""),12:("BUILD WAVE 1","Wave 1 must be demoable tonight. Scope decision."),
 14:("BUILD WAVE 2","Last build day but one."),15:("BUILD WAVE 3",""),
 16:("BUILD WAVE 3","Last build day. Testing has been continuous throughout."),
 17:("UAT - FIND ONLY","Run every script. Fix nothing."),
 18:("FIX + REGRESSION + SIGN-OFF","Blockers, majors, regression, six signatures."),
 19:("RELEASE DAY","Go live and verify on production.")}
MILE={16:"**FEATURE FREEZE — 20:00 tonight.** All committed functionality must be implemented. After tonight: blocker fixes, integration fixes, UAT fixes, regression and release prep only. No scope expansion — and no committed feature quietly dropped.",
 8:"**GATE tonight.** Decisions closed · shared stubs merged · database path proven · **wave-1 designs APPROVED**. If designs are not approved, Wednesday's frontend work cannot start.",
 12:"**Wave 1 must be demoable on a preview tonight.** SCOPE DECISION: anything behind drops a P1 whole rather than half-shipping.",
 17:"**Find only.** Log every problem. Fix nothing today.",
 18:"**Six signatures tonight.** Zero blockers, zero majors, UI/UX signed off, regression clean.",
 19:"**GO LIVE.** Everyone verifies their own journeys on production. Sunday 20th is the deadline date — nobody works it."}
out=[];w=out.append
w("# 112-A — Daily Task Board · 5–19 September 2026")
w("")
w("> **Deadline: Sunday 20 September — which is a Sunday, so the product goes LIVE on Saturday 19 September.**")
w("> **Sundays 6, 13 and 20 September are HOLIDAYS. Nobody works them.**")
w("> 13 working days, of which 10 are build days. FULL committed scope is in this plan - nothing was deferred.")
w("")
w("## Before your first task")
w("")
w("1. **Investigate → Plan → Review → Implement → Test → Regression → Done.** Start every task with prompt **P1**, never P3.")
w("2. **Check your design first.** If your row has a Design dependency, confirm it is *Approved* on the UI-UX sheet before writing frontend code.")
w("3. **HIGH RISK means stop after the plan** and send it to Sohail. Do not start coding.")
w("4. **Do the Regression Check** — that is testing what you did *not* build.")
w("5. **Shallika reviews the running app**, not screenshots. Blockers get fixed; minor cosmetic issues become October bugs.")
w("")
w("| Person | Role | Load |")
w("|---|---|---|")
for p,r_,l in [("Shallika","UI/UX Designer — full time, no code","105% of design days"),
 ("Shivansh","Developer — full time","154%"),("Zainab","Developer — full time","148%"),
 ("shashank","Developer — full time","145%"),("Manuvrtti","Developer — part time","165%"),
 ("Sohail","Architect + builder + release","152%")]:
    w(f"| **{p}** | {r_} | {l} |")
w("")
w("> **Everyone is scheduled at ~150% of capacity.** This is stated, not hidden — see Delivery Risk at the end. Build in priority order so that whatever slips is the least critical work.")
w("")
w("---");w("")
for day in range(5,21):
    date=dt.date(2026,9,day)
    if day in SUN:
        w(f"## {date.strftime('%A %d %B')} — HOLIDAY")
        w("")
        w("> No work. No development, design, QA, review or testing." + ("  \n> **This is the stated deadline date. The product has been live and verified since Saturday.**" if day==20 else ""))
        w("");w("---");w("");continue
    ph,note=PH.get(day,("",""))
    w(f"## {date.strftime('%A %d %B')} — {ph}")
    w("")
    if note: w(f"*{note}*");w("")
    if day in MILE: w(f"> {MILE[day]}");w("")
    for p in PEOPLE:
        td=[a for a in ACT if a["owner"]==p and a["s"]<=day<=a["e"]]
        if not td: continue
        w(f"### {p}" + (" · *designer*" if p=="Shallika" else ""))
        w("")
        for a in td:
            span=f" *(day {day-a['s']+1} of {a['e']-a['s']+1})*" if a["e"]>a["s"] else ""
            flag={"HIGH":"🔴 HIGH RISK","MEDIUM":"🟡 MEDIUM","LOW":"🟢 LOW"}[a["risk"]]
            w(f"- [ ] `{a['id']}` **{a['story']}**{span}")
            w(f"    - **{flag}** · {a['prio']}" + (f" · waits on {a['dec']}" if a["dec"]!="-" else ""))
            if a["ddep"]!="-": w(f"    - **🎨 {a['ddep']}**")
            w(f"    - **What needs to work:** {a['goal']}")
            if a["current"]: w(f"    - **Find out first:** {a['current']}")
            if a["prompt"] not in ("-","n/a"): w(f"    - **Prompts:** {a['prompt']}")
            if a["manual"]: w(f"    - **Manual test:** {a['manual']}")
            w(f"    - **Done when:** {a['acc']}")
            if a["regress"] and not a["regress"].startswith(("None","n/a")):
                w(f"    - **Regression check:** {a['regress']}")
            if a["risk"]=="HIGH": w(f"    - **⛔ {a['reviewer']}**")
        w("")
    w("---");w("")
w("# DELIVERY RISK - read this")
w("")
w("The full committed product is in this plan. Nothing was deferred. But the arithmetic does not close:")
w("")
w("| | Days |")
w("|---|---|")
w("| Committed scope, after every simplification | **60.4** |")
w("| Capacity: 10 build days x 4.0 developer FTE, less overhead | **34.0** |")
w("| **Gap** | **26.4 developer-days** |")
w("")
w("That is roughly **2.6 additional full-time developers** for the whole window. Parallelisation cannot recover it - everyone is already scheduled at ~150%.")
w("")
w("**Priority here is EXECUTION ORDER, not a deferral list.** Build P0 first, then P1, then P2 — so that if something is unfinished on the 19th it is the least critical work, not the most recent. That call belongs to the product lead at the Saturday 12 September gate, not to whoever runs out of time.")
w("")
open("docs/plans/112-A-daily-task-board.md","w").write("\n".join(out)+"\n")
print("daily board:",len(out),"lines")
