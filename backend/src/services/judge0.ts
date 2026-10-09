import axios from 'axios';
import { config } from '../config';

// Judge0 language IDs
const LANGUAGE_IDS: Record<string, number> = {
  python: 71,   // Python 3
  java: 62,     // Java (OpenJDK 13)
  c: 50,        // C (GCC 9.2.0)
  cpp: 54,      // C++ (GCC 9.2.0)
};

export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
}

export interface Judge0Result {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: {
    id: number;
    description: string;
  };
  time: string | null;
  memory: number | null;
}

// Judge0 status IDs
export const JUDGE0_STATUS = {
  IN_QUEUE: 1,
  PROCESSING: 2,
  ACCEPTED: 3,
  WRONG_ANSWER: 4,
  TIME_LIMIT_EXCEEDED: 5,
  COMPILATION_ERROR: 6,
  RUNTIME_ERROR_SIGSEGV: 7,
  RUNTIME_ERROR_SIGXFSZ: 8,
  RUNTIME_ERROR_SIGFPE: 9,
  RUNTIME_ERROR_SIGABRT: 10,
  RUNTIME_ERROR_NZEC: 11,
  RUNTIME_ERROR_OTHER: 12,
  INTERNAL_ERROR: 13,
  EXEC_FORMAT_ERROR: 14,
};

export function getLanguageId(language: string): number {
  const id = LANGUAGE_IDS[language.toLowerCase()];
  if (!id) throw new Error(`Unsupported language: ${language}`);
  return id;
}

export function mapJudge0Status(statusId: number): string {
  switch (statusId) {
    case JUDGE0_STATUS.ACCEPTED:
      return 'ACCEPTED';
    case JUDGE0_STATUS.WRONG_ANSWER:
      return 'WRONG_ANSWER';
    case JUDGE0_STATUS.TIME_LIMIT_EXCEEDED:
      return 'TIME_LIMIT_EXCEEDED';
    case JUDGE0_STATUS.COMPILATION_ERROR:
      return 'COMPILE_ERROR';
    case JUDGE0_STATUS.RUNTIME_ERROR_SIGSEGV:
    case JUDGE0_STATUS.RUNTIME_ERROR_SIGXFSZ:
    case JUDGE0_STATUS.RUNTIME_ERROR_SIGFPE:
    case JUDGE0_STATUS.RUNTIME_ERROR_SIGABRT:
    case JUDGE0_STATUS.RUNTIME_ERROR_NZEC:
    case JUDGE0_STATUS.RUNTIME_ERROR_OTHER:
      return 'RUNTIME_ERROR';
    case JUDGE0_STATUS.INTERNAL_ERROR:
    case JUDGE0_STATUS.EXEC_FORMAT_ERROR:
      return 'INTERNAL_ERROR';
    default:
      return 'PENDING';
  }
}

export async function submitToJudge0(submission: Judge0Submission): Promise<string> {
  const response = await axios.post(
    `${config.judge0.url}/submissions?base64_encoded=false&wait=false`,
    submission,
    {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    }
  );
  return response.data.token;
}

export async function getJudge0Result(token: string): Promise<Judge0Result> {
  const response = await axios.get(
    `${config.judge0.url}/submissions/${token}?base64_encoded=false&fields=token,stdout,stderr,compile_output,message,status,time,memory`,
    { timeout: 10000 }
  );
  return response.data;
}

export async function submitAndWait(
  sourceCode: string,
  language: string,
  stdin: string,
  expectedOutput: string,
  timeLimitSec: number = 2,
  memoryLimitKb: number = 262144
): Promise<Judge0Result> {
  const languageId = getLanguageId(language);

  // Try synchronous submission first (wait=true)
  try {
    const response = await axios.post(
      `${config.judge0.url}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
        expected_output: expectedOutput,
        cpu_time_limit: timeLimitSec,
        memory_limit: memoryLimitKb,
        wall_time_limit: timeLimitSec * 3,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    // If synchronous doesn't work, try async with polling
    const token = await submitToJudge0({
      source_code: sourceCode,
      language_id: languageId,
      stdin: stdin,
      expected_output: expectedOutput,
      cpu_time_limit: timeLimitSec,
      memory_limit: memoryLimitKb,
    });

    // Poll for result
    let result: Judge0Result;
    let attempts = 0;
    const maxAttempts = 30;

    do {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      result = await getJudge0Result(token);
      attempts++;
    } while (
      (result.status.id === JUDGE0_STATUS.IN_QUEUE || result.status.id === JUDGE0_STATUS.PROCESSING) &&
      attempts < maxAttempts
    );

    return result;
  }
}

export async function runCode(
  sourceCode: string,
  language: string,
  stdin: string,
  timeLimitSec: number = 2,
  memoryLimitKb: number = 262144
): Promise<Judge0Result> {
  const languageId = getLanguageId(language);

  try {
    const response = await axios.post(
      `${config.judge0.url}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
        cpu_time_limit: timeLimitSec,
        memory_limit: memoryLimitKb,
        wall_time_limit: timeLimitSec * 3,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('Judge0 runCode sync failed status:', error.response?.status);
    console.error('Judge0 runCode sync failed data:', JSON.stringify(error.response?.data));
    console.error('Judge0 runCode sync failed headers:', error.response?.headers);

    // Fallback to async polling if sync fails
    try {
      const token = await submitToJudge0({
        source_code: sourceCode,
        language_id: languageId,
        stdin: stdin,
        cpu_time_limit: timeLimitSec,
        memory_limit: memoryLimitKb,
      });

      let result: Judge0Result;
      let attempts = 0;
      const maxAttempts = 30;

      do {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        result = await getJudge0Result(token);
        attempts++;
      } while (
        (result.status.id === JUDGE0_STATUS.IN_QUEUE || result.status.id === JUDGE0_STATUS.PROCESSING) &&
        attempts < maxAttempts
      );

      return result;
    } catch (pollError: any) {
      console.error('Judge0 runCode async failed status:', pollError.response?.status);
      console.error('Judge0 runCode async failed data:', JSON.stringify(pollError.response?.data));
      const detail = pollError.response?.data?.error || pollError.response?.data?.message || pollError.message;
      throw new Error(`Judge0 execution failed: ${detail}`);
    }
  }
}

export async function checkJudge0Health(): Promise<boolean> {
  try {
    const response = await axios.get(`${config.judge0.url}/about`, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}
