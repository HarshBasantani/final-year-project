import { motion } from "framer-motion";
import { Globe, BookOpen, Database, ExternalLink, Search } from "lucide-react";

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

interface Props {
  retrieval: RetrievalValidation;
}

const sourceIcon = (type: string) => {
  switch (type) {
    case "wikipedia": return <BookOpen className="w-4 h-4" />;
    case "web_knowledge": return <Globe className="w-4 h-4" />;
    case "dataset": return <Database className="w-4 h-4" />;
    default: return <Search className="w-4 h-4" />;
  }
};

const sourceLabel = (type: string) => {
  switch (type) {
    case "wikipedia": return "Wikipedia";
    case "web_knowledge": return "Web Knowledge";
    case "dataset": return "Knowledge Base";
    default: return "Unknown";
  }
};

const simColor = (sim: number) => {
  if (sim >= 0.6) return "text-accurate";
  if (sim >= 0.3) return "text-partial";
  return "text-hallucinated";
};

const RetrievalSourcesCard = ({ retrieval }: Props) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase">
          Retrieval-Augmented Validation
        </h3>
        <span className="ml-auto text-xs font-mono text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">
          {retrieval.method === "hybrid" ? "Hybrid" : "Wikipedia"}
        </span>
      </div>

      {retrieval.sources.length === 0 ? (
        <p className="text-sm text-muted-foreground font-mono">
          No external sources matched this query. Scoring based on RL + WSD only.
        </p>
      ) : (
        <div className="space-y-3">
          {retrieval.sources.map((source, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-md bg-muted/30 border border-border/50"
            >
              <span className="text-primary shrink-0">{sourceIcon(source.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground uppercase">
                    {sourceLabel(source.type)}
                  </span>
                  {source.url && (
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <p className="text-sm text-secondary-foreground truncate">{source.title}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-lg font-mono font-bold ${simColor(source.similarity)}`}>
                  {Math.round(source.similarity * 100)}%
                </span>
                <p className="text-[10px] font-mono text-muted-foreground">similarity</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Best similarity summary */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground">
          Best retrieval similarity
        </span>
        <span className={`text-sm font-mono font-semibold ${simColor(retrieval.best_similarity)}`}>
          {Math.round(retrieval.best_similarity * 100)}%
        </span>
      </div>

      {retrieval.wikipedia.found && retrieval.wikipedia.extract_preview && (
        <div className="mt-3 p-3 rounded-md bg-muted/20 border border-border/30">
          <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">
            Wikipedia Extract
          </p>
          <p className="text-xs text-secondary-foreground leading-relaxed line-clamp-3">
            {retrieval.wikipedia.extract_preview}
          </p>
        </div>
      )}
    </motion.div>
  );
};

export default RetrievalSourcesCard;
