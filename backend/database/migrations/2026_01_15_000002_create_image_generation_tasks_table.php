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
        Schema::create('image_generation_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('koc_id')->nullable()->constrained()->nullOnDelete();
            $table->text('prompt')->nullable();
            $table->string('aspect_ratio')->default('1:1');
            $table->string('image_size')->default('1K');
            $table->string('status')->default('pending'); // pending, processing, completed, failed
            $table->text('result_image_url')->nullable();
            $table->text('result_text')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('image_generation_tasks');
    }
};
