import { Module } from '@nestjs/common';
import { BoxesModule } from '../boxes/boxes.module';
import { WodsModule } from '../wods/wods.module';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [BoxesModule, WodsModule],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
