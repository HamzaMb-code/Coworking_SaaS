<?php

namespace App\Models;

use App\WorkspaceStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Facades\Storage;

class Workspace extends Model
{
    use HasFactory, SoftDeletes;

    protected $appends = ['image_url'];

    protected $fillable = [
        'name',
        'slug',
        'description',
        'image_path',
        'address',
        'city',
        'phone',
        'email',
        'status',
    ];

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    protected function casts(): array
    {
        return [
            'status' => WorkspaceStatus::class,
        ];
    }

    /**
     * The members of the workspace.
     */
    public function members(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    /**
     * The resources available in the workspace.
     */
    public function resources(): HasMany
    {
        return $this->hasMany(Resource::class);
    }

    /**
     * The bookings made in the workspace.
     */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    public function favoritedBy(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_favorites')
            ->withTimestamps();
    }

    // for invitations 
    public function invitations(): HasMany
    {
        return $this->hasMany(WorkspaceInvitation::class);
    }


    public function workspaceMembers(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }
}
