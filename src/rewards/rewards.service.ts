import { Inject, Injectable } from '@nestjs/common';
import { Db, ObjectId } from 'mongodb';
import { MONGO_CLIENT } from '../database/database.constants';
import { RewardMilestone } from './interfaces/reward-milestone.interface';
import { RewardStreak } from './interfaces/reward-streak.interface';
import { RewardXpLedger, RewardXpLedgerType } from './interfaces/reward-xp-ledger.interface';

const DAILY_CHECKIN_XP = 10;
const MAX_FREEZES = 2;
const MILESTONES = [
  { streakDays: 7, rewardXp: 50, rewardFreeze: 1 },
  { streakDays: 30, rewardXp: 200, rewardFreeze: 1 },
  { streakDays: 100, rewardXp: 1000, rewardFreeze: 1 },
] as const;

type RewardStreakState = 'INACTIVE' | 'ACTIVE' | 'AT_RISK' | 'BROKEN';

@Injectable()
export class RewardsService {
  constructor(@Inject(MONGO_CLIENT) private readonly db: Db) {}

  async recordCheckinActivity(userId: string, boxId: string, activityAt: Date) {
    const normalizedUserId = new ObjectId(userId);
    const normalizedBoxId = new ObjectId(boxId);
    const activityDay = this.normalizeToDayStart(activityAt);
    const streakCollection = this.db.collection<RewardStreak>('reward_streaks');

    const streak = await streakCollection.findOne({
      userId: normalizedUserId,
      boxId: normalizedBoxId,
    });

    if (!streak) {
      const createdStreak: RewardStreak = {
        userId: normalizedUserId,
        boxId: normalizedBoxId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: activityDay,
        availableFreezes: 0,
        totalXp: DAILY_CHECKIN_XP,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await streakCollection.insertOne(createdStreak);
      await this.createXpLedger(normalizedUserId, normalizedBoxId, 'CHECKIN_DAILY', DAILY_CHECKIN_XP);

      return {
        activityStatus: 'counted' as const,
        currentStreak: createdStreak.currentStreak,
        longestStreak: createdStreak.longestStreak,
        availableFreezes: createdStreak.availableFreezes,
        totalXp: createdStreak.totalXp,
        xpGained: DAILY_CHECKIN_XP,
        freezeUsed: false,
        milestonesUnlocked: [] as number[],
      };
    }

    const lastActivityDay = this.normalizeToDayStart(streak.lastActivityDate);

    if (lastActivityDay.getTime() === activityDay.getTime()) {
      return {
        activityStatus: 'already-counted' as const,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        availableFreezes: streak.availableFreezes,
        totalXp: streak.totalXp,
        xpGained: 0,
        freezeUsed: false,
        milestonesUnlocked: [] as number[],
      };
    }

    const gapDays = this.diffInDays(lastActivityDay, activityDay);
    let currentStreak = 1;
    let longestStreak = streak.longestStreak;
    let availableFreezes = streak.availableFreezes;
    let totalXp = streak.totalXp + DAILY_CHECKIN_XP;
    let freezeUsed = false;

    if (gapDays === 1) {
      currentStreak = streak.currentStreak + 1;
      longestStreak = Math.max(streak.longestStreak, currentStreak);
    } else if (gapDays === 2 && streak.availableFreezes > 0) {
      currentStreak = streak.currentStreak + 1;
      longestStreak = Math.max(streak.longestStreak, currentStreak);
      availableFreezes = streak.availableFreezes - 1;
      freezeUsed = true;
      await this.createXpLedger(normalizedUserId, normalizedBoxId, 'FREEZE_CONSUMED', 0);
    }

    const milestoneUnlocks = await this.unlockMilestones({
      userId: normalizedUserId,
      boxId: normalizedBoxId,
      currentStreak,
    });

    totalXp += milestoneUnlocks.bonusXp;
    availableFreezes = Math.min(MAX_FREEZES, availableFreezes + milestoneUnlocks.bonusFreezes);

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

    await this.createXpLedger(normalizedUserId, normalizedBoxId, 'CHECKIN_DAILY', DAILY_CHECKIN_XP, {
      streakDays: currentStreak,
    });

    return {
      activityStatus: 'counted' as const,
      currentStreak,
      longestStreak,
      availableFreezes,
      totalXp,
      xpGained: DAILY_CHECKIN_XP + milestoneUnlocks.bonusXp,
      freezeUsed,
      milestonesUnlocked: milestoneUnlocks.unlocked,
    };
  }

  async getMySummary(userId: string, boxId: string) {
    const streak = await this.db.collection<RewardStreak>('reward_streaks').findOne({
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
        streakState: 'INACTIVE' as RewardStreakState,
        daysSinceLastActivity: null,
        nextMilestone: MILESTONES[0].streakDays,
      };
    }

    const currentDay = this.normalizeToDayStart(new Date());
    const lastActivityDay = this.normalizeToDayStart(streak.lastActivityDate);
    const daysSinceLastActivity = this.diffInDays(lastActivityDay, currentDay);
    const streakState = this.getStreakState(daysSinceLastActivity, streak.availableFreezes);
    const effectiveCurrentStreak = streakState === 'BROKEN' ? 0 : streak.currentStreak;
    const nextMilestone = MILESTONES.find((item) => item.streakDays > effectiveCurrentStreak)?.streakDays ?? null;

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
    const milestonesCollection = this.db.collection<RewardMilestone>('reward_milestones');

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
      await this.createXpLedger(params.userId, params.boxId, 'STREAK_MILESTONE', milestone.rewardXp, {
        streakDays: milestone.streakDays,
        rewardFreeze: milestone.rewardFreeze,
      });

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

    await this.db.collection<RewardXpLedger>('reward_xp_ledger').insertOne(ledgerEntry);
  }

  private normalizeToDayStart(baseDate: Date): Date {
    const normalizedDate = new Date(baseDate);
    normalizedDate.setHours(0, 0, 0, 0);
    return normalizedDate;
  }

  private diffInDays(startDate: Date, endDate: Date): number {
    return Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  }

  private getStreakState(daysSinceLastActivity: number, availableFreezes: number): RewardStreakState {
    if (daysSinceLastActivity <= 1) {
      return 'ACTIVE';
    }

    if (daysSinceLastActivity === 2 && availableFreezes > 0) {
      return 'AT_RISK';
    }

    return 'BROKEN';
  }
}
