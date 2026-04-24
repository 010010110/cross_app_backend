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
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { ExercisesService } from './exercises.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Exercises')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-box-id',
  description: 'ID do box selecionado',
  required: true,
})
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercisesService: ExercisesService) {}

  @Get()
  @ApiOperation({
    summary: 'Lista exercicios do box + exercicios globais',
    description:
      'Retorna todos os exercicios globais da plataforma (isGlobal: true) mais os exercicios customizados do box do usuario autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de exercicios retornada com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, invalido ou expirado',
  })
  async findAll(@Req() request: AuthenticatedRequest) {
    return this.exercisesService.findAllForBox(request.user.boxId!);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cria exercicio customizado no box',
    description:
      'Insere um novo exercicio vinculado ao box do Admin autenticado. Acesso restrito a ADMIN.',
  })
  @ApiResponse({ status: 201, description: 'Exercicio criado com sucesso' })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, invalido ou expirado',
  })
  @ApiResponse({
    status: 403,
    description: 'Perfil sem permissao para criar exercicio',
  })
  @ApiResponse({
    status: 409,
    description: 'Exercicio com este nome ja existe neste box',
  })
  @ApiResponse({ status: 400, description: 'Dados invalidos' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() createExerciseDto: CreateExerciseDto,
  ) {
    const exerciseId = await this.exercisesService.createForBox(
      request.user.boxId!,
      createExerciseDto,
    );

    return { exerciseId };
  }
}
