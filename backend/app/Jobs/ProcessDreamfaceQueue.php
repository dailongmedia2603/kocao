<?php

namespace App\Jobs;

use App\Models\DreamfaceTask;
use App\Services\DreamfaceApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessDreamfaceQueue implements ShouldQueue
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
    public function handle(DreamfaceApiService $dreamfaceService): void
    {
        // Skip if already processed
        if ($this->task->status !== DreamfaceTask::STATUS_PENDING) {
            return;
        }

        try {
            $dreamfaceService->processTask($this->task);
        } catch (\Exception $e) {
            \Log::error("ProcessDreamfaceQueue failed for task {$this->task->id}: " . $e->getMessage());
            
            // Mark as failed after all retries
            if ($this->attempts() >= $this->tries) {
                $this->task->update([
                    'status' => DreamfaceTask::STATUS_FAILED,
                    'error_message' => $e->getMessage(),
                ]);

                // Update linked idea
                if ($this->task->idea_id) {
                    \App\Models\KocContentIdea::where('id', $this->task->idea_id)
                        ->update([
                            'status' => \App\Models\KocContentIdea::STATUS_VIDEO_ERROR,
                            'error_message' => $e->getMessage(),
                        ]);
                }
            }

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        \Log::error("ProcessDreamfaceQueue completely failed for task {$this->task->id}: " . $exception->getMessage());
    }
}
