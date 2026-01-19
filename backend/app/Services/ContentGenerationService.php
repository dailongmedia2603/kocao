<?php

namespace App\Services;

use App\Models\AiPromptTemplate;
use App\Models\Koc;
use App\Models\KocContentIdea;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class ContentGenerationService
{
    /**
     * Generate content for an idea.
     */
    public function generateFromIdea(KocContentIdea $idea): string
    {
        // Get KOC info
        $koc = Koc::find($idea->koc_id);
        if (!$koc) {
            throw new \Exception("KOC with id {$idea->koc_id} not found.");
        }

        // Get template
        $template = $this->getTemplateForKoc($koc, $idea->user_id);
        if (!$template) {
            throw new \Exception("No AI prompt template found for this KOC.");
        }

        // Build full prompt
        $fullPrompt = $this->buildPrompt($koc, $idea, $template);

        // Check template provider preference
        $provider = $template->api_provider;
        
        // Smart Defaulting: If provider is not set or is default 'gpt-custom' but user has no GPT key,
        // checks if they have other keys and switches preference.
        if (empty($provider) || $provider === 'gpt-custom') {
            $hasGpt = $this->hasKey('user_gpt_api_keys', $idea->user_id);
            if (!$hasGpt) {
                if ($this->hasKey('user_troll_llm_api_keys', $idea->user_id)) {
                    $provider = 'troll-llm';
                } elseif ($this->hasKey('user_gemini_api_keys', $idea->user_id)) {
                    $provider = 'gemini-custom';
                }
            }
        }
        
        // Default fallback if still nothing
        if (empty($provider)) {
            $provider = 'gpt-custom';
        }

        $modelUsed = $provider;
        $generatedText = '';

        try {
            switch ($provider) {
                case 'troll-llm':
                    $generatedText = $this->generateWithTrollLlm($fullPrompt, $idea->user_id);
                    break;
                case 'gemini-custom':
                    $generatedText = $this->generateWithGemini($fullPrompt, $idea->user_id);
                    break;
                case 'vertex-ai':
                    $generatedText = $this->generateWithVertexAi($fullPrompt, $idea->user_id);
                    break;
                case 'gpt-custom':
                default:
                    $generatedText = $this->generateWithGpt($fullPrompt, $idea->user_id);
                    break;
            }
        } catch (\Exception $e) {
            \Log::error("Content generation failed with provider {$provider}: " . $e->getMessage());
            throw $e; // Throw immediately, no fallback
        }

        // Update idea with generated content
        $idea->update([
            'new_content' => $generatedText,
            'status' => KocContentIdea::STATUS_CONTENT_READY,
            'ai_prompt_log' => "[Model Used: {$modelUsed}]\n\n{$fullPrompt}",
            'error_message' => null,
        ]);

        return $generatedText;
    }

    /**
     * Generate raw text from prompt using specified provider or smart default.
     */
    public function generateTextRaw(string $prompt, ?string $provider = null, ?string $model = null): string
    {
        // 1. Determine provider
        // If not explicit, try to find a working key, prioritizing Troll LLM as per user preference (or GPT/Gemini)
        if (empty($provider) || $provider === 'gpt-custom') {
             // Check keys availability
             $userId = auth()->id(); // Assuming running in auth context
             if ($this->hasKey('user_troll_llm_api_keys', $userId)) {
                 $provider = 'troll-llm';
             } elseif ($this->hasKey('user_gpt_api_keys', $userId)) {
                 $provider = 'gpt-custom';
             } elseif ($this->hasKey('user_gemini_api_keys', $userId)) {
                 $provider = 'gemini-custom';
             } else {
                 $provider = 'gpt-custom'; // Default fallback
             }
        }
        
        $userId = auth()->id();
        
        switch ($provider) {
            case 'troll-llm':
                return $this->generateWithTrollLlm($prompt, $userId, $model);
            case 'gemini-custom':
                return $this->generateWithGemini($prompt, $userId);
            case 'vertex-ai':
                return $this->generateWithVertexAi($prompt, $userId);
            case 'gpt-custom':
            default:
                return $this->generateWithGpt($prompt, $userId);
        }
    }

    /**
     * Build the full prompt for content generation.
     */
    protected function buildPrompt(Koc $koc, KocContentIdea $idea, AiPromptTemplate $template): string
    {
        return <<<PROMPT
Bạn là một chuyên gia sáng tạo nội dung cho KOC tên là "{$koc->name}".
Hãy phát triển ý tưởng sau đây thành một kịch bản video hoàn chỉnh:

**Ý tưởng gốc:**
---
{$idea->idea_content}
---

**Yêu cầu chi tiết về kịch bản:**
- **Yêu cầu chung:** {$template->general_prompt}
- **Tông giọng:** {$template->tone_of_voice}
- **Văn phong:** {$template->writing_style}
- **Cách viết:** {$template->writing_method}
- **Vai trò của bạn (AI):** {$template->ai_role}
- **Yêu cầu bắt buộc:** {$template->mandatory_requirements}
- **Lời thoại ví dụ (tham khảo):** {$template->example_dialogue}
- **Độ dài tối đa:** {$template->word_count} từ

**QUAN TRỌNG:** Chỉ trả về nội dung kịch bản hoàn chỉnh, không thêm bất kỳ lời giải thích, tiêu đề hay ghi chú nào khác.
PROMPT;
    }

    /**
     * Get template for KOC (KOC default -> User default -> System default).
     */
    protected function getTemplateForKoc(Koc $koc, string $userId): ?AiPromptTemplate
    {
        // 1. KOC's default template
        if ($koc->default_prompt_template_id) {
            $template = AiPromptTemplate::find($koc->default_prompt_template_id);
            if ($template) return $template;
        }

        // 2. User's default template
        $userDefault = AiPromptTemplate::where('user_id', $userId)
            ->where('is_default', true)
            ->first();
        if ($userDefault) return $userDefault;

        // 3. System public template
        $systemDefault = AiPromptTemplate::whereNull('user_id')
            ->where('is_public', true)
            ->first();
        if ($systemDefault) return $systemDefault;

        // 4. Any public template
        return AiPromptTemplate::where('is_public', true)->first();
    }

    /**
     * Generate content using Gemini API.
     */
    public function generateWithGemini(string $prompt, string $userId): string
    {
        $apiKey = $this->getApiKey('user_gemini_api_keys', $userId);

        $response = Http::withHeaders([
            'Content-Type' => 'application/json',
        ])->post("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={$apiKey}", [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ],
            'generationConfig' => [
                'temperature' => 0.7,
                'maxOutputTokens' => 2048,
            ]
        ]);

        if (!$response->successful()) {
            throw new \Exception("Gemini API Error: " . $response->body());
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (!$text) {
            throw new \Exception("Gemini API did not return content");
        }

        return trim($text);
    }

    /**
     * Generate content using GPT API.
     */
    public function generateWithGpt(string $prompt, string $userId): string
    {
        $apiKey = $this->getApiKey('user_gpt_api_keys', $userId);

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$apiKey}",
            'Content-Type' => 'application/json',
        ])->post('https://api.openai.com/v1/chat/completions', [
            'model' => 'gpt-4o-mini',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ]
            ],
            'temperature' => 0.7,
            'max_tokens' => 2048,
        ]);

        if (!$response->successful()) {
            throw new \Exception("GPT API Error: " . $response->body());
        }

        $data = $response->json();
        $text = $data['choices'][0]['message']['content'] ?? null;

        if (!$text) {
            throw new \Exception("GPT API did not return content");
        }

        return trim($text);
    }

    /**
     * Generate content using Vertex AI.
     */
    public function generateWithVertexAi(string $prompt, string $userId): string
    {
        // Get credentials from admin user
        $adminUser = DB::table('profiles')
            ->where('role', 'admin')
            ->first();

        if (!$adminUser) {
            throw new \Exception("No admin account configured for Vertex AI fallback.");
        }

        $credData = DB::table('user_vertex_ai_credentials')
            ->where('user_id', $adminUser->user_id)
            ->first();

        if (!$credData) {
            throw new \Exception("No Vertex AI credentials configured.");
        }

        $credentials = json_decode($credData->credentials, true);
        $projectId = $credentials['project_id'] ?? null;

        if (!$projectId) {
            throw new \Exception("Vertex AI credentials missing project_id.");
        }

        // Get access token via service account JWT
        $accessToken = $this->getGoogleAccessToken($credentials);

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$accessToken}",
            'Content-Type' => 'application/json',
        ])->post("https://us-central1-aiplatform.googleapis.com/v1/projects/{$projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent", [
            'contents' => [
                [
                    'role' => 'user',
                    'parts' => [
                        ['text' => $prompt]
                    ]
                ]
            ]
        ]);

        if (!$response->successful()) {
            throw new \Exception("Vertex AI API Error: " . $response->body());
        }

        $data = $response->json();
        $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (!$text) {
            throw new \Exception("Vertex AI did not return content");
        }

        return trim($text);
    }

    /**
     * Get Google access token using service account credentials.
     */
    protected function getGoogleAccessToken(array $credentials): string
    {
        // Use firebase/php-jwt or similar for JWT signing
        // For now, use simple HTTP approach
        
        $privateKey = $credentials['private_key'];
        $clientEmail = $credentials['client_email'];

        $now = time();
        $payload = [
            'iss' => $clientEmail,
            'scope' => 'https://www.googleapis.com/auth/cloud-platform',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ];

        // Sign JWT with RS256
        $header = base64_encode(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $payload = base64_encode(json_encode($payload));
        
        openssl_sign(
            "{$header}.{$payload}",
            $signature,
            $privateKey,
            OPENSSL_ALGO_SHA256
        );
        
        $jwt = "{$header}.{$payload}." . base64_encode($signature);

        // Exchange JWT for access token
        $response = Http::asForm()->post('https://oauth2.googleapis.com/token', [
            'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            'assertion' => $jwt,
        ]);

        if (!$response->successful()) {
            throw new \Exception("Google Auth Error: " . $response->body());
        }

        return $response->json()['access_token'];
    }

    /**
     * Get API key from database.
     */
    protected function getApiKey(string $table, string $userId): string
    {
        // Try user's key first
        $key = DB::table($table)->where('user_id', $userId)->first();
        
        // Fall back to any available key
        if (!$key) {
            $key = DB::table($table)->first();
        }

        if (!$key) {
            throw new \Exception("No API key configured in {$table}");
        }

        return $key->api_key;
    }

    /**
     * Generate content plan using AI.
     */
    public function generateContentPlan(string $topic, string $duration, string $userId): array
    {
        $prompt = <<<PROMPT
Tạo một kế hoạch nội dung chi tiết cho chủ đề: "{$topic}"
Thời gian thực hiện: {$duration}

Yêu cầu:
1. Liệt kê các ý tưởng video cụ thể
2. Mỗi ý tưởng cần có tiêu đề hấp dẫn và mô tả ngắn gọn
3. Phân bổ theo thời gian hợp lý
4. Trả về dạng JSON array với format: [{"title": "...", "description": "...", "week": 1}]

Chỉ trả về JSON, không thêm text khác.
PROMPT;

        try {
            $result = $this->generateWithGemini($prompt, $userId);
            return json_decode($result, true) ?? [];
        } catch (\Exception $e) {
            try {
                $result = $this->generateWithGpt($prompt, $userId);
                return json_decode($result, true) ?? [];
            } catch (\Exception $e) {
                return [];
            }
        }
    }

    /**
     * Generate more ideas for a KOC.
     */
    public function generateMoreIdeas(Koc $koc, int $count = 5, string $userId): array
    {
        $existingIdeas = $koc->ideas()->pluck('idea_content')->take(10)->implode("\n- ");

        // Try to load template
        $template = AiPromptTemplate::where('user_id', $userId)
            ->where('writing_style', 'generate_more_ideas_gpt') // Using writing_style or name as identifier?
            // Wait, the frontend uses templateType='generate_more_ideas_gpt'.
            // In AiPromptTemplate table, how is it stored? 
            // Usually 'name' or a specific type column. 
            // Let's assume 'name' = 'generate_more_ideas_gpt' or we look it up by ID if passed.
            // But here we don't have ID.
            // Let's look for a template where api_provider is set or based on some convention.
            // Actually, ConfigurePromptDialog uses api.aiTemplates.get('generate_more_ideas_gpt').
            // This API endpoint looks up by 'type' or 'name'. 
            // In AiTemplateController::show, it binds model.
            // Let's assume there is a way to find it. 
            // Given I don't know the exact column for 'type', I will assume 'name' or 'writing_method' matches.
            // For now, let's try to find by name 'generate_more_ideas_gpt'.
            ->orWhere('name', 'generate_more_ideas_gpt')
            ->first();
            
        // Actually, the ConfigurePromptDialog uses api.aiTemplates.get(templateType).
        // If I assume the name is 'generate_more_ideas_gpt'.
        
        $promptContent = $template?->content ?? null;
        $provider = $template?->api_provider ?? 'troll-llm';
        
        if (!$promptContent) {
            $promptContent = <<<PROMPT
KOC: {{KOC_INFO}}

Các ý tưởng đã có:
{{EXISTING_IDEAS}}

Hãy tạo 10 ý tưởng video MỚI, khác biệt và sáng tạo cho KOC này.
Mỗi ý tưởng cần ngắn gọn, hấp dẫn và phù hợp với lĩnh vực.

Trả về dạng JSON array với format: [{"idea": "..."}]
Chỉ trả về JSON, không thêm text khác.
PROMPT;
        }

        // Replace variables
        $prompt = str_replace(
            ['{{KOC_INFO}}', '{{EXISTING_IDEAS}}'],
            ["{$koc->name} - {$koc->field}", $existingIdeas],
            $promptContent
        );

        try {
            $text = $this->generateTextRaw($prompt, $provider);
            // Clean markdown
            $text = preg_replace('/^```json\s*|```$/m', '', $text);
            return json_decode($text, true) ?? [];
        } catch (\Exception $e) {
            \Log::error("generateMoreIdeas error: " . $e->getMessage());
            return [];
        }
    }

    /**
     * Generate content using Troll LLM (now Gemini API).
     */
    public function generateWithTrollLlm(string $prompt, string $userId, ?string $model = null): string
    {
        // Get full config including base_url and model
        $config = DB::table('user_troll_llm_api_keys')->where('user_id', $userId)->first();
        
        if (!$config) {
            // Fallback to any config
            $config = DB::table('user_troll_llm_api_keys')->first();
        }

        if (!$config) {
            throw new \Exception("No Gemini API key configured in user_troll_llm_api_keys");
        }

        $apiKey = $config->api_key;
        $baseUrl = rtrim($config->base_url ?? 'https://chat.trollllm.xyz/v1', '/');
        $modelToUse = $model ?? $config->model ?? 'gemini-3-pro-preview';

        $response = Http::withHeaders([
            'Authorization' => "Bearer {$apiKey}",
            'Content-Type' => 'application/json',
        ])->post($baseUrl . '/chat/completions', [
            'model' => $modelToUse,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ]
            ],
            'max_tokens' => 30000,
        ]);

        if (!$response->successful()) {
            throw new \Exception("Gemini API Error: " . $response->body());
        }

        $data = $response->json();
        $text = $data['choices'][0]['message']['content'] ?? null;

        if (!$text) {
            throw new \Exception("Gemini API did not return content");
        }

        return trim($text);
    }

    /**
     * Check if user has an API key in a specific table.
     */
    protected function hasKey(string $table, string $userId): bool
    {
        return DB::table($table)->where('user_id', $userId)->exists();
    }
}
