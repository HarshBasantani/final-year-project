import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";

interface Props {
  flags: string[];
}

const FlagsList = ({ flags }: Props) => {
  if (!flags || flags.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase mb-4">
          Detection Flags
        </h3>
        <p className="text-sm text-muted-foreground font-mono">No flags raised.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase mb-4">
        Detection Flags
      </h3>
      <ul className="space-y-2">
        {flags.map((flag, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-start gap-2 text-sm"
          >
            <AlertCircle className="w-4 h-4 text-partial shrink-0 mt-0.5" />
            <span className="text-secondary-foreground">{flag}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

export default FlagsList;
