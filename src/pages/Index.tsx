import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Send, Loader2, Brain, ShieldCheck, ChevronDown, BarChart3, CheckCircle2, AlertTriangle, XOctagon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import ResponseCard from "@/components/ResponseCard";
import ClassificationBadge from "@/components/ClassificationBadge";
import ConfidenceMeter from "@/components/ConfidenceMeter";
import FlagsList from "@/components/FlagsList";
import RetrievalSourcesCard from "@/components/RetrievalSourcesCard";
import { findDemoMatch, DemoExample } from "@/data/demoDataset";

interface RetrievalSource {
  type: string;
  title: string;
  similarity: number;
  url?: string;
}

interface RetrievalValidation {
  method: string;
  sources: RetrievalSource[];
  best_similarity: number;
  dataset_check: { found: boolean; match_score: number };
  wikipedia: { found: boolean; title: string; url: string; similarity: number; extract_preview: string };
  web_retrieval: { triggered: boolean; retrieved: boolean; source_type: string };
}

interface RlWsdBreakdown {
  formula: string;
  weights: { alpha: number; beta: number; gamma: number };
  components: { rl_component: number; wsd_component: number; retrieval_component: number };
  rl_score: number;
  wsd_score: number;
  context_drift: number;
  retrieval_similarity: number;
  inconsistency_penalty: number;
  entities_analyzed: number;
  misused_senses: number;
}

interface DetectionResult {
  ai_response: string;
  hallucination_score: number;
  confidence_level: number;
  label: "Accurate" | "Partially Hallucinated" | "Hallucinated";
  flags: string[];
  summary: string;
  retrieval_validation?: RetrievalValidation;
  rl_wsd_breakdown?: RlWsdBreakdown;
  correct_answer?: string;
  is_demo?: boolean;
}

const AI_MODELS = [
  { value: "gemini", label: "Gemini", desc: "Google Gemini 3 Flash" },
  { value: "gpt", label: "GPT", desc: "OpenAI GPT-5 Mini" },
  { value: "claude", label: "Claude", desc: "Gemini 2.5 Pro (Claude-equivalent)" },
];

const labelToClassification = (label: string) => {
  if (label === "Accurate") return "accurate" as const;
  if (label === "Hallucinated") return "hallucinated" as const;
  return "partially_hallucinated" as const;
};

/** Convert a demo dataset entry into a DetectionResult for display */
function demoToResult(demo: DemoExample): DetectionResult {
  const scoreMap = { Hallucinated: 0.95, "Partially Hallucinated": 0.55, Accurate: 0.05 };
  const confMap = { Hallucinated: 0.92, "Partially Hallucinated": 0.78, Accurate: 0.97 };
  const flagsMap: Record<string, string[]> = {
    Hallucinated: [
      "Factual claim contradicts verified sources",
      "Key entities are incorrect or fabricated",
      "High confidence in wrong information",
    ],
    "Partially Hallucinated": [
      "Some claims verified, others contradict sources",
      "Minor factual inaccuracies detected (dates, names, or numbers)",
    ],
    Accurate: ["All claims verified against known sources"],
  };
  const summaryMap: Record<string, string> = {
    Hallucinated: `The AI answer is **hallucinated**. The response contains fabricated or clearly incorrect facts. The correct answer is provided below for comparison.`,
    "Partially Hallucinated": `The AI answer is **partially hallucinated**. While some information is correct, it contains specific factual errors (wrong dates, names, or attributions). See the correct answer below.`,
    Accurate: `The AI answer is **accurate**. All claims have been verified against known sources and are factually correct.`,
  };

  return {
    ai_response: demo.ai_answer,
    hallucination_score: scoreMap[demo.label],
    confidence_level: confMap[demo.label],
    label: demo.label,
    flags: flagsMap[demo.label],
    summary: summaryMap[demo.label],
    correct_answer: demo.correct_answer,
    is_demo: true,
  };
}

const Index = () => {
  const [question, setQuestion] = useState("");
  const [model, setModel] = useState("gemini");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);

    // Check demo dataset first
    const demoMatch = findDemoMatch(question);
    if (demoMatch) {
      // Simulate brief loading for presentation effect
      await new Promise((r) => setTimeout(r, 800));
      setResult(demoToResult(demoMatch));
      toast.success("Demo dataset match found", { description: `Matched: "${demoMatch.question}"` });
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-hallucination`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ question: question.trim(), model }),
        }
      );

      if (!resp.ok) {
        const data = await resp.json();
        const errMsg = data.error || "Request failed";
        if (resp.status === 429) {
          toast.error("Rate limit exceeded", { description: "Please wait a moment and try again." });
        } else if (resp.status === 402) {
          toast.error("Credits required", { description: "Please add credits to continue using AI models." });
        } else if (resp.status === 408) {
          toast.error("Request timed out", { description: "The AI model took too long. Please try again." });
        } else {
          toast.error("Request failed", { description: errMsg });
        }
        throw new Error(errMsg);
      }

      const data: DetectionResult = await resp.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const selectedModel = AI_MODELS.find((m) => m.value === model)!;
  const classification = result ? labelToClassification(result.label) : null;

  return (
    <div className="min-h-screen bg-background bg-grid relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12 sm:py-20">
        {/* Nav */}
        <nav className="flex items-center justify-end gap-4 mb-6">
          <Link
            to="/dataset"
            className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            <Brain className="w-4 h-4" />
            Dataset Generator →
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics Dashboard →
          </Link>
        </nav>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-6">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary tracking-wider uppercase">
              RL-WSD Engine v2.0 — Open-Domain RAV
            </span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">
            <span className="text-gradient-primary">Hallucination</span>{" "}
            <span className="text-foreground">Detector</span>
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
            Submit any open-domain question. The system queries an AI model, then
            validates using Retrieval-Augmented Validation with hybrid knowledge verification.
          </p>
        </motion.header>

        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider shrink-0">
                AI Model
              </label>
              <div className="relative">
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="appearance-none bg-secondary text-secondary-foreground text-sm font-mono px-3 py-1.5 pr-8 rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  {AI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.desc}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>

            <div className="p-1">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask any open-domain question..."
                className="min-h-[120px] bg-transparent border-0 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder:text-muted-foreground font-mono text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
                }}
              />
            </div>

            <div className="flex justify-between items-center px-4 py-3 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground font-mono">
                ⌘ + Enter to submit
              </span>
              <Button
                onClick={handleSubmit}
                disabled={!question.trim() || loading}
                size="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2 px-6"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? "Analyzing..." : "Detect Hallucination"}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4 py-12"
            >
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
                  <Brain className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-sm font-mono text-primary">Querying {selectedModel.label}...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI Response → Dataset Check → Web Retrieval → RL-WSD-RAV Analysis
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-8"
            >
              <p className="text-destructive text-sm font-mono">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && classification && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Demo badge */}
              {result.is_demo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2"
                >
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-xs font-mono text-primary">
                    Demo Dataset Match — This result is from the controlled demo dataset for presentation purposes.
                  </span>
                </motion.div>
              )}

              <ClassificationBadge classification={classification} confidence={result.confidence_level} />

              <ResponseCard title="AI Response" icon={<Brain className="w-4 h-4" />} content={result.ai_response} />

              {/* Correct Answer — shown for hallucinated / partially hallucinated */}
              {result.correct_answer && result.label !== "Accurate" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg border p-5 ${
                    result.label === "Hallucinated"
                      ? "border-hallucinated/40 bg-hallucinated/5"
                      : "border-partial/40 bg-partial/5"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-accurate" />
                    <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase">
                      Correct Answer
                    </h3>
                  </div>
                  <p className="text-sm font-mono text-foreground leading-relaxed">
                    {result.correct_answer}
                  </p>
                </motion.div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ConfidenceMeter confidence={result.confidence_level} classification={classification} />
                <div className="rounded-lg border border-border bg-card p-5">
                  <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase mb-4">
                    Hallucination Score
                  </h3>
                  <div className="flex items-end gap-3 mb-3">
                    <span className="text-4xl font-mono font-bold text-foreground">
                      {Math.round(result.hallucination_score * 100)}
                    </span>
                    <span className="text-lg font-mono text-muted-foreground mb-1">%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(result.hallucination_score * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className={`h-full rounded-full ${
                        result.hallucination_score < 0.3
                          ? "bg-accurate"
                          : result.hallucination_score < 0.6
                          ? "bg-partial"
                          : "bg-hallucinated"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-2">
                    0% = Fully Accurate · 100% = Fully Hallucinated
                  </p>
                </div>
              </div>

              {/* Retrieval-Augmented Validation */}
              {result.retrieval_validation && (
                <RetrievalSourcesCard retrieval={result.retrieval_validation} />
              )}

              {/* Scoring Breakdown */}
              {result.rl_wsd_breakdown && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-border bg-card p-5"
                >
                  <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase mb-4">
                    Scoring Breakdown
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground mb-3">
                    {result.rl_wsd_breakdown.formula}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-md bg-muted/30 border border-border/50 text-center">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">RL (α={result.rl_wsd_breakdown.weights.alpha})</p>
                      <p className="text-xl font-mono font-bold text-foreground mt-1">
                        {Math.round(result.rl_wsd_breakdown.components.rl_component * 100)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/30 border border-border/50 text-center">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">WSD (β={result.rl_wsd_breakdown.weights.beta})</p>
                      <p className="text-xl font-mono font-bold text-foreground mt-1">
                        {Math.round(result.rl_wsd_breakdown.components.wsd_component * 100)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-md bg-muted/30 border border-border/50 text-center">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase">RAV (γ={result.rl_wsd_breakdown.weights.gamma})</p>
                      <p className="text-xl font-mono font-bold text-foreground mt-1">
                        {Math.round(result.rl_wsd_breakdown.components.retrieval_component * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-mono text-muted-foreground">
                    <span>Entities: {result.rl_wsd_breakdown.entities_analyzed}</span>
                    <span>·</span>
                    <span>Misused: {result.rl_wsd_breakdown.misused_senses}</span>
                    <span>·</span>
                    <span>Drift: {Math.round(result.rl_wsd_breakdown.context_drift * 100)}%</span>
                    <span>·</span>
                    <span>Penalty: {result.rl_wsd_breakdown.inconsistency_penalty}</span>
                  </div>
                </motion.div>
              )}

              <FlagsList flags={result.flags} />

              <ResponseCard title="Analysis Summary" icon={<ShieldCheck className="w-4 h-4" />} content={result.summary} />

              {/* Raw JSON */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-border bg-card p-5"
              >
                <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase mb-3">
                  API Response (JSON)
                </h3>
                <pre className="text-xs font-mono text-secondary-foreground bg-muted/50 rounded-md p-4 overflow-x-auto max-h-96">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Index;
