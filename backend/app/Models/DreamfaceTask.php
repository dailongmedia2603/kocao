<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DreamfaceTask extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'user_id',
        'koc_id',
        'idea_id',
        'original_video_url',
        'original_audio_url',
        'status',
        'animate_id',
        'thumbnail_url',
        'result_video_url',
        'error_message',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Status constants
     */
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    /**
     * Get the user that owns the task.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the KOC for the task.
     */
    public function koc(): BelongsTo
    {
        return $this->belongsTo(Koc::class);
    }

    /**
     * Get the idea for the task.
     */
    public function idea(): BelongsTo
    {
        return $this->belongsTo(KocContentIdea::class, 'idea_id');
    }
}
