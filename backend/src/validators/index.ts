import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const studentLoginSchema = z.object({
  regNo: z.string().min(1, 'Registration number is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createStudentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  regNo: z.string().min(1, 'Registration number is required'),
  className: z.string().min(1, 'Class name is required'),
  email: z.string().email().optional().nullable(),
  password: z.string().min(4).optional(),
});

export const createQuestionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  constraints: z.string().optional().nullable(),
  inputFormat: z.string().optional().nullable(),
  outputFormat: z.string().optional().nullable(),
  sampleInput: z.string().optional().nullable(),
  sampleOutput: z.string().optional().nullable(),
  maxMarks: z.number().int().positive().default(100),
  allowedLanguages: z.array(z.string()).default(['python', 'java', 'c', 'cpp']),
  starterCodePython: z.string().optional().nullable(),
  starterCodeJava: z.string().optional().nullable(),
  starterCodeC: z.string().optional().nullable(),
  starterCodeCpp: z.string().optional().nullable(),
  timeLimitMs: z.number().int().positive().default(2000),
  memoryLimitKb: z.number().int().positive().default(262144),
  testCases: z.array(z.object({
    input: z.string(),
    expectedOutput: z.string(),
    isSample: z.boolean().default(false),
    weight: z.number().default(1.0),
    order: z.number().int().default(0),
  })).optional(),
});

export const updateQuestionSchema = createQuestionSchema.partial();

export const createExamSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  durationMinutes: z.number().int().positive('Duration must be positive'),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allowedLanguages: z.array(z.string()).default(['python', 'java', 'c', 'cpp']),
  maxTabSwitches: z.number().int().min(0).default(5),
  autoSubmitAfterTabSwitches: z.boolean().default(true),
  fullscreenRequired: z.boolean().default(true),
  tabSwitchPenalty: z.number().min(0).default(0),
  questionIds: z.array(z.string()).optional(),
});

export const updateExamSchema = createExamSchema.partial();

export const submitCodeSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  language: z.enum(['python', 'java', 'c', 'cpp']),
  sourceCode: z.string().min(1, 'Source code is required'),
});

export const runSampleSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  language: z.enum(['python', 'java', 'c', 'cpp']),
  sourceCode: z.string().min(1, 'Source code is required'),
});

export const proctorEventSchema = z.object({
  type: z.enum([
    'TAB_SWITCH',
    'FULLSCREEN_EXIT',
    'COPY_ATTEMPT',
    'PASTE_ATTEMPT',
    'RIGHT_CLICK',
    'WINDOW_BLUR',
    'WINDOW_FOCUS',
    'FULLSCREEN_ENTER',
    'WARNING_SHOWN',
  ]),
  metadata: z.record(z.any()).optional(),
});

export const autosaveSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  language: z.enum(['python', 'java', 'c', 'cpp']),
  sourceCode: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type StudentLoginInput = z.infer<typeof studentLoginSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type CreateExamInput = z.infer<typeof createExamSchema>;
export type SubmitCodeInput = z.infer<typeof submitCodeSchema>;
export type ProctorEventInput = z.infer<typeof proctorEventSchema>;
