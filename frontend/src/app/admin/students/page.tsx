'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { Users, Upload, Plus, Search, Trash2, X, Download, Eye } from 'lucide-react';

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '', regNo: '', className: '', email: '', password: '',
  });

  const loadStudents = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await adminApi.getStudents(page, 50, search);
      setStudents(data.students || []);
      setPagination(data.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (error: any) {
      toast.error('Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data } = await adminApi.uploadStudents(file);
      setUploadResult(data);
      toast.success(`${data.created} students uploaded successfully`);
      loadStudents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    }
    e.target.value = '';
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await adminApi.createStudent(createForm);
      toast.success(`Student ${createForm.name} created`);
      if (data.generatedPassword) {
        toast.success(`Generated password: ${data.generatedPassword}`, { duration: 10000 });
      }
      setShowCreate(false);
      setCreateForm({ name: '', regNo: '', className: '', email: '', password: '' });
      loadStudents();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Creation failed');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteStudent(id);
      toast.success('Student deleted');
      loadStudents();
    } catch (error: any) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Students</h2>
          <p className="text-dark-400 text-sm mt-1">{pagination.total} students registered</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-sm font-medium text-white hover:bg-dark-700 transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload CSV/Excel
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl gradient-bg text-sm font-medium text-white hover:opacity-90 transition-all shadow-lg shadow-primary-500/25"
          >
            <Plus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
        <input
          type="text"
          placeholder="Search by name, reg no, or class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-dark-800 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 transition-all text-sm"
        />
      </div>

      {/* Students Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-700/50">
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Student</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Reg No</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Class</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Email</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-dark-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/30">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="spinner mx-auto" />
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-dark-500">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((s) => (
                  <tr key={s.id} className="hover:bg-dark-700/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                          {s.name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-white">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-dark-300 font-mono">{s.regNo}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-dark-300">{s.className}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-dark-400">{s.email || s.user?.email || '-'}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(s.id, s.name)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-dark-500 hover:text-red-400 transition-all"
                        title="Delete student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-dark-700/50">
            <span className="text-sm text-dark-400">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => loadStudents(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 rounded-lg text-sm bg-dark-700 text-white disabled:opacity-30"
              >
                Previous
              </button>
              <button
                onClick={() => loadStudents(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 rounded-lg text-sm bg-dark-700 text-white disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowUpload(false)}>
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Upload Students</h3>
              <button onClick={() => setShowUpload(false)} className="text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-dark-600 rounded-xl p-8 text-center">
                <Upload className="w-8 h-8 text-dark-500 mx-auto mb-3" />
                <p className="text-sm text-dark-400 mb-2">Upload CSV or Excel file</p>
                <p className="text-xs text-dark-500 mb-4">Columns: name, regNo, className, email (optional), password (optional)</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gradient-bg text-white text-sm cursor-pointer hover:opacity-90">
                  <Upload className="w-4 h-4" />
                  Choose File
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleUpload} className="hidden" />
                </label>
              </div>

              {uploadResult && (
                <div className="rounded-xl bg-dark-900 p-4 space-y-2">
                  <p className="text-sm text-green-400">✅ {uploadResult.created} students created</p>
                  {uploadResult.errors?.length > 0 && (
                    <div>
                      <p className="text-sm text-red-400 mb-1">Errors:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {uploadResult.errors.map((err: any, i: number) => (
                          <p key={i} className="text-xs text-dark-400">Row {err.row}: {err.message}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {uploadResult.credentials?.length > 0 && (
                    <div>
                      <p className="text-sm text-amber-400 mb-1">Generated Passwords:</p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {uploadResult.credentials.map((c: any, i: number) => (
                          <p key={i} className="text-xs text-dark-300 font-mono">{c.regNo}: {c.password}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Student Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={() => setShowCreate(false)}>
          <div className="bg-dark-800 rounded-2xl p-6 w-full max-w-lg border border-dark-700" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Add Student</h3>
              <button onClick={() => setShowCreate(false)} className="text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Reg No *</label>
                  <input
                    type="text"
                    value={createForm.regNo}
                    onChange={(e) => setCreateForm({ ...createForm, regNo: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-1">Class *</label>
                  <input
                    type="text"
                    value={createForm.className}
                    onChange={(e) => setCreateForm({ ...createForm, className: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-1">Password (auto-generated if blank)</label>
                <input
                  type="text"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Leave blank to auto-generate"
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-900 border border-dark-600 text-white text-sm focus:outline-none focus:border-primary-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-all"
              >
                Create Student
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
