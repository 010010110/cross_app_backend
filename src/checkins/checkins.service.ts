import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { Box } from '../common/interfaces/box.interface';
import { RewardsService } from '../rewards/rewards.service';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { Checkin } from './interfaces/checkin.interface';

@Injectable()
export class CheckinsService {
  private static readonly CHECKIN_RADIUS_METERS = 100;

  constructor(
    @Inject(MONGO_CLIENT) private readonly db: Db,
    private readonly rewardsService: RewardsService,
  ) {}

  async create(userId: string, boxId: string, dto: CreateCheckinDto) {
    const box = await this.db.collection<Box>('boxes').findOne({ _id: new ObjectId(boxId) });

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

    if (distanceFromBoxInMeters > CheckinsService.CHECKIN_RADIUS_METERS) {
      throw new ForbiddenException('Voce esta fora do raio permitido para check-in');
    }

    const checkin: Checkin = {
      userId: new ObjectId(userId),
      boxId: new ObjectId(boxId),
      latitude: dto.latitude,
      longitude: dto.longitude,
      distanceFromBoxInMeters,
      createdAt: new Date(),
    };

    const result = await this.db.collection<Checkin>('checkins').insertOne(checkin);
    const consistency = await this.rewardsService.recordCheckinActivity(
      userId,
      boxId,
      checkin.createdAt,
    );

    return {
      checkinId: result.insertedId,
      distanceFromBoxInMeters,
      consistency,
      message: 'Check-in realizado com sucesso',
    };
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

  private calculateDistanceInMeters(
    originLatitude: number,
    originLongitude: number,
    destinationLatitude: number,
    destinationLongitude: number,
  ): number {
    const earthRadiusInMeters = 6371000;

    const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

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

    return earthRadiusInMeters * c;
  }
}
