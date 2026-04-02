import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { hash, compare } from 'bcryptjs';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { User } from '../common/interfaces/user.interface';
import { UserRole } from '../common/types/user-role.type';
import { CreateStudentDto } from './dto/create-student.dto';

@Injectable()
export class UsersService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async findById(userId: ObjectId | string): Promise<User> {
    const normalizedUserId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const user = await this.db.collection<User>('users').findOne({
      _id: normalizedUserId,
    });

    if (!user) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    return user;
  }

  async createInitialAdmin(params: {
    boxId: ObjectId;
    name: string;
    email: string;
    password: string;
  }): Promise<{ adminId: ObjectId; linkedExistingAdmin: boolean }> {
    const normalizedEmail = params.email.toLowerCase();

    const existingUser = await this.db.collection<User>('users').findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      if (existingUser.role !== 'ADMIN') {
        throw new BadRequestException('Ja existe usuario com este email e role diferente de ADMIN');
      }

      const isPasswordValid = await compare(params.password, existingUser.passwordHash);

      if (!isPasswordValid) {
        throw new BadRequestException('Senha invalida para o ADMIN existente');
      }

      await this.db.collection<User>('users').updateOne(
        { _id: existingUser._id },
        {
          $addToSet: { boxIds: params.boxId },
        },
      );

      return {
        adminId: existingUser._id!,
        linkedExistingAdmin: true,
      };
    }

    const passwordHash = await hash(params.password, 10);

    const adminUser: User = {
      boxIds: [params.boxId],
      name: params.name,
      email: normalizedEmail,
      passwordHash,
      role: 'ADMIN',
      createdAt: new Date(),
    };

    const result = await this.db.collection<User>('users').insertOne(adminUser);

    return {
      adminId: result.insertedId,
      linkedExistingAdmin: false,
    };
  }

  async createStudent(boxId: string, dto: CreateStudentDto): Promise<ObjectId> {
    if (!ObjectId.isValid(boxId)) {
      throw new BadRequestException('boxId invalido no token');
    }

    const boxObjectId = new ObjectId(boxId);

    // Aluno ja registrado neste box?
    const existingInBox = await this.db.collection<User>('users').findOne({
      email: dto.email.toLowerCase(),
      boxIds: boxObjectId,
    });

    if (existingInBox) {
      throw new BadRequestException('Ja existe aluno com este email neste box');
    }

    // Aluno existe em outro box? Apenas vincula ao novo box
    const existingGlobal = await this.db.collection<User>('users').findOne({
      email: dto.email.toLowerCase(),
      role: 'ALUNO',
    });

    if (existingGlobal) {
      await this.db
        .collection<User>('users')
        .updateOne({ _id: existingGlobal._id }, { $addToSet: { boxIds: boxObjectId } });

      return existingGlobal._id!;
    }

    // Aluno novo - cria documento completo
    const studentUser: User = {
      boxIds: [boxObjectId],
      name: dto.name,
      email: dto.email.toLowerCase(),
      passwordHash: await hash(dto.password, 10),
      role: 'ALUNO',
      createdAt: new Date(),
    };

    const result = await this.db.collection<User>('users').insertOne(studentUser);

    return result.insertedId;
  }

  async findStudentsByBox(boxId: string): Promise<Omit<User, 'passwordHash'>[]> {
    return this.db
      .collection<User>('users')
      .find(
        { boxIds: new ObjectId(boxId), role: 'ALUNO' },
        { projection: { passwordHash: 0 } },
      )
      .sort({ name: 1 })
      .toArray() as Promise<Omit<User, 'passwordHash'>[]>;
  }

  async validateCredentials(email: string, password: string): Promise<User> {
    const user = await this.db.collection<User>('users').findOne({
      email: email.toLowerCase(),
    });

    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    const isPasswordValid = await compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciais invalidas');
    }

    return user;
  }

  toJwtSafeUser(user: User): { id: string; email: string; boxIds: string[]; role: UserRole } {
    return {
      id: user._id!.toHexString(),
      email: user.email,
      boxIds: user.boxIds.map((id) => id.toHexString()),
      role: user.role,
    };
  }
}
