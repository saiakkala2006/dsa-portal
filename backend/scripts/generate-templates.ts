// Run this script to generate Excel template files
// Usage: npx ts-node scripts/generate-templates.ts

import ExcelJS from 'exceljs';
import path from 'path';

async function generateStudentTemplate() {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Students');

  ws.columns = [
    { header: 'name', key: 'name', width: 25 },
    { header: 'regNo', key: 'regNo', width: 15 },
    { header: 'className', key: 'className', width: 12 },
    { header: 'email', key: 'email', width: 30 },
    { header: 'password', key: 'password', width: 15 },
  ];

  // Style header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };

  // Sample rows
  ws.addRow({ name: 'John Doe', regNo: 'STU101', className: 'CS-A', email: 'john@student.com', password: 'pass1234' });
  ws.addRow({ name: 'Jane Smith', regNo: 'STU102', className: 'CS-A', email: 'jane@student.com', password: '' });
  ws.addRow({ name: 'Bob Wilson', regNo: 'STU103', className: 'CS-B', email: '', password: '' });

  const filePath = path.resolve(__dirname, '../../templates/students_template.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Student template created: ${filePath}`);
}

async function generateQuestionTemplate() {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1: Questions
  const qWs = workbook.addWorksheet('Questions');
  qWs.columns = [
    { header: 'question_id', key: 'question_id', width: 15 },
    { header: 'title', key: 'title', width: 25 },
    { header: 'description', key: 'description', width: 50 },
    { header: 'constraints', key: 'constraints', width: 30 },
    { header: 'input_format', key: 'input_format', width: 25 },
    { header: 'output_format', key: 'output_format', width: 25 },
    { header: 'sample_input', key: 'sample_input', width: 20 },
    { header: 'sample_output', key: 'sample_output', width: 20 },
    { header: 'max_marks', key: 'max_marks', width: 12 },
    { header: 'allowed_languages', key: 'allowed_languages', width: 25 },
    { header: 'time_limit_ms', key: 'time_limit_ms', width: 15 },
    { header: 'memory_limit_kb', key: 'memory_limit_kb', width: 15 },
    { header: 'starter_code_python', key: 'starter_code_python', width: 30 },
    { header: 'starter_code_java', key: 'starter_code_java', width: 30 },
    { header: 'starter_code_c', key: 'starter_code_c', width: 30 },
    { header: 'starter_code_cpp', key: 'starter_code_cpp', width: 30 },
  ];

  qWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  qWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

  qWs.addRow({
    question_id: 'Q1',
    title: 'Two Sum',
    description: 'Given an array of integers and a target, return indices of two numbers that add up to target.',
    constraints: '2 <= nums.length <= 10^4',
    input_format: 'First line: array, Second line: target',
    output_format: 'Two space-separated indices',
    sample_input: '2 7 11 15\n9',
    sample_output: '0 1',
    max_marks: 100,
    allowed_languages: 'python,java,c,cpp',
    time_limit_ms: 2000,
    memory_limit_kb: 262144,
    starter_code_python: '# Write your solution here',
    starter_code_java: '// Write your solution here',
    starter_code_c: '// Write your solution here',
    starter_code_cpp: '// Write your solution here',
  });

  // Sheet 2: TestCases
  const tcWs = workbook.addWorksheet('TestCases');
  tcWs.columns = [
    { header: 'question_id', key: 'question_id', width: 15 },
    { header: 'input', key: 'input', width: 30 },
    { header: 'expected_output', key: 'expected_output', width: 30 },
    { header: 'is_sample', key: 'is_sample', width: 12 },
    { header: 'weight', key: 'weight', width: 10 },
    { header: 'order', key: 'order', width: 8 },
  ];

  tcWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
  tcWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '4472C4' } };

  tcWs.addRow({ question_id: 'Q1', input: '2 7 11 15\n9', expected_output: '0 1', is_sample: true, weight: 1.0, order: 1 });
  tcWs.addRow({ question_id: 'Q1', input: '3 2 4\n6', expected_output: '1 2', is_sample: true, weight: 1.0, order: 2 });
  tcWs.addRow({ question_id: 'Q1', input: '3 3\n6', expected_output: '0 1', is_sample: false, weight: 1.0, order: 3 });

  const filePath = path.resolve(__dirname, '../../templates/questions_template.xlsx');
  await workbook.xlsx.writeFile(filePath);
  console.log(`✅ Question template created: ${filePath}`);
}

async function main() {
  await generateStudentTemplate();
  await generateQuestionTemplate();
  console.log('\n📋 Templates generated in the templates/ directory');
}

main().catch(console.error);
