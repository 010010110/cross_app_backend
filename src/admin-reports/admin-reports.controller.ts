import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
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
import { CreateCoachClassAssignmentDto } from './dto/create-coach-class-assignment.dto';
import { AdminReportsService } from './admin-reports.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Admin Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, BoxContextGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COACH)
@ApiHeader({ name: 'x-box-id', description: 'ID do box selecionado', required: true })
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Resumo geral do box no periodo (alunos, aulas, check-ins)' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-04-30' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'studentId', required: false, example: '67ebfa10ac5d89c8bb9d2101' })
  @ApiQuery({ name: 'classId', required: false, example: '67ebb001ac5d89c8bb9d2201' })
  @ApiResponse({ status: 200, description: 'Resumo retornado com sucesso' })
  async getOverview(
    @Req() request: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('coachId') coachId?: string,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.adminReportsService.getOverview(request.user.boxId!, request.user, {
      startDate,
      endDate,
      coachId,
      studentId,
      classId,
    });
  }

  @Get('inactivity')
  @ApiOperation({ summary: 'Lista alunos inativos acima do threshold de dias sem treino' })
  @ApiQuery({ name: 'thresholdDays', required: false, example: '7' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'studentId', required: false, example: '67ebfa10ac5d89c8bb9d2101' })
  @ApiResponse({ status: 200, description: 'Relatorio de inatividade retornado com sucesso' })
  async getInactivity(
    @Req() request: AuthenticatedRequest,
    @Query('thresholdDays') thresholdDays?: string,
    @Query('coachId') coachId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.adminReportsService.getInactivity(request.user.boxId!, request.user, {
      thresholdDays,
      coachId,
      studentId,
    });
  }

  @Get('class-participation')
  @ApiOperation({ summary: 'Participacao por aula no periodo selecionado' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-04-30' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'studentId', required: false, example: '67ebfa10ac5d89c8bb9d2101' })
  @ApiQuery({ name: 'classId', required: false, example: '67ebb001ac5d89c8bb9d2201' })
  @ApiResponse({ status: 200, description: 'Participacao por aula retornada com sucesso' })
  async getClassParticipation(
    @Req() request: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('coachId') coachId?: string,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
  ) {
    return this.adminReportsService.getClassParticipation(request.user.boxId!, request.user, {
      startDate,
      endDate,
      coachId,
      studentId,
      classId,
    });
  }

  @Get('training-ranking')
  @ApiOperation({ summary: 'Ranking de treino por PR, frequencia ou XP' })
  @ApiQuery({ name: 'rankingBy', required: false, enum: ['prs', 'attendance', 'xp'] })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-04-30' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'studentId', required: false, example: '67ebfa10ac5d89c8bb9d2101' })
  @ApiResponse({ status: 200, description: 'Ranking retornado com sucesso' })
  async getTrainingRanking(
    @Req() request: AuthenticatedRequest,
    @Query('rankingBy') rankingBy?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('coachId') coachId?: string,
    @Query('studentId') studentId?: string,
  ) {
    return this.adminReportsService.getTrainingRanking(request.user.boxId!, request.user, {
      rankingBy,
      limit,
      startDate,
      endDate,
      coachId,
      studentId,
    });
  }

  @Get('gym-rats')
  @ApiOperation({ summary: 'Top frequentadores do box no periodo selecionado' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-04-30' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'studentId', required: false, example: '67ebfa10ac5d89c8bb9d2101' })
  @ApiQuery({ name: 'classId', required: false, example: '67ebb001ac5d89c8bb9d2201' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @ApiResponse({ status: 200, description: 'Ranking de frequentadores retornado com sucesso' })
  async getGymRats(
    @Req() request: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('coachId') coachId?: string,
    @Query('studentId') studentId?: string,
    @Query('classId') classId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminReportsService.getGymRats(request.user.boxId!, request.user, {
      startDate,
      endDate,
      coachId,
      studentId,
      classId,
      limit,
    });
  }

  @Get('rewards-xp')
  @ApiOperation({ summary: 'Distribuicao de XP e snapshot de streaks por periodo' })
  @ApiQuery({ name: 'startDate', required: false, example: '2026-04-01' })
  @ApiQuery({ name: 'endDate', required: false, example: '2026-04-30' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'studentId', required: false, example: '67ebfa10ac5d89c8bb9d2101' })
  @ApiQuery({ name: 'minStreak', required: false, example: '7' })
  @ApiQuery({ name: 'limit', required: false, example: '10' })
  @ApiResponse({ status: 200, description: 'Relatorio de rewards/xp retornado com sucesso' })
  async getRewardsXp(
    @Req() request: AuthenticatedRequest,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('coachId') coachId?: string,
    @Query('studentId') studentId?: string,
    @Query('minStreak') minStreak?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminReportsService.getRewardsXp(request.user.boxId!, request.user, {
      startDate,
      endDate,
      coachId,
      studentId,
      minStreak,
      limit,
    });
  }

  @Get('coach-assignments')
  @ApiOperation({ summary: 'Lista vinculos ativos coach-turma no box' })
  @ApiQuery({ name: 'coachId', required: false, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiResponse({ status: 200, description: 'Vinculos retornados com sucesso' })
  async listCoachAssignments(@Req() request: AuthenticatedRequest, @Query('coachId') coachId?: string) {
    return this.adminReportsService.listCoachAssignments(request.user.boxId!, coachId);
  }

  @Post('coach-assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Cria vinculo coach-turma para habilitar filtros por coach' })
  @ApiResponse({ status: 201, description: 'Vinculo criado com sucesso' })
  async createCoachAssignment(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateCoachClassAssignmentDto,
  ) {
    return this.adminReportsService.createCoachAssignment(
      request.user.boxId!,
      request.user.sub,
      body.coachId,
      body.classId,
    );
  }

  @Delete('coach-assignments')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove vinculo ativo coach-turma' })
  @ApiQuery({ name: 'coachId', required: true, example: '67ebfa12ac5d89c8bb9d2103' })
  @ApiQuery({ name: 'classId', required: true, example: '67ebb001ac5d89c8bb9d2201' })
  @ApiResponse({ status: 200, description: 'Vinculo removido com sucesso' })
  async removeCoachAssignment(
    @Req() request: AuthenticatedRequest,
    @Query('coachId') coachId: string,
    @Query('classId') classId: string,
  ) {
    return this.adminReportsService.removeCoachAssignment(request.user.boxId!, coachId, classId);
  }
}
