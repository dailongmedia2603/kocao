<?php

namespace App\Jobs;

use App\Models\KocContentIdea;
use App\Services\ContentGenerationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GenerateIdeaContent implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public int $backoff = 30;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public KocContentIdea $idea
    ) {}

    /**
     * Execute the job.
     */
    public function handle(ContentGenerationService $contentService): void
    {
        // Skip if already processed
        if ($this->idea->new_content && $this->idea->status === KocContentIdea::STATUS_CONTENT_READY) {
            return;
        }

        $this->idea->update(['status' => KocContentIdea::STATUS_PROCESSING]);

        try {
            $contentService->generateFromIdea($this->idea);
            
            \Log::info("GenerateIdeaContent completed for idea {$this->idea->id}");

        } catch (\Exception $e) {
            \Log::error("GenerateIdeaContent failed for idea {$this->idea->id}: " . $e->getMessage());

            $this->idea->update([
                'status' => KocContentIdea::STATUS_CONTENT_ERROR,
                'error_message' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        $this->idea->update([
            'status' => KocContentIdea::STATUS_CONTENT_ERROR,
            'error_message' => 'Job failed after retries: ' . $exception->getMessage(),
        ]);
    }
}
