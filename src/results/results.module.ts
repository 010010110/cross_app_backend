import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { FeedModule } from '../feed/feed.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [BoxesModule, FeedModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
