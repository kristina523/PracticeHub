import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const totalStudents = await prisma.student.count();

    const activeStudents = await prisma.student.count({
      where: {
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now }
      }
    });

    const endingThisWeek = await prisma.student.count({
      where: {
        endDate: {
          gte: now,
          lte: weekFromNow
        },
        status: {
          in: ['PENDING', 'ACTIVE']
        }
      }
    });

    const byPracticeType = await prisma.student.groupBy({
      by: ['practiceType'],
      _count: true
    });

    const byStatus = await prisma.student.groupBy({
      by: ['status'],
      _count: true
    });

    const byInstitution = await prisma.student.groupBy({
      by: ['institutionId'],
      _count: true
    });

    const institutionIds = byInstitution.map(item => item.institutionId);
    const institutions = await prisma.institution.findMany({
      where: {
        id: { in: institutionIds }
      },
      select: {
        id: true,
        name: true
      }
    });

    const byInstitutionWithNames = byInstitution.map(item => {
      const institution = institutions.find(inst => inst.id === item.institutionId);
      return {
        institutionId: item.institutionId,
        institutionName: institution?.name || 'Unknown',
        count: item._count
      };
    });

    const upcomingStarts = await prisma.student.findMany({
      where: {
        startDate: {
          gte: now,
          lte: weekFromNow
        }
      },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        middleName: true,
        startDate: true,
        practiceType: true,
        institution: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      },
      take: 10
    });

    const upcomingEnds = await prisma.student.findMany({
      where: {
        endDate: {
          gte: now,
          lte: weekFromNow
        },
        status: {
          in: ['PENDING', 'ACTIVE']
        }
      },
      select: {
        id: true,
        lastName: true,
        firstName: true,
        middleName: true,
        endDate: true,
        practiceType: true,
        institution: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        endDate: 'asc'
      },
      take: 10
    });

    const byCourse = await prisma.student.groupBy({
      by: ['course'],
      _count: true,
      orderBy: {
        course: 'asc'
      }
    });

    res.json({
      totalStudents,
      activeStudents,
      endingThisWeek,
      byPracticeType: byPracticeType.map(item => ({
        type: item.practiceType,
        count: item._count
      })),
      byStatus: byStatus.map(item => ({
        status: item.status,
        count: item._count
      })),
      byInstitution: byInstitutionWithNames,
      byCourse: byCourse.map(item => ({
        course: item.course,
        count: item._count
      })),
      upcomingStarts,
      upcomingEnds
    });
  } catch (error) {
    console.error('Ошибка получения статистики дашборда:', error);
    res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
});

export default router;

