import { Module } from '@nestjs/common';
import { WodsController } from './wods.controller';
import { WodsService } from './wods.service';

@Module({
	controllers: [WodsController],
	providers: [WodsService],
})
export class WodsModule {}
