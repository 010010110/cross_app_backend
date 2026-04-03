import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Classes')
@ApiBearerAuth()
@ApiHeader({ name: 'x-box-id', description: 'ID do box selecionado', required: true })
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cadastra aula recorrente do box',
    description:
      'Permite ao ADMIN cadastrar a grade de aulas informando nome, dias da semana e faixa de horario.',
  })
  @ApiResponse({ status: 201, description: 'Aula cadastrada com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados invalidos da aula' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para cadastrar aula' })
  async create(@Req() request: AuthenticatedRequest, @Body() createClassDto: CreateClassDto) {
    const classId = await this.classesService.createForBox(request.user.boxId!, createClassDto);

    return {
      classId,
      boxId: request.user.boxId!,
      message: 'Aula cadastrada com sucesso',
    };
  }

  @Get('today')
  @ApiOperation({
    summary: 'Lista aulas do dia e WOD diario',
    description:
      'Retorna as aulas do dia da semana atual no box selecionado e o WOD diario associado a esse dia.',
  })
  @ApiResponse({ status: 200, description: 'Aulas do dia retornadas com sucesso' })
  async findToday(@Req() request: AuthenticatedRequest) {
    return this.classesService.findTodayByBox(request.user.boxId!);
  }
}
