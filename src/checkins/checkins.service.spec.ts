import { ForbiddenException } from '@nestjs/common';
import { ObjectId } from 'mongodb';
import { CheckinsService } from './checkins.service';

class FindCollection<T extends { _id?: ObjectId; createdAt?: Date }> {
  constructor(private readonly store: T[]) {}

  async findOne(query: Record<string, unknown>) {
    return (
      this.store.find((item) =>
        Object.entries(query).every(([key, value]) => {
          const currentValue = (item as Record<string, unknown>)[key];

          if (value instanceof ObjectId && currentValue instanceof ObjectId) {
            return currentValue.equals(value);
          }

          return currentValue === value;
        }),
      ) ?? null
    );
  }

  find(query: Record<string, unknown>) {
    const matches = this.store.filter((item) =>
      Object.entries(query).every(([key, value]) => {
        const currentValue = (item as Record<string, unknown>)[key];

        if (value instanceof ObjectId && currentValue instanceof ObjectId) {
          return currentValue.equals(value);
        }

        if (value && typeof value === 'object' && '$gte' in (value as Record<string, unknown>)) {
          const dateValue = currentValue as Date;
          const range = value as { $gte: Date; $lte: Date };
          return dateValue >= range.$gte && dateValue <= range.$lte;
        }

        return currentValue === value;
      }),
    );

    return {
      sort: ({ createdAt }: { createdAt: 1 | -1 }) => ({
        toArray: async () =>
          [...matches].sort((left, right) => {
            const leftTime = left.createdAt?.getTime() ?? 0;
            const rightTime = right.createdAt?.getTime() ?? 0;
            return (leftTime - rightTime) * createdAt;
          }),
      }),
    };
  }
}

class InsertCollection<T extends { _id?: ObjectId }> {
  constructor(private readonly store: T[]) {}

  async insertOne(document: T) {
    const inserted = {
      ...document,
      _id: new ObjectId(String(this.store.length + 1).padStart(24, '0')),
    } as T;

    this.store.push(inserted);
    return { insertedId: inserted._id };
  }

  find(query: Record<string, unknown>) {
    const matches = this.store.filter((item) =>
      Object.entries(query).every(([key, value]) => {
        const currentValue = (item as Record<string, unknown>)[key];

        if (value instanceof ObjectId && currentValue instanceof ObjectId) {
          return currentValue.equals(value);
        }

        if (value && typeof value === 'object' && '$gte' in (value as Record<string, unknown>)) {
          const dateValue = currentValue as Date;
          const range = value as { $gte: Date; $lte: Date };
          return dateValue >= range.$gte && dateValue <= range.$lte;
        }

        return currentValue === value;
      }),
    );

    return {
      sort: ({ createdAt }: { createdAt: 1 | -1 }) => ({
        toArray: async () =>
          [...matches].sort((left, right) => {
            const leftTime = (left as { createdAt?: Date }).createdAt?.getTime() ?? 0;
            const rightTime = (right as { createdAt?: Date }).createdAt?.getTime() ?? 0;
            return (leftTime - rightTime) * createdAt;
          }),
      }),
    };
  }
}

describe('CheckinsService', () => {
  const userId = new ObjectId('67ea76a5ac5d89c8bb9d2111');
  const boxId = new ObjectId('67ea76a5ac5d89c8bb9d2222');
  const users: Array<Record<string, unknown>> = [];
  const boxes: Array<Record<string, unknown>> = [];
  const checkins: Array<Record<string, unknown>> = [];

  const rewardsService = {
    recordCheckinActivity: jest.fn().mockResolvedValue({
      activityStatus: 'counted',
      currentStreak: 1,
      longestStreak: 1,
      availableFreezes: 0,
      totalXp: 10,
      xpGained: 10,
      freezeUsed: false,
      milestonesUnlocked: [],
    }),
  };

  const db = {
    collection: (name: string) => {
      if (name === 'users') {
        return new FindCollection(users as Array<{ _id?: ObjectId; createdAt?: Date }>);
      }

      if (name === 'boxes') {
        return new FindCollection(boxes as Array<{ _id?: ObjectId; createdAt?: Date }>);
      }

      if (name === 'checkins') {
        return new InsertCollection(checkins as Array<{ _id?: ObjectId }>);
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  };

  let service: CheckinsService;

  beforeEach(() => {
    users.length = 0;
    boxes.length = 0;
    checkins.length = 0;
    rewardsService.recordCheckinActivity.mockClear();
    service = new CheckinsService(db as never, rewardsService as never);
  });

  it('blocks checkin when user is not registered in the selected box', async () => {
    users.push({
      _id: userId,
      boxIds: [],
      name: 'Aluno',
      email: 'aluno@teste.com',
      passwordHash: 'hash',
      role: 'ALUNO',
      createdAt: new Date(),
    });

    boxes.push({
      _id: boxId,
      name: 'Box Alpha',
      cnpj: '12345678000199',
      location: { type: 'Point', coordinates: [-46.65284, -23.56447] },
      geofenceRadius: 100,
      createdAt: new Date(),
    });

    await expect(
      service.create(userId.toHexString(), boxId.toHexString(), {
        latitude: -23.56447,
        longitude: -46.65284,
      }),
    ).rejects.toThrow(
      'Voce ainda nao esta cadastrado como aluno desta academia. Procure o administrador para concluir seu cadastro.',
    );
  });

  it('allows checkin when user belongs to the box and is inside the configured radius', async () => {
    users.push({
      _id: userId,
      boxIds: [boxId],
      name: 'Aluno',
      email: 'aluno@teste.com',
      passwordHash: 'hash',
      role: 'ALUNO',
      createdAt: new Date(),
    });

    boxes.push({
      _id: boxId,
      name: 'Box Alpha',
      cnpj: '12345678000199',
      location: { type: 'Point', coordinates: [-46.65284, -23.56447] },
      geofenceRadius: 150,
      createdAt: new Date(),
    });

    const result = await service.create(userId.toHexString(), boxId.toHexString(), {
      latitude: -23.56447,
      longitude: -46.65284,
    });

    expect(result.message).toBe('Check-in realizado com sucesso');
    expect(result.distanceFromBoxInMeters).toBe(0);
    expect(rewardsService.recordCheckinActivity).toHaveBeenCalledWith(
      userId.toHexString(),
      boxId.toHexString(),
      expect.any(Date),
    );
  });

  it('uses the box geofenceRadius instead of a fixed radius', async () => {
    users.push({
      _id: userId,
      boxIds: [boxId],
      name: 'Aluno',
      email: 'aluno@teste.com',
      passwordHash: 'hash',
      role: 'ALUNO',
      createdAt: new Date(),
    });

    boxes.push({
      _id: boxId,
      name: 'Box Alpha',
      cnpj: '12345678000199',
      location: { type: 'Point', coordinates: [-46.65284, -23.56447] },
      geofenceRadius: 10,
      createdAt: new Date(),
    });

    await expect(
      service.create(userId.toHexString(), boxId.toHexString(), {
        latitude: -23.5642,
        longitude: -46.65284,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
