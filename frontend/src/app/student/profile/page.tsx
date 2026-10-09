'use client';

import { useEffect, useState } from 'react';
import { studentApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { User, Trophy, Clock, BookOpen, Hash } from 'lucide-react';

export default function StudentProfilePage() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const { data } = await studentApi.getProfile();
      setProfile(data);
    } catch (error) {
      console.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><div className="spinner w-8 h-8" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <h2 className="text-2xl font-bold text-white">Profile</h2>

      {/* Student Info */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{profile?.student?.name || user?.name}</h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-dark-400">
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{profile?.student?.regNo || user?.regNo}</span>
              <span>{profile?.student?.className || user?.className}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Published Results */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          Published Results
        </h3>

        {(!profile?.results || profile.results.length === 0) ? (
          <div className="text-center py-8">
            <Trophy className="w-10 h-10 text-dark-600 mx-auto mb-2" />
            <p className="text-dark-500 text-sm">No published results yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.results.map((r: any) => (
              <div key={r.id} className="p-4 rounded-xl bg-dark-800/50">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white">{r.exam?.title}</h4>
                  <span className={`text-lg font-bold ${r.finalScore >= 80 ? 'text-green-400' : r.finalScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {r.finalScore.toFixed(1)}/100
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-xs text-dark-400">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {r.questionsAttempted} attempted
                  </div>
                  <div>
                    {r.testCasesPassed}/{r.totalTestCases} test cases
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {Math.floor(r.timeTakenSeconds / 60)}m {r.timeTakenSeconds % 60}s
                  </div>
                  <div>
                    Tab switches: {r.tabSwitchCount}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
