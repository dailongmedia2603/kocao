<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserSubscription;
use Illuminate\Support\Facades\DB;

class SubscriptionService
{
    /**
     * Check if user can create a video.
     */
    public function canCreateVideo(User $user): bool
    {
        $subscription = $user->subscription;
        
        if (!$subscription || !$subscription->plan) {
            return false;
        }

        return $subscription->current_period_videos_used < $subscription->plan->monthly_video_limit;
    }

    /**
     * Check if user can create a voice.
     */
    public function canCreateVoice(User $user): bool
    {
        $subscription = $user->subscription;
        
        if (!$subscription || !$subscription->plan) {
            return false;
        }

        return $subscription->current_period_voices_used < $subscription->plan->monthly_voice_limit;
    }

    /**
     * Deduct video credit from user.
     */
    public function deductVideoCredit(User $user): bool
    {
        return DB::transaction(function () use ($user) {
            $subscription = UserSubscription::where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if (!$subscription || !$subscription->canCreateVideo()) {
                return false;
            }

            $subscription->increment('current_period_videos_used');
            return true;
        });
    }

    /**
     * Deduct voice credit from user.
     */
    public function deductVoiceCredit(User $user): bool
    {
        return DB::transaction(function () use ($user) {
            $subscription = UserSubscription::where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if (!$subscription || !$subscription->canCreateVoice()) {
                return false;
            }

            $subscription->increment('current_period_voices_used');
            return true;
        });
    }

    /**
     * Refund video credit to user.
     */
    public function refundVideoCredit(User $user): void
    {
        $subscription = $user->subscription;
        
        if ($subscription && $subscription->current_period_videos_used > 0) {
            $subscription->decrement('current_period_videos_used');
        }
    }

    /**
     * Refund voice credit to user.
     */
    public function refundVoiceCredit(User $user): void
    {
        $subscription = $user->subscription;
        
        if ($subscription && $subscription->current_period_voices_used > 0) {
            $subscription->decrement('current_period_voices_used');
        }
    }

    /**
     * Reset monthly credits for all users.
     */
    public function resetMonthlyCredits(): int
    {
        return UserSubscription::query()->update([
            'current_period_videos_used' => 0,
            'current_period_voices_used' => 0,
            'current_period_start' => now(),
            'current_period_end' => now()->addMonth(),
        ]);
    }

    /**
     * Get subscription info for user.
     */
    public function getSubscriptionInfo(User $user): ?array
    {
        $subscription = $user->subscription?->load('plan');
        
        if (!$subscription) {
            return null;
        }

        return [
            'plan_name' => $subscription->plan?->name,
            'videos_used' => $subscription->current_period_videos_used,
            'video_limit' => $subscription->plan?->monthly_video_limit,
            'voices_used' => $subscription->current_period_voices_used,
            'voice_limit' => $subscription->plan?->monthly_voice_limit,
            'price' => $subscription->plan?->price,
        ];
    }
}
