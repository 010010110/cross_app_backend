import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
	imports: [BoxesModule],
	controllers: [FeedController],
	providers: [FeedService],
	exports: [FeedService],
})
export class FeedModule {}
