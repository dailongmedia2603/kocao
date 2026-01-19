<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserSubscription extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'plan_id',
        'current_period_videos_used',
        'current_period_voices_used',
        'current_period_start',
        'current_period_end',
    ];

    protected $casts = [
        'current_period_videos_used' => 'integer',
        'current_period_voices_used' => 'integer',
        'current_period_start' => 'date',
        'current_period_end' => 'date',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the subscription plan.
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'plan_id');
    }

    /**
     * Check if user can create video.
     */
    public function canCreateVideo(): bool
    {
        if (!$this->plan) return false;
        return $this->current_period_videos_used < $this->plan->monthly_video_limit;
    }

    /**
     * Check if user can create voice.
     */
    public function canCreateVoice(): bool
    {
        if (!$this->plan) return false;
        return $this->current_period_voices_used < $this->plan->monthly_voice_limit;
    }

    /**
     * Get remaining video credits.
     */
    public function getRemainingVideosAttribute(): int
    {
        if (!$this->plan) return 0;
        return max(0, $this->plan->monthly_video_limit - $this->current_period_videos_used);
    }

    /**
     * Get remaining voice credits.
     */
    public function getRemainingVoicesAttribute(): int
    {
        if (!$this->plan) return 0;
        return max(0, $this->plan->monthly_voice_limit - $this->current_period_voices_used);
    }
}
