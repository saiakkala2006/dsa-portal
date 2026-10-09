'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Clock, Users, Eye, EyeOff, BarChart3, Download,
  AlertTriangle, Monitor, Wifi, WifiOff, Code2, CheckCircle, XCircle
} from 'lucide-react';
import { format } from 'date-fns';

type TabType = 'overview' | 'proctoring' | 'submissions' | 'results';

export default function ExamDetailPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [exam, setExam] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabType>('overview');

  useEffect(() => { loadExam(); }, [examId]);

  useEffect(() => {
    if (tab === 'proctoring') {
      loadSessions();
      const interval = setInterval(loadSessions, 10000);
      return () => clearInterval(interval);
    }
    if (tab === 'submissions') loadSubmissions();
    if (tab === 'results') loadResults();
  }, [tab, examId]);

  async function loadExam() {
    try {
      const { data } = await adminApi.getExam(examId);
      setExam(data);
    } catch (error) {
      toast.error('Failed to load exam');
    } finally {
      setLoading(false);
    }
  }

  async function loadSessions() {
    try {
      const { data } = await adminApi.getExamSessions(examId);
      setSessions(data.sessions || []);
    } catch (error) { console.error(error); }
  }

  async function loadSubmissions() {
    try {
      const { data } = await adminApi.getExamSubmissions(examId);
      setSubmissions(data.sessions || []);
    } catch (error) { console.error(error); }
  }

  async function loadResults() {
    try {
      const { data } = await adminApi.getExamResults(examId);
      setResults(data.results || []);
    } catch (error) { console.error(error); }
  }

  const exportResults = async () => {
    try {
      const response = await adminApi.exportResults(examId);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exam?.title?.replace(/[^a-zA-Z0-9]/g, '_')}_results.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Results exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>;
  }

  if (!exam) {
    return <div className="text-center py-12 text-dark-400">Exam not found</div>;
  }

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: Eye },
    { key: 'proctoring', label: 'Live Proctoring', icon: Monitor },
    { key: 'submissions', label: 'Submissions', icon: Code2 },
    { key: 'results', label: 'Results', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin/exams')} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-white">{exam.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-dark-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{exam.durationMinutes} min</span>
            <span>{exam._count?.questions || exam.questions?.length || 0} questions</span>
            <span>{exam._count?.sessions || 0} students</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportResults} className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-sm text-white hover:bg-dark-700">
            <Download className="w-4 h-4" />Export
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-dark-800/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              tab === t.key ? 'bg-primary-500/15 text-primary-400' : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {exam.description && <div className="glass rounded-2xl p-5"><p className="text-sm text-dark-300">{exam.description}</p></div>}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-dark-500 mb-1">Start</p>
              <p className="text-sm text-white">{format(new Date(exam.startAt), 'MMM d, yyyy HH:mm')}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-dark-500 mb-1">End</p>
              <p className="text-sm text-white">{format(new Date(exam.endAt), 'MMM d, yyyy HH:mm')}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-dark-500 mb-1">Max Tab Switches</p>
              <p className="text-sm text-white">{exam.maxTabSwitches}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <p className="text-xs text-dark-500 mb-1">Fullscreen Required</p>
              <p className="text-sm text-white">{exam.fullscreenRequired ? 'Yes' : 'No'}</p>
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Questions ({exam.questions?.length || 0})</h3>
            <div className="space-y-2">
              {exam.questions?.map((eq: any, i: number) => (
                <div key={eq.questionId} className="flex items-center justify-between p-3 rounded-lg bg-dark-800/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-dark-500 w-6">#{i + 1}</span>
                    <span className="text-sm text-white">{eq.question?.title}</span>
                  </div>
                  <span className="text-xs text-dark-400">{eq.maxMarksOverride || eq.question?.maxMarks} marks</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Tab */}
      {tab === 'proctoring' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs text-dark-400">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Auto-refreshing every 10 seconds · {sessions.length} students
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Student</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Status</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Time Left</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Tab Switches</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">FS Exits</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Online</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Submissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/30">
                {sessions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-dark-500">No active sessions</td></tr>
                ) : (
                  sessions.map((s: any) => (
                    <tr key={s.id} className="hover:bg-dark-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <p className="text-sm font-medium text-white">{s.student?.name}</p>
                          <p className="text-xs text-dark-500">{s.student?.regNo}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          s.status === 'IN_PROGRESS' ? 'bg-green-500/10 text-green-400' :
                          s.status === 'SUBMITTED' ? 'bg-blue-500/10 text-blue-400' :
                          s.status === 'AUTO_SUBMITTED' ? 'bg-amber-500/10 text-amber-400' :
                          'bg-dark-600 text-dark-400'
                        }`}>
                          {s.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-sm font-mono ${s.timeRemaining < 300 ? 'text-red-400' : 'text-white'}`}>
                          {Math.floor(s.timeRemaining / 60)}:{String(s.timeRemaining % 60).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-sm font-mono ${s.tabSwitchCount > 3 ? 'text-red-400' : s.tabSwitchCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          {s.tabSwitchCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-sm font-mono ${s.fullscreenExitCount > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          {s.fullscreenExitCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        {s.isOnline ? <Wifi className="w-4 h-4 text-green-400 mx-auto" /> : <WifiOff className="w-4 h-4 text-red-400 mx-auto" />}
                      </td>
                      <td className="px-5 py-3 text-center text-sm text-dark-300">{s.submissions?.length || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Submissions Tab */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          {submissions.length === 0 ? (
            <div className="glass rounded-2xl p-12 text-center text-dark-500">No submissions yet</div>
          ) : (
            submissions.map((session: any) => (
              <div key={session.id} className="glass rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{session.student?.name}</p>
                    <p className="text-xs text-dark-500">{session.student?.regNo} · {session.student?.className}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    session.status === 'SUBMITTED' ? 'bg-blue-500/10 text-blue-400' : 'bg-dark-600 text-dark-400'
                  }`}>{session.status?.replace(/_/g, ' ')}</span>
                </div>
                <div className="space-y-2">
                  {session.submissions?.map((sub: any) => (
                    <details key={sub.id} className="rounded-lg bg-dark-800/50 overflow-hidden group">
                      <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-dark-700/50 transition-all">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            sub.status === 'ACCEPTED' ? 'status-accepted' :
                            sub.status === 'WRONG_ANSWER' ? 'status-wrong' :
                            sub.status === 'COMPILE_ERROR' ? 'status-error' : 'status-pending'
                          }`}>{sub.status}</span>
                          <span className="text-sm text-white">{sub.language}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-dark-400">
                          <span>{sub.passedTestCases}/{sub.totalTestCases} passed</span>
                          <span className="font-semibold text-white">{sub.score?.toFixed(1)} pts</span>
                        </div>
                      </summary>
                      <div className="p-3 border-t border-dark-700/50 space-y-2">
                        <pre className="text-xs text-dark-300 bg-dark-900 rounded-lg p-3 overflow-x-auto max-h-40 font-mono">{sub.sourceCode}</pre>
                        {sub.testResults?.map((tr: any) => (
                          <div key={tr.id} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-dark-900/50">
                            {tr.passed ? <CheckCircle className="w-3 h-3 text-green-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                            <span className="text-dark-400">{tr.testCase?.isSample ? 'Sample' : 'Hidden'}</span>
                            <span className={tr.passed ? 'text-green-400' : 'text-red-400'}>{tr.status}</span>
                            {tr.timeMs && <span className="text-dark-500">{tr.timeMs.toFixed(0)}ms</span>}
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Results Tab */}
      {tab === 'results' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-dark-400">{results.length} results</p>
            <button onClick={exportResults} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs gradient-bg text-white">
              <Download className="w-3 h-3" />Export Excel
            </button>
          </div>
          <div className="glass rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Rank</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Student</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Reg No</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Questions</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Test Cases</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Time</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Tab Switches</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-dark-400 uppercase">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/30">
                {results.map((r: any, i: number) => (
                  <tr key={r.id} className="hover:bg-dark-700/20">
                    <td className="px-5 py-3 text-sm text-dark-400">#{i + 1}</td>
                    <td className="px-5 py-3 text-sm font-medium text-white">{r.student?.name}</td>
                    <td className="px-5 py-3 text-center text-sm text-dark-300 font-mono">{r.student?.regNo}</td>
                    <td className="px-5 py-3 text-center text-sm text-dark-300">{r.questionsAttempted}</td>
                    <td className="px-5 py-3 text-center text-sm text-dark-300">{r.testCasesPassed}/{r.totalTestCases}</td>
                    <td className="px-5 py-3 text-center text-sm text-dark-300">{Math.floor(r.timeTakenSeconds / 60)}m {r.timeTakenSeconds % 60}s</td>
                    <td className="px-5 py-3 text-center text-sm text-dark-300">{r.tabSwitchCount}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-sm font-bold ${r.finalScore >= 80 ? 'text-green-400' : r.finalScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                        {r.finalScore.toFixed(1)}/100
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
