import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
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
    const [user] = await Promise.all([
      this.usersService.findById(userId),
    ]);

    const radius = query.radius || 5000;
    const [longitude, latitude] = [query.longitude, query.latitude];

    const boxes = await this.db
      .collection<Box>('boxes')
      .aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            distanceField: 'distanceInMeters',
            maxDistance: radius,
            spherical: true,
          },
        },
        {
          $project: {
            boxId: '$_id',
            name: 1,
            cnpj: 1,
            latitude: { $arrayElemAt: ['$location.coordinates', 1] },
            longitude: { $arrayElemAt: ['$location.coordinates', 0] },
            geofenceRadius: 1,
            distanceInMeters: 1,
          },
        },
      ])
      .toArray();

    return boxes.map((box: any) => ({
      ...box,
      isStudentRegistered: user.boxIds.some((registeredBoxId: ObjectId) =>
        registeredBoxId.equals(box.boxId),
      ),
    }));
  }

  async validateUserBoxMembership(userId: string, boxId: string): Promise<void> {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(boxId)) {
      throw new BadRequestException('IDs invalidos');
    }

    const userObjectId = new ObjectId(userId);
    const boxObjectId = new ObjectId(boxId);

    const user = await this.db.collection('users').findOne({
      _id: userObjectId,
    });

    if (!user) {
      throw new ForbiddenException('Usuario nao encontrado');
    }

    const hasMembership = user.boxIds.some((id: ObjectId) => id.equals(boxObjectId));

    if (!hasMembership) {
      throw new ForbiddenException('Box nao pertence ao usuario');
    }
  }
}
