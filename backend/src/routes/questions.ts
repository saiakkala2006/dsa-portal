import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { createQuestionSchema, updateQuestionSchema } from '../validators';
import { Role } from '@prisma/client';

const router = Router();

// All routes require admin auth
router.use(authenticate, authorize(Role.ADMIN));

// List all questions
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [questions, total] = await Promise.all([
      prisma.question.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          testCases: { orderBy: { order: 'asc' } },
          _count: { select: { testCases: true, exams: true } },
        },
      }),
      prisma.question.count({ where }),
    ]);

    res.json({
      questions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single question
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const question = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: {
        testCases: { orderBy: { order: 'asc' } },
      },
    });

    if (!question) {
      res.status(404).json({ error: 'Question not found' });
      return;
    }

    res.json(question);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create question
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createQuestionSchema.parse(req.body);
    const { testCases, ...questionData } = data;

    const question = await prisma.question.create({
      data: {
        ...questionData,
        testCases: testCases
          ? {
              create: testCases.map((tc, index) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isSample: tc.isSample,
                weight: tc.weight,
                order: tc.order || index + 1,
              })),
            }
          : undefined,
      },
      include: { testCases: true },
    });

    res.status(201).json(question);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update question
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const data = updateQuestionSchema.parse(req.body);
    const { testCases, ...questionData } = data;

    const question = await prisma.question.update({
      where: { id: req.params.id },
      data: questionData,
      include: { testCases: true },
    });

    // If test cases provided, replace them
    if (testCases) {
      await prisma.testCase.deleteMany({ where: { questionId: req.params.id } });
      await prisma.testCase.createMany({
        data: testCases.map((tc, index) => ({
          questionId: req.params.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          isSample: tc.isSample,
          weight: tc.weight,
          order: tc.order || index + 1,
        })),
      });
    }

    const updated = await prisma.question.findUnique({
      where: { id: req.params.id },
      include: { testCases: { orderBy: { order: 'asc' } } },
    });

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete question
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ message: 'Question deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk upload questions via Excel/CSV/JSON
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path;
    const ext = req.file.originalname.toLowerCase();
    let questions: any[] = [];
    let testCasesMap: Map<string, any[]> = new Map();

    if (ext.endsWith('.json')) {
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      questions = Array.isArray(content) ? content : content.questions || [];
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Sheet 1: Questions
      const qSheet = workbook.getWorksheet('Questions') || workbook.getWorksheet(1);
      if (qSheet) {
        const qHeaders: string[] = [];
        qSheet.getRow(1).eachCell((cell, col) => {
          qHeaders[col] = String(cell.value).trim().toLowerCase().replace(/\s+/g, '_');
        });

        qSheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return;
          const q: any = {};
          row.eachCell((cell, col) => {
            q[qHeaders[col]] = cell.value;
          });
          questions.push({
            question_id: String(q.question_id || q.id || rowNum - 1),
            title: q.title || '',
            description: q.description || '',
            constraints: q.constraints || null,
            inputFormat: q.input_format || null,
            outputFormat: q.output_format || null,
            sampleInput: q.sample_input || null,
            sampleOutput: q.sample_output || null,
            maxMarks: parseInt(q.max_marks || '100'),
            allowedLanguages: q.allowed_languages
              ? String(q.allowed_languages).split(',').map((s: string) => s.trim())
              : ['python', 'java', 'c', 'cpp'],
            starterCodePython: q.starter_code_python || null,
            starterCodeJava: q.starter_code_java || null,
            starterCodeC: q.starter_code_c || null,
            starterCodeCpp: q.starter_code_cpp || null,
            timeLimitMs: parseInt(q.time_limit_ms || '2000'),
            memoryLimitKb: parseInt(q.memory_limit_kb || '262144'),
          });
        });
      }

      // Sheet 2: TestCases
      const tcSheet = workbook.getWorksheet('TestCases') || workbook.getWorksheet(2);
      if (tcSheet) {
        const tcHeaders: string[] = [];
        tcSheet.getRow(1).eachCell((cell, col) => {
          tcHeaders[col] = String(cell.value).trim().toLowerCase().replace(/\s+/g, '_');
        });

        tcSheet.eachRow((row, rowNum) => {
          if (rowNum === 1) return;
          const tc: any = {};
          row.eachCell((cell, col) => {
            tc[tcHeaders[col]] = cell.value;
          });

          const qId = String(tc.question_id || '');
          if (!testCasesMap.has(qId)) {
            testCasesMap.set(qId, []);
          }
          testCasesMap.get(qId)!.push({
            input: String(tc.input || ''),
            expectedOutput: String(tc.expected_output || ''),
            isSample: tc.is_sample === true || tc.is_sample === 'true' || tc.is_sample === 1,
            weight: parseFloat(tc.weight || '1.0'),
            order: parseInt(tc.order || '0'),
          });
        });
      }
    } else if (ext.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      questions = records.map((r: any) => ({
        title: r.title || '',
        description: r.description || '',
        constraints: r.constraints || null,
        inputFormat: r.input_format || null,
        outputFormat: r.output_format || null,
        sampleInput: r.sample_input || null,
        sampleOutput: r.sample_output || null,
        maxMarks: parseInt(r.max_marks || '100'),
        allowedLanguages: r.allowed_languages
          ? r.allowed_languages.split(',').map((s: string) => s.trim())
          : ['python', 'java', 'c', 'cpp'],
      }));
    }

    const errors: Array<{ row: number; message: string }> = [];
    let created = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.title || !q.description) {
        errors.push({ row: i + 2, message: 'Missing title or description' });
        continue;
      }

      try {
        const qId = q.question_id || String(i + 1);
        const tcs = testCasesMap.get(qId) || q.testCases || [];

        await prisma.question.create({
          data: {
            title: String(q.title),
            description: String(q.description),
            constraints: q.constraints ? String(q.constraints) : null,
            inputFormat: q.inputFormat ? String(q.inputFormat) : null,
            outputFormat: q.outputFormat ? String(q.outputFormat) : null,
            sampleInput: q.sampleInput ? String(q.sampleInput) : null,
            sampleOutput: q.sampleOutput ? String(q.sampleOutput) : null,
            maxMarks: q.maxMarks || 100,
            allowedLanguages: q.allowedLanguages || ['python', 'java', 'c', 'cpp'],
            starterCodePython: q.starterCodePython ? String(q.starterCodePython) : null,
            starterCodeJava: q.starterCodeJava ? String(q.starterCodeJava) : null,
            starterCodeC: q.starterCodeC ? String(q.starterCodeC) : null,
            starterCodeCpp: q.starterCodeCpp ? String(q.starterCodeCpp) : null,
            timeLimitMs: q.timeLimitMs || 2000,
            memoryLimitKb: q.memoryLimitKb || 262144,
            testCases: tcs.length > 0
              ? {
                  create: tcs.map((tc: any, idx: number) => ({
                    input: String(tc.input || ''),
                    expectedOutput: String(tc.expectedOutput || tc.expected_output || ''),
                    isSample: Boolean(tc.isSample || tc.is_sample),
                    weight: parseFloat(tc.weight || '1.0'),
                    order: parseInt(tc.order || String(idx + 1)),
                  })),
                }
              : undefined,
          },
        });
        created++;
      } catch (err: any) {
        errors.push({ row: i + 2, message: err.message });
      }
    }

    fs.unlinkSync(filePath);

    res.json({
      message: `${created} questions created successfully`,
      created,
      errors,
      totalProcessed: questions.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add test case to question
router.post('/:id/test-cases', async (req: Request, res: Response) => {
  try {
    const testCase = await prisma.testCase.create({
      data: {
        questionId: req.params.id,
        input: req.body.input,
        expectedOutput: req.body.expectedOutput,
        isSample: req.body.isSample || false,
        weight: req.body.weight || 1.0,
        order: req.body.order || 0,
      },
    });

    res.status(201).json(testCase);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete test case
router.delete('/test-cases/:testCaseId', async (req: Request, res: Response) => {
  try {
    await prisma.testCase.delete({ where: { id: req.params.testCaseId } });
    res.json({ message: 'Test case deleted' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
