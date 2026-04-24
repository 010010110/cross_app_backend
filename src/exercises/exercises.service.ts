import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { Exercise, ExerciseCategory } from './interfaces/exercise.interface';
import { CreateExerciseDto } from './dto/create-exercise.dto';

@Injectable()
export class ExercisesService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async findAllForBox(boxId: string): Promise<Exercise[]> {
    return this.db
      .collection<Exercise>('exercises')
      .find({
        $or: [{ isGlobal: true }, { boxId: new ObjectId(boxId) }],
      })
      .sort({ name: 1 })
      .toArray();
  }

  async createForBox(boxId: string, dto: CreateExerciseDto): Promise<ObjectId> {
    const existing = await this.db.collection<Exercise>('exercises').findOne({
      name: { $regex: new RegExp(`^${dto.name}$`, 'i') },
      boxId: new ObjectId(boxId),
    });

    if (existing) {
      throw new ConflictException(
        'Ja existe um exercicio com este nome neste box',
      );
    }

    const exercise: Exercise = {
      name: dto.name,
      category: dto.category as ExerciseCategory,
      isGlobal: false,
      boxId: new ObjectId(boxId),
      createdAt: new Date(),
    };

    const result = await this.db
      .collection<Exercise>('exercises')
      .insertOne(exercise);

    return result.insertedId;
  }
}
