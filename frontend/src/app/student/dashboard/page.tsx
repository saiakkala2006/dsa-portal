'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { studentApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ClipboardList, Clock, Trophy, ArrowRight, BookOpen } from 'lucide-react';

export default function StudentDashboardPage() {
  const { user } = useAuthStore();
  const [exams, setExams] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [examsRes, resultsRes] = await Promise.all([
        studentApi.getExams(),
        studentApi.getResults(),
      ]);
      setExams(examsRes.data.exams || []);
      setResults(resultsRes.data.results || []);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>;
  }

  const availableExams = exams.filter(e => e.canStart || e.isActive);

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Welcome back, {user?.name?.split(' ')[0]}! 👋</h2>
        <p className="text-dark-400 text-sm mt-1">Here&apos;s your exam overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-2xl p-5 card-hover">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-3">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-white">{availableExams.length}</p>
          <p className="text-sm text-dark-400">Available Exams</p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-3">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-white">{results.length}</p>
          <p className="text-sm text-dark-400">Completed Exams</p>
        </div>
        <div className="glass rounded-2xl p-5 card-hover">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-3">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <p className="text-2xl font-bold text-white">
            {results.length > 0 ? (results.reduce((sum: number, r: any) => sum + r.finalScore, 0) / results.length).toFixed(1) : '-'}
          </p>
          <p className="text-sm text-dark-400">Avg Score</p>
        </div>
      </div>

      {/* Available Exams */}
      {availableExams.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Available Exams</h3>
          <div className="space-y-3">
            {availableExams.map((exam: any) => (
              <Link
                key={exam.id}
                href="/student/exams"
                className="flex items-center justify-between p-4 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium text-white group-hover:text-green-300">{exam.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-dark-500">
                      <Clock className="w-3 h-3" />
                      {exam.durationMinutes} minutes · {exam.questionCount} questions
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-dark-500 group-hover:text-green-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Results */}
      {results.length > 0 && (
        <div className="glass rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Published Results</h3>
          <div className="space-y-3">
            {results.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between p-4 rounded-xl bg-dark-800/50">
                <div>
                  <p className="text-sm font-medium text-white">{r.exam?.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                    <span>{r.questionsAttempted} questions attempted</span>
                    <span>{r.testCasesPassed}/{r.totalTestCases} test cases</span>
                    <span>{Math.floor(r.timeTakenSeconds / 60)}m {r.timeTakenSeconds % 60}s</span>
                  </div>
                </div>
                <span className={`text-lg font-bold ${r.finalScore >= 80 ? 'text-green-400' : r.finalScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                  {r.finalScore.toFixed(1)}/100
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
