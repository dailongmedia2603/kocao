<?php

namespace App\Services;

use Aws\S3\S3Client;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class R2StorageService
{
    protected ?S3Client $client = null;
    protected string $bucket;
    protected ?string $publicUrl;
    protected bool $isLocal = false;

    public function __construct(?string $userId = null)
    {
        // Try to load config from database first
        $dbConfig = null;
        if ($userId) {
            $dbConfig = DB::table('user_r2_configs')
                ->where('user_id', $userId)
                ->first();
        }

        if ($dbConfig && !empty($dbConfig->endpoint) && !empty($dbConfig->access_key_id)) {
            // Use database config
            $this->bucket = $dbConfig->bucket ?? '';
            $this->publicUrl = $dbConfig->public_url ?? null;
            $this->client = new S3Client([
                'version' => 'latest',
                'region' => 'auto',
                'endpoint' => $dbConfig->endpoint,
                'use_path_style_endpoint' => true,
                'credentials' => [
                    'key' => $dbConfig->access_key_id,
                    'secret' => $dbConfig->secret_access_key,
                ],
            ]);
        } else {
            // Fallback to .env config
            $config = config('services.r2');
            $this->bucket = $config['bucket'] ?? '';
            $this->publicUrl = $config['public_url'] ?? null;

            if (!empty($config['endpoint']) && !empty($config['access_key_id'])) {
                $this->client = new S3Client([
                    'version' => 'latest',
                    'region' => 'auto',
                    'endpoint' => $config['endpoint'],
                    'use_path_style_endpoint' => true,
                    'credentials' => [
                        'key' => $config['access_key_id'],
                        'secret' => $config['secret_access_key'],
                    ],
                ]);
            } else {
                $this->isLocal = true;
            }
        }
    }

    /**
     * Upload a file to R2 or Local.
     */
    public function upload(UploadedFile $file, string $key): string
    {
        if ($this->isLocal) {
            Storage::disk('public')->put($key, fopen($file->getRealPath(), 'r'));
            return $this->getPublicUrl($key);
        }

        $this->client->putObject([
            'Bucket' => $this->bucket,
            'Key' => $key,
            'Body' => fopen($file->getRealPath(), 'r'),
            'ContentType' => $file->getMimeType(),
        ]);

        return $this->getPublicUrl($key);
    }

    /**
     * Upload content from a URL to R2 or Local.
     */
    public function uploadFromUrl(string $url, string $key): string
    {
        $response = \Http::get($url);
        
        if (!$response->successful()) {
            throw new \Exception("Failed to download file from URL: {$url}");
        }

        $contentType = $response->header('Content-Type') ?? 'application/octet-stream';

        if ($this->isLocal) {
            Storage::disk('public')->put($key, $response->body());
            return $this->getPublicUrl($key);
        }

        $this->client->putObject([
            'Bucket' => $this->bucket,
            'Key' => $key,
            'Body' => $response->body(),
            'ContentType' => $contentType,
        ]);

        return $this->getPublicUrl($key);
    }

    /**
     * Delete a file from R2 or Local.
     */
    public function delete(string $key): bool
    {
        if ($this->isLocal) {
            return Storage::disk('public')->delete($key);
        }

        $this->client->deleteObject([
            'Bucket' => $this->bucket,
            'Key' => $key,
        ]);

        return true;
    }

    /**
     * Get the public URL for a file.
     */
    public function getPublicUrl(string $key): string
    {
        if ($this->isLocal) {
            return Storage::disk('public')->url($key);
        }
        
        // If custom public URL is set, use it
        if ($this->publicUrl) {
            return "{$this->publicUrl}/{$key}";
        }
        
        // Otherwise, generate a presigned URL (valid for 7 days)
        return $this->generatePresignedUrl($key, 604800);
    }

    /**
     * Generate a pre-signed URL for download.
     */
    public function generatePresignedUrl(string $key, int $expiresIn = 3600): string
    {
        if ($this->isLocal) {
            // For local, just return the public URL significantly, 
            // or a temporary URL if using 'local' driver which supports temporaryUrl (but 'public' usually doesn't without S3)
            // Actually 'public' disk in local is just a symlink.
            // We can return the direct URL.
            return Storage::disk('public')->url($key);
        }

        $cmd = $this->client->getCommand('GetObject', [
            'Bucket' => $this->bucket,
            'Key' => $key,
        ]);

        $request = $this->client->createPresignedRequest($cmd, "+{$expiresIn} seconds");

        return (string) $request->getUri();
    }

    /**
     * Check if a file exists.
     */
    public function exists(string $key): bool
    {
        if ($this->isLocal) {
            return Storage::disk('public')->exists($key);
        }

        try {
            $this->client->headObject([
                'Bucket' => $this->bucket,
                'Key' => $key,
            ]);
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }
}
