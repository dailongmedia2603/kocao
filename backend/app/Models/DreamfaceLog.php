<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DreamfaceLog extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'dreamface_task_id',
        'action',
        'request_payload',
        'response_body',
        'status_code',
        'error_message',
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

    public function task(): BelongsTo
    {
        return $this->belongsTo(DreamfaceTask::class, 'dreamface_task_id');
    }
}
