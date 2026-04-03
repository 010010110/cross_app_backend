import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { User } from '../common/interfaces/user.interface';
import { RegisterUserDto } from '../users/dto/register-user.dto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerUserDto: RegisterUserDto) {
    const user = await this.usersService.registerStudent(registerUserDto);

    return this.createSession(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.validateCredentials(loginDto.email, loginDto.password);

    return this.createSession(user);
  }

  async createSession(user: User) {
    const safeUser = this.usersService.toJwtSafeUser(user);

    const payload: JwtPayload = {
      sub: safeUser.id,
      email: safeUser.email,
      boxIds: safeUser.boxIds,
      role: safeUser.role,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      user: payload,
    };
  }
}
