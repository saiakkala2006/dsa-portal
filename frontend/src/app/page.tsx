'use client';

import Link from 'next/link';
import { Code2, Shield, GraduationCap, Zap, Terminal, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-dark-900 bg-mesh">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-3xl" />
        </div>

        <nav className="relative z-10 flex items-center justify-between px-6 lg:px-12 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">DSA Exam Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/login"
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-dark-300 hover:text-white transition-colors"
            >
              Admin Login
            </Link>
            <Link
              href="/student/login"
              className="px-5 py-2.5 rounded-xl text-sm font-medium gradient-bg text-white hover:opacity-90 transition-opacity shadow-lg shadow-primary-500/25"
            >
              Student Login
            </Link>
          </div>
        </nav>

        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-12 pt-20 pb-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 text-sm text-primary-300">
              <Zap className="w-4 h-4" />
              <span>Powered by Judge0 Code Execution Engine</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
              <span className="text-white">Master Your</span>
              <br />
              <span className="gradient-text">DSA Skills</span>
            </h1>

            <p className="text-lg lg:text-xl text-dark-400 max-w-2xl mx-auto mb-12 leading-relaxed">
              A secure, proctored online examination platform for Data Structures and Algorithms.
              Write, test, and submit code in Python, Java, C, and C++.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/student/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold gradient-bg text-white hover:opacity-90 transition-all shadow-lg shadow-primary-500/25 flex items-center justify-center gap-2"
              >
                <GraduationCap className="w-5 h-5" />
                Start Exam
              </Link>
              <Link
                href="/admin/login"
                className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold glass text-white hover:bg-dark-700 transition-all flex items-center justify-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Admin Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-12 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Everything You Need
          </h2>
          <p className="text-dark-400 text-lg max-w-2xl mx-auto">
            A complete examination platform with real-time code execution, proctoring, and analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Code2,
              title: 'Monaco Code Editor',
              description: 'Full-featured code editor with syntax highlighting, auto-completion, and support for Python, Java, C, and C++.',
              color: 'from-blue-500 to-cyan-500',
            },
            {
              icon: Shield,
              title: 'Secure Proctoring',
              description: 'Tab switch detection, fullscreen enforcement, copy/paste blocking, and real-time monitoring dashboard.',
              color: 'from-red-500 to-orange-500',
            },
            {
              icon: Zap,
              title: 'Real-time Execution',
              description: 'Code is compiled and executed on secure sandboxed containers via Judge0 with time and memory limits.',
              color: 'from-yellow-500 to-amber-500',
            },
            {
              icon: CheckCircle,
              title: 'Automated Scoring',
              description: 'Run code against hidden test cases. Scores computed automatically with per-test-case breakdown.',
              color: 'from-green-500 to-emerald-500',
            },
            {
              icon: GraduationCap,
              title: 'Exam Management',
              description: 'Create exams, assign questions, set schedules, configure proctoring rules, and publish results.',
              color: 'from-purple-500 to-pink-500',
            },
            {
              icon: Terminal,
              title: 'Bulk Import/Export',
              description: 'Upload students and questions via CSV/Excel. Export results with full breakdown to spreadsheets.',
              color: 'from-primary-500 to-violet-500',
            },
          ].map((feature, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-6 card-hover group"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-dark-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-dark-700/50 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-dark-500">
          <span>© 2024 DSA Exam Portal. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>System Operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
