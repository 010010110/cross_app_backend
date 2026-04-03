import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { CreateWodDto } from './dto/create-wod.dto';
import { Wod, WodModel } from './interfaces/wod.interface';

@Injectable()
export class WodsService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async createForBox(boxId: string, dto: CreateWodDto): Promise<ObjectId> {
    const trainingDateLocalStart = this.parseIsoDateAsLocalStart(dto.date);
    const { start, end } = this.getDayRange(trainingDateLocalStart);
    const legacyUtcMidnight = this.parseIsoDateAsUtcMidnight(dto.date);

    const existing = await this.db.collection<Wod>('wods').findOne({
      boxId: new ObjectId(boxId),
      $or: [
        { date: { $gte: start, $lte: end } },
        // Compatibilidade com registros legados salvos em UTC meia-noite.
        { date: legacyUtcMidnight },
      ],
    });

    if (existing) {
      throw new ConflictException('Ja existe um WOD cadastrado para esta data neste box');
    }

    const wod: Wod = {
      boxId: new ObjectId(boxId),
      date: trainingDateLocalStart,
      title: dto.title,
      model: dto.model ?? this.inferWodModel(dto.title, dto.blocks),
      blocks: dto.blocks,
      createdAt: new Date(),
    };

    const result = await this.db.collection<Wod>('wods').insertOne(wod);

    return result.insertedId;
  }

  async findTodayByBox(boxId: string): Promise<Wod | null> {
    const today = new Date();
    const { start, end } = this.getDayRange(today);
    const legacyUtcMidnight = this.parseIsoDateAsUtcMidnight(this.formatDateToIsoDay(today));

    return this.db.collection<Wod>('wods').findOne({
      boxId: new ObjectId(boxId),
      $or: [
        {
          date: {
            $gte: start,
            $lte: end,
          },
        },
        // Compatibilidade com registros legados salvos em UTC meia-noite.
        { date: legacyUtcMidnight },
      ],
    });
  }

  private parseIsoDateAsLocalStart(isoDate: string): Date {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private parseIsoDateAsUtcMidnight(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
  }

  private getDayRange(baseDate: Date): { start: Date; end: Date } {
    const start = new Date(baseDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(baseDate);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private formatDateToIsoDay(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private inferWodModel(title: string, blocks: Wod['blocks']): WodModel | undefined {
    const content = [title, ...blocks.flatMap((block) => [block.title, block.content])]
      .join(' ')
      .toUpperCase();

    if (/\bAMRAP\b/.test(content)) return WodModel.AMRAP;
    if (/\bFOR\s*TIME\b|\bFORTIME\b/.test(content)) return WodModel.FOR_TIME;
    if (/\bEMOM\b/.test(content)) return WodModel.EMOM;
    if (/\bTABATA\b/.test(content)) return WodModel.TABATA;
    if (/\bRFT\b|\bROUNDS?\s+FOR\s+TIME\b/.test(content)) return WodModel.RFT;
    if (/\bCHIPPER\b/.test(content)) return WodModel.CHIPPER;
    if (/\bLADDER\b/.test(content)) return WodModel.LADDER;
    if (/\bINTERVALS?\b/.test(content)) return WodModel.INTERVALS;

    return undefined;
  }
}