import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { AutoPrPostStatus, ResultScoreKind } from '../common/enums';
import { Exercise } from '../exercises/interfaces/exercise.interface';
import { FeedService } from '../feed/feed.service';
import { Wod } from '../wods/interfaces/wod.interface';
import { CreateExercisePrDto } from './dto/create-exercise-pr.dto';
import { CreateResultDto } from './dto/create-result.dto';
import { Result } from './interfaces/result.interface';

interface ParsedScore {
  kind: Exclude<ResultScoreKind, ResultScoreKind.UNKNOWN>;
  value: number;
}

@Injectable()
export class ResultsService {
  constructor(
    @Inject(MONGO_CLIENT) private readonly db: Db,
    private readonly feedService: FeedService,
  ) {}

  async create(userId: string, boxId: string, dto: CreateResultDto) {
    await this.ensureWodExistsForBox(dto.wodId, boxId);
    const exercise = await this.ensureExerciseExistsForBox(dto.exerciseId, boxId);

    const currentParsedScore = this.parseScore(dto.score);

    const history = await this.db
      .collection<Result>('results')
      .find({
        userId: new ObjectId(userId),
        boxId: new ObjectId(boxId),
        exerciseId: new ObjectId(dto.exerciseId),
      })
      .toArray();

    const isNewPR = this.isNewPersonalRecord(currentParsedScore, history);

    const result: Result = {
      userId: new ObjectId(userId),
      boxId: new ObjectId(boxId),
      wodId: new ObjectId(dto.wodId),
      exerciseId: new ObjectId(dto.exerciseId),
      score: dto.score,
      scoreKind: currentParsedScore?.kind ?? ResultScoreKind.UNKNOWN,
      isNewPR,
      createdAt: new Date(),
    };

    const insertResult = await this.db.collection<Result>('results').insertOne(result);
    const autoFeedPost = await this.tryCreateAutoPostForNewPr({
      userId,
      boxId,
      resultId: insertResult.insertedId,
      isNewPR,
      exerciseName: exercise.name,
      score: dto.score,
      customText: dto.autoPostText,
    });

    return {
      resultId: insertResult.insertedId,
      isNewPR,
      scoreKind: result.scoreKind,
      autoFeedPost,
      message: 'Resultado salvo com sucesso',
    };
  }

  async createPrByExercise(userId: string, boxId: string, dto: CreateExercisePrDto) {
    const exercise = await this.ensureExerciseExistsForBox(dto.exerciseId, boxId);

    const currentParsedScore = this.parseScore(dto.score);

    const history = await this.db
      .collection<Result>('results')
      .find({
        userId: new ObjectId(userId),
        boxId: new ObjectId(boxId),
        exerciseId: new ObjectId(dto.exerciseId),
      })
      .toArray();

    const isNewPR = this.isNewPersonalRecord(currentParsedScore, history);

    const result: Result = {
      userId: new ObjectId(userId),
      boxId: new ObjectId(boxId),
      exerciseId: new ObjectId(dto.exerciseId),
      score: dto.score,
      scoreKind: currentParsedScore?.kind ?? ResultScoreKind.UNKNOWN,
      isNewPR,
      createdAt: new Date(),
    };

    const insertResult = await this.db.collection<Result>('results').insertOne(result);
    const autoFeedPost = await this.tryCreateAutoPostForNewPr({
      userId,
      boxId,
      resultId: insertResult.insertedId,
      isNewPR,
      exerciseName: exercise.name,
      score: dto.score,
      customText: dto.autoPostText,
    });

    return {
      resultId: insertResult.insertedId,
      isNewPR,
      scoreKind: result.scoreKind,
      autoFeedPost,
      message: 'PR salvo com sucesso',
    };
  }

  private async ensureWodExistsForBox(wodId: string, boxId: string): Promise<void> {
    const wod = await this.db.collection<Wod>('wods').findOne({
      _id: new ObjectId(wodId),
      boxId: new ObjectId(boxId),
    });

    if (!wod) {
      throw new NotFoundException('WOD nao encontrado para este box');
    }
  }

  private async ensureExerciseExistsForBox(exerciseId: string, boxId: string): Promise<Exercise> {
    const exercise = await this.db.collection<Exercise>('exercises').findOne({
      _id: new ObjectId(exerciseId),
      $or: [{ isGlobal: true }, { boxId: new ObjectId(boxId) }],
    });

    if (!exercise) {
      throw new NotFoundException('Exercicio nao encontrado para este box');
    }

    return exercise;
  }

  private async tryCreateAutoPostForNewPr(params: {
    userId: string;
    boxId: string;
    resultId: ObjectId;
    isNewPR: boolean;
    exerciseName: string;
    score: string;
    customText?: string;
  }) {
    if (!params.isNewPR) {
      return { status: AutoPrPostStatus.SKIPPED_NO_NEW_PR };
    }

    const finalText = this.resolveAutoPostText(
      params.customText,
      params.exerciseName,
      params.score,
    );

    return this.feedService.createAutoPostForPr({
      userId: params.userId,
      boxId: params.boxId,
      resultId: params.resultId,
      text: finalText,
    });
  }

  private resolveAutoPostText(customText: string | undefined, exerciseName: string, score: string): string {
    if (customText && customText.trim().length > 0) {
      return customText.trim();
    }

    return `Novo PR no ${exerciseName}: ${score}`;
  }

  private isNewPersonalRecord(currentScore: ParsedScore | null, history: Result[]): boolean {
    if (history.length === 0) {
      return true;
    }

    if (!currentScore) {
      return false;
    }

    const previousComparableScores = history
      .map((item) => this.parseScore(item.score))
      .filter((item): item is ParsedScore => !!item && item.kind === currentScore.kind)
      .map((item) => item.value);

    if (previousComparableScores.length === 0) {
      return true;
    }

    if (currentScore.kind === ResultScoreKind.TIME) {
      const bestPreviousTime = Math.min(...previousComparableScores);
      return currentScore.value < bestPreviousTime;
    }

    const bestPreviousLoad = Math.max(...previousComparableScores);
    return currentScore.value > bestPreviousLoad;
  }

  private parseScore(score: string): ParsedScore | null {
    const normalized = score.trim().toLowerCase();

    const parsedTime = this.parseTimeToSeconds(normalized);
    if (parsedTime !== null) {
      return { kind: ResultScoreKind.TIME, value: parsedTime };
    }

    const numericMatch = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!numericMatch) {
      return null;
    }

    return { kind: ResultScoreKind.LOAD, value: Number(numericMatch[0]) };
  }

  private parseTimeToSeconds(raw: string): number | null {
    const parts = raw.split(':');

    if (parts.length !== 2 && parts.length !== 3) {
      return null;
    }

    const numbers = parts.map((part) => Number(part));

    if (numbers.some((part) => Number.isNaN(part) || part < 0)) {
      return null;
    }

    if (parts.length === 2) {
      const [minutes, seconds] = numbers;
      return minutes * 60 + seconds;
    }

    const [hours, minutes, seconds] = numbers;
    return hours * 3600 + minutes * 60 + seconds;
  }
}
