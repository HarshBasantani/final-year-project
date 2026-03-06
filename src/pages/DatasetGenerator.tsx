import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Database, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "450", total: 450, desc: "Quick test" },
  { label: "1,000", total: 1000, desc: "Small" },
  { label: "5,000", total: 5000, desc: "Medium" },
  { label: "10,000", total: 10000, desc: "Large" },
];

const DatasetGenerator = () => {
  const [total, setTotal] = useState(10000);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setProgress("Connecting to AI gateway...");
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-dataset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ total, format, batch_size: 40 }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hallucination_dataset_${total}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dataset downloaded!", {
        description: `${total} examples in ${format.toUpperCase()} format`,
      });
    } catch (e) {
      toast.error("Generation failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
      setProgress("");
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-12 sm:py-20">
        <nav className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Detector
          </Link>
        </nav>

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-4">
            <Database className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary tracking-wider uppercase">
              Dataset Generator
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            <span className="text-gradient-primary">Generate</span>{" "}
            <span className="text-foreground">Demo Dataset</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            AI-generated QA pairs labeled as Hallucinated, Partially Hallucinated, or
            Accurate — across 15+ knowledge domains.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-lg border border-border bg-card shadow-lg p-6 space-y-6"
        >
          {/* Size */}
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3 block">
              Dataset Size
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.total}
                  onClick={() => setTotal(p.total)}
                  className={`rounded-md border px-3 py-3 text-center transition-all font-mono text-sm ${
                    total === p.total
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="font-bold">{p.label}</div>
                  <div className="text-[10px] mt-0.5 opacity-70">{p.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Distribution preview */}
          <div className="rounded-md bg-muted/30 border border-border/50 p-4">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Distribution Preview
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-mono font-bold text-hallucinated">
                  {Math.round(total * 0.5).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">Hallucinated</p>
              </div>
              <div>
                <p className="text-lg font-mono font-bold text-partial">
                  {Math.round(total * 0.375).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">Partial</p>
              </div>
              <div>
                <p className="text-lg font-mono font-bold text-accurate">
                  {(total - Math.round(total * 0.5) - Math.round(total * 0.375)).toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">Accurate</p>
              </div>
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-3 block">
              Output Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["csv", "json"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-md border px-3 py-2.5 text-center transition-all font-mono text-sm ${
                    format === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {f.toUpperCase()}
                  <span className="text-[10px] ml-1.5 opacity-70">
                    {f === "csv" ? "(Excel compatible)" : "(structured)"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={loading}
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating {total.toLocaleString()} examples...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Generate & Download ({total.toLocaleString()} examples)
              </>
            )}
          </Button>

          {loading && progress && (
            <p className="text-xs text-center font-mono text-muted-foreground animate-pulse">
              {progress} This may take several minutes for large datasets.
            </p>
          )}

          <p className="text-[10px] text-center font-mono text-muted-foreground">
            Uses Gemini 2.5 Flash to generate diverse QA pairs across science, history,
            geography, technology, medicine, literature, math, economics, and more.
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default DatasetGenerator;
