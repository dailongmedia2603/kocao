<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Koc;
use App\Models\KocContentIdea;
use App\Services\ContentGenerationService;
use App\Services\DreamfaceApiService;
use App\Services\SubscriptionService;
use App\Services\VoiceApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IdeaController extends Controller
{
    public function __construct(
        protected ContentGenerationService $contentService,
        protected VoiceApiService $voiceService,
        protected DreamfaceApiService $dreamfaceService,
        protected SubscriptionService $subscriptionService
    ) {}

    /**
     * Display a listing of ideas for a KOC.
     */
    public function index(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $ideas = $koc->ideas()
            ->with(['voiceTask', 'dreamfaceTask', 'finalVideoFile'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($ideas);
    }

    /**
     * Store a newly created idea.
     */
    public function store(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'idea_content' => ['required', 'string'],
            'new_content' => ['nullable', 'string'],
        ]);

        $idea = KocContentIdea::create([
            'koc_id' => $koc->id,
            'user_id' => $request->user()->id,
            'idea_content' => $validated['idea_content'],
            'new_content' => $validated['new_content'] ?? null,
            'status' => KocContentIdea::STATUS_NEW,
        ]);

        return response()->json($idea, 201);
    }

    /**
     * Update the specified idea.
     */
    public function update(Request $request, KocContentIdea $idea): JsonResponse
    {
        // Check ownership
        if ($idea->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'idea_content' => ['sometimes', 'string'],
            'new_content' => ['sometimes', 'string'],
            'status' => ['sometimes', 'string'],
        ]);

        $idea->update($validated);

        return response()->json($idea);
    }

    /**
     * Remove the specified idea.
     */
    public function destroy(Request $request, KocContentIdea $idea): JsonResponse
    {
        // Check ownership
        if ($idea->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $idea->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Generate content for an idea using AI.
     */
    public function generateContent(Request $request, KocContentIdea $idea): JsonResponse
    {
        // Check ownership
        if ($idea->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $idea->update(['status' => KocContentIdea::STATUS_PROCESSING]);

        try {
            $generatedContent = $this->contentService->generateFromIdea($idea);

            return response()->json([
                'success' => true,
                'message' => 'Nội dung đã được tạo thành công.',
                'idea' => $idea->fresh(),
            ]);

        } catch (\Exception $e) {
            $idea->update([
                'status' => KocContentIdea::STATUS_CONTENT_ERROR,
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create voice from idea content.
     */
    public function createVoice(Request $request, KocContentIdea $idea): JsonResponse
    {
        // Check ownership
        if ($idea->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$idea->new_content) {
            return response()->json([
                'success' => false,
                'error' => 'Idea chưa có nội dung để tạo voice.',
            ], 400);
        }

        // Check voice credits
        if (!$this->subscriptionService->canCreateVoice($request->user())) {
            return response()->json([
                'success' => false,
                'error' => 'Bạn đã hết lượt tạo giọng nói trong tháng này.',
            ], 403);
        }

        $idea->update(['status' => KocContentIdea::STATUS_CREATING_VOICE]);

        try {
            // Deduct credit
            if (!$this->subscriptionService->deductVoiceCredit($request->user())) {
                return response()->json([
                    'success' => false,
                    'error' => 'Không thể trừ credit.',
                ], 403);
            }

            // Get KOC's default voice
            $koc = Koc::find($idea->koc_id);
            $voiceSettings = [];
            
            if ($koc->default_cloned_voice_id) {
                $voiceSettings['voice_id'] = $koc->default_cloned_voice_id;
            }

            // Create TTS task
            $result = $this->voiceService->textToSpeech($request->user(), [
                'text' => $idea->new_content,
                'voice_name' => 'default',
                'voice_setting' => $voiceSettings,
            ]);

            // Update idea with voice task
            $idea->update([
                'voice_task_id' => $result['task_id'] ?? null,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Đang tạo giọng nói...',
                'idea' => $idea->fresh(),
                'task_id' => $result['task_id'] ?? null,
            ]);

        } catch (\Exception $e) {
            // Refund credit
            $this->subscriptionService->refundVoiceCredit($request->user());

            $idea->update([
                'status' => KocContentIdea::STATUS_VOICE_ERROR,
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Create video from idea's voice.
     */
    public function createVideo(Request $request, KocContentIdea $idea): JsonResponse
    {
        // Check ownership
        if ($idea->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if (!$idea->voice_audio_url) {
            return response()->json([
                'success' => false,
                'error' => 'Idea chưa có voice audio để tạo video.',
            ], 400);
        }

        // Check video credits
        if (!$this->subscriptionService->canCreateVideo($request->user())) {
            return response()->json([
                'success' => false,
                'error' => 'Bạn đã hết lượt tạo video trong tháng này.',
            ], 403);
        }

        $idea->update(['status' => KocContentIdea::STATUS_CREATING_VIDEO]);

        try {
            // Deduct credit
            if (!$this->subscriptionService->deductVideoCredit($request->user())) {
                return response()->json([
                    'success' => false,
                    'error' => 'Không thể trừ credit.',
                ], 403);
            }

            // Get a random KOC file for video source
            $koc = Koc::find($idea->koc_id);
            $kocFile = $koc->files()
                ->whereRaw("LOWER(display_name) REGEXP '\\.(mp4|mov|webm)$'")
                ->inRandomOrder()
                ->first();

            if (!$kocFile) {
                throw new \Exception('KOC chưa có video mẫu để tạo video.');
            }

            // Create Dreamface task
            $task = \App\Models\DreamfaceTask::create([
                'user_id' => $request->user()->id,
                'koc_id' => $idea->koc_id,
                'idea_id' => $idea->id,
                'original_video_url' => $kocFile->publicUrl,
                'original_audio_url' => $idea->voice_audio_url,
                'status' => \App\Models\DreamfaceTask::STATUS_PENDING,
            ]);

            // Update idea
            $idea->update(['dreamface_task_id' => $task->id]);

            // Process immediately (or dispatch job for queue)
            try {
                $this->dreamfaceService->processTask($task);
            } catch (\Exception $processError) {
                \Log::error("Dreamface process error: " . $processError->getMessage());
                // Task status already updated in service
            }

            return response()->json([
                'success' => true,
                'message' => 'Đang tạo video...',
                'idea' => $idea->fresh(),
                'task' => $task->fresh(),
            ]);

        } catch (\Exception $e) {
            // Refund credit
            $this->subscriptionService->refundVideoCredit($request->user());

            $idea->update([
                'status' => KocContentIdea::STATUS_VIDEO_ERROR,
                'error_message' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}

