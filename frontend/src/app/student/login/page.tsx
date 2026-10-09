'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { GraduationCap, Hash, Lock, ArrowRight, Terminal } from 'lucide-react';

export default function StudentLoginPage() {
  const [regNo, setRegNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await authApi.studentLogin(regNo, password);
      login(data.user, data.token);
      toast.success(`Welcome, ${data.user.name}!`);
      router.push('/student/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 bg-mesh flex items-center justify-center p-6">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">DSA Exam Portal</span>
          </Link>
          <div className="flex items-center justify-center gap-2 mb-2">
            <GraduationCap className="w-6 h-6 text-green-400" />
            <h1 className="text-2xl font-bold text-white">Student Portal</h1>
          </div>
          <p className="text-dark-400 text-sm">Sign in with your registration number</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Registration Number</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="STU001"
                required
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-dark-800 border border-dark-600 text-white placeholder-dark-500 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90 transition-all shadow-lg shadow-green-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="spinner" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center">
            <Link href="/admin/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
              Admin login →
            </Link>
          </div>
        </form>

        <p className="text-center text-xs text-dark-500 mt-6">
          Sample: STU001 / student123
        </p>
      </div>
    </div>
  );
}
