<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClonedVoice extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'voice_id',
        'user_id',
        'voice_name',
        'sample_audio',
        'cover_url',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Get the user that owns the voice.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
