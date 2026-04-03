import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { Db, ObjectId } from 'mongodb';
import { User } from '../common/interfaces/user.interface';
import { UserRole } from '../common/types/user-role.type';
import { MONGO_CLIENT } from '../database/database.constants';
import { RegisterUserDto } from './dto/register-user.dto';
import { EnrollmentToken } from './interfaces/enrollment-token.interface';

@Injectable()
export class UsersService {
  private static readonly ENROLLMENT_TOKEN_DURATION_IN_MS = 60 * 60 * 1000;

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
      if (existingUser.role !== UserRole.ADMIN) {
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
      role: UserRole.ADMIN,
      createdAt: new Date(),
    };

    const result = await this.db.collection<User>('users').insertOne(adminUser);

    return {
      adminId: result.insertedId,
      linkedExistingAdmin: false,
    };
  }

  async registerStudent(dto: RegisterUserDto): Promise<User> {
    const normalizedEmail = dto.email.toLowerCase();
    const existingUser = await this.db.collection<User>('users').findOne({ email: normalizedEmail });

    if (existingUser) {
      throw new ConflictException('Ja existe usuario com este email');
    }

    const studentUser: User = {
      boxIds: [],
      name: dto.name,
      email: normalizedEmail,
      passwordHash: await hash(dto.password, 10),
      role: UserRole.ALUNO,
      createdAt: new Date(),
    };

    const result = await this.db.collection<User>('users').insertOne(studentUser);

    return {
      ...studentUser,
      _id: result.insertedId,
    };
  }

  async createEnrollmentToken(userId: string) {
    const user = await this.findById(userId);

    if (user.role !== UserRole.ALUNO) {
      throw new BadRequestException('Apenas alunos podem gerar token de matricula');
    }

    await this.db.collection<EnrollmentToken>('enrollment_tokens').deleteMany({
      userId: user._id!,
      usedAt: { $exists: false },
    });

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + UsersService.ENROLLMENT_TOKEN_DURATION_IN_MS);

    await this.db.collection<EnrollmentToken>('enrollment_tokens').insertOne({
      userId: user._id!,
      token,
      expiresAt,
      createdAt: new Date(),
    });

    return {
      token,
      expiresAt,
      message: 'Token gerado com sucesso. Informe este codigo ao administrador do box.',
    };
  }

  async enrollStudentWithToken(boxId: string, token: string) {
    if (!ObjectId.isValid(boxId)) {
      throw new BadRequestException('boxId invalido no token');
    }

    const normalizedToken = token.trim().toLowerCase();
    const normalizedBoxId = new ObjectId(boxId);
    const enrollmentToken = await this.db.collection<EnrollmentToken>('enrollment_tokens').findOne({
      token: normalizedToken,
    });

    if (!enrollmentToken) {
      throw new BadRequestException('Token de matricula invalido');
    }

    if (enrollmentToken.usedAt) {
      throw new BadRequestException('Token de matricula ja utilizado');
    }

    if (enrollmentToken.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Token de matricula expirado');
    }

    const student = await this.findById(enrollmentToken.userId);

    if (student.role !== UserRole.ALUNO) {
      throw new BadRequestException('Token informado nao pertence a um aluno valido');
    }

    if (student.boxIds.some((studentBoxId) => studentBoxId.equals(normalizedBoxId))) {
      throw new ConflictException('Aluno ja matriculado neste box');
    }

    await this.db.collection<User>('users').updateOne(
      { _id: student._id },
      { $addToSet: { boxIds: normalizedBoxId } },
    );

    await this.db.collection<EnrollmentToken>('enrollment_tokens').updateOne(
      { _id: enrollmentToken._id },
      {
        $set: {
          usedAt: new Date(),
          usedByBoxId: normalizedBoxId,
        },
      },
    );

    return {
      studentId: student._id,
      boxId: normalizedBoxId,
      name: student.name,
      email: student.email,
      role: student.role,
      message: 'Aluno vinculado ao box com sucesso',
    };
  }

  async findStudentsByBox(boxId: string): Promise<Omit<User, 'passwordHash'>[]> {
    return this.db
      .collection<User>('users')
      .find(
        { boxIds: new ObjectId(boxId), role: UserRole.ALUNO },
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
