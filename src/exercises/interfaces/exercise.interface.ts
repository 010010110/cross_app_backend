import { ObjectId } from 'mongodb';

export enum ExerciseCategory {
  WEIGHTLIFTING = 'WEIGHTLIFTING',
  GYMNASTICS = 'GYMNASTICS',
  MONOSTRUCTURAL = 'MONOSTRUCTURAL',
  ACCESSORY = 'ACCESSORY',
}

export interface Exercise {
  _id?: ObjectId;
  name: string;
  category: ExerciseCategory;
  isGlobal: boolean;
  boxId?: ObjectId;
  createdAt: Date;
}
