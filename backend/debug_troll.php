<?php

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$keyConfig = DB::table('user_troll_llm_api_keys')->first();

if (!$keyConfig) {
    echo "No API Key found.\n";
    exit(1);
}

$apiKey = $keyConfig->api_key;
$model = 'gemini-3-pro-preview'; // Testing the user requested model

echo "Testing Model: $model\n";

$response = Http::withHeaders([
    'Authorization' => "Bearer {$apiKey}",
    'Content-Type' => 'application/json',
])->post('https://chat.trollllm.xyz/v1/chat/completions', [
    'model' => $model,
    'messages' => [
        [
            'role' => 'user',
            'content' => 'Hello, are you working?',
        ]
    ],
    'max_tokens' => 2000,
]);

echo "Status: " . $response->status() . "\n";
echo "Body: " . $response->body() . "\n";
