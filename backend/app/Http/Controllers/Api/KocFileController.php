<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Koc;
use App\Models\KocFile;
use App\Services\R2StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class KocFileController extends Controller
{
    /**
     * Get R2 service instance with user's config.
     */
    private function getR2Service(Request $request): R2StorageService
    {
        return new R2StorageService($request->user()->id);
    }

    /**
     * Display a listing of files for a KOC.
     */
    public function index(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $files = $koc->files()
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($file) use ($request) {
                $r2Service = $this->getR2Service($request);
                return [
                    ...$file->toArray(),
                    'public_url' => $r2Service->getPublicUrl($file->r2_key),
                ];
            });

        return response()->json($files);
    }

    /**
     * Upload a file for a KOC.
     */
    public function upload(Request $request, Koc $koc): JsonResponse
    {
        // Check ownership
        if ($koc->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        \Log::info('Upload request received', [
            'koc_id' => $koc->id,
            'has_file' => $request->hasFile('file'),
            'content_length' => $request->header('Content-Length'),
            'post_count' => count($request->all()),
        ]);

        try {
            $request->validate([
                'file' => ['required', 'file', 'max:1024000'], // 1GB max
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Upload validation failed', ['errors' => $e->errors()]);
            throw $e;
        }

        $file = $request->file('file');
        $fileName = $file->getClientOriginalName();
        
        // Generate unique R2 key
        $folderPath = $koc->folder_path ?? 'kocs/' . $request->user()->id . '/' . $koc->id;
        
        // Add subfolder based on file type
        $mimeType = $file->getMimeType();
        $subFolder = 'sources/files';
        if (str_starts_with($mimeType, 'video/')) {
            $subFolder = 'sources/videos';
        } elseif (str_starts_with($mimeType, 'image/')) {
            $subFolder = 'sources/images';
        }

        $r2Key = $folderPath . '/' . $subFolder . '/' . time() . '-' . $fileName;

        try {
            // Get R2 service with user's config
            $r2Service = $this->getR2Service($request);
            
            // Upload to R2
            $publicUrl = $r2Service->upload($file, $r2Key);

            \Log::info('Upload completed', [
                'r2_key' => $r2Key,
                'public_url' => $publicUrl,
            ]);

            // Create database record
            $kocFile = KocFile::create([
                'koc_id' => $koc->id,
                'user_id' => $request->user()->id,
                'r2_key' => $r2Key,
                'display_name' => $fileName,
            ]);

            // Generate thumbnail for videos (async)
            if (str_starts_with($file->getMimeType(), 'video/')) {
                // TODO: Dispatch GenerateThumbnail job
            }

            return response()->json([
                'success' => true,
                'file' => [
                    ...$kocFile->toArray(),
                    'public_url' => $publicUrl,
                ],
            ], 201);

        } catch (\Exception $e) {
            \Log::error('Upload processing error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Lỗi upload file: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a single file.
     */
    public function destroy(Request $request, KocFile $file): JsonResponse
    {
        // Check ownership
        if ($file->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            // Delete from R2
            $r2Service = $this->getR2Service($request);
            $r2Service->delete($file->r2_key);
            
            // Delete database record
            $file->delete();

            return response()->json(['success' => true]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Lỗi xóa file: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete multiple files.
     */
    public function destroyBatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file_ids' => ['required', 'array'],
            'file_ids.*' => ['uuid'],
        ]);

        $files = KocFile::whereIn('id', $validated['file_ids'])
            ->where('user_id', $request->user()->id)
            ->get();

        $deletedCount = 0;
        $r2Service = $this->getR2Service($request);

        foreach ($files as $file) {
            try {
                $r2Service->delete($file->r2_key);
                $file->delete();
                $deletedCount++;
            } catch (\Exception $e) {
                // Log error but continue
                \Log::error("Error deleting file {$file->id}: " . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'deleted_count' => $deletedCount,
        ]);
    }

    /**
     * Get download URL for a file.
     */
    public function downloadUrl(Request $request, KocFile $file): JsonResponse
    {
        // Check ownership
        if ($file->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $r2Service = $this->getR2Service($request);
            $url = $r2Service->generatePresignedUrl($file->r2_key, 3600);

            return response()->json([
                'url' => $url,
                'expires_in' => 3600,
            ]);

        } catch (\Exception $e) {
            $r2Service = $this->getR2Service($request);
            return response()->json([
                'url' => $r2Service->getPublicUrl($file->r2_key),
            ]);
        }
    }
}
