import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import ExcelJS from 'exceljs';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { createStudentSchema } from '../validators';
import { Role } from '@prisma/client';

const router = Router();

// All routes require admin auth
router.use(authenticate, authorize(Role.ADMIN));

// List all students
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const search = req.query.search as string;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { regNo: { contains: search, mode: 'insensitive' } },
        { className: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { regNo: 'asc' },
        include: { user: { select: { email: true, role: true } } },
      }),
      prisma.student.count({ where }),
    ]);

    res.json({
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create single student
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createStudentSchema.parse(req.body);
    const password = data.password || generatePassword();
    const email = data.email || `${data.regNo.toLowerCase()}@student.exam.local`;
    const passwordHash = await bcrypt.hash(password, 12);

    const student = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: Role.STUDENT,
        name: data.name,
        student: {
          create: {
            name: data.name,
            regNo: data.regNo,
            className: data.className,
            email,
          },
        },
      },
      include: { student: true },
    });

    res.status(201).json({
      student: student.student,
      generatedPassword: data.password ? undefined : password,
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Upload students via CSV/Excel
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filePath = req.file.path;
    const ext = req.file.originalname.toLowerCase();
    let students: Array<{ name: string; regNo: string; className: string; email?: string; password?: string }> = [];

    if (ext.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parse(content, { columns: true, skip_empty_lines: true, trim: true });
      students = records.map((r: any) => ({
        name: r.name || r.Name,
        regNo: r.regNo || r.RegNo || r.reg_no || r['Registration Number'],
        className: r.className || r.ClassName || r.class_name || r.Class || r['class'],
        email: r.email || r.Email || undefined,
        password: r.password || r.Password || undefined,
      }));
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        res.status(400).json({ error: 'No worksheet found in file' });
        return;
      }

      const headers: string[] = [];
      worksheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value).trim().toLowerCase();
      });

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowData: any = {};
        row.eachCell((cell, colNumber) => {
          rowData[headers[colNumber]] = String(cell.value || '').trim();
        });
        students.push({
          name: rowData.name || '',
          regNo: rowData.regno || rowData.reg_no || rowData['registration number'] || '',
          className: rowData.classname || rowData.class_name || rowData.class || '',
          email: rowData.email || undefined,
          password: rowData.password || undefined,
        });
      });
    }

    // Validate and filter
    const errors: Array<{ row: number; message: string }> = [];
    const validStudents: typeof students = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      if (!s.name || !s.regNo || !s.className) {
        errors.push({ row: i + 2, message: `Missing required fields (name, regNo, className)` });
        continue;
      }

      // Check duplicate in file
      const dupe = validStudents.find((v) => v.regNo === s.regNo);
      if (dupe) {
        errors.push({ row: i + 2, message: `Duplicate regNo: ${s.regNo}` });
        continue;
      }

      // Check duplicate in DB
      const existing = await prisma.student.findUnique({ where: { regNo: s.regNo } });
      if (existing) {
        errors.push({ row: i + 2, message: `regNo already exists: ${s.regNo}` });
        continue;
      }

      validStudents.push(s);
    }

    // Create valid students
    let created = 0;
    const createdStudents: Array<{ regNo: string; password: string }> = [];

    for (const s of validStudents) {
      const password = s.password || generatePassword();
      const email = s.email || `${s.regNo.toLowerCase()}@student.exam.local`;
      const passwordHash = await bcrypt.hash(password, 12);

      try {
        await prisma.user.create({
          data: {
            email,
            passwordHash,
            role: Role.STUDENT,
            name: s.name,
            student: {
              create: {
                name: s.name,
                regNo: s.regNo,
                className: s.className,
                email,
              },
            },
          },
        });
        created++;
        createdStudents.push({ regNo: s.regNo, password });
      } catch (err: any) {
        errors.push({ row: 0, message: `Failed to create ${s.regNo}: ${err.message}` });
      }
    }

    // Cleanup uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: `${created} students created successfully`,
      created,
      errors,
      credentials: createdStudents,
      totalProcessed: students.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete student
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    // Delete user (cascades to student)
    await prisma.user.delete({ where: { id: student.userId } });

    res.json({ message: 'Student deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single student
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { email: true } },
        sessions: {
          include: {
            exam: { select: { title: true } },
            submissions: true,
          },
        },
        results: {
          include: {
            exam: { select: { title: true } },
          },
        },
      },
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return;
    }

    res.json(student);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function generatePassword(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export default router;
