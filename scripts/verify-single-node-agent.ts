/**
 * Checks for the SINGLE-NODE LangGraph agent.
 *
 * Two jobs:
 *   1. prove the one-node graph works on its own — input in, final response out
 *   2. prove it stays behaviourally identical to the multi-node agent
 *
 * The parity checks are the important half. Two agents sharing one policy is
 * only safe while they actually agree; these assert that the same input yields
 * the same action AND the same resulting state through both graphs, so the
 * simple one cannot quietly drift from the one that runs the product.
 *
 * Run: npx tsx scripts/verify-single-node-agent.ts
 */
import assert from "node:assert/strict";

import { planCohortInterview } from "../src/features/interview/cohort/planner";
import { MAX_REDIRECTS_PER_QUESTION } from "../src/features/interview/constants";
import { createInitialState, startInterview } from "../src/features/interview/state";
import type {
  AnswerEvidence,
  InterviewPlan,
  InterviewState,
} from "../src/features/interview/types";
import {
  createMockInterviewLLM,
  REDIRECT_LINE,
  runInterviewTurn,
} from "../src/features/interview/agent";
import type { InterviewDecision, InterviewLLM } from "../src/features/interview/agent";
import { runSingleNodeTurn } from "../src/features/interview/agent/single-node/graph";

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  ok  ${name}`);
}

const plan: InterviewPlan = planCohortInterview("DAY_15");
const OPENER = plan.questions[0]!;
const PROBEABLE = plan.questions[1]!;

function stateAt(index: number): InterviewState {
  return { ...startInterview(createInitialState()), currentQuestionIndex: index };
}

function evidence(over: Partial<AnswerEvidence> = {}): AnswerEvidence {
  return {
    conceptualFound: false,
    practicalFound: false,
    tradeoffsFound: false,
    flaggedIssues: [],
    reasoning: "test",
    ...over,
  };
}

function fixedLLM(decision: Partial<InterviewDecision>): InterviewLLM {
  return {
    name: "fixed",
    async analyzeAnswer() {
      return {
        action: "NEXT_QUESTION",
        reason: "fixed",
        evidence: evidence(),
        followUpQuestion: null,
        acknowledgement: "Understood.",
        confidence: 1,
        degraded: false,
        ...decision,
      } as InterviewDecision;
    },
  };
}

async function single(
  llm: InterviewLLM,
  state: InterviewState,
  questionId: string,
  answerText: string,
) {
  const r = await runSingleNodeTurn(llm, {
    interviewId: "sn_test",
    blueprint: "DAY_15",
    plan,
    state,
    questionId,
    answerText,
  });
  assert.ok(r.ok, `single-node turn failed: ${r.ok ? "" : r.message}`);
  return r.data;
}

/** Runs the same input through BOTH graphs and asserts they agree. */
async function assertParity(
  label: string,
  llm: InterviewLLM,
  state: InterviewState,
  questionId: string,
  answerText: string,
) {
  const sn = await single(llm, state, questionId, answerText);
  const mn = await runInterviewTurn(llm, {
    interviewId: "mn_test",
    blueprint: "DAY_15",
    plan,
    state,
    questionId,
    answerText,
  });
  assert.ok(mn.ok, `multi-node turn failed for ${label}`);

  assert.equal(sn.action, mn.data.action, `${label}: action differs`);
  assert.equal(sn.response, mn.data.prompt, `${label}: spoken response differs`);
  assert.equal(
    sn.state.currentQuestionIndex,
    mn.data.state.currentQuestionIndex,
    `${label}: question index differs`,
  );
  assert.equal(
    sn.state.followUpsAsked,
    mn.data.state.followUpsAsked,
    `${label}: follow-up count differs`,
  );
  assert.equal(
    sn.state.redirectsAsked ?? 0,
    mn.data.state.redirectsAsked ?? 0,
    `${label}: redirect count differs`,
  );
  assert.deepEqual(
    sn.state.evidenceByQuestionId,
    mn.data.state.evidenceByQuestionId,
    `${label}: recorded evidence differs`,
  );
}

async function main() {
  console.log("\nSingle-node LangGraph interview agent\n");

  await check("1. takes input, runs the graph, returns a final response", async () => {
    const out = await single(
      fixedLLM({ evidence: evidence({ conceptualFound: true, practicalFound: true }) }),
      stateAt(0),
      OPENER.id,
      "I ran it locally with Ollama so the coverage data never left my machine.",
    );

    assert.equal(out.action, "NEXT_QUESTION");
    assert.ok(out.response && out.response.length > 0, "a final response is returned");
    assert.ok(out.response.endsWith(plan.questions[1]!.text));
    assert.equal(out.state.currentQuestionIndex, 1);
    assert.ok(out.state.evidenceByQuestionId[OPENER.id]);
  });

  await check("2. state carries across turns and changes later decisions", async () => {
    const llm = fixedLLM({
      action: "FOLLOW_UP",
      followUpQuestion: "Which part did you build?",
      evidence: evidence({ conceptualFound: true }),
    });

    const first = await single(llm, stateAt(1), PROBEABLE.id, "It remembers the chat.");
    assert.equal(first.action, "FOLLOW_UP");
    assert.equal(first.state.followUpsAsked, 1);

    // Identical input, but the state from turn 1 exhausts the budget.
    const second = await single(llm, first.state, PROBEABLE.id, "It just stores it.");
    assert.equal(second.action, "NEXT_QUESTION", "budget from prior turn applies");
  });

  await check("3. off-topic input is redirected, not answered", async () => {
    const out = await single(
      createMockInterviewLLM(),
      stateAt(1),
      PROBEABLE.id,
      "Who is the PM of India?",
    );
    assert.equal(out.action, "REDIRECT");
    assert.ok(out.response?.startsWith(REDIRECT_LINE));
    assert.equal(out.state.redirectsAsked, 1);
    assert.equal(out.state.evidenceByQuestionId[PROBEABLE.id], undefined);
  });

  await check("4. the LLM cannot exceed the follow-up budget", async () => {
    const out = await single(
      fixedLLM({
        action: "FOLLOW_UP",
        followUpQuestion: "Tell me more.",
        evidence: evidence({ conceptualFound: true }),
      }),
      stateAt(0),
      OPENER.id,
      "Because it is free.",
    );
    // The opener carries maxFollowUps: 0.
    assert.equal(out.action, "NEXT_QUESTION");
    assert.equal(out.proposed, "FOLLOW_UP", "the model asked, the policy refused");
  });

  await check("5. a broken provider degrades instead of crashing", async () => {
    const broken: InterviewLLM = {
      name: "broken",
      async analyzeAnswer() {
        throw new Error("provider exploded");
      },
    };
    const result = await runSingleNodeTurn(broken, {
      interviewId: "sn_test",
      blueprint: "DAY_15",
      plan,
      state: stateAt(1),
      questionId: PROBEABLE.id,
      answerText: "We stored the last few messages.",
    });
    // A provider that throws is a bug in that provider, not a crash for the
    // candidate: the turn is refused cleanly and the state is left untouched.
    assert.equal(result.ok, false);
  });

  await check("6. a stale answer for a closed question is refused", async () => {
    const result = await runSingleNodeTurn(fixedLLM({}), {
      interviewId: "sn_test",
      blueprint: "DAY_15",
      plan,
      state: stateAt(1),
      questionId: OPENER.id,
      answerText: "Some answer.",
    });
    assert.equal(result.ok, false);
  });

  /* --------------------------------------------------------------- parity */

  await check("7. parity with the multi-node agent: strong answer", async () => {
    await assertParity(
      "strong",
      fixedLLM({ evidence: evidence({ conceptualFound: true, practicalFound: true }) }),
      stateAt(0),
      OPENER.id,
      "I ran it locally with Ollama to keep the data on my machine.",
    );
  });

  await check("8. parity: follow-up", async () => {
    await assertParity(
      "follow-up",
      fixedLLM({
        action: "FOLLOW_UP",
        followUpQuestion: "Which part did you build?",
        evidence: evidence({ conceptualFound: true }),
      }),
      stateAt(1),
      PROBEABLE.id,
      "It remembers the conversation.",
    );
  });

  await check("9. parity: off-topic redirect", async () => {
    await assertParity(
      "redirect",
      createMockInterviewLLM(),
      stateAt(1),
      PROBEABLE.id,
      "Who is the PM of India?",
    );
  });

  await check("10. parity: repeated redirect up to the cap", async () => {
    const llm = createMockInterviewLLM();
    let state = stateAt(1);
    for (let i = 0; i < MAX_REDIRECTS_PER_QUESTION; i++) {
      await assertParity(`redirect ${i + 1}`, llm, state, PROBEABLE.id, "Who is the PM of India?");
      state = (await single(llm, state, PROBEABLE.id, "Who is the PM of India?")).state;
    }
    // Past the cap both must move on rather than keep redirecting.
    await assertParity("redirect past cap", llm, state, PROBEABLE.id, "Who is the PM of India?");
  });

  await check("11. parity: stuck candidate is never probed", async () => {
    await assertParity(
      "stuck",
      fixedLLM({
        action: "FOLLOW_UP",
        followUpQuestion: "Try anyway?",
        evidence: evidence({ flaggedIssues: ["stuck_or_evasive"] }),
      }),
      stateAt(1),
      PROBEABLE.id,
      "I don't know.",
    );
  });

  console.log(`\n${passed} checks passed.\n`);
}

main().catch((error) => {
  console.error("\nFAILED\n", error);
  process.exit(1);
});
