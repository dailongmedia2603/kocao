<?php

namespace App\Services;

use App\Models\DreamfaceTask;
use App\Models\DreamfaceLog;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class DreamfaceApiService
{
    protected string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = config('services.dreamface.api_url', 'https://dapi.qcv.vn');
    }

    /**
     * Get shared API credentials from database.
     */
    protected function getCredentials(): array
    {
        $creds = DB::table('user_dreamface_api_keys')->first();

        if (!$creds) {
            throw new \Exception('Chưa có API Key Dreamface nào được cấu hình trong hệ thống.');
        }

        return [
            'accountId' => $creds->account_id,
            'userId' => $creds->user_id_dreamface,
            'tokenId' => $creds->token_id,
            'clientId' => $creds->client_id,
        ];
    }

    /**
     * Upload video to Dreamface.
     */
    public function uploadVideo(string $videoContent, string $fileName): string
    {
        $creds = $this->getCredentials();

        $response = Http::attach(
            'file',
            $videoContent,
            $fileName
        )->post("{$this->baseUrl}/upload-video", [
            'accountId' => $creds['accountId'],
            'userId' => $creds['userId'],
            'tokenId' => $creds['tokenId'],
            'clientId' => $creds['clientId'],
        ]);

        if (!$response->successful()) {
            $this->handleApiError($response, 'upload-video');
        }

        $data = $response->json();
        $fileUrl = $data['file_url'] ?? null;

        if (!$fileUrl) {
            throw new \Exception('Did not receive file_url from video upload');
        }

        return $fileUrl;
    }

    /**
     * Get avatar list from Dreamface.
     */
    public function getAvatarList(): array
    {
        $creds = $this->getCredentials();

        $response = Http::get("{$this->baseUrl}/avatar-list", [
            ...$creds,
            'page_size' => 20,
        ]);

        if (!$response->successful()) {
            $this->handleApiError($response, 'avatar-list');
        }

        $data = $response->json();
        
        if (!($data['success'] ?? false) || !is_array($data['data']['avatars'] ?? null)) {
            throw new \Exception('Could not get avatar list. Response: ' . json_encode($data));
        }

        return $data['data']['avatars'];
    }

    /**
     * Find avatar by path.
     */
    public function findAvatarByPath(string $videoUrl): ?array
    {
        $avatars = $this->getAvatarList();
        
        foreach ($avatars as $avatar) {
            if ($avatar['path'] === $videoUrl) {
                return $avatar;
            }
        }

        return null;
    }

    /**
     * Upload voice/audio to Dreamface.
     */
    public function uploadVoice(string $audioContent, string $fileName, string $avatarId, string $avatarPath): array
    {
        $creds = $this->getCredentials();

        $response = Http::attach(
            'file',
            $audioContent,
            $fileName
        )->post("{$this->baseUrl}/upload-voice", [
            'accountId' => $creds['accountId'],
            'userId' => $creds['userId'],
            'tokenId' => $creds['tokenId'],
            'clientId' => $creds['clientId'],
            'avatarId' => $avatarId,
            'avatarPath' => $avatarPath,
        ]);

        if (!$response->successful()) {
            $this->handleApiError($response, 'upload-voice');
        }

        $data = $response->json();

        if (!($data['success'] ?? false)) {
            throw new \Exception('Audio upload failed: ' . json_encode($data));
        }

        $animateId = $data['video_data']['animate_id'] ?? $data['video_data']['animate_image_id'] ?? null;
        
        if (!$animateId) {
            throw new \Exception('Response from audio upload did not contain animate_id: ' . json_encode($data));
        }

        return [
            'animate_id' => $animateId,
            'thumbnail_url' => $data['video_data']['work_webp_path'] ?? null,
        ];
    }

    /**
     * Get task status from animate ID.
     */
    public function getTaskStatus(string $animateId): array
    {
        $creds = $this->getCredentials();

        $response = Http::get("{$this->baseUrl}/animate-status", [
            ...$creds,
            'animate_id' => $animateId,
        ]);

        if (!$response->successful()) {
            return [
                'status' => 'error',
                'error_message' => 'Failed to get task status',
            ];
        }

        $data = $response->json();

        // Parse status from response
        $status = $data['data']['status'] ?? 'unknown';
        $resultUrl = $data['data']['result_url'] ?? $data['data']['video_url'] ?? null;

        return [
            'raw_status' => $status,
            'status' => $this->mapStatus($status),
            'result_video_url' => $resultUrl,
            'thumbnail_url' => $data['data']['thumbnail_url'] ?? null,
        ];
    }

    /**
     * Map Dreamface status to our status.
     */
    protected function mapStatus(string $status): string
    {
        return match (strtolower($status)) {
            'pending', 'queued', 'waiting' => DreamfaceTask::STATUS_PENDING,
            'processing', 'running', 'in_progress' => DreamfaceTask::STATUS_PROCESSING,
            'completed', 'done', 'success', 'finished' => DreamfaceTask::STATUS_COMPLETED,
            'failed', 'error' => DreamfaceTask::STATUS_FAILED,
            default => DreamfaceTask::STATUS_PROCESSING,
        };
    }

    /**
     * Get download URL for completed video.
     */
    public function getDownloadUrl(string $path): string
    {
        $creds = $this->getCredentials();

        $response = Http::get("{$this->baseUrl}/download-url", [
            ...$creds,
            'path' => $path,
        ]);

        if (!$response->successful()) {
            throw new \Exception('Failed to get download URL');
        }

        $data = $response->json();
        return $data['url'] ?? $path;
    }

    /**
     * Process a pending task (full workflow).
     */
    public function processTask(DreamfaceTask $task): array
    {
        try {
            // 1. Fetch video from URL
            $videoResponse = Http::timeout(60)->get($task->original_video_url);
            if (!$videoResponse->successful()) {
                throw new \Exception("Failed to fetch video from: {$task->original_video_url}");
            }

            // 2. Fetch audio from URL
            $audioResponse = Http::timeout(60)->get($task->original_audio_url);
            if (!$audioResponse->successful()) {
                throw new \Exception("Failed to fetch audio from: {$task->original_audio_url}");
            }

            // 3. Upload video
            $videoFileName = basename(parse_url($task->original_video_url, PHP_URL_PATH)) ?: 'video.mp4';
            $uploadedVideoUrl = $this->uploadVideo($videoResponse->body(), $videoFileName);

            // 4. Wait a bit and find avatar
            sleep(2);
            $avatar = $this->findAvatarByPath($uploadedVideoUrl);
            
            if (!$avatar) {
                throw new \Exception('Could not find the uploaded video in the avatar list');
            }

            // 5. Upload audio
            $audioFileName = basename(parse_url($task->original_audio_url, PHP_URL_PATH)) ?: 'audio.mp3';
            $result = $this->uploadVoice(
                $audioResponse->body(),
                $audioFileName,
                $avatar['id'],
                $avatar['path']
            );

            // 6. Update task with animate_id
            $task->update([
                'animate_id' => $result['animate_id'],
                'thumbnail_url' => $result['thumbnail_url'],
                'status' => DreamfaceTask::STATUS_PROCESSING,
            ]);

            $this->logAction($task, 'process_complete', [
                'animate_id' => $result['animate_id'],
            ]);

            return [
                'success' => true,
                'animate_id' => $result['animate_id'],
            ];

        } catch (\Exception $e) {
            $task->update([
                'status' => DreamfaceTask::STATUS_FAILED,
                'error_message' => $e->getMessage(),
            ]);

            $this->logAction($task, 'process_failed', [
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Sync task status from API.
     */
    public function syncTaskStatus(DreamfaceTask $task): bool
    {
        if (!$task->animate_id) {
            return false;
        }

        try {
            $status = $this->getTaskStatus($task->animate_id);

            $updateData = ['status' => $status['status']];

            if ($status['result_video_url']) {
                $updateData['result_video_url'] = $status['result_video_url'];
            }

            if ($status['thumbnail_url'] && !$task->thumbnail_url) {
                $updateData['thumbnail_url'] = $status['thumbnail_url'];
            }

            $task->update($updateData);

            // Update linked idea if completed
            if ($status['status'] === DreamfaceTask::STATUS_COMPLETED && $task->idea_id) {
                DB::table('koc_content_ideas')
                    ->where('id', $task->idea_id)
                    ->update(['status' => 'Hoàn thành']);
            }

            return true;

        } catch (\Exception $e) {
            \Log::error("Failed to sync dreamface task {$task->id}: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Handle API error response.
     */
    protected function handleApiError($response, string $context): void
    {
        $errorText = $response->body();
        $errorMessage = "Dreamface API Error ({$context}): Status {$response->status()}.";
        
        try {
            $errorJson = json_decode($errorText, true);
            $errorMessage .= ' Message: ' . ($errorJson['msg'] ?? $errorJson['message'] ?? 'Unknown error');
        } catch (\Exception $e) {
            $errorMessage .= ' Response: ' . substr($errorText, 0, 500);
        }

        throw new \Exception($errorMessage);
    }

    /**
     * Log an action.
     */
    protected function logAction(DreamfaceTask $task, string $action, array $data = []): void
    {
        DreamfaceLog::create([
            'user_id' => $task->user_id,
            'dreamface_task_id' => $task->id,
            'action' => $action,
            'request_payload' => $data,
            'status_code' => 200,
        ]);
    }
}
