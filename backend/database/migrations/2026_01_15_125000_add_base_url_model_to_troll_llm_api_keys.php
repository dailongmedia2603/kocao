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
        Schema::table('user_troll_llm_api_keys', function (Blueprint $table) {
            $table->string('base_url')->default('https://chat.trollllm.xyz/v1')->after('api_key');
            $table->string('model')->default('gemini-3-pro-preview')->after('base_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_troll_llm_api_keys', function (Blueprint $table) {
            $table->dropColumn(['base_url', 'model']);
        });
    }
};
