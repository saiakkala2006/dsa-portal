import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { submitCodeSchema, runSampleSchema, proctorEventSchema, autosaveSchema } from '../validators';
import { submitAndWait, runCode, mapJudge0Status, JUDGE0_STATUS } from '../services/judge0';
import { Role, SessionStatus, SubmissionStatus, ProctorEventType } from '@prisma/client';

const router = Router();

// All routes require student auth
router.use(authenticate, authorize(Role.STUDENT));

// Helper to get student from user
async function getStudent(userId: string) {
  return prisma.student.findUnique({ where: { userId } });
}

// Get available exams for student
router.get('/exams', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const exams = await prisma.exam.findMany({
      where: {
        isPublished: true,
        endAt: { gte: now },
      },
      include: {
        _count: { select: { questions: true } },
        sessions: {
          where: { studentId: student.id },
        },
      },
      orderBy: { startAt: 'asc' },
    });

    const examList = exams.map((exam) => ({
      id: exam.id,
      title: exam.title,
      description: exam.description,
      durationMinutes: exam.durationMinutes,
      startAt: exam.startAt,
      endAt: exam.endAt,
      allowedLanguages: exam.allowedLanguages,
      fullscreenRequired: exam.fullscreenRequired,
      questionCount: exam._count.questions,
      hasStarted: exam.sessions.length > 0,
      sessionStatus: exam.sessions[0]?.status || null,
      canStart: now >= exam.startAt && now <= exam.endAt && exam.sessions.length === 0,
      isActive: exam.sessions.length > 0 && exam.sessions[0].status === 'IN_PROGRESS',
    }));

    res.json({ exams: examList });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start exam - create session
router.post('/exams/:examId/start', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const exam = await prisma.exam.findUnique({
      where: { id: req.params.examId },
      include: {
        questions: {
          include: {
            question: {
              include: {
                testCases: {
                  where: { isSample: true },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!exam || !exam.isPublished) {
      res.status(404).json({ error: 'Exam not found or not published' });
      return;
    }

    const now = new Date();
    if (now < exam.startAt) {
      res.status(400).json({ error: 'Exam has not started yet' });
      return;
    }
    if (now > exam.endAt) {
      res.status(400).json({ error: 'Exam has ended' });
      return;
    }

    // Check for existing session
    let session = await prisma.examSession.findUnique({
      where: {
        examId_studentId: {
          examId: exam.id,
          studentId: student.id,
        },
      },
    });

    if (session && session.status !== 'IN_PROGRESS') {
      res.status(400).json({ error: 'You have already completed this exam' });
      return;
    }

    if (!session) {
      session = await prisma.examSession.create({
        data: {
          examId: exam.id,
          studentId: student.id,
          status: SessionStatus.IN_PROGRESS,
        },
      });
    }

    // Return exam data (only sample test cases)
    const questions = exam.questions.map((eq) => ({
      id: eq.question.id,
      title: eq.question.title,
      description: eq.question.description,
      constraints: eq.question.constraints,
      inputFormat: eq.question.inputFormat,
      outputFormat: eq.question.outputFormat,
      sampleInput: eq.question.sampleInput,
      sampleOutput: eq.question.sampleOutput,
      maxMarks: eq.maxMarksOverride || eq.question.maxMarks,
      allowedLanguages: eq.question.allowedLanguages,
      starterCodePython: eq.question.starterCodePython,
      starterCodeJava: eq.question.starterCodeJava,
      starterCodeC: eq.question.starterCodeC,
      starterCodeCpp: eq.question.starterCodeCpp,
      order: eq.order,
      sampleTestCases: eq.question.testCases,
    }));

    res.json({
      session: {
        id: session.id,
        startedAt: session.startedAt,
        status: session.status,
        tabSwitchCount: session.tabSwitchCount,
        fullscreenExitCount: session.fullscreenExitCount,
      },
      exam: {
        id: exam.id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        startAt: exam.startAt,
        endAt: exam.endAt,
        allowedLanguages: exam.allowedLanguages,
        maxTabSwitches: exam.maxTabSwitches,
        autoSubmitAfterTabSwitches: exam.autoSubmitAfterTabSwitches,
        fullscreenRequired: exam.fullscreenRequired,
      },
      questions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get exam session data (for resume)
router.get('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
      },
      include: {
        exam: {
          include: {
            questions: {
              include: {
                question: {
                  include: {
                    testCases: {
                      where: { isSample: true },
                      orderBy: { order: 'asc' },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        },
        submissions: {
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Heartbeat
router.post('/sessions/:sessionId/heartbeat', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
        status: SessionStatus.IN_PROGRESS,
      },
      include: { exam: true },
    });

    if (!session) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    // Check if time expired (server-authoritative)
    const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
    const totalTime = session.exam.durationMinutes * 60;

    if (elapsed >= totalTime) {
      await prisma.examSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.TIMED_OUT,
          submittedAt: new Date(),
          timeTakenSeconds: totalTime,
        },
      });
      res.json({ status: 'TIMED_OUT', timeRemaining: 0 });
      return;
    }

    await prisma.examSession.update({
      where: { id: session.id },
      data: { lastHeartbeat: new Date() },
    });

    res.json({
      status: 'IN_PROGRESS',
      timeRemaining: totalTime - elapsed,
      tabSwitchCount: session.tabSwitchCount,
      fullscreenExitCount: session.fullscreenExitCount,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Autosave code
router.post('/sessions/:sessionId/autosave', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const data = autosaveSchema.parse(req.body);

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
        status: SessionStatus.IN_PROGRESS,
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    // Upsert draft submission
    const existing = await prisma.submission.findFirst({
      where: {
        sessionId: session.id,
        questionId: data.questionId,
        status: SubmissionStatus.PENDING,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await prisma.submission.update({
        where: { id: existing.id },
        data: {
          sourceCode: data.sourceCode,
          language: data.language,
        },
      });
    } else {
      await prisma.submission.create({
        data: {
          sessionId: session.id,
          questionId: data.questionId,
          language: data.language,
          sourceCode: data.sourceCode,
          status: SubmissionStatus.PENDING,
        },
      });
    }

    res.json({ message: 'Code saved' });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.errors[0]?.message || 'Validation error' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// Run sample test cases
router.post('/sessions/:sessionId/run', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const data = runSampleSchema.parse(req.body);

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
        status: SessionStatus.IN_PROGRESS,
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    // Get sample test cases only
    const sampleTestCases = await prisma.testCase.findMany({
      where: {
        questionId: data.questionId,
        isSample: true,
      },
      orderBy: { order: 'asc' },
    });

    if (sampleTestCases.length === 0) {
      res.status(400).json({ error: 'No sample test cases found' });
      return;
    }

    const question = await prisma.question.findUnique({
      where: { id: data.questionId },
    });

    const results = [];
    let firstCompileOutput: string | null = null;
    let firstStderr: string | null = null;

    for (let i = 0; i < sampleTestCases.length; i++) {
      const tc = sampleTestCases[i];
      try {
        const result = await runCode(
          data.sourceCode,
          data.language,
          tc.input,
          (question?.timeLimitMs || 2000) / 1000,
          question?.memoryLimitKb || 262144
        );

        const stdout = (result.stdout || '').trim();
        const expected = tc.expectedOutput.trim();
        const statusStr = mapJudge0Status(result.status.id);
        const passed = (result.status.id === JUDGE0_STATUS.ACCEPTED || stdout === expected) && !result.stderr && !result.compile_output;

        if (result.compile_output && !firstCompileOutput) firstCompileOutput = result.compile_output;
        if (result.stderr && !firstStderr) firstStderr = result.stderr;

        results.push({
          testCaseId: tc.id,
          order: tc.order || i + 1,
          isSample: true,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: result.stdout,
          passed,
          status: result.status.description || statusStr,
          timeMs: result.time ? parseFloat(result.time) * 1000 : null,
          memoryKb: result.memory,
          compileOutput: result.compile_output,
          stderr: result.stderr,
        });
      } catch (err: any) {
        if (!firstStderr) firstStderr = err.message;
        results.push({
          testCaseId: tc.id,
          order: tc.order || i + 1,
          isSample: true,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: null,
          passed: false,
          status: 'Error',
          error: err.message,
          stderr: err.message,
        });
      }
    }

    res.json({
      results,
      compileOutput: firstCompileOutput,
      runtimeError: firstStderr,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.errors[0]?.message || 'Validation error' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// Submit code for a question (runs against ALL test cases)
router.post('/sessions/:sessionId/submit', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const data = submitCodeSchema.parse(req.body);

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
        status: SessionStatus.IN_PROGRESS,
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    // Get ALL test cases
    const testCases = await prisma.testCase.findMany({
      where: { questionId: data.questionId },
      orderBy: { order: 'asc' },
    });

    const question = await prisma.question.findUnique({
      where: { id: data.questionId },
    });

    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    // Get max marks from exam question override
    const examQuestion = await prisma.examQuestion.findFirst({
      where: {
        examId: session.examId,
        questionId: data.questionId,
      },
    });

    const maxMarks = examQuestion?.maxMarksOverride || question.maxMarks;

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        sessionId: session.id,
        questionId: data.questionId,
        language: data.language,
        sourceCode: data.sourceCode,
        status: SubmissionStatus.RUNNING,
        totalTestCases: testCases.length,
      },
    });

    // Run against all test cases
    let passedCount = 0;
    let firstCompileOutput: string | null = null;
    let firstStderr: string | null = null;
    const testCaseResults: any[] = [];

    for (let i = 0; i < testCases.length; i++) {
      const tc = testCases[i];
      try {
        const result = await submitAndWait(
          data.sourceCode,
          data.language,
          tc.input,
          tc.expectedOutput,
          (question.timeLimitMs || 2000) / 1000,
          question.memoryLimitKb || 262144
        );

        const statusStr = mapJudge0Status(result.status.id);
        const stdout = (result.stdout || '').trim();
        const expected = tc.expectedOutput.trim();
        const passed = (result.status.id === JUDGE0_STATUS.ACCEPTED || stdout === expected) && !result.compile_output && !result.stderr;

        if (passed) passedCount++;
        if (result.compile_output && !firstCompileOutput) {
          firstCompileOutput = result.compile_output;
        }
        if (result.stderr && !firstStderr) {
          firstStderr = result.stderr;
        }

        await prisma.testCaseResult.create({
          data: {
            submissionId: submission.id,
            testCaseId: tc.id,
            status: statusStr as SubmissionStatus,
            stdout: result.stdout,
            stderr: result.stderr,
            timeMs: result.time ? parseFloat(result.time) * 1000 : null,
            memoryKb: result.memory ? result.memory : null,
            passed,
          },
        });

        if (tc.isSample) {
          testCaseResults.push({
            id: tc.id,
            order: tc.order || i + 1,
            isSample: true,
            passed,
            status: result.status.description || statusStr,
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            actualOutput: result.stdout,
            stderr: result.stderr,
            compileOutput: result.compile_output,
            timeMs: result.time ? parseFloat(result.time) * 1000 : null,
          });
        } else {
          testCaseResults.push({
            id: tc.id,
            order: tc.order || i + 1,
            isSample: false,
            passed,
            status: passed ? 'Accepted' : (result.status.description || statusStr),
            stderr: result.stderr,
            compileOutput: result.compile_output,
            timeMs: result.time ? parseFloat(result.time) * 1000 : null,
          });
        }
      } catch (err: any) {
        if (!firstStderr) firstStderr = err.message;
        await prisma.testCaseResult.create({
          data: {
            submissionId: submission.id,
            testCaseId: tc.id,
            status: SubmissionStatus.INTERNAL_ERROR,
            stderr: err.message,
            passed: false,
          },
        });

        testCaseResults.push({
          id: tc.id,
          order: tc.order || i + 1,
          isSample: tc.isSample,
          passed: false,
          status: 'Internal Error',
          stderr: err.message,
          input: tc.isSample ? tc.input : undefined,
          expectedOutput: tc.isSample ? tc.expectedOutput : undefined,
          actualOutput: null,
        });
      }
    }

    // Calculate score
    const score = testCases.length > 0
      ? (passedCount / testCases.length) * maxMarks
      : 0;

    // Determine overall status
    let overallStatus: SubmissionStatus = SubmissionStatus.ACCEPTED;
    if (firstCompileOutput) {
      overallStatus = SubmissionStatus.COMPILE_ERROR;
    } else if (firstStderr && passedCount === 0) {
      overallStatus = SubmissionStatus.RUNTIME_ERROR;
    } else if (passedCount < testCases.length) {
      overallStatus = SubmissionStatus.WRONG_ANSWER;
    }

    await prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: overallStatus,
        score: Math.round(score * 100) / 100,
        passedTestCases: passedCount,
        compileOutput: firstCompileOutput,
        runtimeOutput: firstStderr,
        submittedAt: new Date(),
      },
    });

    res.json({
      submissionId: submission.id,
      status: overallStatus,
      score: Math.round(score * 100) / 100,
      passedTestCases: passedCount,
      totalTestCases: testCases.length,
      maxMarks,
      compileOutput: firstCompileOutput,
      runtimeError: firstStderr,
      testCases: testCaseResults,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.errors[0]?.message || 'Validation error' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// Submit entire exam
router.post('/sessions/:sessionId/finish', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
        status: SessionStatus.IN_PROGRESS,
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Active session not found' });
      return;
    }

    const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

    await prisma.examSession.update({
      where: { id: session.id },
      data: {
        status: req.body.autoSubmit
          ? SessionStatus.AUTO_SUBMITTED
          : SessionStatus.SUBMITTED,
        submittedAt: new Date(),
        timeTakenSeconds: elapsed,
      },
    });

    res.json({ message: 'Exam submitted successfully', timeTaken: elapsed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Report proctor event
router.post('/sessions/:sessionId/proctor-event', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const data = proctorEventSchema.parse(req.body);

    const session = await prisma.examSession.findFirst({
      where: {
        id: req.params.sessionId,
        studentId: student.id,
      },
      include: { exam: true },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Record event
    await prisma.proctorEvent.create({
      data: {
        sessionId: session.id,
        type: data.type as ProctorEventType,
        metadata: data.metadata || {},
      },
    });

    // Update counters
    const updateData: any = {};
    if (data.type === 'TAB_SWITCH' || data.type === 'WINDOW_BLUR') {
      updateData.tabSwitchCount = { increment: 1 };
    }
    if (data.type === 'FULLSCREEN_EXIT') {
      updateData.fullscreenExitCount = { increment: 1 };
    }

    const updatedSession = await prisma.examSession.update({
      where: { id: session.id },
      data: updateData,
    });

    // Check if auto-submit needed
    let shouldAutoSubmit = false;
    if (
      session.exam.autoSubmitAfterTabSwitches &&
      updatedSession.tabSwitchCount >= session.exam.maxTabSwitches
    ) {
      shouldAutoSubmit = true;
      const elapsed = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);
      await prisma.examSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.AUTO_SUBMITTED,
          submittedAt: new Date(),
          timeTakenSeconds: elapsed,
        },
      });
    }

    res.json({
      tabSwitchCount: updatedSession.tabSwitchCount,
      fullscreenExitCount: updatedSession.fullscreenExitCount,
      autoSubmitted: shouldAutoSubmit,
      maxTabSwitches: session.exam.maxTabSwitches,
    });
  } catch (error: any) {
    if (error instanceof ZodError) {
      res.status(400).json({ error: error.errors[0]?.message || 'Validation error' });
      return;
    }
    res.status(500).json({ error: error.message });
  }
});

// Get published results for current student
router.get('/results', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const results = await prisma.result.findMany({
      where: {
        studentId: student.id,
        publishedAt: { not: null },
        exam: { resultsPublished: true },
      },
      include: {
        exam: { select: { title: true, durationMinutes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get student profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const student = await getStudent(req.user!.userId);
    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    const results = await prisma.result.findMany({
      where: {
        studentId: student.id,
        publishedAt: { not: null },
        exam: { resultsPublished: true },
      },
      include: {
        exam: { select: { title: true, durationMinutes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sessions = await prisma.examSession.findMany({
      where: { studentId: student.id },
      include: {
        exam: { select: { title: true } },
      },
    });

    res.json({
      student,
      results,
      sessions,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
