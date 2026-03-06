import { motion } from "framer-motion";
import { BarChart3, PieChart as PieIcon, TrendingUp, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ResponsiveContainer,
} from "recharts";

// ── Demo Data ──

const pieData = [
  { name: "Accurate", value: 156, fill: "hsl(150, 70%, 45%)" },
  { name: "Partially Hallucinated", value: 138, fill: "hsl(40, 90%, 55%)" },
  { name: "Hallucinated", value: 106, fill: "hsl(0, 72%, 55%)" },
];

const lineData = [
  { batch: "Batch 1", GPT: 0.22, Gemini: 0.18, Claude: 0.25 },
  { batch: "Batch 2", GPT: 0.28, Gemini: 0.21, Claude: 0.30 },
  { batch: "Batch 3", GPT: 0.19, Gemini: 0.16, Claude: 0.23 },
  { batch: "Batch 4", GPT: 0.35, Gemini: 0.24, Claude: 0.31 },
  { batch: "Batch 5", GPT: 0.26, Gemini: 0.19, Claude: 0.27 },
  { batch: "Batch 6", GPT: 0.31, Gemini: 0.22, Claude: 0.29 },
  { batch: "Batch 7", GPT: 0.24, Gemini: 0.17, Claude: 0.26 },
];

const barData = [
  { model: "GPT-5 Mini", rate: 32.4, fill: "hsl(175, 70%, 45%)" },
  { model: "Gemini 3 Flash", rate: 21.8, fill: "hsl(150, 70%, 45%)" },
  { model: "Gemini 2.5 Pro", rate: 28.6, fill: "hsl(40, 90%, 55%)" },
];

const STATS = [
  { label: "Total Queries", value: "400", icon: Brain },
  { label: "Avg Hallucination Rate", value: "27.6%", icon: TrendingUp },
  { label: "Accuracy", value: "72.4%", icon: BarChart3 },
  { label: "Avg Confidence", value: "81.2%", icon: PieIcon },
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "hsl(220, 18%, 10%)",
    border: "1px solid hsl(220, 15%, 18%)",
    borderRadius: "0.5rem",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "0.75rem",
    color: "hsl(210, 20%, 90%)",
  },
  itemStyle: { color: "hsl(210, 20%, 80%)" },
};

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background bg-grid relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-12 sm:py-16">
        {/* Nav */}
        <nav className="flex items-center gap-4 mb-10">
          <Link
            to="/"
            className="text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Detector
          </Link>
          <span className="text-border">|</span>
          <span className="text-sm font-mono text-primary">Analytics Dashboard</span>
        </nav>

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary tracking-wider uppercase">
              Analytics
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2">
            <span className="text-gradient-primary">Visualization</span>{" "}
            <span className="text-foreground">Dashboard</span>
          </h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Model comparison metrics, classification distribution, and hallucination rates across AI models.
          </p>
        </motion.header>

        {/* Stat Cards */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8"
        >
          {STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <s.icon className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-wider">{s.label}</span>
              </div>
              <span className="text-2xl font-mono font-bold text-foreground">{s.value}</span>
            </div>
          ))}
        </motion.div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <PieIcon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase">
                Classification Distribution
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip {...tooltipStyle} />
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg border border-border bg-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase">
                Hallucination Rate by Model
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis
                  dataKey="model"
                  tick={{ fill: "hsl(215, 15%, 50%)", fontFamily: "'JetBrains Mono'", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(220, 15%, 18%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(215, 15%, 50%)", fontFamily: "'JetBrains Mono'", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(220, 15%, 18%)" }}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => [`${value}%`, "Hallucination Rate"]}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Line Chart - full width */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-lg border border-border bg-card p-5 lg:col-span-2"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-mono font-semibold text-foreground tracking-wide uppercase">
                Model Comparison Over Batches
              </h3>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
                <XAxis
                  dataKey="batch"
                  tick={{ fill: "hsl(215, 15%, 50%)", fontFamily: "'JetBrains Mono'", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(220, 15%, 18%)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(215, 15%, 50%)", fontFamily: "'JetBrains Mono'", fontSize: 11 }}
                  axisLine={{ stroke: "hsl(220, 15%, 18%)" }}
                  tickLine={false}
                  domain={[0, 0.5]}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number) => [(value * 100).toFixed(1) + "%", ""]}
                />
                <Legend
                  wrapperStyle={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem" }}
                />
                <Line
                  type="monotone"
                  dataKey="GPT"
                  stroke="hsl(175, 70%, 45%)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(175, 70%, 45%)" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Gemini"
                  stroke="hsl(150, 70%, 45%)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(150, 70%, 45%)" }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="Claude"
                  stroke="hsl(40, 90%, 55%)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "hsl(40, 90%, 55%)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
