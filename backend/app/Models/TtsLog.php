<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TtsLog extends Model
{
    use HasUuids;

    protected $table = 'tts_logs';

    protected $fillable = [
        'user_id',
        'task_id',
        'request_payload',
        'response_body',
        'status_code',
    ];

    protected $casts = [
        'request_payload' => 'array',
        'response_body' => 'array',
        'status_code' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
