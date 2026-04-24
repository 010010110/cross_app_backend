import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminReportsModule } from './admin-reports/admin-reports.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BoxesModule } from './boxes/boxes.module';
import { ClassesModule } from './classes/classes.module';
import { CheckinsModule } from './checkins/checkins.module';
import { DatabaseModule } from './database/database.module';
import { ExercisesModule } from './exercises/exercises.module';
import { FeedModule } from './feed/feed.module';
import { RewardsModule } from './rewards/rewards.module';
import { ResultsModule } from './results/results.module';
import { UsersModule } from './users/users.module';
import { WodsModule } from './wods/wods.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AdminReportsModule,
    DatabaseModule,
    AuthModule,
    BoxesModule,
    ClassesModule,
    UsersModule,
    ExercisesModule,
    WodsModule,
    CheckinsModule,
    ResultsModule,
    RewardsModule,
    FeedModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
