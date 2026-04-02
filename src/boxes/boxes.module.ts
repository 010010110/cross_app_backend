import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoxesController } from './boxes.controller';
import { BoxesService } from './boxes.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, AuthModule],
  controllers: [BoxesController],
  providers: [BoxesService],
})
export class BoxesModule {}
