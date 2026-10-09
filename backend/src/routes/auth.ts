import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken, authenticate, AuthPayload } from '../middleware/auth';
import { loginSchema, studentLoginSchema } from '../validators';
import { Role } from '@prisma/client';

const router = Router();

// Admin login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Login failed' });
  }
});

// Student login (via regNo)
router.post('/student/login', async (req: Request, res: Response) => {
  try {
    const { regNo, password } = studentLoginSchema.parse(req.body);

    const student = await prisma.student.findUnique({
      where: { regNo },
      include: { user: true },
    });

    if (!student) {
      res.status(401).json({ error: 'Invalid registration number or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, student.user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid registration number or password' });
      return;
    }

    const token = generateToken({
      userId: student.user.id,
      email: student.user.email,
      role: student.user.role,
    });

    res.json({
      token,
      user: {
        id: student.user.id,
        email: student.user.email,
        name: student.name,
        role: student.user.role,
        regNo: student.regNo,
        className: student.className,
        studentId: student.id,
      },
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Login failed' });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        student: true,
        admin: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      student: user.student,
      admin: user.admin,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
