<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    // ==================== TikTok ====================

    public function getTiktok(Request $request): JsonResponse
    {
        $token = DB::table('user_tiktok_tokens')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_token' => (bool) $token,
            'check_url' => $token?->check_url,
        ]);
    }

    public function saveTiktok(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'access_token' => ['required', 'string'],
            'check_url' => ['nullable', 'string'],
        ]);

        $existing = DB::table('user_tiktok_tokens')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_tiktok_tokens')
                ->where('user_id', $request->user()->id)
                ->update([
                    'access_token' => $validated['access_token'],
                    'check_url' => $validated['check_url'] ?? null,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_tiktok_tokens')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'access_token' => $validated['access_token'],
                'check_url' => $validated['check_url'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function checkTiktok(Request $request): JsonResponse
    {
        // TODO: Validate token with TikTok API
        return response()->json(['valid' => true]);
    }

    // ==================== Facebook ====================

    public function getFacebook(Request $request): JsonResponse
    {
        $token = DB::table('user_facebook_tokens')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_token' => (bool) $token,
            'check_url' => $token?->check_url,
        ]);
    }

    public function saveFacebook(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'access_token' => ['required', 'string'],
            'check_url' => ['nullable', 'string'],
        ]);

        $existing = DB::table('user_facebook_tokens')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_facebook_tokens')
                ->where('user_id', $request->user()->id)
                ->update([
                    'access_token' => $validated['access_token'],
                    'check_url' => $validated['check_url'] ?? null,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_facebook_tokens')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'access_token' => $validated['access_token'],
                'check_url' => $validated['check_url'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function checkFacebook(Request $request): JsonResponse
    {
        // TODO: Validate token with Facebook API
        return response()->json(['valid' => true]);
    }

    // ==================== Dreamface ====================

    public function getDreamface(Request $request): JsonResponse
    {
        // Get system-wide dreamface credentials (admin only)
        $creds = DB::table('user_dreamface_api_keys')->first();

        return response()->json([
            'has_credentials' => (bool) $creds,
        ]);
    }

    public function saveDreamface(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'account_id' => ['required', 'string'],
            'user_id_dreamface' => ['required', 'string'],
            'token_id' => ['required', 'string'],
            'client_id' => ['required', 'string'],
        ]);

        $existing = DB::table('user_dreamface_api_keys')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_dreamface_api_keys')
                ->where('user_id', $request->user()->id)
                ->update([
                    'account_id' => $validated['account_id'],
                    'user_id_dreamface' => $validated['user_id_dreamface'],
                    'token_id' => $validated['token_id'],
                    'client_id' => $validated['client_id'],
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_dreamface_api_keys')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'account_id' => $validated['account_id'],
                'user_id_dreamface' => $validated['user_id_dreamface'],
                'token_id' => $validated['token_id'],
                'client_id' => $validated['client_id'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    // ==================== Voice API ====================

    public function getVoiceApi(Request $request): JsonResponse
    {
        $key = DB::table('user_voice_api_keys')->first();

        return response()->json([
            'has_key' => (bool) $key,
        ]);
    }

    public function saveVoiceApi(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => ['required', 'string'],
        ]);

        // System-wide key (admin only)
        $existing = DB::table('user_voice_api_keys')
             ->where('user_id', $request->user()->id)
             ->first();

        if ($existing) {
             DB::table('user_voice_api_keys')
                 ->where('user_id', $request->user()->id)
                 ->update([
                     'api_key' => $validated['api_key'],
                     'updated_at' => now(),
                 ]);
        } else {
             DB::table('user_voice_api_keys')->insert([
                 'id' => Str::uuid()->toString(),
                 'user_id' => $request->user()->id,
                 'api_key' => $validated['api_key'],
                 'created_at' => now(),
                 'updated_at' => now(),
             ]);
        }

        return response()->json(['success' => true]);
    }

    // ==================== Vertex AI ====================

    public function getVertexAi(Request $request): JsonResponse
    {
        $creds = DB::table('user_vertex_ai_credentials')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_credentials' => (bool) $creds,
        ]);
    }

    public function saveVertexAi(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'credentials' => ['required', 'array'],
        ]);

        $existing = DB::table('user_vertex_ai_credentials')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_vertex_ai_credentials')
                ->where('user_id', $request->user()->id)
                ->update([
                    'credentials' => json_encode($validated['credentials']),
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_vertex_ai_credentials')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'credentials' => json_encode($validated['credentials']),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }




    // ==================== Troll LLM ====================

    public function getTrollLlm(Request $request): JsonResponse
    {
        $key = DB::table('user_troll_llm_api_keys')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_key' => (bool) $key,
            'base_url' => $key->base_url ?? 'https://chat.trollllm.xyz/v1',
            'model' => $key->model ?? 'gemini-3-pro-preview',
        ]);
    }

    public function saveTrollLlm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => ['required', 'string'],
            'base_url' => ['nullable', 'string', 'url'],
            'model' => ['nullable', 'string'],
        ]);

        $baseUrl = $validated['base_url'] ?? 'https://chat.trollllm.xyz/v1';
        $model = $validated['model'] ?? 'gemini-3-pro-preview';

        $existing = DB::table('user_troll_llm_api_keys')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_troll_llm_api_keys')
                ->where('user_id', $request->user()->id)
                ->update([
                    'api_key' => $validated['api_key'],
                    'base_url' => $baseUrl,
                    'model' => $model,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_troll_llm_api_keys')->insert([
                'id' => \Illuminate\Support\Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'api_key' => $validated['api_key'],
                'base_url' => $baseUrl,
                'model' => $model,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function checkTrollLlm(Request $request): JsonResponse
    {
        $key = DB::table('user_troll_llm_api_keys')
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$key) {
             return response()->json(['valid' => false, 'message' => 'API Key not found'], 404);
        }

        try {
            $baseUrl = rtrim($key->base_url ?? 'https://chat.trollllm.xyz/v1', '/');
            $model = $key->model ?? 'gemini-3-pro-preview';

            $response = \Illuminate\Support\Facades\Http::withToken($key->api_key)
                ->post($baseUrl . '/chat/completions', [
                    'model' => $model, 
                    'messages' => [
                        ['role' => 'user', 'content' => 'Hello']
                    ],
                    'max_tokens' => 5
                ]);

            if ($response->successful()) {
                return response()->json(['valid' => true]);
            }

            return response()->json([
                'valid' => false,
                'message' => 'API Check Failed: ' . $response->status() . ' - ' . $response->body()
            ], 400);

        } catch (\Exception $e) {
            return response()->json(['valid' => false, 'message' => $e->getMessage()], 500);
        }
    }

    // ==================== DELETE METHODS ====================

    public function deleteTiktok(Request $request): JsonResponse
    {
        DB::table('user_tiktok_tokens')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function deleteFacebook(Request $request): JsonResponse
    {
        DB::table('user_facebook_tokens')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function deleteDreamface(Request $request): JsonResponse
    {
        DB::table('user_dreamface_api_keys')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function deleteVoiceApi(Request $request): JsonResponse
    {
        DB::table('user_voice_api_keys')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function deleteVertexAi(Request $request): JsonResponse
    {
        DB::table('user_vertex_ai_credentials')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }





    public function deleteTrollLlm(Request $request): JsonResponse
    {
        DB::table('user_troll_llm_api_keys')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function checkVoiceApi(Request $request): JsonResponse
    {
        try {
            $service = new \App\Services\VoiceApiService();
            // Call credits endpoint to verify key
            $service->proxy('v1/credits', 'GET');
            
            return response()->json(['valid' => true]);
        } catch (\Exception $e) {
            return response()->json([
                'valid' => false, 
                'message' => 'Lỗi kiểm tra API Key: ' . $e->getMessage()
            ], 400);
        }
    }

    // ==================== Kling API ====================

    public function getKlingApi(Request $request): JsonResponse
    {
        $config = DB::table('user_kling_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_config' => (bool) $config,
            'api_url' => $config?->api_url,
            'cookie' => $config?->cookie,
        ]);
    }

    public function saveKlingApi(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_url' => ['required', 'string', 'url'],
            'cookie' => ['required', 'string', 'min:10'],
        ]);

        $existing = DB::table('user_kling_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_kling_api_configs')
                ->where('user_id', $request->user()->id)
                ->update([
                    'api_url' => $validated['api_url'],
                    'cookie' => $validated['cookie'],
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_kling_api_configs')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'api_url' => $validated['api_url'],
                'cookie' => $validated['cookie'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function deleteKlingApi(Request $request): JsonResponse
    {
        DB::table('user_kling_api_configs')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function checkKlingApi(Request $request): JsonResponse
    {
        $config = DB::table('user_kling_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$config) {
            return response()->json(['valid' => false, 'message' => 'Chưa cấu hình Kling API'], 404);
        }

        try {
            $response = \Illuminate\Support\Facades\Http::post(
                rtrim($config->api_url, '/') . '/api/automation/verify-cookie',
                ['cookie' => $config->cookie]
            );

            if ($response->successful() && $response->json('valid') === true) {
                return response()->json([
                    'valid' => true,
                    'user' => $response->json('user'),
                ]);
            }

            return response()->json([
                'valid' => false,
                'message' => $response->json('message') ?? 'Cookie không hợp lệ',
            ], 400);

        } catch (\Exception $e) {
            return response()->json([
                'valid' => false, 
                'message' => 'Lỗi kết nối: ' . $e->getMessage()
            ], 500);
        }
    }

    // ==================== Image Generation API ====================

    public function getImageGenApi(Request $request): JsonResponse
    {
        $config = DB::table('user_image_gen_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_key' => (bool) $config,
        ]);
    }

    public function saveImageGenApi(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'api_key' => ['required', 'string', 'min:10'],
        ]);

        $existing = DB::table('user_image_gen_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_image_gen_api_configs')
                ->where('user_id', $request->user()->id)
                ->update([
                    'api_key' => $validated['api_key'],
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_image_gen_api_configs')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'api_key' => $validated['api_key'],
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function deleteImageGenApi(Request $request): JsonResponse
    {
        DB::table('user_image_gen_api_configs')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }

    public function checkImageGenApi(Request $request): JsonResponse
    {
        $config = DB::table('user_image_gen_api_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$config) {
            return response()->json(['valid' => false, 'message' => 'Chưa cấu hình API Key'], 404);
        }

        try {
            $response = \Illuminate\Support\Facades\Http::withHeaders([
                'Content-Type' => 'application/json',
                'Authorization' => 'Bearer ' . $config->api_key,
            ])->post('https://api.key4u.shop/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' . $config->api_key, [
                'contents' => [
                    [
                        'role' => 'user',
                        'parts' => [
                            ['text' => 'Hello, this is a test message to verify API connection.']
                        ]
                    ]
                ],
                'generationConfig' => [
                    'responseModalities' => ['TEXT'],
                ]
            ]);

            if ($response->successful()) {
                return response()->json(['valid' => true]);
            }

            return response()->json([
                'valid' => false,
                'message' => 'API Check Failed: ' . $response->status() . ' - ' . $response->body()
            ], 400);

        } catch (\Exception $e) {
            return response()->json(['valid' => false, 'message' => 'Lỗi kết nối: ' . $e->getMessage()], 500);
        }
    }

    // ==================== Cloudflare R2 ====================

    public function getR2(Request $request): JsonResponse
    {
        $config = DB::table('user_r2_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        return response()->json([
            'has_config' => (bool) $config,
            'endpoint' => $config?->endpoint,
            'bucket' => $config?->bucket,
            'public_url' => $config?->public_url,
        ]);
    }

    public function saveR2(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => ['required', 'string', 'url'],
            'access_key_id' => ['required', 'string', 'min:10'],
            'secret_access_key' => ['required', 'string', 'min:10'],
            'bucket' => ['required', 'string'],
            'public_url' => ['nullable', 'string', 'url'],
        ]);

        $existing = DB::table('user_r2_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            DB::table('user_r2_configs')
                ->where('user_id', $request->user()->id)
                ->update([
                    'endpoint' => $validated['endpoint'],
                    'access_key_id' => $validated['access_key_id'],
                    'secret_access_key' => $validated['secret_access_key'],
                    'bucket' => $validated['bucket'],
                    'public_url' => $validated['public_url'] ?? null,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('user_r2_configs')->insert([
                'id' => Str::uuid()->toString(),
                'user_id' => $request->user()->id,
                'endpoint' => $validated['endpoint'],
                'access_key_id' => $validated['access_key_id'],
                'secret_access_key' => $validated['secret_access_key'],
                'bucket' => $validated['bucket'],
                'public_url' => $validated['public_url'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function checkR2(Request $request): JsonResponse
    {
        $config = DB::table('user_r2_configs')
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$config) {
            return response()->json(['valid' => false, 'message' => 'Chưa cấu hình Cloudflare R2'], 404);
        }

        try {
            $client = new \Aws\S3\S3Client([
                'version' => 'latest',
                'region' => 'auto',
                'endpoint' => $config->endpoint,
                'use_path_style_endpoint' => true,
                'credentials' => [
                    'key' => $config->access_key_id,
                    'secret' => $config->secret_access_key,
                ],
            ]);

            // Try to list 1 object to verify credentials and bucket access
            $client->listObjectsV2([
                'Bucket' => $config->bucket,
                'MaxKeys' => 1,
            ]);

            return response()->json(['valid' => true]);

        } catch (\Exception $e) {
            return response()->json([
                'valid' => false,
                'message' => 'Lỗi kết nối: ' . $e->getMessage()
            ], 400);
        }
    }

    public function deleteR2(Request $request): JsonResponse
    {
        DB::table('user_r2_configs')->where('user_id', $request->user()->id)->delete();
        return response()->json(['success' => true]);
    }
}
