import { useEffect, useState } from "react";
import api from "../lib/api";
import { AppLayout } from "../layouts/AppLayout";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Plus, FileText, MoreVertical, Clock, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

interface Resume {
  id: string;
  name: string;
  skills: string[];
  updatedAt: string;
  isBase: boolean;
  score?: number;
}

export default function Dashboard() {
  const { user } = useUser();
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const response = await api.get("/resumes");
        if (response.data.success) {
          setResumes(response.data.data);
        }
      } catch (error) {
        console.error("Failed to load resumes", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResumes();
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-16">
          <div>
            <h1 className="text-4xl md:text-6xl font-serif font-light mb-6 text-mist-100 leading-tight">
              Welcome back, <br />
              <span className="italic text-mist-400">
                {user?.firstName || "User"}
              </span>
            </h1>
            <p className="text-mist-400 text-lg md:text-xl max-w-xl font-light">
              You have{" "}
              <span className="font-mono text-aurora-teal">
                {resumes.length}
              </span>{" "}
              resumes on file. Ready to tailor your next application?
            </p>
          </div>
          <Link to="/tailor">
            <Button className="shadow-[0_0_20px_rgba(255,255,255,0.1)] gap-2">
              <Plus size={18} /> New Application
            </Button>
          </Link>
        </header>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatsCard
            label="Total Resumes"
            value={resumes.length.toString()}
            icon={<FileText size={20} />}
            trend="All time"
          />
          <StatsCard
            label="Avg. Match Score"
            value="--"
            icon={<TrendingUp size={20} />}
            trend="Requires Analysis"
          />
          <StatsCard
            label="Saved Applications"
            value="0"
            icon={<Clock size={20} />}
            trend="Pending"
          />
        </div>

        {/* Main Grid */}
        <h2 className="text-xl font-serif text-mist-100 mb-6">
          Resume Library
        </h2>

        {loading ? (
          <div className="text-mist-400 font-mono animate-pulse">
            Loading library...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* 'Create New' Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Placeholder for future Create Resume logic */}
              <button className="w-full h-full min-h-[220px] rounded-[32px] border border-dashed border-white/10 hover:border-aurora-teal/50 hover:bg-aurora-teal/5 transition-all flex flex-col items-center justify-center gap-4 text-mist-400 hover:text-aurora-teal group bg-void-950/20">
                <div className="w-12 h-12 rounded-full bg-white/5 group-hover:bg-aurora-teal/20 flex items-center justify-center transition-colors">
                  <Plus size={24} />
                </div>
                <span className="font-medium">Create Blank Resume</span>
              </button>
            </motion.div>

            {/* Resume Cards */}
            {resumes.map((resume, index) => (
              <motion.div
                key={resume.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="group cursor-pointer hover:border-white/10 transition-colors h-full flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 rounded-xl bg-void-950/50 text-aurora-teal border border-white/5">
                      <FileText size={24} />
                    </div>
                    <button className="text-mist-400 hover:text-mist-100 transition-colors p-2 -mr-2">
                      <MoreVertical size={18} />
                    </button>
                  </div>

                  <h3 className="text-lg font-medium text-mist-100 mb-2 group-hover:text-aurora-teal transition-colors truncate">
                    {resume.name}
                  </h3>

                  <div className="flex flex-wrap gap-2 mb-6 flex-grow">
                    {(resume.skills || []).slice(0, 3).map((keyword, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-md bg-white/5 text-xs text-mist-400 font-mono border border-white/5 truncate max-w-[100px]"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5 mt-auto">
                    <span className="text-xs text-mist-400 font-mono flex items-center gap-1.5">
                      <Clock size={12} />{" "}
                      {new Date(resume.updatedAt).toLocaleDateString()}
                    </span>
                    {resume.isBase && (
                      <span className="text-xs font-bold text-aurora-purple bg-aurora-purple/10 px-2 py-1 rounded">
                        Base
                      </span>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
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
