<?php

namespace App\Jobs;

use App\Models\ClonedVoice;
use App\Models\User;
use App\Models\VoiceCloneLog;
use App\Services\VoiceApiService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class CloneVoiceJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 2;

    /**
     * The number of seconds the job can run before timing out.
     */
    public int $timeout = 300;

    /**
     * The number of seconds to wait before retrying.
     */
    public int $backoff = 10;

    protected string $userId;
    protected string $voiceName;
    protected ?string $previewText;
    protected string $tempFilePath;
    protected string $fileName;
    protected string $logId;

    /**
     * Create a new job instance.
     */
    public function __construct(
        string $userId,
        string $voiceName,
        ?string $previewText,
        string $tempFilePath,
        string $fileName,
        string $logId
    ) {
        $this->userId = $userId;
        $this->voiceName = $voiceName;
        $this->previewText = $previewText;
        $this->tempFilePath = $tempFilePath;
        $this->fileName = $fileName;
        $this->logId = $logId;
    }

    /**
     * Execute the job.
     */
    public function handle(VoiceApiService $voiceService): void
    {
        $log = VoiceCloneLog::find($this->logId);
        
        try {
            // Read file from temp storage
            $fileContent = Storage::disk('local')->get($this->tempFilePath);
            
            if (!$fileContent) {
                throw new \Exception('File not found in temp storage');
            }

            // Get API key
            $keyRecord = \DB::table('user_voice_api_keys')->first();
            if (!$keyRecord) {
                throw new \Exception('No Voice API key configured');
            }
            $apiKey = $keyRecord->api_key;
            $baseUrl = config('services.voice.api_url', 'https://gateway.vivoo.work');

            // Make API request
            $response = Http::timeout(180)
                ->connectTimeout(30)
                ->withHeaders([
                    'xi-api-key' => $apiKey,
                ])->attach(
                    'file', 
                    $fileContent, 
                    $this->fileName
                )->post("{$baseUrl}/v1m/voice/clone", [
                    'voice_name' => $this->voiceName,
                    'preview_text' => $this->previewText,
                    'language_tag' => 'Vietnamese',
                ]);

            $data = $response->json() ?? [];

            // Update log
            if ($log) {
                $log->update([
                    'response_body' => $data,
                    'status_code' => $response->status(),
                    'status_text' => $response->successful() ? 'OK' : 'Error',
                ]);
            }

            // Check for success
            if ($response->successful() && ($data['success'] ?? false) === true) {
                // Save cloned voice to database
                if (isset($data['clone_voice_id'])) {
                    $clonedVoice = ClonedVoice::create([
                        'voice_id' => $data['clone_voice_id'],
                        'user_id' => $this->userId,
                        'voice_name' => $this->voiceName,
                        'sample_audio' => $data['sample_audio'] ?? null,
                        'cover_url' => $data['cover_url'] ?? null,
                    ]);

                    // Auto-generate sample audio using TTS if preview_text is provided
                    if ($this->previewText && !$clonedVoice->sample_audio) {
                        try {
                            $ttsResponse = Http::timeout(60)
                                ->withHeaders([
                                    'xi-api-key' => $apiKey,
                                ])->post("{$baseUrl}/v1m/task/text-to-speech", [
                                    'text' => $this->previewText,
                                    'voice_name' => 'clone_voice',
                                    'voice_setting' => [
                                        'voice_id' => $data['clone_voice_id'],
                                    ],
                                ]);

                            if ($ttsResponse->successful()) {
                                $ttsData = $ttsResponse->json();
                                if (isset($ttsData['task_id'])) {
                                    // Create VoiceTask to track and sync the sample audio
                                    \App\Models\VoiceTask::create([
                                        'id' => $ttsData['task_id'],
                                        'user_id' => $this->userId,
                                        'voice_name' => 'clone_voice',
                                        'status' => 'doing',
                                        'cloned_voice_id' => $data['clone_voice_id'],
                                        'cloned_voice_name' => $this->voiceName,
                                        'task_type' => 'clone_sample',
                                    ]);
                                    \Log::info("CloneVoiceJob: Created TTS task {$ttsData['task_id']} for sample audio");
                                }
                            }
                        } catch (\Exception $e) {
                            \Log::warning("CloneVoiceJob: Failed to create sample audio TTS - {$e->getMessage()}");
                        }
                    }
                }
                
                \Log::info("CloneVoiceJob: Successfully cloned voice '{$this->voiceName}' for user {$this->userId}");
            } else {
                $errorMsg = $data['message'] ?? $data['error'] ?? "API Error {$response->status()}";
                \Log::error("CloneVoiceJob: Failed - {$errorMsg}");
                
                if ($log) {
                    $log->update(['status_text' => "Error: {$errorMsg}"]);
                }
            }

        } catch (\Exception $e) {
            \Log::error("CloneVoiceJob: Exception - {$e->getMessage()}");
            
            if ($log) {
                $log->update([
                    'status_code' => 0,
                    'status_text' => "Exception: {$e->getMessage()}",
                    'response_body' => ['error' => $e->getMessage()],
                ]);
            }

            throw $e;
        } finally {
            // Clean up temp file
            Storage::disk('local')->delete($this->tempFilePath);
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        \Log::error("CloneVoiceJob completely failed for voice '{$this->voiceName}': {$exception->getMessage()}");
        
        // Clean up temp file on failure
        Storage::disk('local')->delete($this->tempFilePath);
    }
}
