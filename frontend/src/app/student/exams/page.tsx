'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { studentApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { ClipboardList, Clock, BookOpen, ArrowRight, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadExams();
  }, []);

  async function loadExams() {
    try {
      const { data } = await studentApi.getExams();
      setExams(data.exams || []);
    } catch (error) {
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  }

  const startExam = async (examId: string) => {
    try {
      const { data } = await studentApi.startExam(examId);
      router.push(`/student/exam/${data.session.id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to start exam');
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-white">Available Exams</h2>
        <p className="text-dark-400 text-sm mt-1">{exams.length} exams</p>
      </div>

      {exams.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <ClipboardList className="w-12 h-12 text-dark-600 mx-auto mb-3" />
          <p className="text-dark-400">No exams available right now</p>
        </div>
      ) : (
        <div className="space-y-4">
          {exams.map((exam: any) => {
            const now = new Date();
            const started = new Date(exam.startAt) <= now;
            const ended = new Date(exam.endAt) < now;

            return (
              <div key={exam.id} className="glass rounded-2xl p-6 card-hover">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white">{exam.title}</h3>
                      {exam.isActive && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />In Progress
                        </span>
                      )}
                      {exam.sessionStatus === 'SUBMITTED' && (
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />Completed
                        </span>
                      )}
                    </div>

                    {exam.description && <p className="text-sm text-dark-400 mb-3">{exam.description}</p>}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-dark-400">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{exam.durationMinutes} minutes</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-4 h-4" />{exam.questionCount} questions</span>
                      <span>Languages: {exam.allowedLanguages?.join(', ')}</span>
                      {exam.fullscreenRequired && (
                        <span className="flex items-center gap-1 text-amber-400"><Lock className="w-3 h-3" />Fullscreen required</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-xs text-dark-500">
                      <span>Start: {format(new Date(exam.startAt), 'MMM d, yyyy HH:mm')}</span>
                      <span>End: {format(new Date(exam.endAt), 'MMM d, yyyy HH:mm')}</span>
                    </div>

                    {exam.fullscreenRequired && (
                      <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-300">
                          <p className="font-semibold">Proctored Exam</p>
                          <p className="text-amber-400/70">Tab switches and fullscreen exits will be monitored. Max {exam.maxTabSwitches || 5} tab switches allowed.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-6">
                    {exam.canStart ? (
                      <button
                        onClick={() => startExam(exam.id)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-green-500/25"
                      >
                        Start Exam
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : exam.isActive ? (
                      <button
                        onClick={() => {
                          // Resume exam
                          const sessionId = exam.sessions?.[0]?.id;
                          if (sessionId) router.push(`/student/exam/${sessionId}`);
                          else startExam(exam.id);
                        }}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-semibold hover:opacity-90 transition-all shadow-lg shadow-amber-500/25"
                      >
                        Resume
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    ) : !started ? (
                      <span className="text-sm text-dark-500">Not started yet</span>
                    ) : ended ? (
                      <span className="text-sm text-dark-500">Ended</span>
                    ) : (
                      <span className="text-sm text-dark-500">Completed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
