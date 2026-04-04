import { ObjectId } from 'mongodb';
import { CheckinActivityStatus, RewardStreakState } from '../common/enums';
import { RewardsService } from './rewards.service';

function matchesQueryValue(itemValue: unknown, queryValue: unknown): boolean {
  if (queryValue && typeof queryValue === 'object' && 'toHexString' in (queryValue as Record<string, unknown>)) {
    return (
      !!itemValue &&
      typeof itemValue === 'object' &&
      'toHexString' in (itemValue as Record<string, unknown>) &&
      (itemValue as { toHexString(): string }).toHexString() ===
        (queryValue as { toHexString(): string }).toHexString()
    );
  }

  if (queryValue && typeof queryValue === 'object' && !Array.isArray(queryValue)) {
    const operatorObject = queryValue as Record<string, unknown>;

    if ('$gte' in operatorObject || '$lte' in operatorObject) {
      const itemDate = itemValue instanceof Date ? itemValue.getTime() : Number.NaN;
      const gteTime = operatorObject.$gte instanceof Date ? operatorObject.$gte.getTime() : Number.NEGATIVE_INFINITY;
      const lteTime = operatorObject.$lte instanceof Date ? operatorObject.$lte.getTime() : Number.POSITIVE_INFINITY;
      return itemDate >= gteTime && itemDate <= lteTime;
    }
  }

  return itemValue === queryValue;
}

class MockCollection<T extends { _id?: { toHexString(): string } }> {
  constructor(private readonly store: T[]) {}

  async findOne(query: Record<string, unknown>, options?: { sort?: { createdAt: 1 | -1 } }) {
    const matches = this.store.filter((item) =>
      Object.entries(query).every(([key, value]) => {
        const itemValue = (item as Record<string, unknown>)[key];
        return matchesQueryValue(itemValue, value);
      }),
    );

    if (!options?.sort) {
      return matches[0] ?? null;
    }

    return (
      [...matches].sort((left, right) => {
        const direction = options.sort?.createdAt ?? 1;
        const leftTime = new Date((left as Record<string, unknown>).createdAt as Date).getTime();
        const rightTime = new Date((right as Record<string, unknown>).createdAt as Date).getTime();
        return (leftTime - rightTime) * direction;
      })[0] ?? null
    );
  }

  async insertOne(document: T) {
    const inserted = { ...document, _id: createObjectId(String(this.store.length + 1)) } as T;
    this.store.push(inserted);
    return { insertedId: inserted._id };
  }

  async updateOne(query: Record<string, unknown>, update: { $set: Record<string, unknown> }) {
    const match = await this.findOne(query);
    if (!match) {
      return { matchedCount: 0 };
    }

    Object.assign(match as Record<string, unknown>, update.$set);
    return { matchedCount: 1 };
  }

  find(query: Record<string, unknown>) {
    const matches = this.store.filter((item) =>
      Object.entries(query).every(([key, value]) => {
        const itemValue = (item as Record<string, unknown>)[key];
        return matchesQueryValue(itemValue, value);
      }),
    );

    return {
      sort: ({ unlockedAt }: { unlockedAt: 1 | -1 }) => ({
        toArray: async () =>
          [...matches].sort((left, right) => {
            const leftTime = new Date((left as Record<string, unknown>).unlockedAt as Date).getTime();
            const rightTime = new Date((right as Record<string, unknown>).unlockedAt as Date).getTime();
            return (leftTime - rightTime) * unlockedAt;
          }),
      }),
      toArray: async () => matches,
    };
  }
}

const createObjectId = (value: string) => new ObjectId(value.padStart(24, '0').slice(-24));

describe('RewardsService', () => {
  const rewardStreaks: Array<Record<string, unknown>> = [];
  const rewardMilestones: Array<Record<string, unknown>> = [];
  const rewardXpLedger: Array<Record<string, unknown>> = [];
  const checkins: Array<Record<string, unknown>> = [];

  const db = {
    collection: (name: string) => {
      if (name === 'reward_streaks') {
        return new MockCollection(rewardStreaks);
      }

      if (name === 'reward_milestones') {
        return new MockCollection(rewardMilestones);
      }

      if (name === 'reward_xp_ledger') {
        return new MockCollection(rewardXpLedger);
      }

      if (name === 'checkins') {
        return new MockCollection(checkins);
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  };

  let service: RewardsService;

  beforeEach(() => {
    rewardStreaks.length = 0;
    rewardMilestones.length = 0;
    rewardXpLedger.length = 0;
    checkins.length = 0;
    service = new RewardsService(db as never);
  });

  it('creates first streak on first checkin', async () => {
    const result = await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-02T10:00:00.000Z'),
    );

    expect(result.activityStatus).toBe(CheckinActivityStatus.COUNTED);
    expect(result.currentStreak).toBe(1);
    expect(result.totalXp).toBe(10);
  });

  it('does not double count two checkins on the same day', async () => {
    await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-02T10:00:00.000Z'),
    );

    const result = await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-02T18:00:00.000Z'),
    );

    expect(result.activityStatus).toBe(CheckinActivityStatus.ALREADY_COUNTED);
    expect(result.xpGained).toBe(0);
    expect(result.currentStreak).toBe(1);
  });

  it('unlocks the 7 day milestone and grants freeze + bonus xp', async () => {
    for (let day = 1; day <= 6; day += 1) {
      await service.recordCheckinActivity(
        '67ea76a5ac5d89c8bb9d2111',
        '67ea76a5ac5d89c8bb9d2222',
        new Date(`2026-04-${String(day).padStart(2, '0')}T10:00:00.000Z`),
      );
    }

    const result = await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-07T10:00:00.000Z'),
    );

    expect(result.currentStreak).toBe(7);
    expect(result.availableFreezes).toBe(1);
    expect(result.milestonesUnlocked).toEqual([7]);
    expect(result.xpGained).toBe(60);
  });

  it('does not consume freeze when skipping weekend between friday and monday', async () => {
    await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-03T10:00:00.000Z'),
    );

    const result = await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-06T10:00:00.000Z'),
    );

    expect(result.activityStatus).toBe(CheckinActivityStatus.COUNTED);
    expect(result.freezeUsed).toBe(false);
    expect(result.currentStreak).toBe(2);
  });

  it('grants saturday bonus xp on counted checkin', async () => {
    const result = await service.recordCheckinActivity(
      '67ea76a5ac5d89c8bb9d2111',
      '67ea76a5ac5d89c8bb9d2222',
      new Date('2026-04-04T10:00:00.000Z'),
    );

    expect(result.activityStatus).toBe(CheckinActivityStatus.COUNTED);
    expect(result.xpGained).toBe(15);
    expect(result.totalXp).toBe(15);
  });

  it('keeps streak active over weekend with no extra checkin', async () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-04-05T12:00:00.000Z'));

      await service.recordCheckinActivity(
        '67ea76a5ac5d89c8bb9d2111',
        '67ea76a5ac5d89c8bb9d2222',
        new Date('2026-04-03T10:00:00.000Z'),
      );

      const summary = await service.getMySummary('67ea76a5ac5d89c8bb9d2111', '67ea76a5ac5d89c8bb9d2222');

      expect(summary.streakState).toBe(RewardStreakState.ACTIVE);
    } finally {
      jest.useRealTimers();
    }
  });

  it('grants sunday bonus xp on counted checkin', async () => {
    const userId = createObjectId('67ea76a5ac5d89c8bb9d2111');
    const boxId = createObjectId('67ea76a5ac5d89c8bb9d2222');
    checkins.push({
      _id: createObjectId('9001'),
      userId,
      boxId,
      createdAt: new Date('2026-04-05T10:00:00.000Z'),
    });

    const result = await service.recordCheckinActivity(
      userId.toHexString(),
      boxId.toHexString(),
      new Date('2026-04-05T10:00:00.000Z'),
    );

    expect(result.activityStatus).toBe(CheckinActivityStatus.COUNTED);
    expect(result.xpGained).toBe(15);
    expect(result.totalXp).toBe(15);
  });

  it('grants extra bonus when user trained all 7 days in the week', async () => {
    const userId = createObjectId('67ea76a5ac5d89c8bb9d2111');
    const boxId = createObjectId('67ea76a5ac5d89c8bb9d2222');
    rewardMilestones.push({
      _id: createObjectId('9200'),
      userId,
      boxId,
      streakDays: 7,
      rewardXp: 50,
      rewardFreeze: 1,
      unlockedAt: new Date('2026-03-01T10:00:00.000Z'),
    });

    const weekDates = [
      '2026-03-30T10:00:00.000Z',
      '2026-03-31T10:00:00.000Z',
      '2026-04-01T10:00:00.000Z',
      '2026-04-02T10:00:00.000Z',
      '2026-04-03T10:00:00.000Z',
      '2026-04-04T10:00:00.000Z',
      '2026-04-05T10:00:00.000Z',
    ];

    weekDates.forEach((date, index) => {
      checkins.push({
        _id: createObjectId(String(9100 + index)),
        userId,
        boxId,
        createdAt: new Date(date),
      });
    });

    for (let index = 0; index < weekDates.length - 1; index += 1) {
      await service.recordCheckinActivity(userId.toHexString(), boxId.toHexString(), new Date(weekDates[index]));
    }

    const sundayResult = await service.recordCheckinActivity(
      userId.toHexString(),
      boxId.toHexString(),
      new Date('2026-04-05T10:00:00.000Z'),
    );

    expect(sundayResult.activityStatus).toBe(CheckinActivityStatus.COUNTED);
    expect(sundayResult.xpGained).toBe(20);
    expect(sundayResult.availableFreezes).toBe(1);
  });

  it('does not grant double freeze when 7-day milestone and full-week bonus happen together', async () => {
    const userId = createObjectId('67ea76a5ac5d89c8bb9d2111');
    const boxId = createObjectId('67ea76a5ac5d89c8bb9d2222');
    const weekDates = [
      '2026-03-30T10:00:00.000Z',
      '2026-03-31T10:00:00.000Z',
      '2026-04-01T10:00:00.000Z',
      '2026-04-02T10:00:00.000Z',
      '2026-04-03T10:00:00.000Z',
      '2026-04-04T10:00:00.000Z',
      '2026-04-05T10:00:00.000Z',
    ];

    weekDates.forEach((date, index) => {
      checkins.push({
        _id: createObjectId(String(9300 + index)),
        userId,
        boxId,
        createdAt: new Date(date),
      });
    });

    for (let index = 0; index < weekDates.length - 1; index += 1) {
      await service.recordCheckinActivity(userId.toHexString(), boxId.toHexString(), new Date(weekDates[index]));
    }

    const sundayResult = await service.recordCheckinActivity(
      userId.toHexString(),
      boxId.toHexString(),
      new Date('2026-04-05T10:00:00.000Z'),
    );

    expect(sundayResult.milestonesUnlocked).toEqual([7]);
    expect(sundayResult.availableFreezes).toBe(1);
  });
});
