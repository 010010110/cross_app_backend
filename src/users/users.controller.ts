import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { UseEnrollmentTokenDto } from './dto/use-enrollment-token.dto';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('students')
  @UseGuards(BoxContextGuard)
  @ApiHeader({
    name: 'x-box-id',
    description: 'ID do box selecionado',
    required: true,
  })
  @ApiOperation({
    summary: 'Lista todos os alunos do box do usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de alunos retornada com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, invalido ou expirado',
  })
  async findStudents(@Req() request: AuthenticatedRequest) {
    return this.usersService.findStudentsByBox(request.user.boxId!);
  }

  @Get('coaches')
  @UseGuards(BoxContextGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @ApiHeader({
    name: 'x-box-id',
    description: 'ID do box selecionado',
    required: true,
  })
  @ApiOperation({
    summary: 'Lista todos os coaches do box do usuario autenticado',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de coaches retornada com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, invalido ou expirado',
  })
  @ApiResponse({
    status: 403,
    description: 'Perfil sem permissao para listar coaches',
  })
  async findCoaches(@Req() request: AuthenticatedRequest) {
    return this.usersService.findCoachesByBox(request.user.boxId!);
  }

  @Post('me/enrollment-token')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @ApiOperation({
    summary: 'Gera token temporario do aluno para matricula em um box',
  })
  @ApiResponse({ status: 201, description: 'Token gerado com sucesso' })
  @ApiResponse({
    status: 403,
    description: 'Perfil sem permissao para gerar token',
  })
  async createEnrollmentToken(@Req() request: AuthenticatedRequest) {
    return this.usersService.createEnrollmentToken(request.user.sub);
  }

  @Post('enroll')
  @UseGuards(BoxContextGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @ApiHeader({
    name: 'x-box-id',
    description: 'ID do box selecionado',
    required: true,
  })
  @ApiOperation({
    summary: 'Vincula um aluno ao box atual usando o token temporario do aluno',
  })
  @ApiResponse({
    status: 201,
    description: 'Aluno vinculado ao box com sucesso',
  })
  @ApiResponse({
    status: 400,
    description: 'Token invalido, expirado ou ja utilizado',
  })
  @ApiResponse({
    status: 403,
    description: 'Perfil sem permissao para matricular aluno',
  })
  @ApiResponse({ status: 409, description: 'Aluno ja matriculado neste box' })
  async enrollStudent(
    @Req() request: AuthenticatedRequest,
    @Body() useEnrollmentTokenDto: UseEnrollmentTokenDto,
  ) {
    return this.usersService.enrollStudentWithToken(
      request.user.boxId!,
      useEnrollmentTokenDto.token,
    );
  }
}
