import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Labels used in the hallucination detection system
const LABELS = ["Accurate", "Partially Hallucinated", "Hallucinated"] as const;
type Label = typeof LABELS[number];

// ── Confusion Matrix ──
interface ConfusionMatrix {
  matrix: number[][];        // [actual][predicted]
  labels: string[];
  tp: Record<string, number>;
  fp: Record<string, number>;
  fn: Record<string, number>;
  tn: Record<string, number>;
}

function buildConfusionMatrix(actual: Label[], predicted: Label[]): ConfusionMatrix {
  const n = LABELS.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const labelIdx = Object.fromEntries(LABELS.map((l, i) => [l, i]));

  for (let i = 0; i < actual.length; i++) {
    const ai = labelIdx[actual[i]];
    const pi = labelIdx[predicted[i]];
    if (ai !== undefined && pi !== undefined) matrix[ai][pi]++;
  }

  // Per-class TP, FP, FN, TN (one-vs-rest)
  const tp: Record<string, number> = {};
  const fp: Record<string, number> = {};
  const fn: Record<string, number> = {};
  const tn: Record<string, number> = {};

  for (let c = 0; c < n; c++) {
    const label = LABELS[c];
    tp[label] = matrix[c][c];
    fp[label] = 0;
    fn[label] = 0;
    tn[label] = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === c && j !== c) fn[label] += matrix[i][j];
        if (i !== c && j === c) fp[label] += matrix[i][j];
        if (i !== c && j !== c) tn[label] += matrix[i][j];
      }
    }
  }

  return { matrix, labels: [...LABELS], tp, fp, fn, tn };
}

// ── Metrics Calculation ──
interface ClassMetrics {
  precision: number;
  recall: number;
  f1_score: number;
  support: number;
}

interface EvaluationResult {
  confusion_matrix: ConfusionMatrix;
  per_class: Record<string, ClassMetrics>;
  macro_avg: { precision: number; recall: number; f1_score: number };
  weighted_avg: { precision: number; recall: number; f1_score: number };
  accuracy: number;
  hallucination_rate: number;
  total_samples: number;
  label_distribution: Record<string, number>;
}

function computeMetrics(actual: Label[], predicted: Label[]): EvaluationResult {
  const cm = buildConfusionMatrix(actual, predicted);
  const total = actual.length;

  // Per-class metrics
  const perClass: Record<string, ClassMetrics> = {};
  for (const label of LABELS) {
    const p = cm.tp[label] + cm.fp[label] > 0
      ? cm.tp[label] / (cm.tp[label] + cm.fp[label]) : 0;
    const r = cm.tp[label] + cm.fn[label] > 0
      ? cm.tp[label] / (cm.tp[label] + cm.fn[label]) : 0;
    const f1 = p + r > 0 ? (2 * p * r) / (p + r) : 0;
    const support = cm.tp[label] + cm.fn[label];
    perClass[label] = {
      precision: round(p),
      recall: round(r),
      f1_score: round(f1),
      support,
    };
  }

  // Macro average (unweighted mean across classes)
  const macroP = avg(LABELS.map(l => perClass[l].precision));
  const macroR = avg(LABELS.map(l => perClass[l].recall));
  const macroF1 = avg(LABELS.map(l => perClass[l].f1_score));

  // Weighted average (weighted by support)
  const totalSupport = LABELS.reduce((s, l) => s + perClass[l].support, 0);
  const weightedP = LABELS.reduce((s, l) => s + perClass[l].precision * perClass[l].support, 0) / (totalSupport || 1);
  const weightedR = LABELS.reduce((s, l) => s + perClass[l].recall * perClass[l].support, 0) / (totalSupport || 1);
  const weightedF1 = LABELS.reduce((s, l) => s + perClass[l].f1_score * perClass[l].support, 0) / (totalSupport || 1);

  // Overall accuracy
  const correct = LABELS.reduce((s, l) => s + cm.tp[l], 0);
  const accuracy = total > 0 ? correct / total : 0;

  // Hallucination rate: proportion of actual hallucinated samples
  const hallCount = actual.filter(a => a === "Hallucinated" || a === "Partially Hallucinated").length;
  const hallucinationRate = total > 0 ? hallCount / total : 0;

  // Distribution
  const labelDist: Record<string, number> = {};
  for (const l of LABELS) labelDist[l] = actual.filter(a => a === l).length;

  return {
    confusion_matrix: cm,
    per_class: perClass,
    macro_avg: { precision: round(macroP), recall: round(macroR), f1_score: round(macroF1) },
    weighted_avg: { precision: round(weightedP), recall: round(weightedR), f1_score: round(weightedF1) },
    accuracy: round(accuracy),
    hallucination_rate: round(hallucinationRate),
    total_samples: total,
    label_distribution: labelDist,
  };
}

function round(v: number): number { return Math.round(v * 1000) / 1000; }
function avg(arr: number[]): number { return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { actual, predicted } = await req.json();

    if (!Array.isArray(actual) || !Array.isArray(predicted)) {
      return new Response(JSON.stringify({ error: "Both 'actual' and 'predicted' must be arrays of labels" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (actual.length !== predicted.length) {
      return new Response(JSON.stringify({ error: "Arrays must be the same length" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (actual.length === 0) {
      return new Response(JSON.stringify({ error: "Arrays must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const validLabels = new Set(LABELS);
    for (const l of [...actual, ...predicted]) {
      if (!validLabels.has(l)) {
        return new Response(JSON.stringify({ error: `Invalid label "${l}". Must be one of: ${LABELS.join(", ")}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const result = computeMetrics(actual as Label[], predicted as Label[]);

    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Evaluation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
