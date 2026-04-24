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

        if (
          value &&
          typeof value === 'object' &&
          '$gte' in (value as Record<string, unknown>)
        ) {
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

        if (
          value &&
          typeof value === 'object' &&
          '$gte' in (value as Record<string, unknown>)
        ) {
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
            const leftTime =
              (left as { createdAt?: Date }).createdAt?.getTime() ?? 0;
            const rightTime =
              (right as { createdAt?: Date }).createdAt?.getTime() ?? 0;
            return (leftTime - rightTime) * createdAt;
          }),
      }),
    };
  }

  async countDocuments(query: Record<string, unknown>) {
    return this.store.filter((item) =>
      Object.entries(query).every(([key, value]) => {
        const currentValue = (item as Record<string, unknown>)[key];

        if (value instanceof ObjectId && currentValue instanceof ObjectId) {
          return currentValue.equals(value);
        }

        if (
          value &&
          typeof value === 'object' &&
          '$gte' in (value as Record<string, unknown>)
        ) {
          const dateValue = currentValue as Date;
          const range = value as { $gte: Date; $lte: Date };
          return dateValue >= range.$gte && dateValue <= range.$lte;
        }

        return currentValue === value;
      }),
    ).length;
  }

  async deleteOne(query: Record<string, unknown>) {
    const index = this.store.findIndex((item) =>
      Object.entries(query).every(([key, value]) => {
        const currentValue = (item as Record<string, unknown>)[key];

        if (value instanceof ObjectId && currentValue instanceof ObjectId) {
          return currentValue.equals(value);
        }

        return currentValue === value;
      }),
    );

    if (index < 0) {
      return { deletedCount: 0 };
    }

    this.store.splice(index, 1);
    return { deletedCount: 1 };
  }
}

describe('CheckinsService', () => {
  const userId = new ObjectId('67ea76a5ac5d89c8bb9d2111');
  const boxId = new ObjectId('67ea76a5ac5d89c8bb9d2222');
  const classId = new ObjectId('67ea76a5ac5d89c8bb9d3333');
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

  const classesService = {
    findByIdInBox: jest.fn().mockResolvedValue({
      _id: classId,
      boxId,
      name: 'Turma das 7h',
      weekDays: ['MONDAY'],
      startTime: '07:00',
      endTime: '08:00',
      createdAt: new Date(),
    }),
    isNowInsideClassWindow: jest.fn().mockReturnValue(true),
  };

  const wodsService = {
    findTodayByBox: jest.fn().mockResolvedValue(null),
  };

  const db = {
    collection: (name: string) => {
      if (name === 'users') {
        return new FindCollection(
          users as Array<{ _id?: ObjectId; createdAt?: Date }>,
        );
      }

      if (name === 'boxes') {
        return new FindCollection(
          boxes as Array<{ _id?: ObjectId; createdAt?: Date }>,
        );
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
    classesService.findByIdInBox.mockClear();
    classesService.isNowInsideClassWindow.mockClear();
    classesService.isNowInsideClassWindow.mockReturnValue(true);
    wodsService.findTodayByBox.mockClear();
    service = new CheckinsService(
      db as never,
      rewardsService as never,
      classesService as never,
      wodsService as never,
    );
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
        classId: classId.toHexString(),
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

    const result = await service.create(
      userId.toHexString(),
      boxId.toHexString(),
      {
        classId: classId.toHexString(),
        latitude: -23.56447,
        longitude: -46.65284,
      },
    );

    expect(result.message).toBe('Check-in realizado com sucesso');
    expect(result.distanceFromBoxInMeters).toBe(0);
    expect(rewardsService.recordCheckinActivity).toHaveBeenCalledWith(
      userId.toHexString(),
      boxId.toHexString(),
      expect.any(Date),
    );
    expect(classesService.findByIdInBox).toHaveBeenCalledWith(
      boxId.toHexString(),
      classId.toHexString(),
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
        classId: classId.toHexString(),
        latitude: -23.5642,
        longitude: -46.65284,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows checkin even when class is outside current class window', async () => {
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

    classesService.isNowInsideClassWindow.mockReturnValue(false);

    const result = await service.create(
      userId.toHexString(),
      boxId.toHexString(),
      {
        classId: classId.toHexString(),
        latitude: -23.56447,
        longitude: -46.65284,
      },
    );

    expect(result.message).toBe('Check-in realizado com sucesso');
  });

  it('blocks second checkin in the same day for the same user even in another class', async () => {
    const anotherClassId = new ObjectId('67ea76a5ac5d89c8bb9d3777');

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

    checkins.push({
      _id: new ObjectId('67ea76a5ac5d89c8bb9d3888'),
      userId,
      boxId,
      classId,
      latitude: -23.56447,
      longitude: -46.65284,
      distanceFromBoxInMeters: 0,
      createdAt: new Date(),
    });

    await expect(
      service.create(userId.toHexString(), boxId.toHexString(), {
        classId: anotherClassId.toHexString(),
        latitude: -23.56447,
        longitude: -46.65284,
      }),
    ).rejects.toThrow(
      'Usuario ja realizou check-in hoje. Apenas um check-in diario e permitido',
    );
  });

  it('blocks checkin when class checkin limit for the day is reached', async () => {
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

    classesService.findByIdInBox.mockResolvedValue({
      _id: classId,
      boxId,
      name: 'Turma das 7h',
      weekDays: ['MONDAY'],
      startTime: '07:00',
      endTime: '08:00',
      checkinLimit: 1,
      createdAt: new Date(),
    });

    checkins.push({
      _id: new ObjectId('67ea76a5ac5d89c8bb9d3999'),
      userId: new ObjectId('67ea76a5ac5d89c8bb9d4999'),
      boxId,
      classId,
      latitude: -23.56447,
      longitude: -46.65284,
      distanceFromBoxInMeters: 0,
      createdAt: new Date(),
    });

    await expect(
      service.create(userId.toHexString(), boxId.toHexString(), {
        classId: classId.toHexString(),
        latitude: -23.56447,
        longitude: -46.65284,
      }),
    ).rejects.toThrow('Limite de check-ins desta aula atingido para hoje');
  });

  it('deletes checkin when request happens at least 1 hour before class start', async () => {
    const now = new Date();
    const checkinCreatedAt = new Date(now);
    checkinCreatedAt.setDate(checkinCreatedAt.getDate() + 1);
    checkinCreatedAt.setHours(10, 0, 0, 0);

    checkins.push({
      _id: new ObjectId('67ea76a5ac5d89c8bb9d3444'),
      userId,
      boxId,
      classId,
      latitude: -23.56447,
      longitude: -46.65284,
      distanceFromBoxInMeters: 0,
      createdAt: checkinCreatedAt,
    });

    classesService.findByIdInBox.mockResolvedValue({
      _id: classId,
      boxId,
      name: 'Turma das 10h',
      weekDays: ['MONDAY'],
      startTime: '10:00',
      endTime: '11:00',
      createdAt: new Date(),
    });

    const result = await service.deleteMyCheckin(
      userId.toHexString(),
      boxId.toHexString(),
      '67ea76a5ac5d89c8bb9d3444',
    );

    expect(result.message).toBe('Check-in removido com sucesso');
    expect(checkins).toHaveLength(0);
  });

  it('blocks deleting checkin when request happens less than 1 hour before class start', async () => {
    const now = new Date();
    const checkinCreatedAt = new Date(now);
    checkinCreatedAt.setHours(now.getHours(), now.getMinutes(), 0, 0);
    const classStart = new Date(now.getTime() + 30 * 60 * 1000);
    const startHours = String(classStart.getHours()).padStart(2, '0');
    const startMinutes = String(classStart.getMinutes()).padStart(2, '0');

    checkins.push({
      _id: new ObjectId('67ea76a5ac5d89c8bb9d3555'),
      userId,
      boxId,
      classId,
      latitude: -23.56447,
      longitude: -46.65284,
      distanceFromBoxInMeters: 0,
      createdAt: checkinCreatedAt,
    });

    classesService.findByIdInBox.mockResolvedValue({
      _id: classId,
      boxId,
      name: 'Turma limite',
      weekDays: ['MONDAY'],
      startTime: `${startHours}:${startMinutes}`,
      endTime: '23:59',
      createdAt: new Date(),
    });

    await expect(
      service.deleteMyCheckin(
        userId.toHexString(),
        boxId.toHexString(),
        '67ea76a5ac5d89c8bb9d3555',
      ),
    ).rejects.toThrow('Cancelamento permitido somente ate 1 hora antes da aula');
  });
});
