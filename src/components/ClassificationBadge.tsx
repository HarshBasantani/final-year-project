import { motion } from "framer-motion";
import { ShieldCheck, AlertTriangle, XOctagon } from "lucide-react";

type Classification = "accurate" | "partially_hallucinated" | "hallucinated";

interface Props {
  classification: Classification;
  confidence: number;
}

const config: Record<Classification, { label: string; icon: typeof ShieldCheck; glowClass: string; colorClass: string; bgClass: string; borderClass: string }> = {
  accurate: {
    label: "Accurate",
    icon: ShieldCheck,
    glowClass: "glow-accurate",
    colorClass: "text-accurate",
    bgClass: "bg-accurate/10",
    borderClass: "border-accurate/40",
  },
  partially_hallucinated: {
    label: "Partially Hallucinated",
    icon: AlertTriangle,
    glowClass: "glow-partial",
    colorClass: "text-partial",
    bgClass: "bg-partial/10",
    borderClass: "border-partial/40",
  },
  hallucinated: {
    label: "Hallucinated",
    icon: XOctagon,
    glowClass: "glow-hallucinated",
    colorClass: "text-hallucinated",
    bgClass: "bg-hallucinated/10",
    borderClass: "border-hallucinated/40",
  },
};

const ClassificationBadge = ({ classification, confidence }: Props) => {
  const c = config[classification];
  const Icon = c.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-lg border ${c.borderClass} ${c.bgClass} ${c.glowClass} p-5 flex items-center gap-4`}
    >
      <div className={`p-3 rounded-full ${c.bgClass}`}>
        <Icon className={`w-7 h-7 ${c.colorClass}`} />
      </div>
      <div>
        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">
          Classification Result
        </p>
        <p className={`text-xl font-mono font-bold ${c.colorClass}`}>
          {c.label}
        </p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-xs font-mono text-muted-foreground">Confidence</p>
        <p className={`text-2xl font-mono font-bold ${c.colorClass}`}>
          {Math.round(confidence * 100)}%
        </p>
      </div>
    </motion.div>
  );
};

export default ClassificationBadge;
