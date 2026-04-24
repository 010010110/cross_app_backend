import { ObjectId } from 'mongodb';
import { ClassWeekday } from '../../common/enums/class-weekday.enum';

export interface ClassSchedule {
  _id?: ObjectId;
  boxId: ObjectId;
  name: string;
  weekDays: ClassWeekday[];
  startTime: string;
  endTime: string;
  checkinLimit?: number;
  createdAt: Date;
}
