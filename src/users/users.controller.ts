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
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateStudentDto } from './dto/create-student.dto';
import { UsersService } from './users.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Users')
@ApiBearerAuth()
@ApiHeader({ name: 'x-box-id', description: 'ID do box selecionado', required: true })
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('students')
  @ApiOperation({ summary: 'Lista todos os alunos do box do usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de alunos retornada com sucesso' })
  @ApiResponse({ status: 401, description: 'Token ausente, invalido ou expirado' })
  async findStudents(@Req() request: AuthenticatedRequest) {
    return this.usersService.findStudentsByBox(request.user.boxId!);
  }

  @Post('student')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  @ApiOperation({ summary: 'Cadastra um aluno no box do usuario autenticado' })
  @ApiResponse({ status: 201, description: 'Aluno criado com sucesso' })
  @ApiResponse({ status: 401, description: 'Token ausente, invalido ou expirado' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para criar aluno' })
  @ApiResponse({ status: 400, description: 'Dados invalidos' })
  async createStudent(
    @Req() request: AuthenticatedRequest,
    @Body() createStudentDto: CreateStudentDto,
  ) {
    const studentId = await this.usersService.createStudent(request.user.boxId!, createStudentDto);

    return {
      studentId,
      boxId: request.user.boxId!,
      role: 'ALUNO',
    };
  }
}
