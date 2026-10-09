'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import {
  BookOpen, Plus, Search, Trash2, X, Upload, Edit3, ChevronDown, ChevronUp, Save, Download
} from 'lucide-react';

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '', description: '', constraints: '', inputFormat: '', outputFormat: '',
    sampleInput: '', sampleOutput: '', maxMarks: 100,
    allowedLanguages: ['python', 'java', 'c', 'cpp'],
    starterCodePython: '', starterCodeJava: '', starterCodeC: '', starterCodeCpp: '',
    timeLimitMs: 2000, memoryLimitKb: 262144,
    testCases: [{ input: '', expectedOutput: '', isSample: true, weight: 1.0, order: 1 }],
  });

  const loadQuestions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await adminApi.getQuestions(page, 50, search);
      setQuestions(data.questions || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const resetForm = () => {
    setForm({
      title: '', description: '', constraints: '', inputFormat: '', outputFormat: '',
      sampleInput: '', sampleOutput: '', maxMarks: 100,
      allowedLanguages: ['python', 'java', 'c', 'cpp'],
      starterCodePython: '', starterCodeJava: '', starterCodeC: '', starterCodeCpp: '',
      timeLimitMs: 2000, memoryLimitKb: 262144,
      testCases: [{ input: '', expectedOutput: '', isSample: true, weight: 1.0, order: 1 }],
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await adminApi.updateQuestion(editingId, form);
        toast.success('Question updated');
      } else {
        await adminApi.createQuestion(form);
        toast.success('Question created');
      }
      setShowCreate(false);
      setEditingId(null);
      resetForm();
      loadQuestions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save question');
    }
  };

  const handleEdit = (q: any) => {
    setForm({
      title: q.title, description: q.description, constraints: q.constraints || '',
      inputFormat: q.inputFormat || '', outputFormat: q.outputFormat || '',
      sampleInput: q.sampleInput || '', sampleOutput: q.sampleOutput || '',
      maxMarks: q.maxMarks, allowedLanguages: q.allowedLanguages || ['python', 'java', 'c', 'cpp'],
      starterCodePython: q.starterCodePython || '', starterCodeJava: q.starterCodeJava || '',
      starterCodeC: q.starterCodeC || '', starterCodeCpp: q.starterCodeCpp || '',
      timeLimitMs: q.timeLimitMs || 2000, memoryLimitKb: q.memoryLimitKb || 262144,
      testCases: q.testCases?.length > 0 ? q.testCases.map((tc: any) => ({
        input: tc.input, expectedOutput: tc.expectedOutput,
        isSample: tc.isSample, weight: tc.weight, order: tc.order,
      })) : [{ input: '', expectedOutput: '', isSample: true, weight: 1.0, order: 1 }],
    });
    setEditingId(q.id);
    setShowCreate(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      await adminApi.deleteQuestion(id);
      toast.success('Question deleted');
      loadQuestions();
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await adminApi.uploadQuestions(file);
      toast.success(`${data.created} questions uploaded`);
      if (data.errors?.length > 0) {
        data.errors.forEach((err: any) => toast.error(`Row ${err.row}: ${err.message}`));
      }
      loadQuestions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    }
    e.target.value = '';
  };

  const downloadTemplate = () => {
    const template = [
      {
        title: "Sample Problem: Two Sum",
        description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
        constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9",
        inputFormat: "First line contains n.\nSecond line contains n space-separated integers.\nThird line contains target.",
        outputFormat: "Two space-separated indices.",
        sampleInput: "4\n2 7 11 15\n9",
        sampleOutput: "0 1",
        maxMarks: 100,
        allowedLanguages: ["python", "java", "c", "cpp"],
        timeLimitMs: 2000,
        memoryLimitKb: 262144,
        starterCodePython: "# Read input\nn = int(input())\nnums = list(map(int, input().split()))\ntarget = int(input())\n# Write your code here\n",
        testCases: [
          { input: "4\n2 7 11 15\n9", expectedOutput: "0 1", isSample: true, weight: 1.0, order: 1 },
          { input: "3\n3 2 4\n6", expectedOutput: "1 2", isSample: true, weight: 1.0, order: 2 },
          { input: "2\n3 3\n6", expectedOutput: "0 1", isSample: false, weight: 1.0, order: 3 }
        ]
      }
    ];
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions_template.json';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Sample JSON template downloaded');
  };

  const addTestCase = () => {
    setForm(prev => ({
      ...prev,
      testCases: [...prev.testCases, { input: '', expectedOutput: '', isSample: false, weight: 1.0, order: prev.testCases.length + 1 }],
    }));
  };

  const removeTestCase = (idx: number) => {
    setForm(prev => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== idx),
    }));
  };

  const updateTestCase = (idx: number, field: string, value: any) => {
    setForm(prev => ({
      ...prev,
      testCases: prev.testCases.map((tc, i) => i === idx ? { ...tc, [field]: value } : tc),
    }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Question Bank</h2>
          <p className="text-dark-400 text-sm mt-1">{pagination.total} questions</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-sm font-medium text-white hover:bg-dark-700 transition-all shadow-sm"
            title="Download sample JSON template"
          >
            <Download className="w-4 h-4 text-primary-400" />
            Download Template
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-sm font-medium text-white hover:bg-dark-700 transition-all cursor-pointer shadow-sm">
            <Upload className="w-4 h-4 text-emerald-400" />
            Upload File
            <input type="file" accept=".csv,.xlsx,.xls,.json" onChange={handleUpload} className="hidden" />
          </label>
          <button
            onClick={() => { resetForm(); setEditingId(null); setShowCreate(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-sm font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-primary-500/25"
          >
            <Plus className="w-4 h-4" />
            Add Question
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-all text-sm"
        />
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>
        ) : questions.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <BookOpen className="w-12 h-12 text-dark-600 mx-auto mb-3" />
            <p className="text-dark-400">No questions yet</p>
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.id} className="glass rounded-2xl overflow-hidden card-hover">
              <div
                className="flex items-center justify-between p-5 cursor-pointer"
                onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-semibold text-white">{q.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400">{q.maxMarks} marks</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-dark-600 text-dark-300">{q._count?.testCases || q.testCases?.length || 0} test cases</span>
                  </div>
                  <p className="text-xs text-dark-400 line-clamp-1">{q.description?.substring(0, 120)}...</p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={(e) => { e.stopPropagation(); handleEdit(q); }} className="p-2 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-white transition-all">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(q.id); }} className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-all">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedId === q.id ? <ChevronUp className="w-4 h-4 text-dark-400" /> : <ChevronDown className="w-4 h-4 text-dark-400" />}
                </div>
              </div>

              {expandedId === q.id && (
                <div className="px-5 pb-5 border-t border-dark-700/50 pt-4 space-y-3 animate-slide-down">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-dark-500">Languages:</span>
                      <span className="ml-2 text-dark-300">{q.allowedLanguages?.join(', ')}</span>
                    </div>
                    <div>
                      <span className="text-dark-500">Time Limit:</span>
                      <span className="ml-2 text-dark-300">{q.timeLimitMs}ms</span>
                    </div>
                  </div>
                  {q.testCases?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-dark-400 mb-2">Test Cases:</p>
                      <div className="space-y-2">
                        {q.testCases.map((tc: any, i: number) => (
                          <div key={tc.id} className="flex items-start gap-3 text-xs p-2 rounded-lg bg-dark-800/50">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${tc.isSample ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>
                              {tc.isSample ? 'Sample' : 'Hidden'}
                            </span>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-dark-500">Input:</span>
                                <pre className="text-dark-300 whitespace-pre-wrap mt-0.5">{tc.input}</pre>
                              </div>
                              <div>
                                <span className="text-dark-500">Expected:</span>
                                <pre className="text-dark-300 whitespace-pre-wrap mt-0.5">{tc.expectedOutput}</pre>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center p-6 overflow-y-auto" onClick={() => setShowCreate(false)}>
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-3xl border border-dark-700 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">{editingId ? 'Edit Question' : 'Create Question'}</h3>
              <button onClick={() => setShowCreate(false)} className="text-dark-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Description *</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={4}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500 resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Input Format</label>
                  <textarea value={form.inputFormat} onChange={(e) => setForm({ ...form, inputFormat: e.target.value })} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500 resize-y" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Output Format</label>
                  <textarea value={form.outputFormat} onChange={(e) => setForm({ ...form, outputFormat: e.target.value })} rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500 resize-y" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Constraints</label>
                <textarea value={form.constraints} onChange={(e) => setForm({ ...form, constraints: e.target.value })} rows={2}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500 resize-y" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Max Marks</label>
                  <input type="number" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: parseInt(e.target.value) || 100 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Time Limit (ms)</label>
                  <input type="number" value={form.timeLimitMs} onChange={(e) => setForm({ ...form, timeLimitMs: parseInt(e.target.value) || 2000 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Memory Limit (KB)</label>
                  <input type="number" value={form.memoryLimitKb} onChange={(e) => setForm({ ...form, memoryLimitKb: parseInt(e.target.value) || 262144 })}
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500" />
                </div>
              </div>

              {/* Starter Code */}
              <details className="group">
                <summary className="text-sm font-medium text-dark-300 cursor-pointer hover:text-white">Starter Code (click to expand)</summary>
                <div className="mt-3 space-y-3">
                  {['Python', 'Java', 'C', 'Cpp'].map((lang) => {
                    const key = `starterCode${lang}` as keyof typeof form;
                    return (
                      <div key={lang}>
                        <label className="block text-xs font-medium text-dark-400 mb-1">{lang}</label>
                        <textarea value={form[key] as string} onChange={(e) => setForm({ ...form, [key]: e.target.value })} rows={3}
                          className="w-full px-4 py-2 rounded-lg bg-dark-900 border border-dark-600 text-white text-xs font-mono focus:outline-none focus:border-primary-500 resize-y" />
                      </div>
                    );
                  })}
                </div>
              </details>

              {/* Test Cases */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-dark-300">Test Cases</label>
                  <button type="button" onClick={addTestCase} className="text-xs px-3 py-1 rounded-lg bg-primary-500/10 text-primary-400 hover:bg-primary-500/20">
                    + Add Test Case
                  </button>
                </div>
                <div className="space-y-3">
                  {form.testCases.map((tc, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-dark-900 border border-dark-700 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-dark-400">Test Case #{idx + 1}</span>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-dark-400">
                            <input type="checkbox" checked={tc.isSample} onChange={(e) => updateTestCase(idx, 'isSample', e.target.checked)}
                              className="rounded" />
                            Sample
                          </label>
                          {form.testCases.length > 1 && (
                            <button type="button" onClick={() => removeTestCase(idx)} className="text-red-400 hover:text-red-300">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-dark-500 mb-1">Input</label>
                          <textarea value={tc.input} onChange={(e) => updateTestCase(idx, 'input', e.target.value)} rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-xs font-mono focus:outline-none focus:border-primary-500 resize-y" />
                        </div>
                        <div>
                          <label className="block text-xs text-dark-500 mb-1">Expected Output</label>
                          <textarea value={tc.expectedOutput} onChange={(e) => updateTestCase(idx, 'expectedOutput', e.target.value)} rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-dark-800 border border-dark-600 text-white text-xs font-mono focus:outline-none focus:border-primary-500 resize-y" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />
                {editingId ? 'Update Question' : 'Create Question'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
