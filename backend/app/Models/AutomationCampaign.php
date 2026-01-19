<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AutomationCampaign extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'koc_id',
        'name',
        'description',
        'status',
        'cloned_voice_id',
        'cloned_voice_name',
        'ai_template_id',
        'model',
        'max_words',
    ];

    protected $casts = [
        'max_words' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user that owns the campaign.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the KOC for the campaign.
     */
    public function koc(): BelongsTo
    {
        return $this->belongsTo(Koc::class);
    }

    /**
     * Get the AI template for the campaign.
     */
    public function aiTemplate(): BelongsTo
    {
        return $this->belongsTo(AiPromptTemplate::class, 'ai_template_id');
    }

    /**
     * Get the cloned voice for the campaign.
     */
    public function clonedVoice(): BelongsTo
    {
        return $this->belongsTo(ClonedVoice::class, 'cloned_voice_id', 'voice_id');
    }

    /**
     * Check if campaign is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'active';
    }
}
