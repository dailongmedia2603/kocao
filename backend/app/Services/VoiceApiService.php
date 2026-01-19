<?php

namespace App\Services;

use App\Models\ClonedVoice;
use App\Models\TtsLog;
use App\Models\User;
use App\Models\VoiceCloneLog;
use App\Models\VoiceTask;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;

class VoiceApiService
{
    protected string $baseUrl;
    protected ?string $apiKey = null;

    public function __construct()
    {
        $this->baseUrl = config('services.voice.api_url', 'https://gateway.vivoo.work');
    }

    /**
     * Set the API key for requests.
     */
    public function setApiKey(string $apiKey): self
    {
        $this->apiKey = $apiKey;
        return $this;
    }

    /**
     * Get shared API key from database.
     */
    protected function getApiKey(): string
    {
        if ($this->apiKey) {
            return $this->apiKey;
        }

        $keyRecord = \DB::table('user_voice_api_keys')->first();
        
        if (!$keyRecord) {
            throw new \Exception('Chưa có API Key Voice nào được cấu hình trong hệ thống.');
        }

        return $keyRecord->api_key;
    }

    /**
     * Create a text-to-speech task.
     */
    public function textToSpeech(User $user, array $params): array
    {
        $apiKey = $this->getApiKey();

        $response = Http::withHeaders([
            'xi-api-key' => $apiKey,
        ])->post("{$this->baseUrl}/v1m/task/text-to-speech", $params);

        $data = $response->json();

        // Log the request
        TtsLog::create([
            'user_id' => $user->id,
            'task_id' => $data['task_id'] ?? null,
            'request_payload' => $params,
            'response_body' => $data,
            'status_code' => $response->status(),
        ]);

        if (!$response->successful()) {
            throw new \Exception($data['message'] ?? 'Lỗi API Voice');
        }

        // Create voice task record
        if (isset($data['task_id'])) {
            VoiceTask::create([
                'id' => $data['task_id'],
                'user_id' => $user->id,
                'voice_name' => $params['voice_name'] ?? null,
                'status' => 'doing',
                'cloned_voice_id' => $params['voice_setting']['voice_id'] ?? null,
                'cloned_voice_name' => $params['cloned_voice_name'] ?? null,
                'task_type' => 'minimax_tts',
            ]);
        }

        return $data;
    }

    /**
     * Get task status.
     */
    public function getTaskStatus(string $taskId, string $userId): array
    {
        $apiKey = $this->getApiKey();

        $response = Http::withHeaders([
            'xi-api-key' => $apiKey,
        ])->get("{$this->baseUrl}/v1/task/{$taskId}");

        if (!$response->successful()) {
            throw new \Exception('Lỗi lấy trạng thái task');
        }

        return $response->json()['data'] ?? $response->json();
    }

    /**
     * Clone a voice.
     */
    public function cloneVoice(User $user, UploadedFile $file, string $voiceName, ?string $previewText = null): array
    {
        $apiKey = $this->getApiKey();
        
        // Read file content
        $fileContent = file_get_contents($file->getRealPath());
        $fileName = $file->getClientOriginalName();
        
        // Try up to 2 times with different timeout
        $attempts = 0;
        $maxAttempts = 2;
        $lastError = null;
        
        while ($attempts < $maxAttempts) {
            $attempts++;
            $timeout = $attempts === 1 ? 120 : 180; // Increase timeout on retry
            
            try {
                $response = Http::timeout($timeout)
                    ->connectTimeout(30)
                    ->withHeaders([
                        'xi-api-key' => $apiKey,
                    ])->attach(
                        'file', 
                        $fileContent, 
                        $fileName
                    )->post("{$this->baseUrl}/v1m/voice/clone", [
                        'voice_name' => $voiceName,
                        'preview_text' => $previewText,
                        'language_tag' => 'Vietnamese',
                    ]);

                $data = $response->json() ?? [];

                // Log the request
                VoiceCloneLog::create([
                    'user_id' => $user->id,
                    'request_url' => "{$this->baseUrl}/v1m/voice/clone",
                    'request_payload' => ['voice_name' => $voiceName, 'file_size' => strlen($fileContent)],
                    'response_body' => $data,
                    'status_code' => $response->status(),
                    'status_text' => $response->successful() ? 'OK' : 'Error',
                ]);

                // Check for success
                if ($response->successful() && ($data['success'] ?? false) === true) {
                    // Save cloned voice to database
                    if (isset($data['clone_voice_id'])) {
                        ClonedVoice::create([
                            'voice_id' => $data['clone_voice_id'],
                            'user_id' => $user->id,
                            'voice_name' => $voiceName,
                            'sample_audio' => $data['sample_audio'] ?? null,
                            'cover_url' => $data['cover_url'] ?? null,
                        ]);
                    }
                    return $data;
                }

                // Build detailed error message
                $errorMsg = $data['message'] ?? $data['error'] ?? null;
                if (!$errorMsg) {
                    $errorMsg = "API Error {$response->status()}";
                    if ($response->status() === 502) {
                        $errorMsg = "502 Bad Gateway - Server API đang quá tải hoặc không phản hồi. Vui lòng thử lại sau.";
                    } elseif ($response->status() === 503) {
                        $errorMsg = "503 Service Unavailable - Server API đang bảo trì.";
                    } elseif ($response->status() === 401) {
                        $errorMsg = "401 Unauthorized - API Key không hợp lệ.";
                    }
                }
                
                $lastError = $errorMsg;
                
                // Don't retry for auth errors
                if ($response->status() === 401 || $response->status() === 403) {
                    break;
                }
                
                // Wait before retry
                if ($attempts < $maxAttempts) {
                    sleep(2);
                }
                
            } catch (\Exception $e) {
                $lastError = $e->getMessage();
                
                // Log the error
                VoiceCloneLog::create([
                    'user_id' => $user->id,
                    'request_url' => "{$this->baseUrl}/v1m/voice/clone",
                    'request_payload' => ['voice_name' => $voiceName, 'attempt' => $attempts],
                    'response_body' => ['error' => $e->getMessage()],
                    'status_code' => 0,
                    'status_text' => 'Exception',
                ]);
                
                if ($attempts < $maxAttempts) {
                    sleep(2);
                }
            }
        }

        throw new \Exception($lastError ?? 'Lỗi clone giọng nói sau nhiều lần thử');
    }

    /**
     * Get list of cloned voices for user.
     */
    public function getClonedVoices(User $user): array
    {
        return ClonedVoice::where('user_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get()
            ->toArray();
    }

    /**
     * Delete a cloned voice.
     */
    public function deleteClonedVoice(User $user, string $voiceId): bool
    {
        $voice = ClonedVoice::where('user_id', $user->id)
            ->where('voice_id', $voiceId)
            ->first();

        if (!$voice) {
            return false;
        }

        // TODO: Call API to delete voice if needed

        $voice->delete();
        return true;
    }

    /**
     * Proxy request to Voice API.
     */
    public function proxy(string $path, string $method, array $body = []): array
    {
        $apiKey = $this->getApiKey();
        $url = "{$this->baseUrl}/" . ltrim($path, '/');
        $method = strtolower($method);

        if ($method == 'get') {
             $response = Http::withHeaders(['xi-api-key' => $apiKey])->get($url, $body);
        } else {
             $response = Http::withHeaders(['xi-api-key' => $apiKey])->$method($url, $body);
        }

        if (!$response->successful()) {
            throw new \Exception($response->json()['message'] ?? 'Lỗi API Voice: ' . $response->status());
        }

        return $response->json();
    }
}
