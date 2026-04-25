import { Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { RewardMilestone } from './interfaces/reward-milestone.interface';
import { RewardStreak } from './interfaces/reward-streak.interface';
import {
  CheckinActivityStatus,
  RewardStreakState,
  RewardXpLedgerType,
} from '../common/enums';
import { RewardXpLedger } from './interfaces/reward-xp-ledger.interface';

const DAILY_CHECKIN_XP = 10;
const SATURDAY_BONUS_XP = 5;
const SUNDAY_BONUS_XP = 5;
const FULL_WEEK_BONUS_XP = 5;
const FULL_WEEK_BONUS_FREEZE = 1;
const MAX_FREEZES = 3;
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;
const MILESTONES = [
  { streakDays: 7, rewardXp: 50, rewardFreeze: 1 },
  { streakDays: 15, rewardXp: 75, rewardFreeze: 0 },
  { streakDays: 30, rewardXp: 150, rewardFreeze: 1 },
  { streakDays: 45, rewardXp: 200, rewardFreeze: 0 },
  { streakDays: 60, rewardXp: 300, rewardFreeze: 1 },
  { streakDays: 100, rewardXp: 1000, rewardFreeze: 1 },
] as const;

@Injectable()
export class RewardsService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async recordCheckinActivity(userId: string, boxId: string, activityAt: Date) {
    const normalizedUserId = new ObjectId(userId);
    const normalizedBoxId = new ObjectId(boxId);
    const activityDay = this.normalizeToDayStart(activityAt);
    const isSaturdayCheckin = this.isSaturday(activityDay);
    const isSundayCheckin = this.isSunday(activityDay);
    const hasCompletedFullWeek = isSundayCheckin
      ? await this.hasCompletedSevenDayWeek(
          normalizedUserId,
          normalizedBoxId,
          activityDay,
        )
      : false;
    const checkinXp =
      DAILY_CHECKIN_XP +
      (isSaturdayCheckin ? SATURDAY_BONUS_XP : 0) +
      (isSundayCheckin ? SUNDAY_BONUS_XP : 0) +
      (hasCompletedFullWeek ? FULL_WEEK_BONUS_XP : 0);
    const streakCollection = this.db.collection<RewardStreak>('reward_streaks');

    const streak = await streakCollection.findOne({
      userId: normalizedUserId,
      boxId: normalizedBoxId,
    });

    if (!streak) {
      const fullWeekFreezeBonus = this.resolveFullWeekFreezeBonus(
        hasCompletedFullWeek,
        [],
      );
      const createdStreak: RewardStreak = {
        userId: normalizedUserId,
        boxId: normalizedBoxId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: activityDay,
        availableFreezes: Math.min(MAX_FREEZES, fullWeekFreezeBonus),
        totalXp: checkinXp,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await streakCollection.insertOne(createdStreak);
      await this.createXpLedger(
        normalizedUserId,
        normalizedBoxId,
        RewardXpLedgerType.CHECKIN_DAILY,
        DAILY_CHECKIN_XP,
        {
          streakDays: 1,
        },
      );
      if (isSaturdayCheckin) {
        await this.createXpLedger(
          normalizedUserId,
          normalizedBoxId,
          RewardXpLedgerType.CHECKIN_SATURDAY_BONUS,
          SATURDAY_BONUS_XP,
          {
            streakDays: 1,
          },
        );
      }
      if (isSundayCheckin) {
        await this.createXpLedger(
          normalizedUserId,
          normalizedBoxId,
          RewardXpLedgerType.CHECKIN_SUNDAY_BONUS,
          SUNDAY_BONUS_XP,
          {
            streakDays: 1,
          },
        );
      }
      if (hasCompletedFullWeek) {
        await this.createXpLedger(
          normalizedUserId,
          normalizedBoxId,
          RewardXpLedgerType.CHECKIN_FULL_WEEK_BONUS,
          FULL_WEEK_BONUS_XP,
          {
            streakDays: 1,
            rewardFreeze: fullWeekFreezeBonus,
            weekStartDate: this.getWeekStartMonday(activityDay).toISOString(),
          },
        );
      }

      return {
        activityStatus: CheckinActivityStatus.COUNTED,
        currentStreak: createdStreak.currentStreak,
        longestStreak: createdStreak.longestStreak,
        availableFreezes: createdStreak.availableFreezes,
        totalXp: createdStreak.totalXp,
        xpGained: checkinXp,
        freezeUsed: false,
        milestonesUnlocked: [] as number[],
      };
    }

    const lastActivityDay = this.normalizeToDayStart(streak.lastActivityDate);

    if (activityDay.getTime() < lastActivityDay.getTime()) {
      return {
        activityStatus: CheckinActivityStatus.ALREADY_COUNTED,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        availableFreezes: streak.availableFreezes,
        totalXp: streak.totalXp,
        xpGained: 0,
        freezeUsed: false,
        milestonesUnlocked: [] as number[],
      };
    }

    if (lastActivityDay.getTime() === activityDay.getTime()) {
      return {
        activityStatus: CheckinActivityStatus.ALREADY_COUNTED,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        availableFreezes: streak.availableFreezes,
        totalXp: streak.totalXp,
        xpGained: 0,
        freezeUsed: false,
        milestonesUnlocked: [] as number[],
      };
    }

    const missedRequiredDays = this.countRequiredDaysBetween(
      lastActivityDay,
      activityDay,
    );
    let currentStreak = 1;
    let longestStreak = streak.longestStreak;
    let availableFreezes = streak.availableFreezes;
    let totalXp = streak.totalXp + checkinXp;
    let freezeUsed = false;

    if (missedRequiredDays === 0) {
      currentStreak = streak.currentStreak + 1;
      longestStreak = Math.max(streak.longestStreak, currentStreak);
    } else if (missedRequiredDays === 1 && streak.availableFreezes > 0) {
      currentStreak = streak.currentStreak + 1;
      longestStreak = Math.max(streak.longestStreak, currentStreak);
      availableFreezes = streak.availableFreezes - 1;
      freezeUsed = true;
      await this.createXpLedger(
        normalizedUserId,
        normalizedBoxId,
        RewardXpLedgerType.FREEZE_CONSUMED,
        0,
      );
    }

    const milestoneUnlocks = await this.unlockMilestones({
      userId: normalizedUserId,
      boxId: normalizedBoxId,
      currentStreak,
    });

    totalXp += milestoneUnlocks.bonusXp;
    const fullWeekFreezeBonus = this.resolveFullWeekFreezeBonus(
      hasCompletedFullWeek,
      milestoneUnlocks.unlocked,
    );
    availableFreezes = Math.min(
      MAX_FREEZES,
      availableFreezes + milestoneUnlocks.bonusFreezes + fullWeekFreezeBonus,
    );

    await streakCollection.updateOne(
      { _id: streak._id },
      {
        $set: {
          currentStreak,
          longestStreak,
          lastActivityDate: activityDay,
          availableFreezes,
          totalXp,
          updatedAt: new Date(),
        },
      },
    );

    await this.createXpLedger(
      normalizedUserId,
      normalizedBoxId,
      RewardXpLedgerType.CHECKIN_DAILY,
      DAILY_CHECKIN_XP,
      {
        streakDays: currentStreak,
      },
    );
    if (isSaturdayCheckin) {
      await this.createXpLedger(
        normalizedUserId,
        normalizedBoxId,
        RewardXpLedgerType.CHECKIN_SATURDAY_BONUS,
        SATURDAY_BONUS_XP,
        {
          streakDays: currentStreak,
        },
      );
    }
    if (isSundayCheckin) {
      await this.createXpLedger(
        normalizedUserId,
        normalizedBoxId,
        RewardXpLedgerType.CHECKIN_SUNDAY_BONUS,
        SUNDAY_BONUS_XP,
        {
          streakDays: currentStreak,
        },
      );
    }
    if (hasCompletedFullWeek) {
      await this.createXpLedger(
        normalizedUserId,
        normalizedBoxId,
        RewardXpLedgerType.CHECKIN_FULL_WEEK_BONUS,
        FULL_WEEK_BONUS_XP,
        {
          streakDays: currentStreak,
          rewardFreeze: fullWeekFreezeBonus,
          weekStartDate: this.getWeekStartMonday(activityDay).toISOString(),
        },
      );
    }

    return {
      activityStatus: CheckinActivityStatus.COUNTED,
      currentStreak,
      longestStreak,
      availableFreezes,
      totalXp,
      xpGained: checkinXp + milestoneUnlocks.bonusXp,
      freezeUsed,
      milestonesUnlocked: milestoneUnlocks.unlocked,
    };
  }

  async getMySummary(userId: string, boxId: string) {
    const streak = await this.db
      .collection<RewardStreak>('reward_streaks')
      .findOne({
        userId: new ObjectId(userId),
        boxId: new ObjectId(boxId),
      });

    if (!streak) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        availableFreezes: 0,
        totalXp: 0,
        streakState: RewardStreakState.INACTIVE,
        daysSinceLastActivity: null,
        nextMilestone: MILESTONES[0].streakDays,
      };
    }

    const currentDay = this.normalizeToDayStart(new Date());
    const lastActivityDay = this.normalizeToDayStart(streak.lastActivityDate);
    const daysSinceLastActivity = this.diffInDays(lastActivityDay, currentDay);
    const missedRequiredDays = this.countRequiredDaysBetween(
      lastActivityDay,
      currentDay,
    );
    const streakState = this.getStreakState(
      missedRequiredDays,
      streak.availableFreezes,
    );
    const effectiveCurrentStreak =
      streakState === RewardStreakState.BROKEN ? 0 : streak.currentStreak;
    const nextMilestone =
      MILESTONES.find((item) => item.streakDays > effectiveCurrentStreak)
        ?.streakDays ?? null;

    return {
      currentStreak: effectiveCurrentStreak,
      longestStreak: streak.longestStreak,
      lastActivityDate: streak.lastActivityDate,
      availableFreezes: streak.availableFreezes,
      totalXp: streak.totalXp,
      streakState,
      daysSinceLastActivity,
      nextMilestone,
    };
  }

  async getMyMilestones(userId: string, boxId: string) {
    return this.db
      .collection<RewardMilestone>('reward_milestones')
      .find({
        userId: new ObjectId(userId),
        boxId: new ObjectId(boxId),
      })
      .sort({ unlockedAt: -1 })
      .toArray();
  }

  private async unlockMilestones(params: {
    userId: ObjectId;
    boxId: ObjectId;
    currentStreak: number;
  }) {
    const unlocked: number[] = [];
    let bonusXp = 0;
    let bonusFreezes = 0;
    const milestonesCollection =
      this.db.collection<RewardMilestone>('reward_milestones');

    for (const milestone of MILESTONES) {
      if (params.currentStreak < milestone.streakDays) {
        continue;
      }

      const existingMilestone = await milestonesCollection.findOne({
        userId: params.userId,
        boxId: params.boxId,
        streakDays: milestone.streakDays,
      });

      if (existingMilestone) {
        continue;
      }

      const rewardMilestone: RewardMilestone = {
        userId: params.userId,
        boxId: params.boxId,
        streakDays: milestone.streakDays,
        rewardXp: milestone.rewardXp,
        rewardFreeze: milestone.rewardFreeze,
        unlockedAt: new Date(),
      };

      await milestonesCollection.insertOne(rewardMilestone);
      await this.createXpLedger(
        params.userId,
        params.boxId,
        RewardXpLedgerType.STREAK_MILESTONE,
        milestone.rewardXp,
        {
          streakDays: milestone.streakDays,
          rewardFreeze: milestone.rewardFreeze,
        },
      );

      unlocked.push(milestone.streakDays);
      bonusXp += milestone.rewardXp;
      bonusFreezes += milestone.rewardFreeze;
    }

    return { unlocked, bonusXp, bonusFreezes };
  }

  private async createXpLedger(
    userId: ObjectId,
    boxId: ObjectId,
    type: RewardXpLedgerType,
    points: number,
    metadata?: RewardXpLedger['metadata'],
  ) {
    const ledgerEntry: RewardXpLedger = {
      userId,
      boxId,
      type,
      points,
      createdAt: new Date(),
      metadata,
    };

    await this.db
      .collection<RewardXpLedger>('reward_xp_ledger')
      .insertOne(ledgerEntry);
  }

  private normalizeToDayStart(baseDate: Date): Date {
    const normalizedDate = new Date(baseDate);
    normalizedDate.setHours(0, 0, 0, 0);
    return normalizedDate;
  }

  private diffInDays(startDate: Date, endDate: Date): number {
    return Math.floor(
      (endDate.getTime() - startDate.getTime()) / MILLISECONDS_IN_DAY,
    );
  }

  private countRequiredDaysBetween(startDate: Date, endDate: Date): number {
    if (endDate.getTime() <= startDate.getTime()) {
      return 0;
    }

    let requiredDays = 0;
    const cursor = new Date(startDate);

    while (true) {
      cursor.setDate(cursor.getDate() + 1);

      if (cursor.getTime() >= endDate.getTime()) {
        break;
      }

      if (this.isRequiredTrainingDay(cursor)) {
        requiredDays += 1;
      }
    }

    return requiredDays;
  }

  private isRequiredTrainingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  }

  private isSaturday(date: Date): boolean {
    return date.getDay() === 6;
  }

  private isSunday(date: Date): boolean {
    return date.getDay() === 0;
  }

  private getWeekStartMonday(baseDate: Date): Date {
    const weekStart = this.normalizeToDayStart(baseDate);
    const dayOfWeek = weekStart.getDay();
    const deltaToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(weekStart.getDate() - deltaToMonday);
    return weekStart;
  }

  private async hasCompletedSevenDayWeek(
    userId: ObjectId,
    boxId: ObjectId,
    activityDay: Date,
  ): Promise<boolean> {
    const weekStart = this.getWeekStartMonday(activityDay);
    const weekEnd = new Date(activityDay);
    weekEnd.setHours(23, 59, 59, 999);

    const checkins = await this.db
      .collection<{ createdAt: Date }>('checkins')
      .find({
        userId,
        boxId,
        createdAt: { $gte: weekStart, $lte: weekEnd },
      })
      .toArray();

    const trainedDays = new Set(
      checkins.map((checkin) =>
        this.normalizeToDayStart(checkin.createdAt).toISOString(),
      ),
    );

    for (let offset = 0; offset < 7; offset += 1) {
      const day = new Date(weekStart);
      day.setDate(day.getDate() + offset);
      if (!trainedDays.has(day.toISOString())) {
        return false;
      }
    }

    return true;
  }

  private resolveFullWeekFreezeBonus(
    hasCompletedFullWeek: boolean,
    unlockedMilestones: number[],
  ): number {
    if (!hasCompletedFullWeek) {
      return 0;
    }

    if (unlockedMilestones.includes(7)) {
      return 0;
    }

    return FULL_WEEK_BONUS_FREEZE;
  }

  private getStreakState(
    missedRequiredDays: number,
    availableFreezes: number,
  ): RewardStreakState {
    if (missedRequiredDays === 0) {
      return RewardStreakState.ACTIVE;
    }

    if (missedRequiredDays === 1 && availableFreezes > 0) {
      return RewardStreakState.AT_RISK;
    }

    return RewardStreakState.BROKEN;
  }
}
