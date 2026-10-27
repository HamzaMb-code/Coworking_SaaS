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

    public static function isConfiguredForWorkspace(int $workspaceId): bool
    {
        $details = static::query()->where('workspace_id', $workspaceId)->first();
        if (!$details) return false;

        $beneficiary = trim((string) $details->beneficiary_name);
        $bank = trim((string) $details->bank_name);
        $account = preg_replace('/\s+/', '', (string) $details->account_identifier);

        return $beneficiary !== '' && $bank !== '' && is_string($account)
            && strlen($account) >= 8 && strlen($account) <= 64
            && preg_match('/^[A-Za-z0-9]+$/', $account) === 1;
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }
}
