import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Plus, FileText, MoreVertical, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

// Mock Data
const RESUMES = [
  {
    id: 1,
    title: "Software Engineer - General",
    keywords: ["React", "Node.js", "System Design"],
    lastEdited: "2 hours ago",
    score: 92,
  },
  {
    id: 2,
    title: "Frontend Specialist",
    keywords: ["React", "TypeScript", "Tailwind", "Framer"],
    lastEdited: "1 day ago",
    score: 98,
  },
  {
    id: 3,
    title: "Product Engineering Lead",
    keywords: ["Leadership", "Agile", "Microservices"],
    lastEdited: "3 days ago",
    score: 85,
  },
];

export default function Dashboard() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-12 max-w-7xl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-12">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif text-mist-100 mb-2">
            Resume Library
          </h1>
          <p className="text-mist-400">
            Manage your base resumes and track their performance.
          </p>
        </div>
        <Button className="shadow-[0_0_20px_rgba(255,255,255,0.1)] gap-2">
          <Plus size={18} /> Create New Resume
        </Button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <StatsCard
          label="Total Tailored"
          value="24"
          icon={<FileText size={20} />}
          trend="+3 this week"
        />
        <StatsCard
          label="Avg. Match Score"
          value="91%"
          icon={<TrendingUp size={20} />}
          trend="+5% vs last month"
        />
        <StatsCard
          label="Active Applications"
          value="8"
          icon={<Clock size={20} />}
          trend="2 interviews scheduled"
        />
      </div>

      {/* Resume Grid */}
      <h2 className="text-xl font-serif text-mist-100 mb-6">
        Master Variations
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {RESUMES.map((resume, index) => (
          <motion.div
            key={resume.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="group cursor-pointer hover:border-white/10 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 rounded-xl bg-void-950/50 text-aurora-teal border border-white/5">
                  <FileText size={24} />
                </div>
                <button className="text-mist-400 hover:text-mist-100 transition-colors p-2 -mr-2">
                  <MoreVertical size={18} />
                </button>
              </div>

              <h3 className="text-lg font-medium text-mist-100 mb-2 group-hover:text-aurora-teal transition-colors">
                {resume.title}
              </h3>

              <div className="flex flex-wrap gap-2 mb-6">
                {resume.keywords.slice(0, 3).map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2 py-1 rounded-md bg-white/5 text-xs text-mist-400 font-mono border border-white/5"
                  >
                    {keyword}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-xs text-mist-400 font-mono flex items-center gap-1.5">
                  <Clock size={12} /> {resume.lastEdited}
                </span>
                <span className="text-xs font-bold text-aurora-purple bg-aurora-purple/10 px-2 py-1 rounded">
                  Score: {resume.score}
                </span>
              </div>
            </Card>
          </motion.div>
        ))}

        {/* 'Add New' Placeholder Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: RESUMES.length * 0.1 }}
        >
          <button className="w-full h-full min-h-[220px] rounded-[32px] border border-dashed border-white/10 hover:border-aurora-teal/50 hover:bg-aurora-teal/5 transition-all flex flex-col items-center justify-center gap-4 text-mist-400 hover:text-aurora-teal group">
            <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-aurora-teal/20 flex items-center justify-center transition-colors">
              <Plus size={24} />
            </div>
            <span className="font-medium">Create Blank Resume</span>
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function StatsCard({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-mist-400 font-mono text-xs uppercase tracking-wider">
          {label}
        </span>
        <div className="text-aurora-teal">{icon}</div>
      </div>
      <div className="text-3xl font-serif text-mist-100 mb-2">{value}</div>
      <div className="text-xs text-mist-400/60">{trend}</div>
    </Card>
  );
}
