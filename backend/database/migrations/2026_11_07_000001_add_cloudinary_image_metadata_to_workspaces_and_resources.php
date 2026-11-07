<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspaces', function (Blueprint $table) {
            $table->text('cloudinary_url')->nullable();
            $table->string('image_public_id')->nullable();
        });

        Schema::table('resources', function (Blueprint $table) {
            $table->text('cloudinary_url')->nullable();
            $table->string('image_public_id')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('resources', function (Blueprint $table) {
            $table->dropColumn(['cloudinary_url', 'image_public_id']);
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->dropColumn(['cloudinary_url', 'image_public_id']);
        });
    }
};
