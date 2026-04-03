import { ObjectId } from 'mongodb';
import { ExerciseCategory } from '../../common/enums';

export { ExerciseCategory };

export interface Exercise {
  _id?: ObjectId;
  name: string;
  category: ExerciseCategory;
  isGlobal: boolean;
  boxId?: ObjectId;
  createdAt: Date;
}
