<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KocContentIdea extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'koc_id',
        'user_id',
        'idea_content',
        'new_content',
        'status',
        'voice_task_id',
        'voice_audio_url',
        'dreamface_task_id',
        'final_video_file_id',
        'ai_prompt_log',
        'error_message',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Status constants
     */
    const STATUS_NEW = 'Chưa sử dụng';
    const STATUS_PROCESSING = 'Đang xử lý';
    const STATUS_CONTENT_READY = 'Đã có content';
    const STATUS_CREATING_VOICE = 'Đang tạo voice';
    const STATUS_VOICE_READY = 'Đã tạo voice';
    const STATUS_CREATING_VIDEO = 'Đang tạo video';
    const STATUS_COMPLETED = 'Hoàn thành';
    const STATUS_CONTENT_ERROR = 'Lỗi tạo content';
    const STATUS_VOICE_ERROR = 'Lỗi tạo voice';
    const STATUS_VIDEO_ERROR = 'Lỗi tạo video';

    /**
     * Get the KOC that owns the idea.
     */
    public function koc(): BelongsTo
    {
        return $this->belongsTo(Koc::class);
    }

    /**
     * Get the user that owns the idea.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the voice task.
     */
    public function voiceTask(): BelongsTo
    {
        return $this->belongsTo(VoiceTask::class, 'voice_task_id');
    }

    /**
     * Get the dreamface task.
     */
    public function dreamfaceTask(): BelongsTo
    {
        return $this->belongsTo(DreamfaceTask::class, 'dreamface_task_id');
    }

    /**
     * Get the final video file.
     */
    public function finalVideoFile(): BelongsTo
    {
        return $this->belongsTo(KocFile::class, 'final_video_file_id');
    }
}
