import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminReportsController } from './admin-reports.controller';
import { AdminReportsService } from './admin-reports.service';

@Module({
  imports: [BoxesModule],
  controllers: [AdminReportsController],
  providers: [AdminReportsService, JwtAuthGuard, RolesGuard],
})
export class AdminReportsModule {}
