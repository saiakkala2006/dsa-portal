'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { studentApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import {
  Clock, Play, Send, ChevronLeft, ChevronRight, AlertTriangle, Maximize,
  CheckCircle, XCircle, Code2, LogOut, Eye, X, Terminal, Lock, AlertCircle,
  ChevronUp, ChevronDown, FileText, ArrowUpRight
} from 'lucide-react';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANGUAGE_MAP: Record<string, string> = {
  python: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
};

const LANGUAGE_LABELS: Record<string, string> = {
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
};

// Parser to extract line numbers and error summaries from compiler/runtime errors
function parseErrorLocation(errorText: string | null): { line: number; col?: number; message: string } | null {
  if (!errorText) return null;

  // Python: File "...", line 4, in ...
  const pyMatch = errorText.match(/line\s+(\d+)(?:,\s*in\s+[^\n]+)?(?:\n\s*[^\n]+)?(?:\n\s*\^+\s*)?\n\s*([A-Za-z]+Error:[^\n]+)/i);
  if (pyMatch) {
    return { line: parseInt(pyMatch[1], 10), message: pyMatch[2].trim() };
  }

  // Python syntax: File "script.py", line 3
  const pySyntaxMatch = errorText.match(/File\s+["'][^"']+["'],\s*line\s+(\d+)/i);
  const errorNameMatch = errorText.match(/([A-Za-z]+Error:[^\n]+)/);
  if (pySyntaxMatch) {
    return {
      line: parseInt(pySyntaxMatch[1], 10),
      message: errorNameMatch ? errorNameMatch[1].trim() : 'Syntax error on line ' + pySyntaxMatch[1],
    };
  }

  // Java: Main.java:6: error: cannot find symbol
  const javaMatch = errorText.match(/(?:Main\.java|Solution\.java|\.java):(\d+):(?:\s*error:\s*)?([^\n]+)/i);
  if (javaMatch) {
    return { line: parseInt(javaMatch[1], 10), message: javaMatch[2].trim() };
  }

  // C / C++: solution.cpp:8:12: error: expected ';'
  const cppMatch = errorText.match(/(?:\.cpp|\.c|main\.c|main\.cpp):(\d+):(\d+)?:?\s*error:\s*([^\n]+)/i);
  if (cppMatch) {
    return {
      line: parseInt(cppMatch[1], 10),
      col: cppMatch[2] ? parseInt(cppMatch[2], 10) : 1,
      message: cppMatch[3].trim(),
    };
  }

  // Generic fallback: line 4
  const genericLine = errorText.match(/line\s+(\d+)/i);
  if (genericLine) {
    return {
      line: parseInt(genericLine[1], 10),
      message: errorNameMatch ? errorNameMatch[1].trim() : 'Error on line ' + genericLine[1],
    };
  }

  return null;
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const { user } = useAuthStore();

  const [examData, setExamData] = useState<any>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [language, setLanguage] = useState('python');
  const [codeMap, setCodeMap] = useState<Record<string, Record<string, string>>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [fullscreenExitCount, setFullscreenExitCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [runResults, setRunResults] = useState<any[]>([]);
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  const [activeResultTestCaseIdx, setActiveResultTestCaseIdx] = useState(0);
  const [compileError, setCompileError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Draggable console slider states
  const [consoleHeight, setConsoleHeight] = useState(260);
  const [isDragging, setIsDragging] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState<'testcases' | 'results'>('testcases');
  const [selectedSampleTestCaseIdx, setSelectedSampleTestCaseIdx] = useState(0);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(260);

  const [loading, setLoading] = useState(true);
  const [examFinished, setExamFinished] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');

  const autosaveRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load exam data
  useEffect(() => {
    loadExamData();
    return () => {
      if (autosaveRef.current) clearInterval(autosaveRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId]);

  async function loadExamData() {
    try {
      const { data } = await studentApi.getSession(sessionId);
      if (!data || data.status !== 'IN_PROGRESS') {
        toast.error('Exam session is not active');
        router.push('/student/dashboard');
        return;
      }

      setExamData(data);
      const qs = data.exam?.questions?.map((eq: any) => ({
        ...eq.question,
        order: eq.order,
        maxMarks: eq.maxMarksOverride || eq.question.maxMarks,
        sampleTestCases: eq.question.testCases || [],
      })) || [];
      setQuestions(qs);

      // Initialize code map with starter code
      const initCode: Record<string, Record<string, string>> = {};
      qs.forEach((q: any) => {
        initCode[q.id] = {
          python: q.starterCodePython || '',
          java: q.starterCodeJava || '',
          c: q.starterCodeC || '',
          cpp: q.starterCodeCpp || '',
        };
      });

      // Load saved code from submissions
      if (data.submissions) {
        data.submissions.forEach((sub: any) => {
          if (sub.questionId && sub.language && sub.sourceCode) {
            if (!initCode[sub.questionId]) initCode[sub.questionId] = {};
            initCode[sub.questionId][sub.language] = sub.sourceCode;
          }
        });
      }

      setCodeMap(initCode);

      // Calculate time remaining
      const elapsed = Math.floor((Date.now() - new Date(data.startedAt).getTime()) / 1000);
      const total = (data.exam?.durationMinutes || 60) * 60;
      setTimeRemaining(Math.max(0, total - elapsed));
      setTabSwitchCount(data.tabSwitchCount || 0);
      setFullscreenExitCount(data.fullscreenExitCount || 0);

      setLoading(false);

      // Request fullscreen
      if (data.exam?.fullscreenRequired) {
        requestFullscreen();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load exam');
      router.push('/student/dashboard');
    }
  }

  // Timer
  useEffect(() => {
    if (loading || examFinished) return;
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleFinishExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading, examFinished]);

  // Heartbeat every 15 seconds
  useEffect(() => {
    if (loading || examFinished) return;
    heartbeatRef.current = setInterval(async () => {
      try {
        const { data } = await studentApi.heartbeat(sessionId);
        if (data.status === 'TIMED_OUT') {
          setExamFinished(true);
          toast.error('Time is up! Exam auto-submitted.');
          setTimeout(() => router.push('/student/dashboard'), 3000);
        }
        setTimeRemaining(data.timeRemaining || 0);
      } catch (error) { console.error('Heartbeat failed'); }
    }, 15000);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [loading, examFinished, sessionId]);

  // Autosave every 10 seconds
  useEffect(() => {
    if (loading || examFinished) return;
    autosaveRef.current = setInterval(() => {
      const q = questions[currentQuestionIdx];
      if (q) {
        const code = codeMap[q.id]?.[language] || '';
        if (code.trim()) {
          studentApi.autosave(sessionId, {
            questionId: q.id,
            language,
            sourceCode: code,
          }).catch(() => {});
        }
      }
    }, 10000);
    return () => { if (autosaveRef.current) clearInterval(autosaveRef.current); };
  }, [loading, examFinished, currentQuestionIdx, language, codeMap, questions, sessionId]);

  // Proctoring: detect tab switches and fullscreen exits
  useEffect(() => {
    if (loading || examFinished) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        reportProctorEvent('TAB_SWITCH');
      }
    };

    const handleBlur = () => {
      reportProctorEvent('WINDOW_BLUR');
    };

    const handleFullscreenChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!isFS && examData?.exam?.fullscreenRequired) {
        reportProctorEvent('FULLSCREEN_EXIT');
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      reportProctorEvent('RIGHT_CLICK');
    };

    const handleCopy = (e: ClipboardEvent) => {
      reportProctorEvent('COPY_ATTEMPT');
    };

    const handlePaste = (e: ClipboardEvent) => {
      reportProctorEvent('PASTE_ATTEMPT');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [loading, examFinished, examData]);

  async function reportProctorEvent(type: string) {
    try {
      const { data } = await studentApi.reportProctorEvent(sessionId, { type });
      setTabSwitchCount(data.tabSwitchCount || 0);
      setFullscreenExitCount(data.fullscreenExitCount || 0);

      if (data.autoSubmitted) {
        setExamFinished(true);
        toast.error('Exam auto-submitted due to too many tab switches!');
        setTimeout(() => router.push('/student/dashboard'), 3000);
        return;
      }

      if (type === 'TAB_SWITCH' || type === 'WINDOW_BLUR') {
        const remaining = (data.maxTabSwitches || 5) - data.tabSwitchCount;
        if (remaining <= 2) {
          setWarningMessage(`Warning: ${remaining} tab switches remaining before auto-submit!`);
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 5000);
        }
      }

      if (type === 'FULLSCREEN_EXIT' && examData?.exam?.fullscreenRequired) {
        setWarningMessage('Please return to fullscreen mode!');
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000);
      }
    } catch (error) {
      console.error('Failed to report proctor event');
    }
  }

  function requestFullscreen() {
    try {
      document.documentElement.requestFullscreen?.();
    } catch (e) {
      console.error('Fullscreen request failed');
    }
  }

  const currentQuestion = questions[currentQuestionIdx];
  const currentCode = currentQuestion ? (codeMap[currentQuestion.id]?.[language] || '') : '';

  const handleCodeChange = (value: string | undefined) => {
    if (!currentQuestion || !value) return;
    setCodeMap(prev => ({
      ...prev,
      [currentQuestion.id]: {
        ...prev[currentQuestion.id],
        [language]: value,
      },
    }));
    // Clear execution error squigglies when the student edits code
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelMarkers(model, 'execution-error', []);
      }
    }
  };

  // Dragging event listener for resizing console
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = dragStartYRef.current - e.clientY;
      const newHeight = Math.min(Math.max(dragStartHeightRef.current + deltaY, 44), window.innerHeight - 160);
      setConsoleHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  // Synchronize error markers in Monaco editor on compile/runtime error
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor.getModel();
    if (!model) return;

    const errText = compileError || runtimeError;
    if (!errText) {
      monaco.editor.setModelMarkers(model, 'execution-error', []);
      return;
    }

    const errLoc = parseErrorLocation(errText);
    if (errLoc && errLoc.line <= model.getLineCount()) {
      monaco.editor.setModelMarkers(model, 'execution-error', [
        {
          startLineNumber: errLoc.line,
          startColumn: errLoc.col || 1,
          endLineNumber: errLoc.line,
          endColumn: model.getLineMaxColumn(errLoc.line),
          message: errLoc.message,
          severity: monaco.MarkerSeverity.Error,
        },
      ]);
    } else {
      monaco.editor.setModelMarkers(model, 'execution-error', []);
    }
  }, [compileError, runtimeError]);

  const goToErrorLine = (line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.focus();
    }
  };

  const handleRunSample = async () => {
    if (!currentQuestion || !currentCode.trim()) {
      toast.error('Write some code first');
      return;
    }

    setRunning(true);
    setRunResults([]);
    setSubmissionResult(null);
    setCompileError(null);
    setRuntimeError(null);
    setActiveResultTestCaseIdx(0);
    setActiveConsoleTab('results');
    if (consoleHeight < 180) setConsoleHeight(280);

    try {
      const { data } = await studentApi.runSample(sessionId, {
        questionId: currentQuestion.id,
        language,
        sourceCode: currentCode,
      });
      setRunResults(data.results || []);
      setCompileError(data.compileOutput || null);
      setRuntimeError(data.runtimeError || null);

      const allPassed = data.results?.length > 0 && data.results.every((r: any) => r.passed);
      if (data.compileOutput) {
        toast.error('Compilation Error!');
      } else if (data.runtimeError) {
        toast.error('Runtime Error occurred!');
      } else if (allPassed) {
        toast.success('All sample test cases passed!');
      } else {
        toast.error('Some sample test cases failed');
      }
    } catch (error: any) {
      const err = error.response?.data?.error;
      toast.error(typeof err === 'string' ? err : 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleSubmitCode = async () => {
    if (!currentQuestion || !currentCode.trim()) {
      toast.error('Write some code first');
      return;
    }

    setSubmitting(true);
    setRunResults([]);
    setSubmissionResult(null);
    setCompileError(null);
    setRuntimeError(null);
    setActiveResultTestCaseIdx(0);
    setActiveConsoleTab('results');
    if (consoleHeight < 180) setConsoleHeight(280);

    try {
      const { data } = await studentApi.submitCode(sessionId, {
        questionId: currentQuestion.id,
        language,
        sourceCode: currentCode,
      });
      setSubmissionResult(data);
      setCompileError(data.compileOutput || null);
      setRuntimeError(data.runtimeError || null);

      if (data.status === 'ACCEPTED') {
        toast.success(`Accepted! Score: ${data.score}/${data.maxMarks} (${data.passedTestCases}/${data.totalTestCases} passed)`);
      } else if (data.status === 'COMPILE_ERROR') {
        toast.error('Compilation Error!');
      } else if (data.status === 'RUNTIME_ERROR') {
        toast.error('Runtime Error occurred!');
      } else {
        toast.error(`${data.status?.replace(/_/g, ' ')}: ${data.passedTestCases}/${data.totalTestCases} passed`);
      }
    } catch (error: any) {
      const err = error.response?.data?.error;
      toast.error(typeof err === 'string' ? err : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishExam = async (auto = false) => {
    if (!auto && !confirm('Are you sure you want to submit the exam? This cannot be undone.')) return;

    try {
      await studentApi.finishExam(sessionId, auto);
      setExamFinished(true);
      toast.success('Exam submitted successfully!');
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
      setTimeout(() => router.push('/student/dashboard'), 2000);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit exam');
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-dark-400">Loading exam...</p>
        </div>
      </div>
    );
  }

  if (examFinished) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Exam Submitted</h2>
          <p className="text-dark-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-dark-900 flex flex-col overflow-hidden">
      {/* Warning Overlay */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-500/10 backdrop-blur-sm animate-fade-in" onClick={() => setShowWarning(false)}>
          <div className="bg-dark-800 border-2 border-red-500 rounded-2xl p-8 max-w-md text-center shadow-2xl shadow-red-500/20">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-lg font-bold text-white mb-2">Warning!</p>
            <p className="text-red-300">{warningMessage}</p>
            <button
              onClick={() => { setShowWarning(false); requestFullscreen(); }}
              className="mt-4 px-6 py-2 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-all"
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-b border-dark-700/50 flex-shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-white truncate max-w-[200px]">{examData?.exam?.title}</h1>
          <div className="flex items-center gap-1 text-xs text-dark-400">
            <Eye className="w-3 h-3" />
            Tab: {tabSwitchCount}/{examData?.exam?.maxTabSwitches || 5}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${timeRemaining < 300 ? 'bg-red-500/10 text-red-400 animate-pulse' : 'bg-dark-700 text-white'}`}>
            <Clock className="w-4 h-4" />
            <span className="font-mono font-bold text-sm">{formatTime(timeRemaining)}</span>
          </div>

          {!isFullscreen && examData?.exam?.fullscreenRequired && (
            <button onClick={requestFullscreen} className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs flex items-center gap-1">
              <Maximize className="w-3 h-3" />Fullscreen
            </button>
          )}

          <button
            onClick={() => handleFinishExam(false)}
            className="px-4 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            Submit Exam
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Question Panel (Left) */}
        <div className="w-[400px] flex-shrink-0 flex flex-col border-r border-dark-700/50 bg-dark-800/50">
          {/* Question tabs */}
          <div className="flex items-center gap-1 p-2 border-b border-dark-700/50 overflow-x-auto flex-shrink-0">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                onClick={() => { setCurrentQuestionIdx(idx); setRunResults([]); setSubmissionResult(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  idx === currentQuestionIdx ? 'bg-primary-500/15 text-primary-400' : 'text-dark-400 hover:text-white hover:bg-dark-700/50'
                }`}
              >
                Q{idx + 1}
              </button>
            ))}
          </div>

          {/* Question content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {currentQuestion && (
              <>
                <div>
                  <h2 className="text-base font-bold text-white mb-1">{currentQuestion.title}</h2>
                  <span className="text-xs text-primary-400">{currentQuestion.maxMarks} marks</span>
                </div>

                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-dark-300 leading-relaxed">{currentQuestion.description}</pre>
                </div>

                {currentQuestion.constraints && (
                  <div>
                    <h4 className="text-xs font-semibold text-dark-400 mb-1 uppercase">Constraints</h4>
                    <pre className="text-xs text-dark-300 whitespace-pre-wrap bg-dark-900/50 rounded-lg p-3">{currentQuestion.constraints}</pre>
                  </div>
                )}

                {currentQuestion.inputFormat && (
                  <div>
                    <h4 className="text-xs font-semibold text-dark-400 mb-1 uppercase">Input Format</h4>
                    <pre className="text-xs text-dark-300 whitespace-pre-wrap bg-dark-900/50 rounded-lg p-3">{currentQuestion.inputFormat}</pre>
                  </div>
                )}

                {currentQuestion.outputFormat && (
                  <div>
                    <h4 className="text-xs font-semibold text-dark-400 mb-1 uppercase">Output Format</h4>
                    <pre className="text-xs text-dark-300 whitespace-pre-wrap bg-dark-900/50 rounded-lg p-3">{currentQuestion.outputFormat}</pre>
                  </div>
                )}

                {currentQuestion.sampleTestCases?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-dark-400 mb-2 uppercase">Sample Test Cases</h4>
                    {currentQuestion.sampleTestCases.map((tc: any, i: number) => (
                      <div key={tc.id || i} className="mb-3 rounded-lg bg-dark-900/50 overflow-hidden">
                        <div className="grid grid-cols-2 divide-x divide-dark-700/50">
                          <div className="p-3">
                            <p className="text-xs text-dark-500 mb-1">Input</p>
                            <pre className="text-xs text-dark-300 font-mono whitespace-pre-wrap">{tc.input}</pre>
                          </div>
                          <div className="p-3">
                            <p className="text-xs text-dark-500 mb-1">Expected Output</p>
                            <pre className="text-xs text-dark-300 font-mono whitespace-pre-wrap">{tc.expectedOutput}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Code Editor and Console (Right) */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2 bg-dark-800/80 border-b border-dark-700/60 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-dark-400" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary-500"
              >
                {(examData?.exam?.allowedLanguages || ['python', 'java', 'c', 'cpp']).map((lang: string) => (
                  <option key={lang} value={lang}>{LANGUAGE_LABELS[lang] || lang}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunSample}
                disabled={running || submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
              >
                {running ? <div className="spinner w-3 h-3" /> : <Play className="w-3 h-3" />}
                Run Samples
              </button>
              <button
                onClick={handleSubmitCode}
                disabled={running || submitting}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-primary-500/20"
              >
                {submitting ? <div className="spinner w-3 h-3" /> : <Send className="w-3 h-3" />}
                Submit
              </button>
            </div>
          </div>

          {/* Monaco Editor Container */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <MonacoEditor
              height="100%"
              language={LANGUAGE_MAP[language] || 'plaintext'}
              value={currentCode}
              onChange={handleCodeChange}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
              }}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                roundedSelection: true,
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
                insertSpaces: true,
                automaticLayout: true,
                padding: { top: 12 },
                glyphMargin: true,
                scrollbar: {
                  verticalScrollbarSize: 6,
                  horizontalScrollbarSize: 6,
                },
              }}
            />
          </div>

          {/* Draggable Slider Bar (Slide up / down console) */}
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              setIsDragging(true);
              dragStartYRef.current = e.clientY;
              dragStartHeightRef.current = consoleHeight;
            }}
            className="h-2 bg-dark-800 hover:bg-primary-500/40 cursor-row-resize flex items-center justify-center transition-all group select-none border-t border-b border-dark-700/60 flex-shrink-0"
            title="Drag up or down to resize console"
          >
            <div className="w-12 h-1 bg-dark-600 group-hover:bg-primary-400 rounded-full transition-all" />
          </div>

          {/* Bottom Console (Testcase & Results) */}
          <div
            style={{ height: `${consoleHeight}px` }}
            className="flex-shrink-0 flex flex-col bg-dark-900 border-t border-dark-700/50 overflow-hidden transition-all duration-75"
          >
            {/* Console Tab Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-dark-800/90 border-b border-dark-700/60 flex-shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveConsoleTab('testcases');
                    if (consoleHeight < 150) setConsoleHeight(260);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeConsoleTab === 'testcases'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'text-dark-400 hover:text-white hover:bg-dark-700/60'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Testcase
                  {currentQuestion?.sampleTestCases?.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-dark-700 text-dark-300">
                      {currentQuestion.sampleTestCases.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    setActiveConsoleTab('results');
                    if (consoleHeight < 150) setConsoleHeight(260);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeConsoleTab === 'results'
                      ? 'bg-primary-500/20 text-primary-300 border border-primary-500/30'
                      : 'text-dark-400 hover:text-white hover:bg-dark-700/60'
                  }`}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Test Result
                  {(submissionResult || runResults.length > 0 || compileError || runtimeError) && (
                    <span className={`w-2 h-2 rounded-full ${
                      compileError || runtimeError || (submissionResult && submissionResult.status !== 'ACCEPTED')
                        ? 'bg-red-400 animate-pulse'
                        : 'bg-emerald-400'
                    }`} />
                  )}
                </button>
              </div>

              {/* Slider / Height Quick Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConsoleHeight(consoleHeight < 100 ? 260 : 44)}
                  className="px-2 py-0.5 rounded-md text-dark-400 hover:text-white hover:bg-dark-700 transition-all text-xs flex items-center gap-1"
                  title={consoleHeight < 100 ? 'Expand Console' : 'Minimize Console'}
                >
                  {consoleHeight < 100 ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span className="text-[10px]">{consoleHeight < 100 ? 'Expand' : 'Collapse'}</span>
                </button>
                <button
                  onClick={() => setConsoleHeight(consoleHeight >= 450 ? 260 : 480)}
                  className="p-1 rounded-md text-dark-400 hover:text-white hover:bg-dark-700 transition-all text-xs"
                  title="Toggle Full Height"
                >
                  <Maximize className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Console Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-3">
              {activeConsoleTab === 'testcases' ? (
                /* Testcase tab: shows sample test cases */
                <div className="space-y-3">
                  {currentQuestion?.sampleTestCases?.length > 0 ? (
                    <>
                      {/* Case selector chips */}
                      <div className="flex items-center gap-2">
                        {currentQuestion.sampleTestCases.map((tc: any, idx: number) => (
                          <button
                            key={tc.id || idx}
                            onClick={() => setSelectedSampleTestCaseIdx(idx)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                              idx === selectedSampleTestCaseIdx
                                ? 'bg-dark-700 text-white border border-dark-600'
                                : 'bg-dark-800/80 text-dark-400 hover:text-white hover:bg-dark-700'
                            }`}
                          >
                            Case {idx + 1}
                          </button>
                        ))}
                      </div>

                      {/* Selected Case Inputs */}
                      {(() => {
                        const tc = currentQuestion.sampleTestCases[selectedSampleTestCaseIdx] || currentQuestion.sampleTestCases[0];
                        if (!tc) return null;
                        return (
                          <div className="space-y-3">
                            <div>
                              <p className="text-[11px] font-semibold text-dark-400 mb-1 uppercase tracking-wider">Input</p>
                              <pre className="p-3 rounded-lg bg-dark-900/90 font-mono text-xs text-dark-200 whitespace-pre-wrap border border-dark-700/60 max-h-32 overflow-y-auto select-text">
                                {tc.input}
                              </pre>
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-dark-400 mb-1 uppercase tracking-wider">Expected Output</p>
                              <pre className="p-3 rounded-lg bg-dark-900/90 font-mono text-xs text-emerald-400 whitespace-pre-wrap border border-dark-700/60 max-h-32 overflow-y-auto select-text">
                                {tc.expectedOutput}
                              </pre>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    <p className="text-xs text-dark-400 py-4 text-center">No sample test cases specified for this question.</p>
                  )}
                </div>
              ) : (
                /* Test Result tab: shows execution results & error outputs */
                <div className="space-y-3">
                  {(!submissionResult && runResults.length === 0 && !compileError && !runtimeError) ? (
                    <div className="text-center py-6 text-dark-400 space-y-2">
                      <Terminal className="w-8 h-8 mx-auto text-dark-500 opacity-60" />
                      <p className="text-xs">You have not run the code yet.</p>
                      <button
                        onClick={handleRunSample}
                        disabled={running || submitting}
                        className="px-4 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-semibold hover:bg-green-500/25 transition-all inline-flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" /> Run Samples Now
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Overall Status Banner */}
                      {submissionResult && (
                        <div className="flex items-center justify-between p-2.5 rounded-lg bg-dark-800/80 border border-dark-700/60 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-md font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                              submissionResult.status === 'ACCEPTED'
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : submissionResult.status === 'COMPILE_ERROR'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : submissionResult.status === 'RUNTIME_ERROR'
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}>
                              {submissionResult.status === 'ACCEPTED' && <CheckCircle className="w-3.5 h-3.5" />}
                              {submissionResult.status === 'COMPILE_ERROR' && <Terminal className="w-3.5 h-3.5" />}
                              {submissionResult.status === 'RUNTIME_ERROR' && <AlertCircle className="w-3.5 h-3.5" />}
                              {submissionResult.status === 'WRONG_ANSWER' && <XCircle className="w-3.5 h-3.5" />}
                              {submissionResult.status?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-dark-300 font-medium">
                              Score: <span className="text-white font-bold">{submissionResult.score}</span>/{submissionResult.maxMarks}
                            </span>
                          </div>
                          <span className="text-dark-400">
                            {submissionResult.passedTestCases}/{submissionResult.totalTestCases} test cases passed
                          </span>
                        </div>
                      )}

                      {/* Error Box (Compilation / Runtime / Syntax Error) */}
                      {(compileError || runtimeError) && (() => {
                        const errText = compileError || runtimeError;
                        const errLoc = parseErrorLocation(errText);

                        return (
                          <div className="rounded-xl border border-red-500/40 bg-red-950/25 p-3 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 font-semibold text-red-400">
                                {compileError ? <Terminal className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                <span>{compileError ? 'Compilation / Syntax Error' : 'Runtime Error / Traceback'}</span>
                                {errLoc && (
                                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-mono text-[11px]">
                                    Line {errLoc.line}
                                  </span>
                                )}
                              </div>
                              {errLoc && (
                                <button
                                  onClick={() => goToErrorLine(errLoc.line)}
                                  className="flex items-center gap-1 text-[11px] text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/30 px-2 py-0.5 rounded transition-all font-medium"
                                >
                                  Go to Line {errLoc.line} <ArrowUpRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <pre className="p-3 rounded-lg bg-black/85 font-mono text-xs text-red-300 leading-relaxed whitespace-pre-wrap select-text max-h-48 overflow-y-auto border border-red-900/60">
                              {errText}
                            </pre>
                          </div>
                        );
                      })()}

                      {/* Test Case Chips & Details */}
                      {(() => {
                        const cases = submissionResult?.testCases || runResults || [];
                        if (cases.length === 0) return null;
                        const activeCase = cases[activeResultTestCaseIdx] || cases[0];

                        return (
                          <div className="space-y-3">
                            {/* Case selector chips */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                              {cases.map((tc: any, idx: number) => {
                                const isActive = idx === activeResultTestCaseIdx;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => setActiveResultTestCaseIdx(idx)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                                      isActive
                                        ? 'bg-primary-500/20 text-white border-primary-500/40 shadow-sm'
                                        : 'bg-dark-800/80 text-dark-400 border-dark-700/60 hover:text-white hover:bg-dark-700'
                                    }`}
                                  >
                                    {tc.passed ? (
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    )}
                                    <span>Case {idx + 1}</span>
                                    <span className={`text-[10px] px-1 py-0.5 rounded ${tc.isSample ? 'bg-dark-700 text-dark-300' : 'bg-dark-900/60 text-dark-400'}`}>
                                      {tc.isSample ? 'Public' : 'Hidden'}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Active Case Details */}
                            {activeCase && (
                              <div className="rounded-xl bg-dark-800/60 border border-dark-700/60 p-3 space-y-3">
                                {activeCase.isSample ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-semibold text-white flex items-center gap-1.5">
                                        {activeCase.passed ? (
                                          <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Passed</span>
                                        ) : (
                                          <span className="text-red-400 flex items-center gap-1"><XCircle className="w-4 h-4" /> Failed ({activeCase.status || 'Wrong Answer'})</span>
                                        )}
                                      </span>
                                      {activeCase.timeMs && (
                                        <span className="text-dark-400 font-mono">{activeCase.timeMs.toFixed(0)}ms</span>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                      <div>
                                        <p className="text-[11px] font-semibold text-dark-400 mb-1 uppercase tracking-wider">Input</p>
                                        <pre className="p-2.5 rounded-lg bg-dark-900 font-mono text-xs text-dark-200 whitespace-pre-wrap border border-dark-700/40 max-h-28 overflow-y-auto select-text">
                                          {activeCase.input}
                                        </pre>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-semibold text-dark-400 mb-1 uppercase tracking-wider">Expected Output</p>
                                        <pre className="p-2.5 rounded-lg bg-dark-900 font-mono text-xs text-emerald-400 whitespace-pre-wrap border border-dark-700/40 max-h-28 overflow-y-auto select-text">
                                          {activeCase.expectedOutput}
                                        </pre>
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-semibold text-dark-400 mb-1 uppercase tracking-wider">Your Output</p>
                                        <pre className={`p-2.5 rounded-lg font-mono text-xs whitespace-pre-wrap border max-h-28 overflow-y-auto select-text ${
                                          activeCase.passed
                                            ? 'bg-dark-900 text-emerald-400 border-dark-700/40'
                                            : 'bg-red-500/10 text-red-300 border-red-500/20'
                                        }`}>
                                          {activeCase.actualOutput !== null && activeCase.actualOutput !== undefined && activeCase.actualOutput !== ''
                                            ? activeCase.actualOutput
                                            : '(No stdout produced)'}
                                        </pre>
                                      </div>
                                    </div>

                                    {activeCase.stderr && (
                                      <div>
                                        <p className="text-[11px] font-semibold text-red-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                          <AlertCircle className="w-3.5 h-3.5" /> Error / Stderr Output
                                        </p>
                                        <pre className="p-2.5 rounded-lg bg-red-950/40 font-mono text-xs text-red-300 whitespace-pre-wrap border border-red-500/30 max-h-28 overflow-y-auto select-text">
                                          {activeCase.stderr}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-semibold text-white flex items-center gap-1.5">
                                        {activeCase.passed ? (
                                          <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Hidden Test Case Passed</span>
                                        ) : (
                                          <span className="text-red-400 flex items-center gap-1"><XCircle className="w-4 h-4" /> Hidden Test Case Failed ({activeCase.status || 'Failed'})</span>
                                        )}
                                      </span>
                                      {activeCase.timeMs && (
                                        <span className="text-dark-400 font-mono">{activeCase.timeMs.toFixed(0)}ms</span>
                                      )}
                                    </div>
                                    <div className="p-3 rounded-lg bg-dark-900/60 border border-dark-700/40 flex items-center gap-2 text-xs text-dark-400">
                                      <Lock className="w-4 h-4 text-dark-500 flex-shrink-0" />
                                      <span>Input and expected output are private for evaluation and grading.</span>
                                    </div>

                                    {activeCase.stderr && (
                                      <div>
                                        <p className="text-[11px] font-semibold text-red-400 mb-1 uppercase tracking-wider flex items-center gap-1">
                                          <AlertCircle className="w-3.5 h-3.5" /> Error on this testcase
                                        </p>
                                        <pre className="p-2.5 rounded-lg bg-red-950/40 font-mono text-xs text-red-300 whitespace-pre-wrap border border-red-500/30 max-h-28 overflow-y-auto select-text">
                                          {activeCase.stderr}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Question navigation */}
          <div className="flex items-center justify-between px-4 py-2 bg-dark-800 border-t border-dark-700/60 flex-shrink-0">
            <button
              onClick={() => {
                setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1));
                setRunResults([]);
                setSubmissionResult(null);
                setCompileError(null);
                setRuntimeError(null);
              }}
              disabled={currentQuestionIdx === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
            >
              <ChevronLeft className="w-3 h-3" />Previous
            </button>

            <span className="text-xs text-dark-500">
              Question {currentQuestionIdx + 1} of {questions.length}
            </span>

            <button
              onClick={() => {
                setCurrentQuestionIdx(Math.min(questions.length - 1, currentQuestionIdx + 1));
                setRunResults([]);
                setSubmissionResult(null);
                setCompileError(null);
                setRuntimeError(null);
              }}
              disabled={currentQuestionIdx === questions.length - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-dark-400 hover:text-white hover:bg-dark-700 disabled:opacity-30"
            >
              Next<ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
