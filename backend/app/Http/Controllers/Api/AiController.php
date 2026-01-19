<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ContentGenerationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function __construct(
        protected ContentGenerationService $contentService
    ) {}

    /**
     * Generate text using AI.
     */
    public function generateText(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'prompt' => ['required', 'string'],
            'provider' => ['sometimes', 'string'], // 'troll-llm', 'gemini-custom', 'gpt-custom'
            'model' => ['sometimes', 'string'],
        ]);

        try {
            $provider = $validated['provider'] ?? 'troll-llm'; // Default to troll-llm as requested
            
            // Call service
            // We might need to expose a generic generateText method in ContentGenerationService
            // or use specific methods based on provider.
            
            // For now, let's assume valid providers trigger specific logic
            // But ContentGenerationService currently has methods like generateFromIdea
            
            // Let's implement a generic generation method here or in service.
            // Beacuse ContentGenerationService is complex, let's check it first.
            // Ideally we move this logic to service.
            
            $result = $this->contentService->generateTextRaw(
                $validated['prompt'], 
                $provider,
                $validated['model'] ?? null
            );

            return response()->json(['text' => $result]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
