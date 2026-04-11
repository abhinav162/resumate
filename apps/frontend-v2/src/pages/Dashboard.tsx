import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ScorePill } from '../components/ui/ScorePill';
import { Badge } from '../components/ui/Badge';
import { resumesApi, setAuthHeaders } from '../lib/api';

type Resume = { id: string; name: string; score: number | null; tailoredCount?: number; updated_at: string };

export default function Dashboard() {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    const fetchResumes = async () => {
      try {
        const token = await getToken();
        setAuthHeaders(token, userId);
        const data = await resumesApi.getAll();
        setResumes(data);
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchResumes();
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink-primary">My Resumes</h1>
        <Button onClick={() => navigate('/upload')}>+ Upload Resume</Button>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-28 bg-paper-border rounded-lg animate-pulse" />)}
        </div>
      )}

      {!loading && resumes.length === 0 && (
        <div
          className="border-2 border-dashed border-paper-border rounded-xl p-12 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          onClick={() => navigate('/upload')}
        >
          <p className="text-3xl mb-2">📄</p>
          <p className="font-heading font-semibold text-ink-primary">Upload your first resume</p>
          <p className="text-sm text-ink-muted mt-1">AI will score it and suggest improvements instantly</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {resumes.map(resume => (
          <Card key={resume.id} className="p-4 space-y-3 hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-heading font-semibold text-ink-primary">{resume.name}</p>
                <p className="text-xs text-ink-muted mt-0.5">Updated {new Date(resume.updated_at).toLocaleDateString()}</p>
              </div>
              {resume.score !== null && resume.score !== undefined && <ScorePill score={resume.score} />}
            </div>
            {resume.tailoredCount !== undefined && resume.tailoredCount > 0 && (
              <Badge variant="indigo">{resume.tailoredCount} tailored {resume.tailoredCount === 1 ? 'copy' : 'copies'}</Badge>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={() => navigate(`/editor/${resume.id}`)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => navigate(`/tailor?resumeId=${resume.id}`)}>Tailor →</Button>
            </div>
          </Card>
        ))}

        {resumes.length > 0 && (
          <div
            className="border-2 border-dashed border-paper-border rounded-lg p-4 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-300 transition-colors"
            onClick={() => navigate('/upload')}
          >
            <span className="text-xl text-ink-muted">+</span>
            <span className="text-sm text-ink-muted">Upload new resume</span>
          </div>
        )}
      </div>
    </div>
  );
}
