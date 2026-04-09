import type { ApiResponse } from '../../types/index.js';
import { BaseApiService } from './BaseApiService.js';

export interface AchievementDefinition {
  id: string;
  category: string;
  name_en: string;
  name_de: string;
  description_en: string;
  description_de: string;
  hint_en: string | null;
  hint_de: string | null;
  icon_key: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  is_secret: boolean;
  sort_order: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  context: Record<string, unknown>;
  definition: AchievementDefinition | null;
}

export interface AchievementProgress {
  achievement_id: string;
  current_count: number;
  target_count: number;
  updated_at: string;
  definition: AchievementDefinition | null;
}

export interface AchievementSummary {
  total_available: number;
  total_earned: number;
  by_rarity: Record<string, { total: number; earned: number }>;
  recent: UserAchievement[];
}

export class AchievementsApiService extends BaseApiService {
  getDefinitions(): Promise<ApiResponse<AchievementDefinition[]>> {
    return this.get('/achievements/definitions');
  }

  getAchievements(): Promise<ApiResponse<UserAchievement[]>> {
    return this.get('/users/me/achievements');
  }

  getProgress(): Promise<ApiResponse<AchievementProgress[]>> {
    return this.get('/users/me/achievements/progress');
  }

  getSummary(): Promise<ApiResponse<AchievementSummary>> {
    return this.get('/users/me/achievements/summary');
  }
}

export const achievementsApi = new AchievementsApiService();
