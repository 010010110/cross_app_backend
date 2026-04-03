import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { WodsController } from './wods.controller';
import { WodsService } from './wods.service';

@Module({
	imports: [BoxesModule],
	controllers: [WodsController],
	providers: [WodsService],
	exports: [WodsService],
})
export class WodsModule {}
