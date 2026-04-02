import { Module } from '@nestjs/common';
import { RewardsModule } from '../rewards/rewards.module';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';

@Module({
  imports: [RewardsModule],
  controllers: [CheckinsController],
  providers: [CheckinsService],
})
export class CheckinsModule {}
