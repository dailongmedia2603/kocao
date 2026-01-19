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
        Schema::create('koc_avatars', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('koc_id')->constrained()->cascadeOnDelete();
            $table->text('image_url')->nullable();
            $table->text('prompt')->nullable();
            $table->string('source')->default('uploaded'); // 'generated' or 'uploaded'
            $table->string('status')->default('completed'); // 'processing', 'completed', 'failed'
            $table->boolean('is_active')->default(false); // Avatar đang được sử dụng
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('koc_avatars');
    }
};
