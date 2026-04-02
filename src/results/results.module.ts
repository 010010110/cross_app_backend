import { Module } from '@nestjs/common';
import { FeedModule } from '../feed/feed.module';
import { ResultsController } from './results.controller';
import { ResultsService } from './results.service';

@Module({
  imports: [FeedModule],
  controllers: [ResultsController],
  providers: [ResultsService],
})
export class ResultsModule {}
