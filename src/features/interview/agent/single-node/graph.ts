import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { logger } from "@/lib/logger";
import type { InterviewBlueprintKey } from "@/features/interview/cohort/blueprint";
import { mergeEvidence } from "@/features/interview/evidence";
import {
  advanceTurn,
  appendLine,
  getCurrentQuestion,
} from "@/features/interview/state";
import type {
  InterviewPlan,
  InterviewState,
  TurnAction,
} from "@/features/interview/types";
import {
  CLOSING_LINE,
  REDIRECT_LINE,
  REPEAT_LINE,
  resolveAcknowledgement,
  resolveFollowUpText,
  routeDecision,
} from "@/features/interview/agent/policy";
import type { AgentAction } from "@/features/interview/agent/types";
import type { InterviewLLM } from "@/features/interview/agent/llm/provider";

/**
 * The SINGLE-NODE LangGraph interview agent.
 *
 *   START -> interviewAgent -> END
 *
 * This is the canonical minimal LangGraph shape: one state schema, one node,
 * two edges, compiled and invoked. Everything the multi-node agent spreads
 * across nine nodes — admit the answer, call the model, apply the policy,
 * update the state, draft the reply — happens inside this one function.
 *
 * It is a SIBLING of `agent/graph.ts`, not a replacement. Both are kept
 * deliberately:
 *
 *   - this one is the smallest thing that can be called a LangGraph agent, and
 *     is the easiest to read end to end in one sitting
 *   - the multi-node one exposes each decision as a named node and edge, which
 *     is what makes the routing auditable and gives the executed-node trace
 *
 * They share `policy.ts`, `state.ts` and the provider seam, so they cannot
 * drift: `scripts/verify-single-node-agent.ts` asserts both produce the same
 * action and the same resulting state for the same input.
 *
 * The trade-off is the whole lesson. Collapsing to one node buys simplicity and
 * costs observability — the graph can no longer tell you WHICH branch ran,
 * because there is only one node to report.
 */

/** Same channel shape as the multi-node agent, minus the per-branch plumbing. */
const SingleNodeAnnotation = Annotation.Root({
  interviewId: Annotation<string>,
  blueprint: Annotation<InterviewBlueprintKey>,

  plan: Annotation<InterviewPlan>,
  interviewState: Annotation<InterviewState>,

  currentQuestionId: Annotation<string>,
  candidateAnswer: Annotation<string>,

  action: Annotation<AgentAction | null>,
  proposed: Annotation<string | null>,
  response: Annotation<string | null>,
  degraded: Annotation<boolean>,
  error: Annotation<string | null>,
});

type SingleNodeState = typeof SingleNodeAnnotation.State;

/**
 * The one node: user input in, final response out.
 *
 * Reads top to bottom as the interview turn actually happens — which is exactly
 * the readability argument for a single-node agent.
 */
function createInterviewAgentNode(llm: InterviewLLM) {
  return async function interviewAgent(
    state: SingleNodeState,
  ): Promise<Partial<SingleNodeState>> {
    /* 1. admit the answer ------------------------------------------------- */

    if (state.interviewState.status !== "IN_PROGRESS") {
      return { error: "This interview is not in progress." };
    }

    const question = getCurrentQuestion(state.plan, state.interviewState);
    if (!question) return { error: "No question is currently open." };
    if (question.id !== state.currentQuestionId) {
      return { error: "That answer is for a different question." };
    }

    let working = appendLine(
      state.interviewState,
      "candidate",
      state.candidateAnswer,
      question.id,
    );

    /* 2. ask the model ---------------------------------------------------- */

    const decision = await llm.analyzeAnswer({
      question,
      answerText: state.candidateAnswer,
      priorEvidence: working.evidenceByQuestionId[question.id] ?? null,
      followUpsRemaining: Math.max(
        0,
        (question.maxFollowUps ?? 0) - working.followUpsAsked,
      ),
      recentTranscript: working.transcript,
    });

    /* 3. apply the deterministic policy ----------------------------------- */

    const outcome = routeDecision(question, decision, {
      followUpsAsked: working.followUpsAsked,
      redirectsAsked: working.redirectsAsked ?? 0,
      repeatsAsked: working.repeatsAsked ?? 0,
    });

    logger.info("[single-node-agent] turn", {
      interviewId: state.interviewId,
      questionId: question.id,
      provider: llm.name,
      proposed: decision.action,
      applied: outcome.action,
      degraded: decision.degraded,
    });

    /* 4. update state and draft the reply --------------------------------- */

    // REDIRECT and REPEAT record no evidence and spend no budget: neither is an
    // answer, so neither may be scored as one.
    if (outcome.action === "REDIRECT" || outcome.action === "REPEAT") {
      const isRedirect = outcome.action === "REDIRECT";
      const response = `${isRedirect ? REDIRECT_LINE : REPEAT_LINE}\n\n${question.text}`;

      working = appendLine(
        {
          ...working,
          redirectsAsked: (working.redirectsAsked ?? 0) + (isRedirect ? 1 : 0),
          repeatsAsked: (working.repeatsAsked ?? 0) + (isRedirect ? 0 : 1),
        },
        "interviewer",
        response,
        question.id,
      );

      return {
        interviewState: working,
        action: outcome.action,
        proposed: decision.action,
        response,
        degraded: decision.degraded,
      };
    }

    const prior = working.evidenceByQuestionId[question.id];
    const proposedTurn: TurnAction =
      outcome.action === "FOLLOW_UP" ? "FOLLOW_UP" : "NEXT_QUESTION";

    const advanced = advanceTurn(
      state.plan,
      working,
      question.id,
      decision.evidence,
      proposedTurn,
    );

    working = prior
      ? {
          ...advanced.state,
          evidenceByQuestionId: {
            ...advanced.state.evidenceByQuestionId,
            [question.id]: mergeEvidence(prior, decision.evidence),
          },
        }
      : advanced.state;

    if (advanced.action === "FOLLOW_UP") {
      const response = resolveFollowUpText(question, decision) ?? question.text;
      working = appendLine(working, "interviewer", response, question.id);
      return {
        interviewState: working,
        action: "FOLLOW_UP",
        proposed: decision.action,
        response,
        degraded: decision.degraded,
      };
    }

    const next =
      advanced.action === "END_INTERVIEW"
        ? null
        : getCurrentQuestion(state.plan, working);

    if (!next) {
      working = appendLine(
        { ...working, status: "COMPLETED" },
        "interviewer",
        CLOSING_LINE,
        null,
      );
      return {
        interviewState: working,
        action: "COMPLETE",
        proposed: decision.action,
        response: CLOSING_LINE,
        degraded: decision.degraded,
      };
    }

    const response = `${resolveAcknowledgement(decision, question.order)}\n\n${next.text}`;
    working = appendLine(working, "interviewer", response, next.id);

    return {
      interviewState: working,
      currentQuestionId: next.id,
      action: "NEXT_QUESTION",
      proposed: decision.action,
      response,
      degraded: decision.degraded,
    };
  };
}

/** START -> interviewAgent -> END. The whole graph. */
export function buildSingleNodeGraph(llm: InterviewLLM) {
  return new StateGraph(SingleNodeAnnotation)
    .addNode("interviewAgent", createInterviewAgentNode(llm))
    .addEdge(START, "interviewAgent")
    .addEdge("interviewAgent", END)
    .compile();
}

const compiled = new WeakMap<
  InterviewLLM,
  ReturnType<typeof buildSingleNodeGraph>
>();

function graphFor(llm: InterviewLLM) {
  const existing = compiled.get(llm);
  if (existing) return existing;
  const graph = buildSingleNodeGraph(llm);
  compiled.set(llm, graph);
  return graph;
}

export type SingleNodeTurnInput = {
  interviewId: string;
  blueprint: InterviewBlueprintKey;
  plan: InterviewPlan;
  state: InterviewState;
  questionId: string;
  answerText: string;
};

export type SingleNodeTurnResult =
  | {
      ok: true;
      data: {
        state: InterviewState;
        action: AgentAction;
        /** The final response — what the interviewer says next. */
        response: string | null;
        questionId: string | null;
        finished: boolean;
        degraded: boolean;
        proposed: string | null;
      };
    }
  | { ok: false; message: string };

/**
 * Takes user input, runs it through the LangGraph workflow, returns the final
 * response. Deliberately the same signature as `runInterviewTurn`, so the two
 * agents are interchangeable at the call site.
 */
export async function runSingleNodeTurn(
  llm: InterviewLLM,
  input: SingleNodeTurnInput,
): Promise<SingleNodeTurnResult> {
  let final: SingleNodeState;

  try {
    final = (await graphFor(llm).invoke({
      interviewId: input.interviewId,
      blueprint: input.blueprint,
      plan: input.plan,
      interviewState: input.state,
      currentQuestionId: input.questionId,
      candidateAnswer: input.answerText,
      action: null,
      proposed: null,
      response: null,
      degraded: false,
      error: null,
    })) as SingleNodeState;
  } catch (error) {
    logger.error("[single-node-agent] graph invocation failed", {
      interviewId: input.interviewId,
      error: String(error),
    });
    return { ok: false, message: "The interview could not process that answer." };
  }

  if (final.error) return { ok: false, message: final.error };

  const finished = final.interviewState.status === "COMPLETED";

  return {
    ok: true,
    data: {
      state: final.interviewState,
      action: final.action ?? "NEXT_QUESTION",
      response: final.response,
      questionId: finished ? null : final.currentQuestionId,
      finished,
      degraded: final.degraded,
      proposed: final.proposed,
    },
  };
}
