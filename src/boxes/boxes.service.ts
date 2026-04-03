import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { AuthService } from '../auth/auth.service';
import { Box } from '../common/interfaces/box.interface';
import { MONGO_CLIENT } from '../database/database.constants';
import { UsersService } from '../users/users.service';
import { FindNearbyBoxesDto } from './dto/find-nearby-boxes.dto';
import { RegisterBoxDto } from './dto/register-box.dto';

@Injectable()
export class BoxesService {
  constructor(
    @Inject(MONGO_CLIENT) private readonly db: Db,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  async register(registerBoxDto: RegisterBoxDto) {
    const existingBox = await this.db.collection<Box>('boxes').findOne({
      cnpj: registerBoxDto.cnpj,
    });

    if (existingBox) {
      throw new BadRequestException('Ja existe box com este CNPJ');
    }

    let parentBoxObjectId: ObjectId | undefined;

    if (registerBoxDto.parentBoxId) {
      if (!ObjectId.isValid(registerBoxDto.parentBoxId)) {
        throw new BadRequestException('parentBoxId invalido');
      }

      parentBoxObjectId = new ObjectId(registerBoxDto.parentBoxId);
      const parentBox = await this.db.collection<Box>('boxes').findOne({
        _id: parentBoxObjectId,
      });

      if (!parentBox) {
        throw new BadRequestException('Box matriz informado nao existe');
      }
    }

    const box: Box = {
      parentBoxId: parentBoxObjectId,
      name: registerBoxDto.name,
      cnpj: registerBoxDto.cnpj,
      location: {
        type: 'Point',
        coordinates: [registerBoxDto.longitude, registerBoxDto.latitude],
      },
      geofenceRadius: registerBoxDto.geofenceRadius,
      createdAt: new Date(),
    };

    const boxInsertResult = await this.db.collection<Box>('boxes').insertOne(box);

    let adminId: ObjectId;
    let linkedExistingAdmin: boolean;

    try {
      const adminCreationResult = await this.usersService.createInitialAdmin({
        boxId: boxInsertResult.insertedId,
        name: registerBoxDto.adminName,
        email: registerBoxDto.adminEmail,
        password: registerBoxDto.adminPassword,
      });

      adminId = adminCreationResult.adminId;
      linkedExistingAdmin = adminCreationResult.linkedExistingAdmin;
    } catch (error) {
      await this.db.collection<Box>('boxes').deleteOne({
        _id: boxInsertResult.insertedId,
      });

      throw error;
    }

    const adminUser = await this.usersService.findById(adminId);
    const session = await this.authService.createSession(adminUser);

    return {
      boxId: boxInsertResult.insertedId,
      adminId,
      adminLinkedToExisting: linkedExistingAdmin,
      ...session,
      message: linkedExistingAdmin
        ? 'Box criado, ADMIN existente vinculado e JWT retornado com sucesso'
        : 'Box, usuario ADMIN e JWT criados com sucesso',
    };
  }

  async findMineByUserId(userId: string) {
    const user = await this.usersService.findById(userId);
    return this.findByIds(user.boxIds);
  }

  async findByIds(boxObjectIds: ObjectId[]) {
    return this.db
      .collection<Box>('boxes')
      .find({ _id: { $in: boxObjectIds } })
      .toArray();
  }

  async findNearbyByLocation(userId: string, query: FindNearbyBoxesDto) {
    const [user, boxes] = await Promise.all([
      this.usersService.findById(userId),
      this.db.collection<Box>('boxes').find().toArray(),
    ]);

    return boxes
      .map((box) => {
        const [boxLongitude, boxLatitude] = box.location.coordinates;
        const distanceInMeters = this.calculateDistanceInMeters(
          query.latitude,
          query.longitude,
          boxLatitude,
          boxLongitude,
        );

        return {
          boxId: box._id,
          name: box.name,
          cnpj: box.cnpj,
          latitude: boxLatitude,
          longitude: boxLongitude,
          geofenceRadius: box.geofenceRadius,
          distanceInMeters,
          isStudentRegistered: user.boxIds.some((registeredBoxId) => registeredBoxId.equals(box._id!)),
        };
      })
      .sort((left, right) => left.distanceInMeters - right.distanceInMeters);
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
