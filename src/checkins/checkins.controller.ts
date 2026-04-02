import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateCheckinDto } from './dto/create-checkin.dto';
import { CheckinsService } from './checkins.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Checkins')
@ApiBearerAuth()
@ApiHeader({ name: 'x-box-id', description: 'ID do box selecionado', required: true })
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkinsService: CheckinsService) {}

  @Post()
  @ApiOperation({
    summary: 'Realiza check-in por geolocalizacao no box',
    description:
      'Permite check-in apenas quando o atleta estiver a menos de 100 metros das coordenadas do box.',
  })
  @ApiResponse({ status: 201, description: 'Check-in realizado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados invalidos para realizacao de check-in' })
  @ApiResponse({ status: 403, description: 'Usuario fora do raio permitido para check-in' })
  @ApiResponse({ status: 404, description: 'Box nao encontrado' })
  async create(@Req() request: AuthenticatedRequest, @Body() createCheckinDto: CreateCheckinDto) {
    return this.checkinsService.create(request.user.sub, request.user.boxId!, createCheckinDto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Lista os checkins do usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Checkins do usuario retornados com sucesso' })
  async findMine(@Req() request: AuthenticatedRequest) {
    return this.checkinsService.findByUser(request.user.sub);
  }

  @Get('box')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  @ApiOperation({
    summary: 'Relatorio diario de checkins do box',
    description: 'Retorna todos os checkins registrados no box atual no dia de hoje.',
  })
  @ApiResponse({ status: 200, description: 'Checkins do dia retornados com sucesso' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para acessar relatorio' })
  async findByBox(@Req() request: AuthenticatedRequest) {
    return this.checkinsService.findByBox(request.user.boxId!);
  }
}
