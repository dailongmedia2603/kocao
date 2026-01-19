<?php

namespace App\Services;

use App\Models\Koc;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class TiktokApiService
{
    protected string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = config('services.tiktok.api_url', 'https://api.akng.io.vn');
    }

    /**
     * Get access token from database.
     */
    protected function getAccessToken(): ?string
    {
        $tokenData = DB::table('user_tiktok_tokens')->first();
        return $tokenData?->access_token;
    }

    /**
     * Get user info from TikTok channel URL.
     */
    public function getUserInfo(string $channelUrl): ?array
    {
        $accessToken = $this->getAccessToken();

        if (!$accessToken) {
            \Log::warning('No TikTok access token configured');
            return null;
        }

        $response = Http::timeout(30)->get("{$this->baseUrl}/tiktok/user", [
            'input' => $channelUrl,
            'access_token' => $accessToken,
        ]);

        if (!$response->successful()) {
            \Log::error("TikTok API error for URL {$channelUrl}: " . $response->body());
            return null;
        }

        $data = $response->json();

        // Check for API error
        if (isset($data['data']['statusCode'])) {
            \Log::error("TikTok API returned error: " . ($data['data']['statusMsg'] ?? 'Unknown'));
            return null;
        }

        return $data['data']['userInfo'] ?? null;
    }

    /**
     * Scan and update KOC stats from TikTok.
     */
    public function scanKocStats(Koc $koc): bool
    {
        if (!$koc->channel_url) {
            return false;
        }

        $userInfo = $this->getUserInfo($koc->channel_url);

        if (!$userInfo) {
            return false;
        }

        $user = $userInfo['user'] ?? [];
        $stats = $userInfo['statsV2'] ?? [];

        $koc->update([
            'follower_count' => isset($stats['followerCount']) ? (int) $stats['followerCount'] : null,
            'like_count' => isset($stats['heartCount']) ? (int) $stats['heartCount'] : null,
            'video_count' => isset($stats['videoCount']) ? (int) $stats['videoCount'] : null,
            'channel_nickname' => $user['nickname'] ?? null,
            'channel_unique_id' => $user['uniqueId'] ?? null,
            'channel_created_at' => isset($user['createTime']) 
                ? \Carbon\Carbon::createFromTimestamp($user['createTime']) 
                : null,
            'avatar_url' => $user['avatarLarger'] ?? $koc->avatar_url,
            'stats_updated_at' => now(),
        ]);

        return true;
    }

    /**
     * Scan multiple KOCs (batch operation).
     */
    public function scanMultipleKocs(int $limit = 20): array
    {
        $accessToken = $this->getAccessToken();

        if (!$accessToken) {
            return [
                'success' => false,
                'message' => 'No TikTok access token configured',
            ];
        }

        // Get KOCs that need updating (older than 23 hours or never scanned)
        $twentyThreeHoursAgo = now()->subHours(23);
        
        $kocs = Koc::whereNotNull('channel_url')
            ->where(function ($query) use ($twentyThreeHoursAgo) {
                $query->whereNull('stats_updated_at')
                    ->orWhere('stats_updated_at', '<', $twentyThreeHoursAgo);
            })
            ->limit($limit)
            ->get();

        if ($kocs->isEmpty()) {
            return [
                'success' => true,
                'message' => 'No KOCs require scanning at this time.',
                'scanned' => 0,
            ];
        }

        $successCount = 0;
        $failedCount = 0;

        foreach ($kocs as $koc) {
            try {
                $result = $this->scanKocStats($koc);
                if ($result) {
                    $successCount++;
                } else {
                    $failedCount++;
                }
            } catch (\Exception $e) {
                \Log::error("Error scanning KOC {$koc->id}: " . $e->getMessage());
                $failedCount++;
            }

            // Small delay to avoid rate limiting
            usleep(200000); // 200ms
        }

        return [
            'success' => true,
            'message' => "Scan complete. Success: {$successCount}, Failed: {$failedCount}",
            'scanned' => $successCount,
            'failed' => $failedCount,
        ];
    }

    /**
     * Validate TikTok access token.
     */
    public function validateToken(?string $accessToken = null): bool
    {
        $token = $accessToken ?? $this->getAccessToken();

        if (!$token) {
            return false;
        }

        // Try a simple API call to validate
        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/tiktok/user", [
                'input' => 'https://www.tiktok.com/@tiktok',
                'access_token' => $token,
            ]);

            return $response->successful() && !isset($response->json()['data']['statusCode']);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Get channel metadata (videos, engagement, etc.).
     */
    public function getChannelMetadata(string $channelUrl): ?array
    {
        $accessToken = $this->getAccessToken();

        if (!$accessToken) {
            return null;
        }

        // Get user info first
        $userInfo = $this->getUserInfo($channelUrl);

        if (!$userInfo) {
            return null;
        }

        $user = $userInfo['user'] ?? [];
        $stats = $userInfo['statsV2'] ?? [];

        return [
            'username' => $user['uniqueId'] ?? null,
            'nickname' => $user['nickname'] ?? null,
            'avatar' => $user['avatarLarger'] ?? null,
            'bio' => $user['signature'] ?? null,
            'followers' => isset($stats['followerCount']) ? (int) $stats['followerCount'] : 0,
            'likes' => isset($stats['heartCount']) ? (int) $stats['heartCount'] : 0,
            'videos' => isset($stats['videoCount']) ? (int) $stats['videoCount'] : 0,
            'verified' => $user['verified'] ?? false,
            'created_at' => isset($user['createTime']) 
                ? \Carbon\Carbon::createFromTimestamp($user['createTime'])->toIso8601String()
                : null,
        ];
    }
}
