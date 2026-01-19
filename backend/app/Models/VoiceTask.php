<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VoiceTask extends Model
{
    use HasFactory;

    // Use string ID from external API, not auto-increment
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'user_id',
        'voice_name',
        'status',
        'audio_url',
        'srt_url',
        'cloned_voice_id',
        'cloned_voice_name',
        'task_type',
        'credit_cost',
        'error_message',
    ];

    protected $casts = [
        'credit_cost' => 'decimal:4',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Status constants
     */
    const STATUS_DOING = 'doing';
    const STATUS_DONE = 'done';
    const STATUS_ERROR = 'error';

    /**
     * Get the user that owns the task.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the ideas using this voice task.
     */
    public function ideas(): HasMany
    {
        return $this->hasMany(KocContentIdea::class, 'voice_task_id');
    }

    /**
     * Get the cloned voice used.
     */
    public function clonedVoice(): BelongsTo
    {
        return $this->belongsTo(ClonedVoice::class, 'cloned_voice_id', 'voice_id');
    }
}
