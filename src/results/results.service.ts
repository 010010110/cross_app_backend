import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { AutoPrPostStatus, ResultScoreKind, WodModel } from '../common/enums';
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

  async create(userId: string, userBoxIds: string[], dto: CreateResultDto) {
    const wod = await this.ensureWodExistsForUser(dto.wodId, userBoxIds);
    this.validateScoreForWod(dto.score, wod);

    const currentParsedScore = this.parseScore(dto.score);

    const effectiveWodModel = this.detectWodResultMode(wod);

    const result: Result = {
      userId: new ObjectId(userId),
      boxId: wod.boxId,
      wodId: new ObjectId(dto.wodId),
      wodModel: effectiveWodModel ?? undefined,
      wodTitle: wod.title,
      score: dto.score,
      scoreKind: currentParsedScore?.kind ?? ResultScoreKind.UNKNOWN,
      createdAt: new Date(),
    };

    const insertResult = await this.db
      .collection<Result>('results')
      .insertOne(result);

    return {
      resultId: insertResult.insertedId,
      scoreKind: result.scoreKind,
      message: 'Resultado do WOD salvo com sucesso',
    };
  }

  async createPrByExercise(
    userId: string,
    userBoxIds: string[],
    dto: CreateExercisePrDto,
  ) {
    const exercise = await this.ensureExerciseExistsForUser(
      dto.exerciseId,
      userBoxIds,
    );
    const resolvedBoxId = this.resolveResultBoxIdForExercise(
      userBoxIds,
      exercise.boxId,
    );

    const currentParsedScore = this.parseScore(dto.score);

    const history = await this.db
      .collection<Result>('results')
      .find({
        userId: new ObjectId(userId),
        exerciseId: new ObjectId(dto.exerciseId),
      })
      .toArray();

    const isNewPR = this.isNewPersonalRecord(currentParsedScore, history);

    const result: Result = {
      userId: new ObjectId(userId),
      boxId: resolvedBoxId,
      exerciseId: new ObjectId(dto.exerciseId),
      score: dto.score,
      scoreKind: currentParsedScore?.kind ?? ResultScoreKind.UNKNOWN,
      isNewPR,
      createdAt: new Date(),
    };

    const insertResult = await this.db
      .collection<Result>('results')
      .insertOne(result);
    const autoFeedPost = await this.tryCreateAutoPostForNewPr({
      userId,
      boxId: resolvedBoxId.toHexString(),
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

  async listByUser(userId: string, limit = 50) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 200);

    return this.db
      .collection<Result>('results')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(userId),
            exerciseId: { $exists: false },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: normalizedLimit },
        {
          $lookup: {
            from: 'exercises',
            localField: 'exerciseId',
            foreignField: '_id',
            as: 'exercise',
          },
        },
        {
          $lookup: {
            from: 'wods',
            localField: 'wodId',
            foreignField: '_id',
            as: 'wod',
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            boxId: 1,
            wodId: 1,
            exerciseId: 1,
            score: 1,
            scoreKind: 1,
            createdAt: 1,
            wodModel: 1,
            exerciseName: {
              $ifNull: [{ $arrayElemAt: ['$exercise.name', 0] }, null],
            },
            wodTitle: { $ifNull: [{ $arrayElemAt: ['$wod.title', 0] }, null] },
            wodDate: { $ifNull: [{ $arrayElemAt: ['$wod.date', 0] }, null] },
          },
        },
      ])
      .toArray();
  }

  async listPrByUser(userId: string, limit = 50) {
    const normalizedLimit = Math.min(Math.max(limit, 1), 200);

    return this.db
      .collection<Result>('results')
      .aggregate([
        {
          $match: {
            userId: new ObjectId(userId),
            isNewPR: true,
            exerciseId: { $exists: true },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: normalizedLimit },
        {
          $lookup: {
            from: 'exercises',
            localField: 'exerciseId',
            foreignField: '_id',
            as: 'exercise',
          },
        },
        {
          $lookup: {
            from: 'wods',
            localField: 'wodId',
            foreignField: '_id',
            as: 'wod',
          },
        },
        {
          $project: {
            _id: 1,
            userId: 1,
            boxId: 1,
            wodId: 1,
            exerciseId: 1,
            score: 1,
            scoreKind: 1,
            isNewPR: 1,
            createdAt: 1,
            wodModel: {
              $ifNull: [
                '$wodModel',
                { $ifNull: [{ $arrayElemAt: ['$wod.model', 0] }, null] },
              ],
            },
            exerciseName: {
              $ifNull: [{ $arrayElemAt: ['$exercise.name', 0] }, null],
            },
            wodTitle: { $ifNull: [{ $arrayElemAt: ['$wod.title', 0] }, null] },
            wodDate: { $ifNull: [{ $arrayElemAt: ['$wod.date', 0] }, null] },
          },
        },
      ])
      .toArray();
  }

  private async ensureWodExistsForUser(
    wodId: string,
    userBoxIds: string[],
  ): Promise<Wod> {
    const normalizedUserBoxIds = userBoxIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const query: { _id: ObjectId; boxId?: { $in: ObjectId[] } } = {
      _id: new ObjectId(wodId),
    };

    if (normalizedUserBoxIds.length > 0) {
      query.boxId = { $in: normalizedUserBoxIds };
    }

    const wod = await this.db.collection<Wod>('wods').findOne(query);

    if (!wod) {
      throw new NotFoundException('WOD nao encontrado para este usuario');
    }

    return wod;
  }

  private validateScoreForWod(score: string, wod: Wod): void {
    const mode = this.detectWodResultMode(wod);
    const normalizedScore = score.trim().toLowerCase();
    const isTime = this.parseTimeToSeconds(normalizedScore) !== null;
    const isReps = this.parseRepsScore(normalizedScore) !== null;

    const repsOnlyModels: WodModel[] = [
      WodModel.AMRAP,
      WodModel.EMOM,
      WodModel.TABATA,
    ];
    const timeOnlyModels: WodModel[] = [
      WodModel.FOR_TIME,
      WodModel.RFT,
      WodModel.CHIPPER,
    ];
    const repsOrTimeModels: WodModel[] = [WodModel.LADDER, WodModel.INTERVALS];

    if (!mode) {
      return;
    }

    if (repsOnlyModels.includes(mode) && !isReps) {
      throw new BadRequestException(
        `Para WOD ${mode}, o score deve representar repeticoes (ex: 120, 120 reps ou 7+12)`,
      );
    }

    if (timeOnlyModels.includes(mode) && !isTime) {
      throw new BadRequestException(
        `Para WOD ${mode}, o score deve estar em formato de tempo (ex: 12:34 ou 01:02:33)`,
      );
    }

    if (repsOrTimeModels.includes(mode) && !isReps && !isTime) {
      throw new BadRequestException(
        `Para WOD ${mode}, o score deve ser tempo (ex: 12:34) ou repeticoes (ex: 120 ou 7+12)`,
      );
    }
  }

  private detectWodResultMode(wod: Wod): WodModel | null {
    if (wod.model) {
      return wod.model;
    }

    const mergedText = [
      wod.title,
      ...wod.blocks.flatMap((block) => [block.title, block.content]),
    ]
      .join(' ')
      .toUpperCase();

    if (/\bAMRAP\b/.test(mergedText)) return WodModel.AMRAP;
    if (/\bFOR\s*TIME\b|\bFORTIME\b/.test(mergedText)) return WodModel.FOR_TIME;
    if (/\bEMOM\b/.test(mergedText)) return WodModel.EMOM;
    if (/\bTABATA\b/.test(mergedText)) return WodModel.TABATA;
    if (/\bRFT\b|\bROUNDS?\s+FOR\s+TIME\b/.test(mergedText))
      return WodModel.RFT;
    if (/\bCHIPPER\b/.test(mergedText)) return WodModel.CHIPPER;
    if (/\bLADDER\b/.test(mergedText)) return WodModel.LADDER;
    if (/\bINTERVALS?\b/.test(mergedText)) return WodModel.INTERVALS;

    return null;
  }

  private async ensureExerciseExistsForUser(
    exerciseId: string,
    userBoxIds: string[],
  ): Promise<Exercise> {
    const normalizedUserBoxIds = userBoxIds
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const boxClauses = normalizedUserBoxIds.map((boxId) => ({ boxId }));

    const exercise = await this.db.collection<Exercise>('exercises').findOne({
      _id: new ObjectId(exerciseId),
      $or: [{ isGlobal: true }, ...boxClauses],
    });

    if (!exercise) {
      throw new NotFoundException('Exercicio nao encontrado para este usuario');
    }

    return exercise;
  }

  private resolveResultBoxIdForExercise(
    userBoxIds: string[],
    exerciseBoxId?: ObjectId,
  ): ObjectId {
    if (exerciseBoxId) {
      return exerciseBoxId;
    }

    const fallbackUserBoxId = userBoxIds.find((id) => ObjectId.isValid(id));

    if (!fallbackUserBoxId) {
      throw new BadRequestException(
        'Nao foi possivel determinar box de contexto para este resultado',
      );
    }

    return new ObjectId(fallbackUserBoxId);
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

  private resolveAutoPostText(
    customText: string | undefined,
    exerciseName: string,
    score: string,
  ): string {
    if (customText && customText.trim().length > 0) {
      return customText.trim();
    }

    return `Novo PR no ${exerciseName}: ${score}`;
  }

  private isNewPersonalRecord(
    currentScore: ParsedScore | null,
    history: Result[],
  ): boolean {
    if (history.length === 0) {
      return true;
    }

    if (!currentScore) {
      return false;
    }

    const previousComparableScores = history
      .map((item) => this.parseScore(item.score))
      .filter(
        (item): item is ParsedScore =>
          !!item && item.kind === currentScore.kind,
      )
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

    const parsedReps = this.parseRepsScore(normalized);
    if (parsedReps !== null) {
      return { kind: ResultScoreKind.LOAD, value: parsedReps };
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

  private parseRepsScore(raw: string): number | null {
    const normalized = raw.trim().toLowerCase();

    const roundsPlusReps = normalized.match(/^(\d+)\s*\+\s*(\d+)$/);
    if (roundsPlusReps) {
      const rounds = Number(roundsPlusReps[1]);
      const reps = Number(roundsPlusReps[2]);
      return rounds * 1000 + reps;
    }

    const repsOnly = normalized.match(/^(\d+)(\s*(rep|reps))?$/);
    if (repsOnly) {
      return Number(repsOnly[1]);
    }

    return null;
  }
}
