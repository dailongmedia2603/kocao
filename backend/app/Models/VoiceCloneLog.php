<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VoiceCloneLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'request_url',
        'request_payload',
        'response_body',
        'status_code',
        'status_text',
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
