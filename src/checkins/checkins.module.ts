import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { ClassesModule } from '../classes/classes.module';
import { RewardsModule } from '../rewards/rewards.module';
import { WodsModule } from '../wods/wods.module';
import { CheckinsController } from './checkins.controller';
import { CheckinsService } from './checkins.service';

@Module({
  imports: [BoxesModule, RewardsModule, ClassesModule, WodsModule],
  controllers: [CheckinsController],
  providers: [CheckinsService],
})
export class CheckinsModule {}
