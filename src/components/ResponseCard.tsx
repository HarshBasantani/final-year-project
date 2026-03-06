import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface ResponseCardProps {
  title: string;
  icon: React.ReactNode;
  content: string;
}

const ResponseCard = ({ title, icon, content }: ResponseCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase">
          {title}
        </h3>
      </div>
      <div className="prose prose-sm prose-invert max-w-none text-secondary-foreground leading-relaxed text-sm">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </motion.div>
  );
};

export default ResponseCard;
