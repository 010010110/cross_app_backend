import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BoxesController } from './boxes.controller';
import { BoxesService } from './boxes.service';
import { UsersModule } from '../users/users.module';
import { BoxContextGuard } from '../common/guards/box-context.guard';

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => AuthModule)],
  controllers: [BoxesController],
  providers: [BoxesService, BoxContextGuard],
  exports: [BoxContextGuard, BoxesService],
})
export class BoxesModule {}
