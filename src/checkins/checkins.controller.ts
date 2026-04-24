import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
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
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { CheckinsService } from './checkins.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Checkins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Post()
  @ApiHeader({
    name: 'x-box-id',
    description: 'ID do box selecionado',
    required: true,
  })
  @ApiOperation({
    summary: 'Realiza check-in por geolocalizacao no box',
    description:
      'Permite check-in quando o atleta estiver a menos de geofenceRadius metros das coordenadas do box e matriculado nele. O check-in nao depende da janela de horario da aula.',
  })
  @ApiResponse({ status: 201, description: 'Check-in realizado com sucesso' })
  @ApiResponse({
    status: 400,
    description: 'Dados invalidos para realizacao de check-in',
  })
  @ApiResponse({
    status: 403,
    description:
      'Usuario ainda nao matriculado no box, fora do raio permitido, check-in diario global ja realizado ou limite diario de check-ins da aula atingido',
  })
  @ApiResponse({ status: 404, description: 'Box nao encontrado' })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() createCheckinDto: CreateCheckinDto,
  ) {
    const selectedBoxId = request.headers['x-box-id'];

    return this.checkinsService.create(
      request.user.sub,
      typeof selectedBoxId === 'string' ? selectedBoxId : '',
      createCheckinDto,
    );
  }

  @Get('me')
  @ApiOperation({ summary: 'Lista os checkins do usuario autenticado' })
  @ApiResponse({
    status: 200,
    description: 'Checkins do usuario retornados com sucesso',
  })
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.checkinsService.findByUser(request.user.sub);
  }

  @Delete(':checkinId')
  @UseGuards(BoxContextGuard, RolesGuard)
  @ApiHeader({
    name: 'x-box-id',
    description: 'ID do box selecionado',
    required: true,
  })
  @Roles(UserRole.ALUNO)
  @ApiOperation({
    summary: 'Remove check-in do aluno autenticado',
    description:
      'Permite cancelar um check-in do proprio aluno somente ate 1 hora antes do horario de inicio da aula.',
  })
  @ApiResponse({ status: 200, description: 'Check-in removido com sucesso' })
  @ApiResponse({ status: 403, description: 'Cancelamento fora da janela permitida ou perfil sem permissao' })
  @ApiResponse({ status: 404, description: 'Check-in nao encontrado para o usuario no box selecionado' })
  async deleteMine(
    @Req() request: AuthenticatedRequest,
    @Param('checkinId') checkinId: string,
  ) {
    const selectedBoxId = request.headers['x-box-id'];

    return this.checkinsService.deleteMyCheckin(
      request.user.sub,
      typeof selectedBoxId === 'string' ? selectedBoxId : '',
      checkinId,
    );
  }

  @Get('box')
  @UseGuards(BoxContextGuard, RolesGuard)
  @ApiHeader({
    name: 'x-box-id',
    description: 'ID do box selecionado',
    required: true,
  })
  @Roles(UserRole.ADMIN, UserRole.COACH)
  @ApiOperation({
    summary: 'Relatorio diario de checkins do box',
    description:
      'Retorna todos os checkins registrados no box atual no dia de hoje.',
  })
  @ApiResponse({
    status: 200,
    description: 'Checkins do dia retornados com sucesso',
  })
  @ApiResponse({
    status: 403,
    description: 'Perfil sem permissao para acessar relatorio',
  })
  async findByBox(@Req() request: AuthenticatedRequest) {
    return this.checkinsService.findByBox(request.user.boxId!);
  }
}
