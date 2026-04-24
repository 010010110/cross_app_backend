import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { UserRole } from '../common/enums';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { User } from '../common/interfaces/user.interface';
import { MONGO_CLIENT } from '../database/database.constants';
import { ClassSchedule } from '../classes/interfaces/class.interface';
import { RewardStreak } from '../rewards/interfaces/reward-streak.interface';
import { CoachClassAssignment } from './interfaces/coach-class-assignment.interface';

interface ReportFilterInput {
  startDate?: string;
  endDate?: string;
  coachId?: string;
  studentId?: string;
  classId?: string;
}

@Injectable()
export class AdminReportsService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async createCoachAssignment(boxId: string, actorUserId: string, coachId: string, classId: string) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedCoachId = this.ensureObjectId(coachId, 'coachId invalido');
    const normalizedClassId = this.ensureObjectId(classId, 'classId invalido');
    const normalizedActorUserId = this.ensureObjectId(actorUserId, 'userId invalido');

    await this.ensureCoachInBox(normalizedBoxId, normalizedCoachId);
    await this.ensureClassInBox(normalizedBoxId, normalizedClassId);

    const collection = this.db.collection<CoachClassAssignment>('coach_class_assignments');
    const existingActive = await collection.findOne({
      boxId: normalizedBoxId,
      coachId: normalizedCoachId,
      classId: normalizedClassId,
      active: true,
    });

    if (existingActive) {
      return {
        assignmentId: existingActive._id,
        coachId: normalizedCoachId,
        classId: normalizedClassId,
        active: true,
        message: 'Vinculo coach-turma ja estava ativo',
      };
    }

    const assignment: CoachClassAssignment = {
      boxId: normalizedBoxId,
      coachId: normalizedCoachId,
      classId: normalizedClassId,
      active: true,
      assignedAt: new Date(),
      createdBy: normalizedActorUserId,
    };

    const result = await collection.insertOne(assignment);

    return {
      assignmentId: result.insertedId,
      coachId: normalizedCoachId,
      classId: normalizedClassId,
      active: true,
      message: 'Vinculo coach-turma criado com sucesso',
    };
  }

  async removeCoachAssignment(boxId: string, coachId: string, classId: string) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedCoachId = this.ensureObjectId(coachId, 'coachId invalido');
    const normalizedClassId = this.ensureObjectId(classId, 'classId invalido');

    const result = await this.db.collection<CoachClassAssignment>('coach_class_assignments').findOneAndUpdate(
      {
        boxId: normalizedBoxId,
        coachId: normalizedCoachId,
        classId: normalizedClassId,
        active: true,
      },
      {
        $set: {
          active: false,
          unassignedAt: new Date(),
        },
      },
      { returnDocument: 'after' },
    );

    if (!result) {
      throw new NotFoundException('Vinculo coach-turma ativo nao encontrado');
    }

    return {
      assignmentId: result._id,
      coachId: normalizedCoachId,
      classId: normalizedClassId,
      active: false,
      message: 'Vinculo coach-turma removido com sucesso',
    };
  }

  async listCoachAssignments(boxId: string, coachId?: string) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const query: {
      boxId: ObjectId;
      active: boolean;
      coachId?: ObjectId;
    } = {
      boxId: normalizedBoxId,
      active: true,
    };

    if (coachId) {
      query.coachId = this.ensureObjectId(coachId, 'coachId invalido');
    }

    return this.db
      .collection<CoachClassAssignment>('coach_class_assignments')
      .aggregate([
        { $match: query },
        {
          $lookup: {
            from: 'users',
            localField: 'coachId',
            foreignField: '_id',
            as: 'coach',
          },
        },
        {
          $lookup: {
            from: 'classes',
            localField: 'classId',
            foreignField: '_id',
            as: 'class',
          },
        },
        {
          $project: {
            _id: 1,
            coachId: 1,
            classId: 1,
            assignedAt: 1,
            coachName: { $ifNull: [{ $arrayElemAt: ['$coach.name', 0] }, null] },
            className: { $ifNull: [{ $arrayElemAt: ['$class.name', 0] }, null] },
          },
        },
        { $sort: { assignedAt: -1 } },
      ])
      .toArray();
  }

  async getOverview(boxId: string, actor: JwtPayload, filters: ReportFilterInput) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedDates = this.resolveDateRange(filters.startDate, filters.endDate);
    const normalizedStudentId = filters.studentId
      ? this.ensureObjectId(filters.studentId, 'studentId invalido')
      : null;

    const scopedClassIds = await this.resolveScopedClassIds(normalizedBoxId, actor, filters.coachId);
    const checkinMatch = this.buildCheckinMatch(normalizedBoxId, normalizedDates.start, normalizedDates.end, {
      scopedClassIds,
      studentId: normalizedStudentId,
      classId: filters.classId,
    });

    const totalStudents = await this.db.collection<User>('users').countDocuments({
      boxIds: normalizedBoxId,
      role: UserRole.ALUNO,
    });

    const totalActiveClasses = await this.db.collection<ClassSchedule>('classes').countDocuments({
      boxId: normalizedBoxId,
    });

    const totalCheckins = await this.db.collection('checkins').countDocuments(checkinMatch);

    const activeStudentsRows = (await this.db
      .collection('checkins')
      .aggregate([
        { $match: checkinMatch },
        { $group: { _id: '$userId' } },
        { $count: 'count' },
      ])
      .toArray()) as Array<{ count: number }>;

    const activeStudentsInPeriod = activeStudentsRows[0]?.count ?? 0;

    return {
      period: normalizedDates,
      filters: {
        coachId: filters.coachId ?? null,
        studentId: filters.studentId ?? null,
        classId: filters.classId ?? null,
      },
      summary: {
        totalStudents,
        totalActiveClasses,
        totalCheckins,
        activeStudentsInPeriod,
      },
    };
  }

  async getInactivity(boxId: string, actor: JwtPayload, filters: ReportFilterInput & { thresholdDays?: string }) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const thresholdDays = this.parsePositiveInt(filters.thresholdDays, 7, 'thresholdDays deve ser um inteiro positivo');
    const normalizedStudentId = filters.studentId
      ? this.ensureObjectId(filters.studentId, 'studentId invalido')
      : null;

    const scopedClassIds = await this.resolveScopedClassIds(normalizedBoxId, actor, filters.coachId);

    const candidateStudents = await this.fetchCandidateStudents(normalizedBoxId, normalizedStudentId, scopedClassIds);

    if (candidateStudents.length === 0) {
      return {
        thresholdDays,
        count: 0,
        students: [],
      };
    }

    const studentIds = candidateStudents.map((student) => student._id as ObjectId);

    const classMatch = scopedClassIds
      ? { classId: { $in: scopedClassIds } }
      : {};

    const lastCheckins = (await this.db
      .collection('checkins')
      .aggregate([
        {
          $match: {
            boxId: normalizedBoxId,
            userId: { $in: studentIds },
            ...classMatch,
          },
        },
        {
          $group: {
            _id: '$userId',
            lastCheckinDate: { $max: '$createdAt' },
          },
        },
      ])
      .toArray()) as Array<{ _id: ObjectId; lastCheckinDate: Date }>;

    const streakRows = (await this.db
      .collection<RewardStreak>('reward_streaks')
      .find({
        boxId: normalizedBoxId,
        userId: { $in: studentIds },
      })
      .toArray()) as RewardStreak[];

    const lastCheckinMap = new Map(lastCheckins.map((row) => [row._id.toHexString(), row.lastCheckinDate]));
    const streakMap = new Map(streakRows.map((row) => [row.userId.toHexString(), row]));

    const now = new Date();

    const inactiveStudents = candidateStudents
      .map((student) => {
        const studentId = (student._id as ObjectId).toHexString();
        const lastCheckinDate = lastCheckinMap.get(studentId) ?? null;
        const daysSinceLastActivity = lastCheckinDate
          ? Math.floor((now.getTime() - lastCheckinDate.getTime()) / (24 * 60 * 60 * 1000))
          : null;
        const streak = streakMap.get(studentId);

        return {
          userId: student._id,
          name: student.name,
          email: student.email,
          lastCheckinDate,
          daysSinceLastActivity,
          currentStreak: streak?.currentStreak ?? 0,
          longestStreak: streak?.longestStreak ?? 0,
          isNeverTrained: !lastCheckinDate,
        };
      })
      .filter((student) => student.daysSinceLastActivity === null || student.daysSinceLastActivity > thresholdDays)
      .sort((a, b) => {
        if (a.daysSinceLastActivity === null) return -1;
        if (b.daysSinceLastActivity === null) return 1;
        return b.daysSinceLastActivity - a.daysSinceLastActivity;
      });

    return {
      thresholdDays,
      count: inactiveStudents.length,
      students: inactiveStudents,
    };
  }

  async getClassParticipation(boxId: string, actor: JwtPayload, filters: ReportFilterInput) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedDates = this.resolveDateRange(filters.startDate, filters.endDate);
    const normalizedStudentId = filters.studentId
      ? this.ensureObjectId(filters.studentId, 'studentId invalido')
      : null;

    const scopedClassIds = await this.resolveScopedClassIds(normalizedBoxId, actor, filters.coachId);
    const checkinMatch = this.buildCheckinMatch(normalizedBoxId, normalizedDates.start, normalizedDates.end, {
      scopedClassIds,
      studentId: normalizedStudentId,
      classId: filters.classId,
    });

    // Construir filtro para classes com validação correta
    const classFilter: { boxId: ObjectId; _id?: ObjectId | { $in: ObjectId[] } } = {
      boxId: normalizedBoxId,
    };

    if (filters.classId && filters.classId.trim()) {
      classFilter._id = this.ensureObjectId(filters.classId, 'classId invalido');
    } else if (scopedClassIds) {
      classFilter._id = { $in: scopedClassIds };
    }

    const classRows = (await this.db
      .collection<ClassSchedule>('classes')
      .find(classFilter)
      .toArray()) as ClassSchedule[];

    if (classRows.length === 0) {
      return {
        period: normalizedDates,
        classes: [],
      };
    }

    const totals = (await this.db
      .collection('checkins')
      .aggregate([
        { $match: checkinMatch },
        {
          $group: {
            _id: '$classId',
            totalCheckins: { $sum: 1 },
            uniqueStudents: { $addToSet: '$userId' },
            activeDays: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } },
          },
        },
      ])
      .toArray()) as Array<{
      _id: ObjectId;
      totalCheckins: number;
      uniqueStudents: ObjectId[];
      activeDays: string[];
    }>;

    const trendByDow = (await this.db
      .collection('checkins')
      .aggregate([
        { $match: checkinMatch },
        {
          $group: {
            _id: {
              classId: '$classId',
              dayOfWeek: { $dayOfWeek: '$createdAt' },
            },
            checkins: { $sum: 1 },
          },
        },
      ])
      .toArray()) as Array<{ _id: { classId: ObjectId; dayOfWeek: number }; checkins: number }>;

    const totalsMap = new Map(totals.map((row) => [row._id.toHexString(), row]));
    const trendMap = new Map<string, Record<string, number>>();

    for (const row of trendByDow) {
      const key = row._id.classId.toHexString();
      const existing = trendMap.get(key) ?? {
        SUNDAY: 0,
        MONDAY: 0,
        TUESDAY: 0,
        WEDNESDAY: 0,
        THURSDAY: 0,
        FRIDAY: 0,
        SATURDAY: 0,
      };
      const label = this.weekdayLabel(row._id.dayOfWeek);
      existing[label] = row.checkins;
      trendMap.set(key, existing);
    }

    return {
      period: normalizedDates,
      classes: classRows.map((classRow) => {
        const metrics = totalsMap.get((classRow._id as ObjectId).toHexString());
        const sessions = metrics?.activeDays.length ?? 0;
        return {
          classId: classRow._id,
          className: classRow.name,
          weekDays: classRow.weekDays,
          startTime: classRow.startTime,
          endTime: classRow.endTime,
          checkinLimit: classRow.checkinLimit ?? null,
          totalCheckins: metrics?.totalCheckins ?? 0,
          uniqueStudents: metrics?.uniqueStudents.length ?? 0,
          avgParticipantsPerSession: sessions > 0 ? Number(((metrics?.totalCheckins ?? 0) / sessions).toFixed(2)) : 0,
          participationTrendByDay: trendMap.get((classRow._id as ObjectId).toHexString()) ?? {
            SUNDAY: 0,
            MONDAY: 0,
            TUESDAY: 0,
            WEDNESDAY: 0,
            THURSDAY: 0,
            FRIDAY: 0,
            SATURDAY: 0,
          },
        };
      }),
    };
  }

  async getTrainingRanking(
    boxId: string,
    actor: JwtPayload,
    filters: ReportFilterInput & { rankingBy?: string; limit?: string },
  ) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedDates = this.resolveDateRange(filters.startDate, filters.endDate);
    const rankingBy = (filters.rankingBy ?? 'prs').toLowerCase();
    const limit = this.parsePositiveInt(filters.limit, 10, 'limit deve ser um inteiro positivo');
    const normalizedStudentId = filters.studentId
      ? this.ensureObjectId(filters.studentId, 'studentId invalido')
      : null;

    const scopedClassIds = await this.resolveScopedClassIds(normalizedBoxId, actor, filters.coachId);
    const scopedUserIds = await this.resolveScopedUserIds(normalizedBoxId, scopedClassIds, normalizedStudentId);

    let ranking: Array<{ userId: ObjectId; value: number }> = [];

    if (rankingBy === 'attendance') {
      const attendanceRows = (await this.db
        .collection('checkins')
        .aggregate([
          {
            $match: {
              boxId: normalizedBoxId,
              createdAt: { $gte: normalizedDates.start, $lte: normalizedDates.end },
              ...(scopedClassIds ? { classId: { $in: scopedClassIds } } : {}),
              ...(scopedUserIds ? { userId: { $in: scopedUserIds } } : {}),
            },
          },
          { $group: { _id: '$userId', value: { $sum: 1 } } },
          { $sort: { value: -1, _id: 1 } },
          { $limit: limit },
        ])
        .toArray()) as Array<{ _id: ObjectId; value: number }>;
      ranking = attendanceRows.map((row) => ({ userId: row._id, value: row.value }));
    } else if (rankingBy === 'xp') {
      const xpRows = (await this.db
        .collection('reward_xp_ledger')
        .aggregate([
          {
            $match: {
              boxId: normalizedBoxId,
              createdAt: { $gte: normalizedDates.start, $lte: normalizedDates.end },
              ...(scopedUserIds ? { userId: { $in: scopedUserIds } } : {}),
            },
          },
          { $group: { _id: '$userId', value: { $sum: '$points' } } },
          { $sort: { value: -1, _id: 1 } },
          { $limit: limit },
        ])
        .toArray()) as Array<{ _id: ObjectId; value: number }>;
      ranking = xpRows.map((row) => ({ userId: row._id, value: row.value }));
    } else {
      const prRows = (await this.db
        .collection('results')
        .aggregate([
          {
            $match: {
              boxId: normalizedBoxId,
              isNewPR: true,
              createdAt: { $gte: normalizedDates.start, $lte: normalizedDates.end },
              ...(scopedUserIds ? { userId: { $in: scopedUserIds } } : {}),
            },
          },
          { $group: { _id: '$userId', value: { $sum: 1 } } },
          { $sort: { value: -1, _id: 1 } },
          { $limit: limit },
        ])
        .toArray()) as Array<{ _id: ObjectId; value: number }>;
      ranking = prRows.map((row) => ({ userId: row._id, value: row.value }));
    }

    if (ranking.length === 0) {
      return {
        period: normalizedDates,
        rankingBy,
        ranking: [],
      };
    }

    const userRows = (await this.db
      .collection<User>('users')
      .find({ _id: { $in: ranking.map((row) => row.userId) } }, { projection: { passwordHash: 0 } })
      .toArray()) as Omit<User, 'passwordHash'>[];

    const usersMap = new Map(userRows.map((user) => [user._id!.toHexString(), user]));

    return {
      period: normalizedDates,
      rankingBy,
      ranking: ranking.map((row, index) => {
        const user = usersMap.get(row.userId.toHexString());
        return {
          rank: index + 1,
          userId: row.userId,
          name: user?.name ?? null,
          email: user?.email ?? null,
          value: row.value,
        };
      }),
    };
  }

  async getGymRats(
    boxId: string,
    actor: JwtPayload,
    filters: ReportFilterInput & { limit?: string },
  ) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedDates = this.resolveDateRange(filters.startDate, filters.endDate);
    const limit = this.parsePositiveInt(filters.limit, 10, 'limit deve ser um inteiro positivo');
    const normalizedStudentId = filters.studentId
      ? this.ensureObjectId(filters.studentId, 'studentId invalido')
      : null;

    const scopedClassIds = await this.resolveScopedClassIds(normalizedBoxId, actor, filters.coachId);
    const checkinMatch = this.buildCheckinMatch(normalizedBoxId, normalizedDates.start, normalizedDates.end, {
      scopedClassIds,
      studentId: normalizedStudentId,
      classId: filters.classId,
    });

    const rankingRows = (await this.db
      .collection('checkins')
      .aggregate([
        { $match: checkinMatch },
        {
          $group: {
            _id: '$userId',
            totalCheckins: { $sum: 1 },
            lastCheckinDate: { $max: '$createdAt' },
          },
        },
        { $sort: { totalCheckins: -1, lastCheckinDate: -1, _id: 1 } },
        { $limit: limit },
      ])
      .toArray()) as Array<{ _id: ObjectId; totalCheckins: number; lastCheckinDate: Date }>;

    if (rankingRows.length === 0) {
      return {
        period: normalizedDates,
        filters: {
          coachId: filters.coachId ?? null,
          studentId: filters.studentId ?? null,
          classId: filters.classId ?? null,
        },
        ranking: [],
      };
    }

    const users = (await this.db
      .collection<User>('users')
      .find(
        {
          _id: { $in: rankingRows.map((row) => row._id) },
          boxIds: normalizedBoxId,
          role: UserRole.ALUNO,
        },
        { projection: { passwordHash: 0 } },
      )
      .toArray()) as Omit<User, 'passwordHash'>[];

    const usersMap = new Map(users.map((user) => [user._id!.toHexString(), user]));

    return {
      period: normalizedDates,
      filters: {
        coachId: filters.coachId ?? null,
        studentId: filters.studentId ?? null,
        classId: filters.classId ?? null,
      },
      ranking: rankingRows
        .filter((row) => usersMap.has(row._id.toHexString()))
        .map((row, index) => ({
          rank: index + 1,
          userId: row._id,
          name: usersMap.get(row._id.toHexString())?.name ?? null,
          email: usersMap.get(row._id.toHexString())?.email ?? null,
          totalCheckins: row.totalCheckins,
          lastCheckinDate: row.lastCheckinDate,
        })),
    };
  }

  async getRewardsXp(
    boxId: string,
    actor: JwtPayload,
    filters: ReportFilterInput & { minStreak?: string; limit?: string },
  ) {
    const normalizedBoxId = this.ensureObjectId(boxId, 'boxId invalido no contexto');
    const normalizedDates = this.resolveDateRange(filters.startDate, filters.endDate);
    const minStreak = this.parsePositiveInt(filters.minStreak, 0, 'minStreak deve ser um inteiro positivo');
    const limit = this.parsePositiveInt(filters.limit, 10, 'limit deve ser um inteiro positivo');
    const normalizedStudentId = filters.studentId
      ? this.ensureObjectId(filters.studentId, 'studentId invalido')
      : null;

    const scopedClassIds = await this.resolveScopedClassIds(normalizedBoxId, actor, filters.coachId);
    const scopedUserIds = await this.resolveScopedUserIds(normalizedBoxId, scopedClassIds, normalizedStudentId);

    const sourceDistributionRows = (await this.db
      .collection('reward_xp_ledger')
      .aggregate([
        {
          $match: {
            boxId: normalizedBoxId,
            createdAt: { $gte: normalizedDates.start, $lte: normalizedDates.end },
            ...(scopedUserIds ? { userId: { $in: scopedUserIds } } : {}),
          },
        },
        {
          $group: {
            _id: '$type',
            points: { $sum: '$points' },
          },
        },
        { $sort: { points: -1 } },
      ])
      .toArray()) as Array<{ _id: string; points: number }>;

    const topXpRows = (await this.db
      .collection('reward_xp_ledger')
      .aggregate([
        {
          $match: {
            boxId: normalizedBoxId,
            createdAt: { $gte: normalizedDates.start, $lte: normalizedDates.end },
            ...(scopedUserIds ? { userId: { $in: scopedUserIds } } : {}),
          },
        },
        {
          $group: {
            _id: '$userId',
            xpInPeriod: { $sum: '$points' },
          },
        },
        { $sort: { xpInPeriod: -1, _id: 1 } },
        { $limit: limit },
      ])
      .toArray()) as Array<{ _id: ObjectId; xpInPeriod: number }>;

    const streakRows = (await this.db
      .collection<RewardStreak>('reward_streaks')
      .find({
        boxId: normalizedBoxId,
        ...(scopedUserIds ? { userId: { $in: scopedUserIds } } : {}),
        ...(minStreak > 0 ? { currentStreak: { $gte: minStreak } } : {}),
      })
      .sort({ totalXp: -1, currentStreak: -1 })
      .limit(limit)
      .toArray()) as RewardStreak[];

    const userIds = Array.from(
      new Set([
        ...topXpRows.map((row) => row._id.toHexString()),
        ...streakRows.map((row) => row.userId.toHexString()),
      ]),
    ).map((id) => new ObjectId(id));

    const users = userIds.length
      ? ((await this.db
          .collection<User>('users')
          .find({ _id: { $in: userIds } }, { projection: { passwordHash: 0 } })
          .toArray()) as Omit<User, 'passwordHash'>[])
      : [];

    const usersMap = new Map(users.map((user) => [user._id!.toHexString(), user]));

    return {
      period: normalizedDates,
      sourceDistribution: sourceDistributionRows.map((row) => ({
        source: row._id,
        points: row.points,
      })),
      topXpEarners: topXpRows.map((row, index) => ({
        rank: index + 1,
        userId: row._id,
        name: usersMap.get(row._id.toHexString())?.name ?? null,
        email: usersMap.get(row._id.toHexString())?.email ?? null,
        xpInPeriod: row.xpInPeriod,
      })),
      streakSnapshot: streakRows.map((row) => ({
        userId: row.userId,
        name: usersMap.get(row.userId.toHexString())?.name ?? null,
        email: usersMap.get(row.userId.toHexString())?.email ?? null,
        currentStreak: row.currentStreak,
        longestStreak: row.longestStreak,
        totalXp: row.totalXp,
        availableFreezes: row.availableFreezes,
      })),
    };
  }

  private async resolveScopedClassIds(boxId: ObjectId, actor: JwtPayload, coachId?: string): Promise<ObjectId[] | null> {
    // Se coachId é vazio, trata como não fornecido
    const cleanCoachId = coachId && coachId.trim() ? coachId : undefined;
    const coachFilter = cleanCoachId ?? (actor.role === UserRole.COACH ? actor.sub : undefined);

    if (!coachFilter) {
      return null;
    }

    const normalizedCoachId = this.ensureObjectId(coachFilter, 'coachId invalido');

    if (actor.role === UserRole.COACH && actor.sub !== normalizedCoachId.toHexString()) {
      throw new ForbiddenException('Coach so pode consultar seus proprios relatorios');
    }

    await this.ensureCoachInBox(boxId, normalizedCoachId);

    const rows = (await this.db.collection<CoachClassAssignment>('coach_class_assignments').find({
      boxId,
      coachId: normalizedCoachId,
      active: true,
    }).toArray()) as CoachClassAssignment[];

    if (rows.length === 0) {
      return [];
    }

    return rows.map((row) => row.classId);
  }

  private async resolveScopedUserIds(
    boxId: ObjectId,
    scopedClassIds: ObjectId[] | null,
    studentId: ObjectId | null,
  ): Promise<ObjectId[] | null> {
    if (studentId) {
      return [studentId];
    }

    if (!scopedClassIds) {
      return null;
    }

    if (scopedClassIds.length === 0) {
      return [];
    }

    const rows = (await this.db
      .collection('checkins')
      .aggregate([
        {
          $match: {
            boxId,
            classId: { $in: scopedClassIds },
          },
        },
        { $group: { _id: '$userId' } },
      ])
      .toArray()) as Array<{ _id: ObjectId }>;

    return rows.map((row) => row._id);
  }

  private async fetchCandidateStudents(boxId: ObjectId, studentId: ObjectId | null, scopedClassIds: ObjectId[] | null) {
    if (studentId) {
      const row = await this.db.collection<User>('users').findOne({
        _id: studentId,
        boxIds: boxId,
        role: UserRole.ALUNO,
      }, { projection: { passwordHash: 0 } });

      return row ? [row as Omit<User, 'passwordHash'>] : [];
    }

    if (scopedClassIds && scopedClassIds.length === 0) {
      return [];
    }

    // Para inatividade, sempre partimos de todos os alunos do box.
    // O escopo por coach/turma e aplicado ao calcular ultimo check-in,
    // permitindo que "nunca treinou" tambem apareca como inativo.
    return this.db.collection<User>('users').find(
      { boxIds: boxId, role: UserRole.ALUNO },
      { projection: { passwordHash: 0 } },
    ).toArray() as Promise<Array<Omit<User, 'passwordHash'>>>;
  }

  private buildCheckinMatch(
    boxId: ObjectId,
    startDate: Date,
    endDate: Date,
    options: { scopedClassIds: ObjectId[] | null; studentId: ObjectId | null; classId?: string },
  ) {
    const match: {
      boxId: ObjectId;
      createdAt: { $gte: Date; $lte: Date };
      userId?: ObjectId;
      classId?: ObjectId | { $in: ObjectId[] };
    } = {
      boxId,
      createdAt: { $gte: startDate, $lte: endDate },
    };

    if (options.studentId) {
      match.userId = options.studentId;
    }

    // Apenas valida classId se foi fornecido e é uma string não-vazia
    if (options.classId && options.classId.trim()) {
      match.classId = this.ensureObjectId(options.classId, 'classId invalido');
      return match;
    }

    if (options.scopedClassIds) {
      match.classId = { $in: options.scopedClassIds };
    }

    return match;
  }

  private resolveDateRange(startDate?: string, endDate?: string) {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('startDate/endDate invalidos');
    }

    if (start.getTime() > end.getTime()) {
      throw new BadRequestException('startDate deve ser menor ou igual a endDate');
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private parsePositiveInt(value: string | undefined, fallback: number, errorMessage: string) {
    if (!value) {
      return fallback;
    }

    const parsed = Number.parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      throw new BadRequestException(errorMessage);
    }

    return parsed;
  }

  private ensureObjectId(value: string, message: string): ObjectId {
    if (!ObjectId.isValid(value)) {
      throw new BadRequestException(message);
    }

    return new ObjectId(value);
  }

  private async ensureCoachInBox(boxId: ObjectId, coachId: ObjectId) {
    const coach = await this.db.collection<User>('users').findOne({
      _id: coachId,
      boxIds: boxId,
      role: UserRole.COACH,
    });

    if (!coach) {
      throw new NotFoundException('Coach nao encontrado neste box');
    }
  }

  private async ensureClassInBox(boxId: ObjectId, classId: ObjectId) {
    const classRow = await this.db.collection<ClassSchedule>('classes').findOne({
      _id: classId,
      boxId,
    });

    if (!classRow) {
      throw new NotFoundException('Aula nao encontrada neste box');
    }
  }

  private weekdayLabel(dayOfWeek: number) {
    const map: Record<number, string> = {
      1: 'SUNDAY',
      2: 'MONDAY',
      3: 'TUESDAY',
      4: 'WEDNESDAY',
      5: 'THURSDAY',
      6: 'FRIDAY',
      7: 'SATURDAY',
    };

    return map[dayOfWeek] ?? 'UNKNOWN';
  }
}
