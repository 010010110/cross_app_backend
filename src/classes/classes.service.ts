import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { ClassWeekday } from '../common/enums/class-weekday.enum';
import { MONGO_CLIENT } from '../database/database.constants';
import { WodsService } from '../wods/wods.service';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassSchedule } from './interfaces/class.interface';

@Injectable()
export class ClassesService {
  constructor(
    @Inject(MONGO_CLIENT) private readonly db: Db,
    private readonly wodsService: WodsService,
  ) {}

  async createForBox(boxId: string, dto: CreateClassDto): Promise<ObjectId> {
    this.validateTimeRange(dto.startTime, dto.endTime);

    const classSchedule: ClassSchedule = {
      boxId: new ObjectId(boxId),
      name: dto.name,
      weekDays: [...new Set(dto.weekDays)],
      startTime: dto.startTime,
      endTime: dto.endTime,
      ...(dto.checkinLimit ? { checkinLimit: dto.checkinLimit } : {}),
      createdAt: new Date(),
    };

    const result = await this.db
      .collection<ClassSchedule>('classes')
      .insertOne(classSchedule);

    return result.insertedId;
  }

  async findTodayByBox(boxId: string) {
    const weekday = this.getCurrentWeekday();

    const classes = await this.db
      .collection<ClassSchedule>('classes')
      .find({
        boxId: new ObjectId(boxId),
        weekDays: weekday,
      })
      .sort({ startTime: 1 })
      .toArray();

    const wod = await this.wodsService.findTodayByBox(boxId);

    return {
      weekday,
      classes,
      wod,
    };
  }

  async findByIdInBox(boxId: string, classId: string): Promise<ClassSchedule> {
    if (!ObjectId.isValid(classId)) {
      throw new BadRequestException('classId invalido');
    }

    const classSchedule = await this.db
      .collection<ClassSchedule>('classes')
      .findOne({
        _id: new ObjectId(classId),
        boxId: new ObjectId(boxId),
      });

    if (!classSchedule) {
      throw new NotFoundException('Aula nao encontrada para este box');
    }

    return classSchedule;
  }

  isNowInsideClassWindow(
    classSchedule: ClassSchedule,
    now: Date = new Date(),
  ): boolean {
    const nowWeekday = this.getWeekdayFromDate(now);

    if (!classSchedule.weekDays.includes(nowWeekday)) {
      return false;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = this.timeToMinutes(classSchedule.startTime);
    const endMinutes = this.timeToMinutes(classSchedule.endTime);

    return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    if (endMinutes <= startMinutes) {
      throw new BadRequestException(
        'Horario final deve ser maior que o horario inicial',
      );
    }
  }

  private timeToMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private getCurrentWeekday(): ClassWeekday {
    return this.getWeekdayFromDate(new Date());
  }

  private getWeekdayFromDate(date: Date): ClassWeekday {
    const weekdays: ClassWeekday[] = [
      ClassWeekday.SUNDAY,
      ClassWeekday.MONDAY,
      ClassWeekday.TUESDAY,
      ClassWeekday.WEDNESDAY,
      ClassWeekday.THURSDAY,
      ClassWeekday.FRIDAY,
      ClassWeekday.SATURDAY,
    ];

    return weekdays[date.getDay()];
  }
}
