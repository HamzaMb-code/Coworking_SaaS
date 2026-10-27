<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class PaymentReceiptService
{
    /** Persist a small, printable receipt PDF on the private local disk. */
    public function issue(Payment $payment): array
    {
        $payment->loadMissing(['booking.user', 'booking.workspace.members.user', 'booking.resource', 'verifier']);
        $booking = $payment->booking;
        $workspace = $booking->workspace;
        $ownerRole = \App\WorkspaceMemberRole::OWNER;
        $owner = $workspace?->members->first(fn ($member) => $member->role === $ownerRole)?->user;
        $number = $payment->receipt_number ?: 'WSR-'.now()->format('Ymd').'-'.Str::upper(Str::random(8));
        $lines = [
            'WORKSPACE PAYMENT RECEIPT',
            'Receipt number: '.$number,
            'Issued: '.now()->format('Y-m-d H:i:s T'),
            'Business: '.($workspace?->name ?? 'Workspace'),
            'Business owner: '.($owner?->name ?? 'Not provided'),
            'Business address: '.($workspace?->address ?? 'Not provided'),
            'Business contact: '.($workspace?->email ?? $workspace?->phone ?? 'Not provided'),
            'Customer: '.($booking->user?->name ?? 'Customer'),
            'Customer email: '.($booking->user?->email ?? 'Not provided'),
            'Booking reference: #'.$booking->id,
            'Resource: '.($booking->resource?->name ?? 'Workspace resource'),
            'Booking dates: '.$booking->start_at->format('Y-m-d H:i').' to '.$booking->end_at->format('Y-m-d H:i'),
            'Verified amount: '.number_format((float) $payment->amount, 2).' MAD',
            'Payment method: '.strtoupper(str_replace('_', ' ', (string) $payment->payment_method)),
            'Payment date: '.($payment->payment_date?->format('Y-m-d') ?? $payment->paid_at?->format('Y-m-d') ?? 'Not provided'),
            'Verified by: '.($payment->verifier?->name ?? 'Workspace representative'),
            'This receipt confirms payment recorded by the workspace. It is not a tax invoice.',
        ];

        $path = 'payment-receipts/'.$number.'.pdf';
        if (!Storage::disk('local')->put($path, $this->makePdf($lines))) {
            throw new RuntimeException('Unable to store the payment receipt.');
        }

        return ['number' => $number, 'path' => $path];
    }

    /** @param list<string> $lines */
    private function makePdf(array $lines): string
    {
        $commands = "BT\n/F1 18 Tf\n50 790 Td\n";
        foreach ($lines as $index => $line) {
            if ($index === 1) {
                $commands .= "/F1 11 Tf\n";
            }
            $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $line) ?: $line;
            $safe = str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $ascii);
            $commands .= '('.$safe.") Tj\n0 -28 Td\n";
        }
        $commands .= "ET\n";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Length '.strlen($commands)." >>\nstream\n".$commands.'endstream',
        ];

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }
}
