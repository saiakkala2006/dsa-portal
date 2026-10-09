'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { Users, BookOpen, ClipboardList, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    students: 0,
    questions: 0,
    exams: 0,
    activeExams: 0,
  });
  const [recentExams, setRecentExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [studentsRes, questionsRes, examsRes] = await Promise.all([
        adminApi.getStudents(1, 1),
        adminApi.getQuestions(1, 1),
        adminApi.getExams(),
      ]);

      const exams = examsRes.data.exams || [];
      const now = new Date();

      setStats({
        students: studentsRes.data.pagination?.total || 0,
        questions: questionsRes.data.pagination?.total || 0,
        exams: exams.length,
        activeExams: exams.filter((e: any) => new Date(e.startAt) <= now && new Date(e.endAt) >= now && e.isPublished).length,
      });

      setRecentExams(exams.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  const statCards = [
    { label: 'Total Students', value: stats.students, icon: Users, color: 'from-blue-500 to-cyan-500', href: '/admin/students' },
    { label: 'Question Bank', value: stats.questions, icon: BookOpen, color: 'from-purple-500 to-pink-500', href: '/admin/questions' },
    { label: 'Total Exams', value: stats.exams, icon: ClipboardList, color: 'from-amber-500 to-orange-500', href: '/admin/exams' },
    { label: 'Active Exams', value: stats.activeExams, icon: TrendingUp, color: 'from-green-500 to-emerald-500', href: '/admin/exams' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white mb-1">Dashboard</h2>
        <p className="text-dark-400 text-sm">Overview of your exam portal</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Link
            key={i}
            href={card.href}
            className="glass rounded-2xl p-5 card-hover group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{card.value}</p>
            <p className="text-sm text-dark-400">{card.label}</p>
          </Link>
        ))}
      </div>

      {/* Recent Exams */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Recent Exams</h3>
          <Link href="/admin/exams" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
            View all →
          </Link>
        </div>

        {recentExams.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No exams created yet</p>
            <Link href="/admin/exams" className="text-sm text-primary-400 mt-2 inline-block">
              Create your first exam →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentExams.map((exam: any) => {
              const now = new Date();
              const isActive = new Date(exam.startAt) <= now && new Date(exam.endAt) >= now;
              const isPast = new Date(exam.endAt) < now;

              return (
                <Link
                  key={exam.id}
                  href={`/admin/exams/${exam.id}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-dark-800/50 hover:bg-dark-700/50 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : isPast ? 'bg-dark-500' : 'bg-amber-500'}`} />
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-primary-300 transition-colors">{exam.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-dark-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {exam.durationMinutes} min
                        </span>
                        <span>{exam._count?.questions || 0} questions</span>
                        <span>{exam._count?.sessions || 0} submissions</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {exam.isPublished ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">Published</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-dark-600 text-dark-400">Draft</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
