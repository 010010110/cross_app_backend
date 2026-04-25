import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { ClassesService } from '../classes/classes.service';
import { Box } from '../common/interfaces/box.interface';
import { User } from '../common/interfaces/user.interface';
import { MONGO_CLIENT } from '../database/database.constants';
import { RewardsService } from '../rewards/rewards.service';
import { WodsService } from '../wods/wods.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { Checkin } from './interfaces/checkin.interface';

@Injectable()
export class CheckinsService {
  private static readonly DELETE_WINDOW_IN_MS = 60 * 60 * 1000;
  private static readonly EARTH_RADIUS_IN_METERS = 6371000;
  private static readonly DEGREES_TO_RADIANS_FACTOR = Math.PI / 180;

  constructor(
    @Inject(MONGO_CLIENT) private readonly db: Db,
    private readonly rewardsService: RewardsService,
    private readonly classesService: ClassesService,
    private readonly wodsService: WodsService,
  ) {}

  async create(userId: string, boxId: string, dto: CreateCheckinDto) {
    if (!ObjectId.isValid(boxId)) {
      throw new ForbiddenException('Header x-box-id ausente ou invalido');
    }

    const normalizedUserId = new ObjectId(userId);
    const normalizedBoxId = new ObjectId(boxId);
    const user = await this.db
      .collection<User>('users')
      .findOne({ _id: normalizedUserId });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    if (
      !user.boxIds.some((registeredBoxId) =>
        registeredBoxId.equals(normalizedBoxId),
      )
    ) {
      throw new ForbiddenException(
        'Voce ainda nao esta cadastrado como aluno desta academia. Procure o administrador para concluir seu cadastro.',
      );
    }

    const box = await this.db
      .collection<Box>('boxes')
      .findOne({ _id: normalizedBoxId });

    if (!box) {
      throw new NotFoundException('Box nao encontrado');
    }

    const [boxLongitude, boxLatitude] = box.location.coordinates;

    const distanceFromBoxInMeters = this.calculateDistanceInMeters(
      dto.latitude,
      dto.longitude,
      boxLatitude,
      boxLongitude,
    );

    if (distanceFromBoxInMeters > box.geofenceRadius) {
      throw new ForbiddenException(
        'Voce esta fora do raio permitido para check-in',
      );
    }

    const classSchedule = await this.classesService.findByIdInBox(
      boxId,
      dto.classId,
    );

    const { startOfDay, endOfDay } = this.resolveCurrentDayRange();
    const userDailyCheckinsCount = await this.db
      .collection<Checkin>('checkins')
      .countDocuments({
        userId: normalizedUserId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      });

    if (userDailyCheckinsCount > 0) {
      throw new ForbiddenException(
        'Usuario ja realizou check-in hoje. Apenas um check-in diario e permitido',
      );
    }

    if (classSchedule.checkinLimit) {
      const currentCheckinsCount = await this.db
        .collection<Checkin>('checkins')
        .countDocuments({
          boxId: normalizedBoxId,
          classId: new ObjectId(dto.classId),
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

      if (currentCheckinsCount >= classSchedule.checkinLimit) {
        throw new ForbiddenException(
          'Limite de check-ins desta aula atingido para hoje',
        );
      }
    }

    const checkin: Checkin = {
      userId: normalizedUserId,
      boxId: normalizedBoxId,
      classId: new ObjectId(dto.classId),
      latitude: dto.latitude,
      longitude: dto.longitude,
      distanceFromBoxInMeters,
      createdAt: new Date(),
    };

    const result = await this.db
      .collection<Checkin>('checkins')
      .insertOne(checkin);
    const consistency = await this.rewardsService.recordCheckinActivity(
      userId,
      boxId,
      checkin.createdAt,
    );
    const wod = await this.wodsService.findTodayByBox(boxId);

    return {
      checkinId: result.insertedId,
      distanceFromBoxInMeters,
      consistency,
      class: {
        classId: classSchedule._id,
        name: classSchedule.name,
        startTime: classSchedule.startTime,
        endTime: classSchedule.endTime,
        checkinLimit: classSchedule.checkinLimit ?? null,
      },
      wod,
      message: 'Check-in realizado com sucesso',
    };
  }

  private resolveCurrentDayRange() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return { startOfDay, endOfDay };
  }

  async findByUser(userId: string) {
    return this.db
      .collection<Checkin>('checkins')
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async findByBox(boxId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    return this.db
      .collection<Checkin>('checkins')
      .find({
        boxId: new ObjectId(boxId),
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async deleteMyCheckin(userId: string, boxId: string, checkinId: string) {
    if (!ObjectId.isValid(boxId)) {
      throw new ForbiddenException('Header x-box-id ausente ou invalido');
    }

    if (!ObjectId.isValid(checkinId)) {
      throw new BadRequestException('checkinId invalido');
    }

    const normalizedUserId = new ObjectId(userId);
    const normalizedBoxId = new ObjectId(boxId);
    const normalizedCheckinId = new ObjectId(checkinId);

    const checkin = await this.db.collection<Checkin>('checkins').findOne({
      _id: normalizedCheckinId,
      userId: normalizedUserId,
      boxId: normalizedBoxId,
    });

    if (!checkin) {
      throw new NotFoundException('Check-in nao encontrado para este usuario no box selecionado');
    }

    const classSchedule = await this.classesService.findByIdInBox(
      boxId,
      checkin.classId.toHexString(),
    );

    const classStartDate = this.resolveClassStartDate(checkin.createdAt, classSchedule.startTime);
    const deleteDeadline = new Date(
      classStartDate.getTime() - CheckinsService.DELETE_WINDOW_IN_MS,
    );

    if (new Date().getTime() > deleteDeadline.getTime()) {
      throw new ForbiddenException('Cancelamento permitido somente ate 1 hora antes da aula');
    }

    await this.db.collection<Checkin>('checkins').deleteOne({
      _id: normalizedCheckinId,
      userId: normalizedUserId,
      boxId: normalizedBoxId,
    });

    return {
      checkinId: normalizedCheckinId,
      message: 'Check-in removido com sucesso',
    };
  }

  private calculateDistanceInMeters(
    originLatitude: number,
    originLongitude: number,
    destinationLatitude: number,
    destinationLongitude: number,
  ): number {
    const toRadians =
      (degrees: number): number =>
        degrees * CheckinsService.DEGREES_TO_RADIANS_FACTOR;

    const latitudeDiff = toRadians(destinationLatitude - originLatitude);
    const longitudeDiff = toRadians(destinationLongitude - originLongitude);

    const originLatitudeInRadians = toRadians(originLatitude);
    const destinationLatitudeInRadians = toRadians(destinationLatitude);

    const a =
      Math.sin(latitudeDiff / 2) * Math.sin(latitudeDiff / 2) +
      Math.cos(originLatitudeInRadians) *
        Math.cos(destinationLatitudeInRadians) *
        Math.sin(longitudeDiff / 2) *
        Math.sin(longitudeDiff / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return CheckinsService.EARTH_RADIUS_IN_METERS * c;
  }

  private resolveClassStartDate(baseDate: Date, startTime: string) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const classStartDate = new Date(baseDate);
    classStartDate.setHours(hours, minutes, 0, 0);
    return classStartDate;
  }
}
