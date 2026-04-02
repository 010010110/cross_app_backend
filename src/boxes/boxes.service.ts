import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { AuthService } from '../auth/auth.service';
import { Box } from '../common/interfaces/box.interface';
import { MONGO_CLIENT } from '../database/database.constants';
import { RegisterBoxDto } from './dto/register-box.dto';
import { UsersService } from '../users/users.service';

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
}
