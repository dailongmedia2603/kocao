<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Koc extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'name',
        'field',
        'avatar_url',
        'folder_path',
        'channel_url',
        'follower_count',
        'like_count',
        'video_count',
        'channel_nickname',
        'channel_unique_id',
        'channel_created_at',
        'default_prompt_template_id',
        'default_cloned_voice_id',
        'stats_updated_at',
    ];

    protected $casts = [
        'follower_count' => 'integer',
        'like_count' => 'integer',
        'video_count' => 'integer',
        'channel_created_at' => 'datetime',
        'stats_updated_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user that owns the KOC.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the files for the KOC.
     */
    public function files(): HasMany
    {
        return $this->hasMany(KocFile::class);
    }

    /**
     * Get the ideas for the KOC.
     */
    public function ideas(): HasMany
    {
        return $this->hasMany(KocContentIdea::class);
    }

    /**
     * Get the automation campaigns for the KOC.
     */
    public function automationCampaigns(): HasMany
    {
        return $this->hasMany(AutomationCampaign::class);
    }

    /**
     * Get the default prompt template.
     */
    public function defaultPromptTemplate(): BelongsTo
    {
        return $this->belongsTo(AiPromptTemplate::class, 'default_prompt_template_id');
    }

    /**
     * Get the default cloned voice.
     */
    public function defaultClonedVoice(): BelongsTo
    {
        return $this->belongsTo(ClonedVoice::class, 'default_cloned_voice_id', 'voice_id');
    }
}
