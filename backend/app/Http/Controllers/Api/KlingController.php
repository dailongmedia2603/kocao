<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class KlingController extends Controller
{
    /**
     * Store a job created from frontend
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'job_id' => ['required', 'string', 'unique:kling_video_jobs,job_id'],
            'koc_id' => ['nullable'],
            'prompt' => ['nullable', 'string'],
            'quality_mode' => ['nullable', 'string'],
        ]);

        // If koc_id is provided but not a valid UUID, just set it to null
        if (!empty($validated['koc_id']) && !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $validated['koc_id'])) {
            $validated['koc_id'] = null;
        }

        $localJobId = Str::uuid()->toString();
        
        DB::table('kling_video_jobs')->insert([
            'id' => $localJobId,
            'user_id' => $request->user()->id,
            'koc_id' => $validated['koc_id'] ?? null,
            'job_id' => $validated['job_id'],
            'status' => 'pending',
            'progress' => 0,
            'prompt' => $validated['prompt'] ?? null,
            'quality_mode' => $validated['quality_mode'] ?? 'Standard',
            'logs' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'id' => $localJobId,
            'message' => 'Job saved successfully'
        ]);
    }

    /**
     * Get Kling API config for the authenticated user
     */
    private function getKlingConfig(Request $request): ?object
    {
        return DB::table('user_kling_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();
    }

    /**
     * Upload a file to Kling API using raw binary
     * First tries to get upload URL, if that fails, uploads directly to VPS
     */
    private function uploadFileToKling(object $config, $file, string $fileType): array
    {
        $filePath = $file->getPathname();
        $fileBuffer = file_get_contents($filePath);
        $mimeType = $file->getMimeType();
        $fileName = $file->getClientOriginalName();

        \Log::info('Kling uploading file', [
            'type' => $fileType,
            'name' => $fileName,
            'size' => strlen($fileBuffer),
            'mimeType' => $mimeType,
        ]);

        try {
            // Try VPS upload endpoint directly with raw binary
            $uploadEndpoint = rtrim($config->api_url, '/') . '/api/automation/upload/' . $fileType;
            
            $client = new \GuzzleHttp\Client([
                'timeout' => 300,
                'connect_timeout' => 30,
            ]);

            $uploadResponse = $client->post($uploadEndpoint, [
                'body' => $fileBuffer,
                'headers' => [
                    'Content-Type' => $mimeType,
                    'Content-Length' => (string) strlen($fileBuffer),
                    'Origin' => 'https://app.klingai.com',
                    'Referer' => 'https://app.klingai.com/',
                    'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Cookie' => $config->cookie,
                    'X-Filename' => $fileName,
                ],
            ]);

            $responseBody = json_decode($uploadResponse->getBody()->getContents(), true);
            
            \Log::info('Kling file upload response', [
                'status' => $uploadResponse->getStatusCode(),
                'body' => $responseBody,
            ]);

            if ($uploadResponse->getStatusCode() >= 400) {
                \Log::error('Kling file upload failed', [
                    'status' => $uploadResponse->getStatusCode(),
                    'body' => $responseBody,
                ]);
                return ['success' => false, 'error' => $responseBody['message'] ?? 'File upload failed'];
            }

            return [
                'success' => true,
                'resourceId' => $responseBody['resourceId'] ?? $responseBody['id'] ?? null,
                'url' => $responseBody['url'] ?? $responseBody['fileUrl'] ?? null,
            ];

        } catch (\GuzzleHttp\Exception\ClientException $e) {
            // If 404, the VPS doesn't have separate upload endpoint
            // Fall back to returning file content for inline embedding
            if ($e->getResponse() && $e->getResponse()->getStatusCode() === 404) {
                \Log::info('VPS upload endpoint not found, will use inline upload');
                return [
                    'success' => true,
                    'useInline' => true,
                    'buffer' => base64_encode($fileBuffer),
                    'mimeType' => $mimeType,
                    'fileName' => $fileName,
                ];
            }
            
            \Log::error('Kling upload client exception', [
                'error' => $e->getMessage(),
                'response' => $e->hasResponse() ? $e->getResponse()->getBody()->getContents() : null,
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        } catch (\Exception $e) {
            \Log::error('Kling upload exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Generate a video using Kling API
     */
    public function generate(Request $request): JsonResponse
    {
        $config = $this->getKlingConfig($request);
        
        if (!$config) {
            return response()->json([
                'status' => 'error',
                'message' => 'Chưa cấu hình Kling API. Vui lòng vào Cài đặt > API Kling để thiết lập.'
            ], 400);
        }

        // Handle 'none' value from frontend as null
        if ($request->input('koc_id') === 'none' || $request->input('koc_id') === '') {
            $request->merge(['koc_id' => null]);
        }

        // Debug logging
        \Log::info('Kling generate request', [
            'has_video' => $request->hasFile('video'),
            'has_image' => $request->hasFile('image'),
            'koc_id' => $request->input('koc_id'),
            'prompt' => $request->input('prompt'),
            'quality_mode' => $request->input('quality_mode'),
            'all_files' => array_keys($request->allFiles()),
        ]);

        try {
            $validated = $request->validate([
                'koc_id' => ['nullable'],
                'prompt' => ['nullable', 'string', 'max:2000'],
                'quality_mode' => ['nullable', 'string'],
                'video' => ['required', 'file'],
                'image' => ['nullable', 'file'],
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Kling validation failed', [
                'errors' => $e->errors(),
                'request_data' => $request->all(),
            ]);
            throw $e;
        }

        // If koc_id is provided but not a valid UUID, just set it to null
        if (!empty($validated['koc_id']) && !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $validated['koc_id'])) {
            $validated['koc_id'] = null;
        }

        try {
            // Upload video file as raw binary
            $videoFile = $request->file('video');
            $videoUploadResult = $this->uploadFileToKling($config, $videoFile, 'video');
            
            if (!$videoUploadResult['success']) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không thể upload video: ' . ($videoUploadResult['error'] ?? 'Unknown error')
                ], 500);
            }

            // Upload image file if provided
            $imageUploadResult = null;
            if ($request->hasFile('image')) {
                $imageFile = $request->file('image');
                $imageUploadResult = $this->uploadFileToKling($config, $imageFile, 'image');
                
                if (!$imageUploadResult['success']) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Không thể upload ảnh: ' . ($imageUploadResult['error'] ?? 'Unknown error')
                    ], 500);
                }
            }

            // Check if we need to use inline upload (VPS doesn't have separate upload endpoint)
            $useInlineUpload = !empty($videoUploadResult['useInline']);

            if ($useInlineUpload) {
                // Build multipart request with raw binary files and correct headers
                $multipart = [
                    [
                        'name' => 'mode',
                        'contents' => 'video-motion-control'
                    ],
                    [
                        'name' => 'cookie',
                        'contents' => $config->cookie
                    ],
                    [
                        'name' => 'qualityMode',
                        'contents' => $validated['quality_mode'] ?? 'Standard'
                    ],
                ];
                
                if (!empty($validated['prompt'])) {
                    $multipart[] = [
                        'name' => 'prompt',
                        'contents' => $validated['prompt']
                    ];
                }
                
                // Add video file with correct Content-Type
                $multipart[] = [
                    'name' => 'video',
                    'contents' => file_get_contents($videoFile->getPathname()),
                    'filename' => $videoFile->getClientOriginalName(),
                    'headers' => [
                        'Content-Type' => $videoFile->getMimeType()
                    ]
                ];
                
                // Add image file if provided
                if ($imageUploadResult) {
                    $imageFile = $request->file('image');
                    $multipart[] = [
                        'name' => 'image',
                        'contents' => file_get_contents($imageFile->getPathname()),
                        'filename' => $imageFile->getClientOriginalName(),
                        'headers' => [
                            'Content-Type' => $imageFile->getMimeType()
                        ]
                    ];
                }
                
                \Log::info('Kling calling generate with multipart + correct headers');
                
                $client = new \GuzzleHttp\Client([
                    'timeout' => 300,
                    'connect_timeout' => 30,
                ]);
                
                $guzzleResponse = $client->post(
                    rtrim($config->api_url, '/') . '/api/automation/generate',
                    [
                        'multipart' => $multipart,
                        'headers' => [
                            'Origin' => 'https://app.klingai.com',
                            'Referer' => 'https://app.klingai.com/',
                            'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        ]
                    ]
                );
                
                $responseBody = json_decode($guzzleResponse->getBody()->getContents(), true);
                
                \Log::info('Kling generate response (multipart)', [
                    'status' => $guzzleResponse->getStatusCode(),
                    'body' => $responseBody,
                ]);

                if ($guzzleResponse->getStatusCode() >= 400) {
                    return response()->json([
                        'status' => 'error',
                        'message' => $responseBody['message'] ?? 'Lỗi từ Kling API',
                        'details' => $responseBody['details'] ?? null
                    ], $guzzleResponse->getStatusCode());
                }
                
                $jobId = $responseBody['jobId'] ?? null;
            } else {
                // Call generate endpoint with JSON body containing resource IDs
                $generatePayload = [
                    'mode' => 'video-motion-control',
                    'cookie' => $config->cookie,
                    'qualityMode' => $validated['quality_mode'] ?? 'Standard',
                    'videoResourceId' => $videoUploadResult['resourceId'],
                ];

                if (!empty($validated['prompt'])) {
                    $generatePayload['prompt'] = $validated['prompt'];
                }

                if ($imageUploadResult && !empty($imageUploadResult['resourceId'])) {
                    $generatePayload['imageResourceId'] = $imageUploadResult['resourceId'];
                }

                \Log::info('Kling calling generate endpoint', [
                    'endpoint' => rtrim($config->api_url, '/') . '/api/automation/generate',
                    'payload' => array_merge($generatePayload, ['cookie' => '[REDACTED]']),
                ]);

                $response = Http::timeout(120)
                    ->withHeaders([
                        'Content-Type' => 'application/json',
                        'Origin' => 'https://app.klingai.com',
                        'Referer' => 'https://app.klingai.com/',
                        'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    ])
                    ->post(rtrim($config->api_url, '/') . '/api/automation/generate', $generatePayload);

                $responseBody = $response->json();
            
                \Log::info('Kling generate response (JSON)', [
                    'status' => $response->status(),
                    'body' => $responseBody,
                ]);

                if (!$response->successful()) {
                    return response()->json([
                        'status' => 'error',
                        'message' => $responseBody['message'] ?? 'Lỗi từ Kling API',
                        'details' => $responseBody['details'] ?? null
                    ], $response->status());
                }

                $jobId = $responseBody['jobId'] ?? null;
            }

            if (!$jobId) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Không nhận được Job ID từ Kling API'
                ], 500);
            }

            // Save job to database
            $localJobId = Str::uuid()->toString();
            DB::table('kling_video_jobs')->insert([
                'id' => $localJobId,
                'user_id' => $request->user()->id,
                'koc_id' => $validated['koc_id'] ?? null,
                'job_id' => $jobId,
                'status' => 'pending',
                'progress' => 0,
                'prompt' => $validated['prompt'] ?? null,
                'quality_mode' => $validated['quality_mode'] ?? 'Standard',
                'logs' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return response()->json([
                'status' => 'success',
                'id' => $localJobId,
                'jobId' => $jobId,
                'message' => $responseBody['message'] ?? 'Job submitted successfully',
                'queuePosition' => $responseBody['queuePosition'] ?? 0
            ]);

        } catch (\Exception $e) {
            \Log::error('Kling generate exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi kết nối Kling API: ' . $e->getMessage()
            ], 500);
        }
    }


    /**
     * Get status of a specific job
     */
    public function status(Request $request, string $jobId): JsonResponse
    {
        $config = $this->getKlingConfig($request);
        
        if (!$config) {
            return response()->json([
                'status' => 'error',
                'message' => 'Chưa cấu hình Kling API.'
            ], 400);
        }

        // Find local job record
        $job = DB::table('kling_video_jobs')
            ->where('user_id', $request->user()->id)
            ->where(function ($query) use ($jobId) {
                $query->where('id', $jobId)
                      ->orWhere('job_id', $jobId);
            })
            ->first();

        if (!$job) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy job'
            ], 404);
        }

        // If already completed or failed, return cached result
        if (in_array($job->status, ['completed', 'failed'])) {
            return response()->json([
                'status' => 'success',
                'data' => [
                    'id' => $job->id,
                    'job_id' => $job->job_id,
                    'status' => $job->status,
                    'progress' => $job->progress,
                    'logs' => json_decode($job->logs ?? '[]'),
                    'result_video_url' => $job->result_video_url,
                    'error_message' => $job->error_message,
                    'koc_id' => $job->koc_id,
                ]
            ]);
        }

        // Poll Kling API for fresh status
        try {
            $response = Http::timeout(30)
                ->get(rtrim($config->api_url, '/') . '/api/automation/status/' . $job->job_id);

            if (!$response->successful()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Lỗi lấy trạng thái từ Kling API'
                ], $response->status());
            }

            $result = $response->json();
            $data = $result['data'] ?? [];

            // Update local job record
            $updateData = [
                'status' => $data['status'] ?? $job->status,
                'progress' => $data['progress'] ?? $job->progress,
                'logs' => json_encode($data['logs'] ?? []),
                'updated_at' => now(),
            ];

            if ($data['status'] === 'completed' && isset($data['result']['videoUrl'])) {
                $updateData['result_video_url'] = $data['result']['videoUrl'];
            }

            if ($data['status'] === 'failed') {
                $updateData['error_message'] = $data['error'] ?? 'Unknown error';
            }

            DB::table('kling_video_jobs')
                ->where('id', $job->id)
                ->update($updateData);

            return response()->json([
                'status' => 'success',
                'data' => [
                    'id' => $job->id,
                    'job_id' => $job->job_id,
                    'status' => $updateData['status'],
                    'progress' => $updateData['progress'],
                    'logs' => $data['logs'] ?? [],
                    'result_video_url' => $updateData['result_video_url'] ?? null,
                    'error_message' => $updateData['error_message'] ?? null,
                    'koc_id' => $job->koc_id,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Lỗi kết nối: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * List all jobs for the authenticated user
     */
    public function listJobs(Request $request): JsonResponse
    {
        $kocId = $request->query('koc_id');
        
        $query = DB::table('kling_video_jobs')
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc');

        if ($kocId) {
            $query->where('koc_id', $kocId);
        }

        $jobs = $query->get()->map(function ($job) {
            return [
                'id' => $job->id,
                'job_id' => $job->job_id,
                'koc_id' => $job->koc_id,
                'status' => $job->status,
                'progress' => $job->progress,
                'prompt' => $job->prompt,
                'quality_mode' => $job->quality_mode,
                'result_video_url' => $job->result_video_url,
                'error_message' => $job->error_message,
                'logs' => json_decode($job->logs ?? '[]'),
                'created_at' => $job->created_at,
                'updated_at' => $job->updated_at,
            ];
        });

        return response()->json($jobs);
    }

    /**
     * Delete a job
     */
    public function deleteJob(Request $request, string $jobId): JsonResponse
    {
        $deleted = DB::table('kling_video_jobs')
            ->where('user_id', $request->user()->id)
            ->where('id', $jobId)
            ->delete();

        if (!$deleted) {
            return response()->json([
                'status' => 'error',
                'message' => 'Không tìm thấy job hoặc không có quyền xóa'
            ], 404);
        }

        return response()->json(['status' => 'success']);
    }
}
