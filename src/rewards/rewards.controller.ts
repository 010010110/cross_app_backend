import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { BoxContextGuard } from '../common/guards/box-context.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { RewardsService } from './rewards.service';

interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

@ApiTags('Rewards')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-box-id',
  description: 'ID do box selecionado',
  required: true,
})
@UseGuards(JwtAuthGuard, BoxContextGuard)
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('me/summary')
  @ApiOperation({ summary: 'Resumo de consistencia do aluno no box atual' })
  @ApiResponse({
    status: 200,
    description: 'Resumo de consistencia retornado com sucesso',
  })
  async getMySummary(@Req() request: AuthenticatedRequest) {
    return this.rewardsService.getMySummary(
      request.user.sub,
      request.user.boxId!,
    );
  }

  @Get('me/milestones')
  @ApiOperation({ summary: 'Lista milestones desbloqueados no box atual' })
  @ApiResponse({
    status: 200,
    description: 'Milestones retornados com sucesso',
  })
  async getMyMilestones(@Req() request: AuthenticatedRequest) {
    return this.rewardsService.getMyMilestones(
      request.user.sub,
      request.user.boxId!,
    );
  }
}
