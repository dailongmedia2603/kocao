<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiPromptTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiTemplateController extends Controller
{
    /**
     * Display a listing of templates.
     */
    public function index(Request $request): JsonResponse
    {
        $templates = AiPromptTemplate::forUser($request->user()->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($templates);
    }

    /**
     * Store a newly created template.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'api_provider' => ['nullable', 'string', 'max:50'],
            'general_prompt' => ['nullable', 'string'],
            'tone_of_voice' => ['nullable', 'string', 'max:255'],
            'writing_style' => ['nullable', 'string', 'max:255'],
            'writing_method' => ['nullable', 'string', 'max:255'],
            'ai_role' => ['nullable', 'string', 'max:255'],
            'mandatory_requirements' => ['nullable', 'string'],
            'example_dialogue' => ['nullable', 'string'],
            'word_count' => ['nullable', 'integer', 'min:50', 'max:2000'],
            'is_public' => ['sometimes', 'boolean'],
        ]);

        $template = AiPromptTemplate::create([
            ...$validated,
            'user_id' => $request->user()->id,
            'is_default' => false,
        ]);

        return response()->json($template, 201);
    }

    /**
     * Display the specified template.
     */
    public function show(Request $request, AiPromptTemplate $aiTemplate): JsonResponse
    {
        // Check access (owner or public)
        if ($aiTemplate->user_id !== $request->user()->id && !$aiTemplate->is_public) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($aiTemplate);
    }

    /**
     * Update the specified template.
     */
    public function update(Request $request, AiPromptTemplate $aiTemplate): JsonResponse
    {
        // Check ownership
        if ($aiTemplate->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'api_provider' => ['nullable', 'string', 'max:50'],
            'general_prompt' => ['nullable', 'string'],
            'tone_of_voice' => ['nullable', 'string', 'max:255'],
            'writing_style' => ['nullable', 'string', 'max:255'],
            'writing_method' => ['nullable', 'string', 'max:255'],
            'ai_role' => ['nullable', 'string', 'max:255'],
            'mandatory_requirements' => ['nullable', 'string'],
            'example_dialogue' => ['nullable', 'string'],
            'word_count' => ['nullable', 'integer', 'min:50', 'max:2000'],
            'is_public' => ['sometimes', 'boolean'],
        ]);

        $aiTemplate->update($validated);

        return response()->json($aiTemplate);
    }

    /**
     * Remove the specified template.
     */
    public function destroy(Request $request, AiPromptTemplate $aiTemplate): JsonResponse
    {
        // Check ownership
        if ($aiTemplate->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $aiTemplate->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Set template as default.
     */
    public function setDefault(Request $request, AiPromptTemplate $aiTemplate): JsonResponse
    {
        // Check access (owner or public)
        if ($aiTemplate->user_id !== $request->user()->id && !$aiTemplate->is_public) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Unset current default
        AiPromptTemplate::where('user_id', $request->user()->id)
            ->where('is_default', true)
            ->update(['is_default' => false]);

        // Set new default (only for user's own templates)
        if ($aiTemplate->user_id === $request->user()->id) {
            $aiTemplate->update(['is_default' => true]);
        }

        return response()->json([
            'success' => true,
            'template' => $aiTemplate,
        ]);
    }
}
