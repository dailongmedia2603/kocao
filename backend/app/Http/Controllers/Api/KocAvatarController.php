<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class KocAvatarController extends Controller
{
    /**
     * Get list of avatars for a KOC
     */
    public function index(Request $request, string $kocId): JsonResponse
    {
        $avatars = DB::table('koc_avatars')
            ->where('koc_id', $kocId)
            ->where('user_id', $request->user()->id)
            ->orderBy('is_active', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($avatars);
    }

    /**
     * Generate an avatar using AI (Gemini API)
     */
    public function generate(Request $request, string $kocId): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string', 'max:5000'],
            'images_base64' => ['nullable', 'array', 'max:5'],
            'images_base64.*' => ['string'],
        ]);

        // Verify KOC belongs to user
        $koc = DB::table('kocs')
            ->where('id', $kocId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$koc) {
            return response()->json(['success' => false, 'message' => 'KOC không tồn tại'], 404);
        }

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

        // Check if this is the first avatar - will be set as active
        $hasActiveAvatar = DB::table('koc_avatars')
            ->where('koc_id', $kocId)
            ->where('user_id', $request->user()->id)
            ->where('is_active', true)
            ->exists();

        // Create avatar record
        $avatarId = Str::uuid()->toString();
        DB::table('koc_avatars')->insert([
            'id' => $avatarId,
            'user_id' => $request->user()->id,
            'koc_id' => $kocId,
            'prompt' => $validated['prompt'],
            'source' => 'generated',
            'status' => 'processing',
            'is_active' => !$hasActiveAvatar, // Set active if no other active avatar
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            // Build request parts - start with text prompt
            $parts = [
                ['text' => $validated['prompt']]
            ];

            // Add multiple reference images if provided
            if (!empty($validated['images_base64']) && is_array($validated['images_base64'])) {
                foreach ($validated['images_base64'] as $imageBase64) {
                    if (!empty($imageBase64)) {
                        $parts[] = [
                            'inline_data' => [
                                'mime_type' => 'image/jpeg',
                                'data' => $imageBase64
                            ]
                        ];
                    }
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
                        'aspectRatio' => '1:1',
                        'imageSize' => '1K'
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

            // Parse response to extract image
            $resultImageUrl = null;

            if (isset($responseData['candidates'][0]['content']['parts'])) {
                foreach ($responseData['candidates'][0]['content']['parts'] as $part) {
                    if (isset($part['inlineData'])) {
                        // Save base64 image to storage
                        $imageData = base64_decode($part['inlineData']['data']);
                        $mimeType = $part['inlineData']['mimeType'] ?? 'image/png';
                        $extension = $mimeType === 'image/jpeg' ? 'jpg' : 'png';
                        $fileName = 'koc-avatars/' . $avatarId . '.' . $extension;
                        
                        Storage::disk('public')->put($fileName, $imageData);
                        $resultImageUrl = $request->getSchemeAndHttpHost() . '/storage/' . $fileName;
                        break;
                    }
                }
            }

            if (!$resultImageUrl) {
                throw new \Exception('API không trả về ảnh. Vui lòng thử lại với prompt khác.');
            }

            // Update avatar with result
            DB::table('koc_avatars')
                ->where('id', $avatarId)
                ->update([
                    'status' => 'completed',
                    'image_url' => $resultImageUrl,
                    'updated_at' => now(),
                ]);

            $avatar = DB::table('koc_avatars')->where('id', $avatarId)->first();

            return response()->json([
                'success' => true,
                'avatar' => $avatar,
            ]);

        } catch (\Exception $e) {
            // Update avatar with error
            DB::table('koc_avatars')
                ->where('id', $avatarId)
                ->update([
                    'status' => 'failed',
                    'error_message' => $e->getMessage(),
                    'updated_at' => now(),
                ]);

            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tạo avatar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload an avatar image
     */
    public function upload(Request $request, string $kocId): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'image', 'max:10240'], // Max 10MB
        ]);

        // Verify KOC belongs to user
        $koc = DB::table('kocs')
            ->where('id', $kocId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$koc) {
            return response()->json(['success' => false, 'message' => 'KOC không tồn tại'], 404);
        }

        try {
            // Check if this is the first avatar - will be set as active
            $hasActiveAvatar = DB::table('koc_avatars')
                ->where('koc_id', $kocId)
                ->where('user_id', $request->user()->id)
                ->where('is_active', true)
                ->exists();

            $avatarId = Str::uuid()->toString();
            $file = $request->file('file');
            $extension = $file->getClientOriginalExtension() ?: 'png';
            $fileName = 'koc-avatars/' . $avatarId . '.' . $extension;

            // Store the file
            Storage::disk('public')->put($fileName, file_get_contents($file));
            $imageUrl = $request->getSchemeAndHttpHost() . '/storage/' . $fileName;

            // Create avatar record
            DB::table('koc_avatars')->insert([
                'id' => $avatarId,
                'user_id' => $request->user()->id,
                'koc_id' => $kocId,
                'image_url' => $imageUrl,
                'source' => 'uploaded',
                'status' => 'completed',
                'is_active' => !$hasActiveAvatar, // Set active if no other active avatar
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $avatar = DB::table('koc_avatars')->where('id', $avatarId)->first();

            return response()->json([
                'success' => true,
                'avatar' => $avatar,
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi khi tải lên avatar: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Set an avatar as the active avatar for the KOC
     */
    public function setActive(Request $request, string $kocId, string $avatarId): JsonResponse
    {
        // Verify avatar exists and belongs to user
        $avatar = DB::table('koc_avatars')
            ->where('id', $avatarId)
            ->where('koc_id', $kocId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$avatar) {
            return response()->json(['success' => false, 'message' => 'Avatar không tồn tại'], 404);
        }

        // Deactivate all other avatars for this KOC
        DB::table('koc_avatars')
            ->where('koc_id', $kocId)
            ->where('user_id', $request->user()->id)
            ->update(['is_active' => false, 'updated_at' => now()]);

        // Activate this avatar
        DB::table('koc_avatars')
            ->where('id', $avatarId)
            ->update(['is_active' => true, 'updated_at' => now()]);

        $updatedAvatar = DB::table('koc_avatars')->where('id', $avatarId)->first();

        return response()->json([
            'success' => true,
            'avatar' => $updatedAvatar,
        ]);
    }

    /**
     * Delete an avatar
     */
    public function destroy(Request $request, string $kocId, string $avatarId): JsonResponse
    {
        $avatar = DB::table('koc_avatars')
            ->where('id', $avatarId)
            ->where('koc_id', $kocId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$avatar) {
            return response()->json(['success' => false, 'message' => 'Avatar không tồn tại'], 404);
        }

        // Delete image file if exists
        if ($avatar->image_url) {
            $path = preg_replace('#^.*/storage/#', '', $avatar->image_url);
            if ($path && Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);
            }
        }

        $wasActive = $avatar->is_active;

        DB::table('koc_avatars')->where('id', $avatarId)->delete();

        // If deleted avatar was active, set another one as active
        if ($wasActive) {
            $nextAvatar = DB::table('koc_avatars')
                ->where('koc_id', $kocId)
                ->where('user_id', $request->user()->id)
                ->where('status', 'completed')
                ->orderBy('created_at', 'desc')
                ->first();

            if ($nextAvatar) {
                DB::table('koc_avatars')
                    ->where('id', $nextAvatar->id)
                    ->update(['is_active' => true, 'updated_at' => now()]);
            }
        }

        return response()->json(['success' => true]);
    }

    /**
     * Download an avatar image
     */
    public function download(Request $request, string $kocId, string $avatarId)
    {
        $avatar = DB::table('koc_avatars')
            ->where('id', $avatarId)
            ->where('koc_id', $kocId)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$avatar || !$avatar->image_url) {
            return response()->json(['success' => false, 'message' => 'File không tồn tại'], 404);
        }

        // Extract path from URL
        $path = preg_replace('#^.*/storage/#', '', $avatar->image_url);
        
        if (!$path || !Storage::disk('public')->exists($path)) {
            return response()->json(['success' => false, 'message' => 'File không tồn tại'], 404);
        }

        $filename = basename($path);
        
        return Storage::disk('public')->download($path, $filename);
    }
}
