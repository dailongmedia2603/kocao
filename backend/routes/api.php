<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public routes
Route::post('/auth/register', [\App\Http\Controllers\Api\AuthController::class, 'register']);
Route::post('/auth/login', [\App\Http\Controllers\Api\AuthController::class, 'login']);
Route::post('/auth/forgot-password', [\App\Http\Controllers\Api\AuthController::class, 'forgotPassword']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::get('/auth/me', [\App\Http\Controllers\Api\AuthController::class, 'me']);
    Route::post('/auth/logout', [\App\Http\Controllers\Api\AuthController::class, 'logout']);

    // KOCs
    Route::apiResource('kocs', \App\Http\Controllers\Api\KocController::class);
    Route::get('/kocs-with-stats', [\App\Http\Controllers\Api\KocController::class, 'withStats']);
    Route::post('/kocs/{koc}/scan-stats', [\App\Http\Controllers\Api\KocController::class, 'scanStats']);

    // KOC Files
    Route::get('/kocs/{koc}/files', [\App\Http\Controllers\Api\KocFileController::class, 'index']);
    Route::post('/kocs/{koc}/files/upload', [\App\Http\Controllers\Api\KocFileController::class, 'upload']);
    Route::delete('/koc-files/batch', [\App\Http\Controllers\Api\KocFileController::class, 'destroyBatch']);
    Route::delete('/koc-files/{file}', [\App\Http\Controllers\Api\KocFileController::class, 'destroy']);
    Route::get('/koc-files/{file}/download-url', [\App\Http\Controllers\Api\KocFileController::class, 'downloadUrl']);

    // Ideas
    Route::get('/kocs/{koc}/ideas', [\App\Http\Controllers\Api\IdeaController::class, 'index']);
    Route::post('/kocs/{koc}/ideas', [\App\Http\Controllers\Api\IdeaController::class, 'store']);
    Route::put('/ideas/{idea}', [\App\Http\Controllers\Api\IdeaController::class, 'update']);
    Route::delete('/ideas/{idea}', [\App\Http\Controllers\Api\IdeaController::class, 'destroy']);
    Route::post('/ideas/{idea}/generate-content', [\App\Http\Controllers\Api\IdeaController::class, 'generateContent']);
    Route::post('/ideas/{idea}/create-voice', [\App\Http\Controllers\Api\IdeaController::class, 'createVoice']);
    Route::post('/ideas/{idea}/create-video', [\App\Http\Controllers\Api\IdeaController::class, 'createVideo']);

    // Voice
    Route::get('/voice/tasks', [\App\Http\Controllers\Api\VoiceController::class, 'tasks']);
    Route::post('/voice/text-to-speech', [\App\Http\Controllers\Api\VoiceController::class, 'textToSpeech']);
    Route::get('/voice/cloned-voices', [\App\Http\Controllers\Api\VoiceController::class, 'clonedVoices']);
    Route::post('/voice/clone', [\App\Http\Controllers\Api\VoiceController::class, 'clone']);
    Route::delete('/voice/cloned-voices/{voiceId}', [\App\Http\Controllers\Api\VoiceController::class, 'deleteClonedVoice']);
    Route::post('/voice/proxy', [\App\Http\Controllers\Api\VoiceController::class, 'proxy']);
    Route::get('/voice/logs', [\App\Http\Controllers\Api\VoiceController::class, 'logs']);

    // Dreamface (Video Generation)
    Route::get('/dreamface/tasks', [\App\Http\Controllers\Api\DreamfaceController::class, 'tasks']);
    Route::post('/dreamface/create', [\App\Http\Controllers\Api\DreamfaceController::class, 'create']);
    Route::delete('/dreamface/tasks/{task}', [\App\Http\Controllers\Api\DreamfaceController::class, 'destroy']);
    Route::get('/dreamface/tasks/{task}/download-url', [\App\Http\Controllers\Api\DreamfaceController::class, 'downloadUrl']);
    Route::post('/dreamface/tasks/{task}/archive', [\App\Http\Controllers\Api\DreamfaceController::class, 'archive']);

    // Automation
    Route::apiResource('automation/campaigns', \App\Http\Controllers\Api\AutomationController::class);
    Route::get('/automation/campaigns/{campaign}/activity-log', [\App\Http\Controllers\Api\AutomationController::class, 'activityLog']);
    Route::post('/automation/campaigns/{campaign}/toggle', [\App\Http\Controllers\Api\AutomationController::class, 'toggle']);

    // AI Templates
    Route::apiResource('ai-templates', \App\Http\Controllers\Api\AiTemplateController::class);
    Route::post('/ai-templates/{template}/set-default', [\App\Http\Controllers\Api\AiTemplateController::class, 'setDefault']);
    Route::post('/ai/generate-text', [\App\Http\Controllers\Api\AiController::class, 'generateText']);

    // Subscription
    Route::get('/subscription/current', [\App\Http\Controllers\Api\SubscriptionController::class, 'current']);
    Route::get('/subscription/plans', [\App\Http\Controllers\Api\SubscriptionController::class, 'plans']);

    // Transcription
    Route::get('/transcription/tasks', [\App\Http\Controllers\Api\TranscriptionController::class, 'index']);
    Route::post('/transcription/start', [\App\Http\Controllers\Api\TranscriptionController::class, 'start']);
    Route::post('/transcription/channel-metadata', [\App\Http\Controllers\Api\TranscriptionController::class, 'channelMetadata']);
    Route::post('/transcription/download-channel', [\App\Http\Controllers\Api\TranscriptionController::class, 'downloadChannel']);

    // Content Plans
    Route::apiResource('content-plans', \App\Http\Controllers\Api\ContentPlanController::class);
    Route::post('/content-plans/generate', [\App\Http\Controllers\Api\ContentPlanController::class, 'generate']);
    Route::post('/content-plans/{content_plan}/generate-more-ideas', [\App\Http\Controllers\Api\ContentPlanController::class, 'generateMoreIdeas']);

    // Settings
    Route::prefix('settings')->group(function () {
        Route::get('/tiktok', [\App\Http\Controllers\Api\SettingsController::class, 'getTiktok']);
        Route::post('/tiktok', [\App\Http\Controllers\Api\SettingsController::class, 'saveTiktok']);
        Route::delete('/tiktok', [\App\Http\Controllers\Api\SettingsController::class, 'deleteTiktok']);
        Route::post('/tiktok/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkTiktok']);

        Route::get('/facebook', [\App\Http\Controllers\Api\SettingsController::class, 'getFacebook']);
        Route::post('/facebook', [\App\Http\Controllers\Api\SettingsController::class, 'saveFacebook']);
        Route::delete('/facebook', [\App\Http\Controllers\Api\SettingsController::class, 'deleteFacebook']);
        Route::post('/facebook/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkFacebook']);

        Route::get('/dreamface', [\App\Http\Controllers\Api\SettingsController::class, 'getDreamface']);
        Route::post('/dreamface', [\App\Http\Controllers\Api\SettingsController::class, 'saveDreamface']);
        Route::delete('/dreamface', [\App\Http\Controllers\Api\SettingsController::class, 'deleteDreamface']);

        Route::get('/voice-api', [\App\Http\Controllers\Api\SettingsController::class, 'getVoiceApi']);
        Route::post('/voice-api', [\App\Http\Controllers\Api\SettingsController::class, 'saveVoiceApi']);
        Route::delete('/voice-api', [\App\Http\Controllers\Api\SettingsController::class, 'deleteVoiceApi']);
        Route::post('/voice-api/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkVoiceApi']);

        Route::get('/vertex-ai', [\App\Http\Controllers\Api\SettingsController::class, 'getVertexAi']);
        Route::post('/vertex-ai', [\App\Http\Controllers\Api\SettingsController::class, 'saveVertexAi']);
        Route::delete('/vertex-ai', [\App\Http\Controllers\Api\SettingsController::class, 'deleteVertexAi']);





        Route::get('/troll-llm', [\App\Http\Controllers\Api\SettingsController::class, 'getTrollLlm']);
        Route::post('/troll-llm', [\App\Http\Controllers\Api\SettingsController::class, 'saveTrollLlm']);
        Route::delete('/troll-llm', [\App\Http\Controllers\Api\SettingsController::class, 'deleteTrollLlm']);
        Route::post('/troll-llm/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkTrollLlm']);

        Route::get('/kling-api', [\App\Http\Controllers\Api\SettingsController::class, 'getKlingApi']);
        Route::post('/kling-api', [\App\Http\Controllers\Api\SettingsController::class, 'saveKlingApi']);
        Route::delete('/kling-api', [\App\Http\Controllers\Api\SettingsController::class, 'deleteKlingApi']);
        Route::post('/kling-api/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkKlingApi']);

        Route::get('/image-gen-api', [\App\Http\Controllers\Api\SettingsController::class, 'getImageGenApi']);
        Route::post('/image-gen-api', [\App\Http\Controllers\Api\SettingsController::class, 'saveImageGenApi']);
        Route::delete('/image-gen-api', [\App\Http\Controllers\Api\SettingsController::class, 'deleteImageGenApi']);
        Route::post('/image-gen-api/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkImageGenApi']);

        Route::get('/r2', [\App\Http\Controllers\Api\SettingsController::class, 'getR2']);
        Route::post('/r2', [\App\Http\Controllers\Api\SettingsController::class, 'saveR2']);
        Route::delete('/r2', [\App\Http\Controllers\Api\SettingsController::class, 'deleteR2']);
        Route::post('/r2/check', [\App\Http\Controllers\Api\SettingsController::class, 'checkR2']);
    });

    // Kling Video Generation routes
    Route::prefix('kling')->group(function () {
        Route::post('/generate', [\App\Http\Controllers\Api\KlingController::class, 'generate']);
        Route::post('/jobs', [\App\Http\Controllers\Api\KlingController::class, 'store']); // New route
        Route::get('/jobs', [\App\Http\Controllers\Api\KlingController::class, 'listJobs']);
        Route::get('/status/{jobId}', [\App\Http\Controllers\Api\KlingController::class, 'status']);
        Route::delete('/jobs/{jobId}', [\App\Http\Controllers\Api\KlingController::class, 'deleteJob']);
    });

    // Image Generation routes
    Route::prefix('image-generation')->group(function () {
        Route::post('/generate', [\App\Http\Controllers\Api\ImageGenerationController::class, 'generate']);
        Route::get('/tasks', [\App\Http\Controllers\Api\ImageGenerationController::class, 'tasks']);
        Route::delete('/tasks/{task}', [\App\Http\Controllers\Api\ImageGenerationController::class, 'delete']);
        Route::get('/tasks/{task}/download', [\App\Http\Controllers\Api\ImageGenerationController::class, 'download']);
    });

    // KOC Avatars
    Route::prefix('kocs/{koc}/avatars')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\KocAvatarController::class, 'index']);
        Route::post('/generate', [\App\Http\Controllers\Api\KocAvatarController::class, 'generate']);
        Route::post('/upload', [\App\Http\Controllers\Api\KocAvatarController::class, 'upload']);
        Route::post('/{avatar}/set-active', [\App\Http\Controllers\Api\KocAvatarController::class, 'setActive']);
        Route::delete('/{avatar}', [\App\Http\Controllers\Api\KocAvatarController::class, 'destroy']);
        Route::get('/{avatar}/download', [\App\Http\Controllers\Api\KocAvatarController::class, 'download']);
    });

    // Admin routes
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/users', [\App\Http\Controllers\Api\Admin\UserController::class, 'index']);
        Route::post('/users', [\App\Http\Controllers\Api\Admin\UserController::class, 'store']);
        Route::put('/users/{user}', [\App\Http\Controllers\Api\Admin\UserController::class, 'update']);
        Route::delete('/users/{user}', [\App\Http\Controllers\Api\Admin\UserController::class, 'destroy']);

        Route::apiResource('plans', \App\Http\Controllers\Api\Admin\PlanController::class);
    });
});
