<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImageGenerationController extends Controller
{
    /**
     * Generate an image using Gemini API
     */
    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:5000'],
            'images_base64' => ['nullable', 'array', 'max:5'], // Max 5 images
            'images_base64.*' => ['string'], // Each item must be string
            'koc_id' => ['nullable', 'uuid'],
            'aspect_ratio' => ['nullable', 'string', 'in:1:1,16:9,9:16,4:3,3:4'],
            'image_size' => ['nullable', 'string', 'in:1K,2K'],
        ]);

        // Get API Key from settings
        $apiConfig = DB::table('user_image_gen_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$apiConfig) {
            return response()->json([
                'success' => false,
                'message' => 'Chưa cấu hình API Key cho Image Generation. Vui lòng vào Cài đặt > API Gen Ảnh.'
            ], 400);
        }

        // Create task record
        $taskId = Str::uuid()->toString();
        DB::table('image_generation_tasks')->insert([
            'id' => $taskId,
            'user_id' => $request->user()->id,
            'koc_id' => $validated['koc_id'] ?? null,
            'prompt' => $validated['prompt'],
            'aspect_ratio' => $validated['aspect_ratio'] ?? '1:1',
            'image_size' => $validated['image_size'] ?? '1K',
            'status' => 'processing',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            // Auto-fetch KOC's active avatar if koc_id is provided
            $avatarBase64 = null;
            if (!empty($validated['koc_id'])) {
                $activeAvatar = DB::table('koc_avatars')
                    ->where('koc_id', $validated['koc_id'])
                    ->where('user_id', $request->user()->id)
                    ->where('is_active', true)
                    ->where('status', 'completed')
                    ->first();

                if ($activeAvatar && $activeAvatar->image_url) {
                    // Extract path from URL and read from storage
                    $path = preg_replace('#^.*/storage/#', '', $activeAvatar->image_url);
                    if ($path && Storage::disk('public')->exists($path)) {
                        $imageData = Storage::disk('public')->get($path);
                        $avatarBase64 = base64_encode($imageData);
                    }
                }
            }

            // Merge avatar with user-provided images (avatar first for face consistency)
            $allImagesBase64 = [];
            if ($avatarBase64) {
                $allImagesBase64[] = $avatarBase64;
            }
            if (!empty($validated['images_base64']) && is_array($validated['images_base64'])) {
                $allImagesBase64 = array_merge($allImagesBase64, $validated['images_base64']);
            }
            // Limit to max 5 images total
            $allImagesBase64 = array_slice($allImagesBase64, 0, 5);

            // Build request parts - start with text prompt
            $parts = [
                ['text' => $validated['prompt']]
            ];

            // Add all reference images (including avatar)
            foreach ($allImagesBase64 as $imageBase64) {
                if (!empty($imageBase64)) {
                    $parts[] = [
                        'inline_data' => [
                            'mime_type' => 'image/jpeg',
                            'data' => $imageBase64
                        ]
                    ];
                }
            }

            // Build request body
            $requestBody = [
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => $parts
                    ]
                ],
                'generationConfig' => [
                    'responseModalities' => ['TEXT', 'IMAGE'],
                    'imageConfig' => [
                        'aspectRatio' => $validated['aspect_ratio'] ?? '1:1',
                        'imageSize' => $validated['image_size'] ?? '1K'
                    ]
                ]
            ];

            // Call Gemini API
            $response = Http::withHeaders([
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $apiConfig->api_key,
            ])->timeout(120)->post(
                'https://api.key4u.shop/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' . $apiConfig->api_key,
                $requestBody
            );

            if (!$response->successful()) {
                throw new \Exception('API Error: ' . $response->status() . ' - ' . $response->body());
            }

            $responseData = $response->json();

            // Parse response to extract image and text
            $resultImageUrl = null;
            $resultText = null;

            if (isset($responseData['candidates'][0]['content']['parts'])) {
                foreach ($responseData['candidates'][0]['content']['parts'] as $part) {
                    if (isset($part['text'])) {
                        $resultText = $part['text'];
                    }
                    if (isset($part['inlineData'])) {
                        // Save base64 image to storage
                        $imageData = base64_decode($part['inlineData']['data']);
                        $mimeType = $part['inlineData']['mimeType'] ?? 'image/png';
                        $extension = $mimeType === 'image/jpeg' ? 'jpg' : 'png';
                        $fileName = 'generated-images/' . $taskId . '.' . $extension;
                        
                        Storage::disk('public')->put($fileName, $imageData);
                        // Use request base URL to construct proper accessible URL
                        $resultImageUrl = $request->getSchemeAndHttpHost() . '/storage/' . $fileName;
                    }
                }
            }

            // Update task with result
            DB::table('image_generation_tasks')
                ->where('id', $taskId)
                ->update([
                    'status' => 'completed',
                    'result_image_url' => $resultImageUrl,
                    'result_text' => $resultText,
                    'updated_at' => now(),
                ]);

            $task = DB::table('image_generation_tasks')->where('id', $taskId)->first();

            return response()->json([
                'success' => true,
                'task' => $task,
            ]);

        } catch (\Exception $e) {
            // Update task with error
            DB::table('image_generation_tasks')
                ->where('id', $taskId)
                ->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tạo ảnh: ' . $e->getMessage(),
                'task_id' => $taskId,
            ], 500);
        }
    }

    /**
     * Get list of image generation tasks
     */
    public function tasks(Request $request): JsonResponse
    {
        $query = DB::table('image_generation_tasks')
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc');

        if ($request->has('koc_id') && $request->koc_id) {
            $query->where('koc_id', $request->koc_id);
        }

        $tasks = $query->get();

        return response()->json($tasks);
    }

    /**
     * Delete an image generation task
     */
    public function delete(Request $request, string $taskId): JsonResponse
    {
        $task = DB::table('image_generation_tasks')
            ->where('id', $taskId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$task) {
            return response()->json(['success' => false, 'message' => 'Task không tồn tại'], 404);
        }

        // Delete image file if exists
        if ($task->result_image_url) {
            // Extract path from URL (handles both /storage/path and full URL formats)
            $path = preg_replace('#^.*/storage/#', '', $task->result_image_url);
            if ($path && Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        }

        DB::table('image_generation_tasks')->where('id', $taskId)->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Download an image file
     */
    public function download(Request $request, string $taskId)
    {
        $task = DB::table('image_generation_tasks')
            ->where('id', $taskId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$task || !$task->result_image_url) {
            return response()->json(['success' => false, 'message' => 'File không tồn tại'], 404);
        }

        // Extract path from URL
        $path = preg_replace('#^.*/storage/#', '', $task->result_image_url);
        
        if (!$path || !Storage::disk('public')->exists($path)) {
            return response()->json(['success' => false, 'message' => 'File không tồn tại'], 404);
        }

        $filename = basename($path);
        
        return Storage::disk('public')->download($path, $filename);
    }
}
