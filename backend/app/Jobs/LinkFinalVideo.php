<?php

namespace App\Jobs;

use App\Models\DreamfaceTask;
use App\Models\KocContentIdea;
use App\Models\KocFile;
use App\Services\R2StorageService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class LinkFinalVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public int $backoff = 60;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public DreamfaceTask $task
    ) {}

    /**
     * Execute the job.
     */
    public function handle(R2StorageService $r2Service): void
    {
        if (!$this->task->result_video_url || !$this->task->idea_id) {
            return;
        }

        $idea = KocContentIdea::find($this->task->idea_id);
        if (!$idea) {
            return;
        }

        try {
            // Download video and upload to R2
            $fileName = "final_video_{$this->task->id}.mp4";
            $r2Key = "kocs/{$idea->user_id}/{$idea->koc_id}/finals/{$fileName}";

            $r2Url = $r2Service->uploadFromUrl($this->task->result_video_url, $r2Key);

            // Create KocFile record
            $kocFile = KocFile::create([
                'koc_id' => $idea->koc_id,
                'user_id' => $idea->user_id,
                'r2_key' => $r2Key,
                'display_name' => $fileName,
                'url' => $r2Url,
                'thumbnail_url' => $this->task->thumbnail_url,
            ]);

            // Link to idea
            $idea->update([
                'final_video_file_id' => $kocFile->id,
                'status' => KocContentIdea::STATUS_COMPLETED,
            ]);

            \Log::info("LinkFinalVideo completed for task {$this->task->id}");

        } catch (\Exception $e) {
            \Log::error("LinkFinalVideo failed for task {$this->task->id}: " . $e->getMessage());
            throw $e;
        }
    }
}
