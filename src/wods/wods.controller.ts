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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { CreateWodDto } from './dto/create-wod.dto';
import { WodsService } from './wods.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Wods')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-box-id',
  description: 'ID do box selecionado',
  required: true,
})
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('wods')
export class WodsController {
  constructor(private readonly wodsService: WodsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cadastra o WOD do box',
    description:
      'Recebe o JSON completo do treino e persiste na colecao wods vinculado ao boxId do ADMIN autenticado.',
  })
  @ApiResponse({ status: 201, description: 'WOD criado com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados invalidos' })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, invalido ou expirado',
  })
  @ApiResponse({
    status: 403,
    description: 'Perfil sem permissao para criar WOD',
  })
  @ApiResponse({
    status: 409,
    description: 'Ja existe WOD para a data informada neste box',
  })
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() createWodDto: CreateWodDto,
  ) {
    const wodId = await this.wodsService.createForBox(
      request.user.boxId!,
      createWodDto,
    );

    return { wodId, boxId: request.user.boxId! };
  }

  @Get('today')
  @ApiOperation({
    summary: 'Busca o WOD de hoje do box autenticado',
    description:
      'Retorna o treino da data atual associado ao boxId presente no token JWT, para exibicao no app do aluno.',
  })
  @ApiResponse({
    status: 200,
    description: 'WOD de hoje retornado com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Token ausente, invalido ou expirado',
  })
  async findToday(@Req() request: AuthenticatedRequest) {
    return this.wodsService.findTodayByBox(request.user.boxId!);
  }
}
