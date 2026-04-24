import { ObjectId } from 'mongodb';
import { UserRole } from '../common/enums';
import { AdminReportsService } from './admin-reports.service';

type AnyDoc = Record<string, unknown>;

function isObjectIdLike(value: unknown): value is ObjectId {
  return (
    !!value &&
    typeof value === 'object' &&
    'toHexString' in (value as Record<string, unknown>)
  );
}

function matchValue(itemValue: unknown, queryValue: unknown): boolean {
  if (Array.isArray(itemValue) && isObjectIdLike(queryValue)) {
    return itemValue.some(
      (candidate) => isObjectIdLike(candidate) && candidate.equals(queryValue),
    );
  }

  if (isObjectIdLike(queryValue)) {
    return isObjectIdLike(itemValue) && itemValue.equals(queryValue);
  }

  if (queryValue && typeof queryValue === 'object') {
    const operatorObject = queryValue as Record<string, unknown>;

    if ('$in' in operatorObject) {
      const inValues = operatorObject.$in as unknown[];

      if (Array.isArray(itemValue)) {
        return itemValue.some((candidate) =>
          inValues.some((allowed) => matchValue(candidate, allowed)),
        );
      }

      return inValues.some((allowed) => matchValue(itemValue, allowed));
    }
  }

  return itemValue === queryValue;
}

function matchesQuery(doc: AnyDoc, query: AnyDoc): boolean {
  return Object.entries(query).every(([key, expected]) => {
    const current = doc[key];
    return matchValue(current, expected);
  });
}

class MockFindCollection {
  constructor(private readonly docs: AnyDoc[]) {}

  async findOne(query: AnyDoc) {
    return this.docs.find((doc) => matchesQuery(doc, query)) ?? null;
  }

  find(query: AnyDoc) {
    const matches = this.docs.filter((doc) => matchesQuery(doc, query));
    return {
      toArray: async () => matches,
    };
  }
}

class MockCheckinsCollection {
  constructor(private readonly docs: AnyDoc[]) {}

  aggregate(pipeline: AnyDoc[]) {
    const matchStage = (pipeline.find((stage) => '$match' in stage)?.$match ??
      {}) as AnyDoc;

    const grouped = new Map<string, Date>();

    const filtered = this.docs.filter((doc) => {
      if (!matchesQuery(doc, matchStage)) {
        return false;
      }
      return true;
    });

    for (const row of filtered) {
      const userId = row.userId as ObjectId;
      const createdAt = row.createdAt as Date;
      const key = userId.toHexString();
      const existing = grouped.get(key);
      if (!existing || createdAt > existing) {
        grouped.set(key, createdAt);
      }
    }

    return {
      toArray: async () =>
        Array.from(grouped.entries()).map(([hex, date]) => ({
          _id: new ObjectId(hex),
          lastCheckinDate: date,
        })),
    };
  }
}

describe('AdminReportsService', () => {
  const boxId = new ObjectId('67ea76a5ac5d89c8bb9d2001');
  const classId = new ObjectId('67ea76a5ac5d89c8bb9d2002');
  const coachId = new ObjectId('67ea76a5ac5d89c8bb9d2003');
  const s1 = new ObjectId('67ea76a5ac5d89c8bb9d2011');
  const s2 = new ObjectId('67ea76a5ac5d89c8bb9d2012');
  const s3 = new ObjectId('67ea76a5ac5d89c8bb9d2013');
  const s4 = new ObjectId('67ea76a5ac5d89c8bb9d2014');

  const users: AnyDoc[] = [];
  const assignments: AnyDoc[] = [];
  const checkins: AnyDoc[] = [];
  const rewardStreaks: AnyDoc[] = [];

  const db = {
    collection: (name: string) => {
      if (name === 'users') {
        return new MockFindCollection(users);
      }

      if (name === 'coach_class_assignments') {
        return new MockFindCollection(assignments);
      }

      if (name === 'checkins') {
        return new MockCheckinsCollection(checkins);
      }

      if (name === 'reward_streaks') {
        return new MockFindCollection(rewardStreaks);
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  };

  let service: AdminReportsService;

  beforeEach(() => {
    users.length = 0;
    assignments.length = 0;
    checkins.length = 0;
    rewardStreaks.length = 0;

    service = new AdminReportsService(db as never);

    users.push(
      {
        _id: coachId,
        boxIds: [boxId],
        role: UserRole.COACH,
        name: 'Coach Alpha',
        email: 'coach.alpha@teste.com',
      },
      {
        _id: s1,
        boxIds: [boxId],
        role: UserRole.ALUNO,
        name: 'Aluno 1',
        email: 'aluno1@teste.com',
      },
      {
        _id: s2,
        boxIds: [boxId],
        role: UserRole.ALUNO,
        name: 'Aluno 2',
        email: 'aluno2@teste.com',
      },
      {
        _id: s3,
        boxIds: [boxId],
        role: UserRole.ALUNO,
        name: 'Aluno 3',
        email: 'aluno3@teste.com',
      },
      {
        _id: s4,
        boxIds: [boxId],
        role: UserRole.ALUNO,
        name: 'Aluno 4',
        email: 'aluno4@teste.com',
      },
    );

    assignments.push({
      _id: new ObjectId('67ea76a5ac5d89c8bb9d2021'),
      boxId,
      coachId,
      classId,
      active: true,
      assignedAt: new Date('2026-04-01T10:00:00.000Z'),
    });

    checkins.push({
      _id: new ObjectId('67ea76a5ac5d89c8bb9d2031'),
      boxId,
      classId,
      userId: s1,
      createdAt: new Date('2026-04-24T10:00:00.000Z'),
    });
  });

  it('includes never-trained students in inactivity report when filtering by coach scope', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));

      const report = await service.getInactivity(
        boxId.toHexString(),
        {
          sub: '67ea76a5ac5d89c8bb9d2aaa',
          email: 'admin@teste.com',
          boxIds: [boxId.toHexString()],
          boxId: boxId.toHexString(),
          role: UserRole.ADMIN,
        },
        {
          coachId: coachId.toHexString(),
          thresholdDays: '7',
        },
      );

      expect(report.count).toBe(3);
      expect(report.students).toHaveLength(3);

      const returnedIds = report.students.map((row) => row.userId.toHexString());
      expect(returnedIds).toEqual(
        expect.arrayContaining([s2.toHexString(), s3.toHexString(), s4.toHexString()]),
      );
      expect(report.students.every((row) => row.isNeverTrained)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
