<?php

namespace App\Models;

use App\WorkspaceMemberRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'workspace_id',
        'role',
    ];

    protected function casts(): array
    {
        return [
            'role' => WorkspaceMemberRole::class,
        ];
    }

    /**
     * The user associated with this membership.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The workspace associated with this membership.
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}