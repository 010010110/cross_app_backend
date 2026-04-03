import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
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
import { CreateExercisePrDto } from './dto/create-exercise-pr.dto';
import { CreateResultDto } from './dto/create-result.dto';
import { ResultsService } from './results.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Results')
@ApiBearerAuth()
@ApiHeader({ name: 'x-box-id', description: 'ID do box selecionado', required: true })
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @ApiOperation({ summary: 'Lista resultados do aluno no box atual' })
  @ApiResponse({ status: 200, description: 'Resultados retornados com sucesso' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para consultar resultados' })
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.resultsService.listByUser(request.user.sub, request.user.boxId!, limit);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @ApiOperation({
    summary: 'Registra resultado de treino e identifica novo PR',
    description:
      'Salva o score final do WOD completo e marca isNewPR=true quando o score supera o melhor historico do proprio aluno para o mesmo benchmark (titulo do WOD).',
  })
  @ApiResponse({ status: 201, description: 'Resultado salvo com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados invalidos' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para registrar resultado' })
  @ApiResponse({ status: 404, description: 'WOD nao encontrado para o box' })
  async create(@Req() request: AuthenticatedRequest, @Body() createResultDto: CreateResultDto) {
    return this.resultsService.create(request.user.sub, request.user.boxId!, createResultDto);
  }

  @Post('pr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @ApiOperation({
    summary: 'Registra PR direto por exercicio',
    description:
      'Permite ao aluno selecionar um exercicio (via GET /exercises) e salvar um PR sem vincular ao WOD, com comparacao de historico por exerciseId.',
  })
  @ApiResponse({ status: 201, description: 'PR salvo com sucesso' })
  @ApiResponse({ status: 400, description: 'Dados invalidos' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para registrar PR' })
  @ApiResponse({ status: 404, description: 'Exercicio nao encontrado para o box' })
  async createPrByExercise(
    @Req() request: AuthenticatedRequest,
    @Body() createExercisePrDto: CreateExercisePrDto,
  ) {
    return this.resultsService.createPrByExercise(
      request.user.sub,
      request.user.boxId!,
      createExercisePrDto,
    );
  }

  @Get('pr')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ALUNO)
  @ApiOperation({ summary: 'Lista PRs do aluno no box atual' })
  @ApiResponse({ status: 200, description: 'PRs retornados com sucesso' })
  @ApiResponse({ status: 403, description: 'Perfil sem permissao para consultar PRs' })
  async listPrs(
    @Req() request: AuthenticatedRequest,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.resultsService.listPrByUser(request.user.sub, request.user.boxId!, limit);
  }
}
