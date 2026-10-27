<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceBankTransferDetail extends Model
{
    protected $fillable = ['workspace_id', 'beneficiary_name', 'bank_name', 'account_identifier'];

    protected function casts(): array
    {
        return ['account_identifier' => 'encrypted'];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
