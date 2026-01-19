<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SubscriptionService;
use App\Services\VoiceApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VoiceController extends Controller
{
    public function __construct(
        protected VoiceApiService $voiceService,
        protected SubscriptionService $subscriptionService
    ) {}

    /**
     * Get list of voice tasks for current user.
     * Excludes clone_sample tasks (those are internal for generating sample audio).
     */
    public function tasks(Request $request): JsonResponse
    {
        $tasks = \App\Models\VoiceTask::where('user_id', $request->user()->id)
            ->where(function ($query) {
                $query->whereNull('task_type')
                      ->orWhere('task_type', '!=', 'clone_sample');
            })
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json($tasks);
    }

    /**
     * Create a text-to-speech task.
     */
    public function textToSpeech(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'text' => ['required', 'string'],
            'voice_name' => ['required', 'string'],
            'model' => ['sometimes', 'string'],
            'voice_setting' => ['sometimes', 'array'],
            'voice_setting.voice_id' => ['sometimes', 'string'],
            'cloned_voice_name' => ['sometimes', 'string'],
        ]);

        // Check voice credits
        if (!$this->subscriptionService->canCreateVoice($request->user())) {
            return response()->json([
                'success' => false,
                'error' => 'Bạn đã hết lượt tạo giọng nói trong tháng này.',
            ], 403);
        }

        try {
            // Deduct credit
            if (!$this->subscriptionService->deductVoiceCredit($request->user())) {
                return response()->json([
                    'success' => false,
                    'error' => 'Không thể trừ credit.',
                ], 403);
            }

            $result = $this->voiceService->textToSpeech($request->user(), $validated);

            return response()->json([
                'success' => true,
                'task_id' => $result['task_id'] ?? null,
                ...$result,
            ]);

        } catch (\Exception $e) {
            // Refund credit on error
            $this->subscriptionService->refundVoiceCredit($request->user());

            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get list of cloned voices.
     */
    public function clonedVoices(Request $request): JsonResponse
    {
        $voices = $this->voiceService->getClonedVoices($request->user());

        return response()->json($voices);
    }

    /**
     * Clone a voice (async - dispatches to queue).
     */
    public function clone(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'mimes:mp3,wav,m4a,ogg', 'max:20480'], // 20MB
            'voice_name' => ['required', 'string', 'max:255'],
            'preview_text' => ['nullable', 'string'],
        ]);

        try {
            $file = $request->file('file');
            $user = $request->user();
            
            // Save file to temp storage
            $tempPath = 'temp/voice_clone/' . uniqid() . '_' . $file->getClientOriginalName();
            \Storage::disk('local')->put($tempPath, file_get_contents($file->getRealPath()));
            
            // Create pending log entry
            $log = \App\Models\VoiceCloneLog::create([
                'user_id' => $user->id,
                'request_url' => config('services.voice.api_url', 'https://gateway.vivoo.work') . '/v1m/voice/clone',
                'request_payload' => [
                    'voice_name' => $validated['voice_name'],
                    'file_name' => $file->getClientOriginalName(),
                    'file_size' => $file->getSize(),
                ],
                'response_body' => null,
                'status_code' => 0,
                'status_text' => 'Processing',
            ]);
            
            // Dispatch job to queue
            \App\Jobs\CloneVoiceJob::dispatch(
                $user->id,
                $validated['voice_name'],
                $validated['preview_text'] ?? null,
                $tempPath,
                $file->getClientOriginalName(),
                $log->id
            );

            return response()->json([
                'success' => true,
                'message' => 'Yêu cầu clone voice đã được gửi. Vui lòng đợi vài phút.',
                'log_id' => $log->id,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a cloned voice.
     */
    public function deleteClonedVoice(Request $request, string $voiceId): JsonResponse
    {
        $deleted = $this->voiceService->deleteClonedVoice($request->user(), $voiceId);

        if (!$deleted) {
            return response()->json([
                'success' => false,
                'error' => 'Không tìm thấy giọng nói hoặc không có quyền xóa.',
            ], 404);
        }

        return response()->json(['success' => true]);
    }

    /**
     * Proxy request to Voice API.
     */
    public function proxy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'path' => ['required', 'string'],
            'method' => ['required', 'string'],
            'body' => ['nullable', 'array'],
        ]);

        try {
            $result = $this->voiceService->proxy(
                $validated['path'],
                $validated['method'],
                $validated['body'] ?? []
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get voice clone logs.
     */
    public function logs(Request $request): JsonResponse
    {
        $logs = \App\Models\VoiceCloneLog::where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($logs);
    }
}
