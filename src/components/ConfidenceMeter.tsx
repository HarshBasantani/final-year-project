import { motion } from "framer-motion";

type Classification = "accurate" | "partially_hallucinated" | "hallucinated";

interface Props {
  confidence: number;
  classification: Classification;
}

const colorMap: Record<Classification, string> = {
  accurate: "bg-accurate",
  partially_hallucinated: "bg-partial",
  hallucinated: "bg-hallucinated",
};

const ConfidenceMeter = ({ confidence, classification }: Props) => {
  const pct = Math.round(confidence * 100);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase mb-4">
        Confidence Score
      </h3>
      <div className="flex items-end gap-3 mb-3">
        <span className="text-4xl font-mono font-bold text-foreground">{pct}</span>
        <span className="text-lg font-mono text-muted-foreground mb-1">%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${colorMap[classification]}`}
        />
      </div>
    </div>
  );
};

export default ConfidenceMeter;
