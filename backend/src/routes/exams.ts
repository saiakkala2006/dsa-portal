import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { createExamSchema, updateExamSchema } from '../validators';
import { Role } from '@prisma/client';

const router = Router();

// All routes require admin auth
router.use(authenticate, authorize(Role.ADMIN));

// List all exams
router.get('/', async (req: Request, res: Response) => {
  try {
    const exams = await prisma.exam.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true, sessions: true } },
      },
    });

    res.json({ exams });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single exam with details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        questions: {
          include: {
            question: {
              include: { testCases: { orderBy: { order: 'asc' } } },
            },
          },
          orderBy: { order: 'asc' },
        },
        sessions: {
          include: {
            student: true,
            submissions: true,
          },
        },
        _count: { select: { questions: true, sessions: true } },
      },
    });

    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }

    res.json(exam);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create exam
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createExamSchema.parse(req.body);
    const { questionIds, ...examData } = data;

    const exam = await prisma.exam.create({
      data: {
        ...examData,
        startAt: new Date(examData.startAt),
        endAt: new Date(examData.endAt),
        questions: questionIds
          ? {
              create: questionIds.map((qId, idx) => ({
                questionId: qId,
                order: idx + 1,
              })),
            }
          : undefined,
      },
      include: {
        questions: { include: { question: true } },
      },
    });

    res.status(201).json(exam);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update exam
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateExamSchema.parse(req.body);
    const { questionIds, ...examData } = data;

    const updateData: any = { ...examData };
    if (examData.startAt) updateData.startAt = new Date(examData.startAt);
    if (examData.endAt) updateData.endAt = new Date(examData.endAt);

    const exam = await prisma.exam.update({
      where: { id: req.params.id },
      data: updateData,
    });

    // Update questions if provided
    if (questionIds) {
      await prisma.examQuestion.deleteMany({ where: { examId: req.params.id } });
      await prisma.examQuestion.createMany({
        data: questionIds.map((qId, idx) => ({
          examId: req.params.id,
          questionId: qId,
          order: idx + 1,
        })),
      });
    }

    const updated = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        questions: { include: { question: true }, orderBy: { order: 'asc' } },
      },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Publish/unpublish exam
router.patch('/:id/publish', async (req: Request, res: Response) => {
  try {
    const exam = await prisma.exam.update({
      where: { id: req.params.id },
      data: { isPublished: req.body.isPublished },
    });
    res.json(exam);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Publish/unpublish results
router.patch('/:id/publish-results', async (req: Request, res: Response) => {
  try {
    const exam = await prisma.exam.update({
      where: { id: req.params.id },
      data: { resultsPublished: req.body.resultsPublished },
    });

    // If publishing, compute and store results for all completed sessions
    if (req.body.resultsPublished) {
      const sessions = await prisma.examSession.findMany({
        where: {
          examId: req.params.id,
          status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'TIMED_OUT'] },
        },
        include: {
          submissions: true,
          student: true,
        },
      });

      const examQuestions = await prisma.examQuestion.findMany({
        where: { examId: req.params.id },
        include: { question: true },
      });

      const totalMaxMarks = examQuestions.reduce(
        (sum, eq) => sum + (eq.maxMarksOverride || eq.question.maxMarks),
        0
      );

      for (const session of sessions) {
        let totalScore = 0;
        let questionsAttempted = 0;
        let totalTestCasesPassed = 0;
        let totalTestCasesCount = 0;

        for (const eq of examQuestions) {
          // Get best submission for this question
          const submissions = session.submissions.filter(
            (s) => s.questionId === eq.questionId
          );

          if (submissions.length > 0) {
            questionsAttempted++;
            const best = submissions.reduce((a, b) =>
              a.score > b.score ? a : b
            );
            totalScore += best.score;
            totalTestCasesPassed += best.passedTestCases;
            totalTestCasesCount += best.totalTestCases;
          } else {
            // Count test cases for unattempted questions
            const tcCount = await prisma.testCase.count({
              where: { questionId: eq.questionId },
            });
            totalTestCasesCount += tcCount;
          }
        }

        const finalScore = totalMaxMarks > 0
          ? (totalScore / totalMaxMarks) * 100
          : 0;

        await prisma.result.upsert({
          where: {
            examId_studentId: {
              examId: req.params.id,
              studentId: session.studentId,
            },
          },
          create: {
            examId: req.params.id,
            studentId: session.studentId,
            questionsAttempted,
            testCasesPassed: totalTestCasesPassed,
            totalTestCases: totalTestCasesCount,
            timeTakenSeconds: session.timeTakenSeconds || 0,
            tabSwitchCount: session.tabSwitchCount,
            finalScore: Math.round(finalScore * 100) / 100,
            publishedAt: new Date(),
          },
          update: {
            questionsAttempted,
            testCasesPassed: totalTestCasesPassed,
            totalTestCases: totalTestCasesCount,
            timeTakenSeconds: session.timeTakenSeconds || 0,
            tabSwitchCount: session.tabSwitchCount,
            finalScore: Math.round(finalScore * 100) / 100,
            publishedAt: new Date(),
          },
        });
      }
    }

    res.json(exam);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete exam
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.exam.delete({ where: { id: req.params.id } });
    res.json({ message: 'Exam deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get exam sessions (proctoring dashboard)
router.get('/:id/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.examSession.findMany({
      where: { examId: req.params.id },
      include: {
        student: true,
        submissions: {
          orderBy: { submittedAt: 'desc' },
        },
        proctorEvents: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Compute time remaining for each session
    const exam = await prisma.exam.findUnique({ where: { id: req.params.id } });
    const now = new Date();

    const enrichedSessions = sessions.map((s) => {
      const elapsed = Math.floor((now.getTime() - s.startedAt.getTime()) / 1000);
      const totalTime = (exam?.durationMinutes || 0) * 60;
      const timeRemaining = Math.max(0, totalTime - elapsed);

      return {
        ...s,
        timeRemaining,
        isOnline: (now.getTime() - s.lastHeartbeat.getTime()) < 30000,
      };
    });

    res.json({ sessions: enrichedSessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all submissions for an exam
router.get('/:id/submissions', async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.examSession.findMany({
      where: { examId: req.params.id },
      include: {
        student: true,
        submissions: {
          include: {
            testResults: {
              include: { testCase: true },
            },
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    res.json({ sessions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get results for an exam
router.get('/:id/results', async (req: Request, res: Response) => {
  try {
    const results = await prisma.result.findMany({
      where: { examId: req.params.id },
      include: {
        student: true,
      },
      orderBy: { finalScore: 'desc' },
    });

    res.json({ results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Export results to Excel
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
    });

    if (!exam) {
      res.status(404).json({ error: 'Exam not found' });
      return;
    }

    const results = await prisma.result.findMany({
      where: { examId: req.params.id },
      include: { student: true },
      orderBy: { student: { regNo: 'asc' } },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Results');

    worksheet.columns = [
      { header: 'Registration Number', key: 'regNo', width: 20 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Class', key: 'className', width: 15 },
      { header: 'Questions Attempted', key: 'questionsAttempted', width: 22 },
      { header: 'Test Cases Passed', key: 'testCasesPassed', width: 20 },
      { header: 'Total Test Cases', key: 'totalTestCases', width: 18 },
      { header: 'Time Taken (seconds)', key: 'timeTakenSeconds', width: 22 },
      { header: 'Tab Switches', key: 'tabSwitchCount', width: 15 },
      { header: 'Final Score (/100)', key: 'finalScore', width: 18 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, size: 12 };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4472C4' },
    };
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };

    for (const result of results) {
      worksheet.addRow({
        regNo: result.student.regNo,
        name: result.student.name,
        className: result.student.className,
        questionsAttempted: result.questionsAttempted,
        testCasesPassed: result.testCasesPassed,
        totalTestCases: result.totalTestCases,
        timeTakenSeconds: result.timeTakenSeconds,
        tabSwitchCount: result.tabSwitchCount,
        finalScore: result.finalScore,
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}_results.xlsx"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Edit marks manually
router.patch('/submissions/:submissionId/marks', async (req: Request, res: Response) => {
  try {
    const { score } = req.body;

    const submission = await prisma.submission.update({
      where: { id: req.params.submissionId },
      data: { score: parseFloat(score) },
    });

    res.json(submission);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
