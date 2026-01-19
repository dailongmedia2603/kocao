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
        Schema::create('ai_prompt_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->text('general_prompt')->nullable();
            $table->string('tone_of_voice')->nullable();
            $table->string('writing_style')->nullable();
            $table->string('writing_method')->nullable();
            $table->string('ai_role')->nullable();
            $table->text('mandatory_requirements')->nullable();
            $table->text('example_dialogue')->nullable();
            $table->integer('word_count')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_public')->default(false);
            $table->timestamps();

            $table->index('user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ai_prompt_templates');
    }
};
