<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // TikTok Tokens
        Schema::create('user_tiktok_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->text('access_token');
            $table->string('check_url')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        // Facebook Tokens
        Schema::create('user_facebook_tokens', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->text('access_token');
            $table->string('check_url')->nullable();
            $table->timestamps();

            $table->unique('user_id');
        });

        // Dreamface API Keys
        Schema::create('user_dreamface_api_keys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('account_id');
            $table->string('user_id_dreamface');
            $table->string('token_id');
            $table->string('client_id');
            $table->timestamps();
        });

        // Voice API Keys (shared system-wide)
        Schema::create('user_voice_api_keys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('api_key');
            $table->timestamps();
        });

        // Vertex AI Credentials
        Schema::create('user_vertex_ai_credentials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->json('credentials');
            $table->timestamps();

            $table->unique('user_id');
        });

        // Gemini API Keys
        Schema::create('user_gemini_api_keys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('api_key');
            $table->timestamps();
        });

        // GPT API Keys
        Schema::create('user_gpt_api_keys', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('api_key');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_gpt_api_keys');
        Schema::dropIfExists('user_gemini_api_keys');
        Schema::dropIfExists('user_vertex_ai_credentials');
        Schema::dropIfExists('user_voice_api_keys');
        Schema::dropIfExists('user_dreamface_api_keys');
        Schema::dropIfExists('user_facebook_tokens');
        Schema::dropIfExists('user_tiktok_tokens');
    }
};
