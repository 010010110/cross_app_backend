import { ObjectId } from 'mongodb';
import { CheckinActivityStatus } from '../common/enums';
import { RewardsService } from './rewards.service';

class MockCollection<T extends { _id?: { toHexString(): string } }> {
  constructor(private readonly store: T[]) {}

  async findOne(query: Record<string, unknown>, options?: { sort?: { createdAt: 1 | -1 } }) {
    const matches = this.store.filter((item) =>
      Object.entries(query).every(([key, value]) => {
        const itemValue = (item as Record<string, unknown>)[key];
        if (value && typeof value === 'object' && 'toHexString' in (value as Record<string, unknown>)) {
          return (
            itemValue &&
            typeof itemValue === 'object' &&
            'toHexString' in (itemValue as Record<string, unknown>) &&
            (itemValue as { toHexString(): string }).toHexString() ===
              (value as { toHexString(): string }).toHexString()
          );
        }

        return itemValue === value;
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
        if (value && typeof value === 'object' && 'toHexString' in (value as Record<string, unknown>)) {
          return (
            itemValue &&
            typeof itemValue === 'object' &&
            'toHexString' in (itemValue as Record<string, unknown>) &&
            (itemValue as { toHexString(): string }).toHexString() ===
              (value as { toHexString(): string }).toHexString()
          );
        }

        return itemValue === value;
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

      throw new Error(`Unexpected collection ${name}`);
    },
  };

  let service: RewardsService;

  beforeEach(() => {
    rewardStreaks.length = 0;
    rewardMilestones.length = 0;
    rewardXpLedger.length = 0;
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
});
