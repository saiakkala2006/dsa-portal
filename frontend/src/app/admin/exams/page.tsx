'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  ClipboardList, Plus, Clock, Users, BookOpen, Eye, EyeOff, BarChart3, Trash2, X, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import DateTimePicker from '@/components/DateTimePicker';

export default function AdminExamsPage() {
  const [exams, setExams] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', durationMinutes: 60,
    startAt: '', endAt: '', allowedLanguages: ['python', 'java', 'c', 'cpp'],
    maxTabSwitches: 5, autoSubmitAfterTabSwitches: true,
    fullscreenRequired: true, tabSwitchPenalty: 0, questionIds: [] as string[],
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [examsRes, questionsRes] = await Promise.all([
        adminApi.getExams(),
        adminApi.getQuestions(1, 200),
      ]);
      setExams(examsRes.data.exams || []);
      setQuestions(questionsRes.data.questions || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.startAt || !form.endAt) {
      toast.error('Please select both start and end time');
      return;
    }
    if (new Date(form.endAt) <= new Date(form.startAt)) {
      toast.error('End time must be after start time');
      return;
    }
    try {
      await adminApi.createExam(form);
      toast.success('Exam created successfully');
      setShowCreate(false);
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create exam');
    }
  };

  const togglePublish = async (id: string, current: boolean) => {
    try {
      await adminApi.publishExam(id, !current);
      toast.success(current ? 'Exam unpublished' : 'Exam published');
      loadData();
    } catch (error) {
      toast.error('Failed to update exam');
    }
  };

  const toggleResults = async (id: string, current: boolean) => {
    try {
      await adminApi.publishResults(id, !current);
      toast.success(current ? 'Results hidden' : 'Results published & scores computed');
      loadData();
    } catch (error) {
      toast.error('Failed to update results');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this exam and all associated data?')) return;
    try {
      await adminApi.deleteExam(id);
      toast.success('Exam deleted');
      loadData();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const exportResults = async (id: string, title: string) => {
    try {
      const response = await adminApi.exportResults(id);
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, '_')}_results.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Results exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const toggleQuestion = (qId: string) => {
    setForm(prev => ({
      ...prev,
      questionIds: prev.questionIds.includes(qId)
        ? prev.questionIds.filter(id => id !== qId)
        : [...prev.questionIds, qId],
    }));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Exams</h2>
          <p className="text-dark-400 text-sm mt-1">{exams.length} exams</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-sm font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-primary-500/25"
        >
          <Plus className="w-4 h-4" />
          Create Exam
        </button>
      </div>

      {/* Exams List */}
      <div className="space-y-4">
        {exams.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <ClipboardList className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No exams created yet</p>
          </div>
        ) : (
          exams.map((exam: any) => {
            const now = new Date();
            const isActive = new Date(exam.startAt) <= now && new Date(exam.endAt) >= now;
            const isPast = new Date(exam.endAt) < now;
            const isFuture = new Date(exam.startAt) > now;

            return (
              <div key={exam.id} className="glass rounded-2xl p-5 card-hover">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-semibold text-white">{exam.title}</h3>
                      {isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>}
                      {isFuture && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">Upcoming</span>}
                      {isPast && <span className="text-xs px-2 py-0.5 rounded-full bg-dark-600 text-dark-400">Ended</span>}
                      {exam.isPublished ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400">Published</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-dark-600 text-dark-400">Draft</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-dark-400">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{exam.durationMinutes} min</span>
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{exam._count?.questions || 0} questions</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{exam._count?.sessions || 0} submissions</span>
                      <span>
                        {format(new Date(exam.startAt), 'MMM d, yyyy HH:mm')} → {format(new Date(exam.endAt), 'MMM d, yyyy HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Link
                      href={`/admin/exams/${exam.id}`}
                      className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-all"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => togglePublish(exam.id, exam.isPublished)}
                      className={`p-2 rounded-lg transition-all ${exam.isPublished ? 'hover:bg-amber-500/10 text-amber-400' : 'hover:bg-green-500/10 text-green-400'}`}
                      title={exam.isPublished ? 'Unpublish' : 'Publish'}
                    >
                      {exam.isPublished ? <EyeOff className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => toggleResults(exam.id, exam.resultsPublished)}
                      className={`p-2 rounded-lg transition-all ${exam.resultsPublished ? 'text-green-400 hover:bg-green-500/10' : 'text-dark-400 hover:bg-dark-700'}`}
                      title={exam.resultsPublished ? 'Hide results' : 'Publish results'}
                    >
                      <BarChart3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => exportResults(exam.id, exam.title)}
                      className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-all"
                      title="Export results"
                    >
                      📊
                    </button>
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Exam Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-6 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-3xl border border-dark-700 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Create Exam</h3>
              <button onClick={() => setShowCreate(false)} className="text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 pb-24">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500 resize-y" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Duration (minutes) *</label>
                  <input
                    type="number"
                    min="1"
                    value={form.durationMinutes}
                    onChange={(e) => {
                      const mins = parseInt(e.target.value) || 60;
                      setForm(prev => {
                        const updated: any = { ...prev, durationMinutes: mins };
                        // Automatically update endAt if startAt is already set
                        if (prev.startAt) {
                          const startD = new Date(prev.startAt);
                          const endD = new Date(startD.getTime() + mins * 60000);
                          updated.endAt = endD.toISOString();
                        }
                        return updated;
                      });
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <DateTimePicker
                    label="Start Time"
                    value={form.startAt}
                    onChange={(val) => {
                      setForm(prev => {
                        const updated: any = { ...prev, startAt: val };
                        // If endAt is empty, automatically suggest endAt = startAt + duration
                        if (!prev.endAt && val) {
                          const startD = new Date(val);
                          const endD = new Date(startD.getTime() + (prev.durationMinutes || 60) * 60000);
                          updated.endAt = endD.toISOString();
                        }
                        return updated;
                      });
                    }}
                    required
                    placeholder="Choose start time"
                  />
                </div>
                <div>
                  <DateTimePicker
                    label="End Time"
                    value={form.endAt}
                    onChange={(val) => setForm(prev => ({ ...prev, endAt: val }))}
                    required
                    placeholder="Choose end time"
                  />
                </div>
              </div>

              {/* Proctoring Settings */}
              <div className="p-4 rounded-xl bg-dark-900 border border-dark-700 space-y-3">
                <h4 className="text-sm font-semibold text-dark-300">Proctoring Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Max Tab Switches</label>
                    <input type="number" value={form.maxTabSwitches} onChange={(e) => setForm({ ...form, maxTabSwitches: parseInt(e.target.value) || 5 })}
                      className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-dark-400 mb-1">Tab Switch Penalty</label>
                    <input type="number" step="0.1" value={form.tabSwitchPenalty} onChange={(e) => setForm({ ...form, tabSwitchPenalty: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 text-sm text-dark-300">
                    <input type="checkbox" checked={form.autoSubmitAfterTabSwitches}
                      onChange={(e) => setForm({ ...form, autoSubmitAfterTabSwitches: e.target.checked })} className="rounded" />
                    Auto-submit after max tab switches
                  </label>
                  <label className="flex items-center gap-2 text-sm text-dark-300">
                    <input type="checkbox" checked={form.fullscreenRequired}
                      onChange={(e) => setForm({ ...form, fullscreenRequired: e.target.checked })} className="rounded" />
                    Fullscreen required
                  </label>
                </div>
              </div>

              {/* Question Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Select Questions ({form.questionIds.length} selected)
                </label>
                <div className="max-h-60 overflow-y-auto space-y-2 p-3 rounded-xl bg-dark-900 border border-dark-700">
                  {questions.length === 0 ? (
                    <p className="text-xs text-dark-500 text-center py-4">No questions available. Create questions first.</p>
                  ) : (
                    questions.map((q: any) => (
                      <label
                        key={q.id}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                          form.questionIds.includes(q.id) ? 'bg-primary-500/10 border border-primary-500/20' : 'hover:bg-dark-800 border border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={form.questionIds.includes(q.id)}
                          onChange={() => toggleQuestion(q.id)}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <p className="text-sm text-white">{q.title}</p>
                          <p className="text-xs text-dark-400">{q.maxMarks} marks · {q._count?.testCases || q.testCases?.length || 0} test cases</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-all">
                Create Exam
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
