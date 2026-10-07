<h1>New booking request</h1>

<p>
    {{ $booking->user->name }} requested {{ $booking->resource->name }} at
    {{ $booking->workspace->name }}.
</p>

<p>
    {{ $booking->start_at->format('D, M j, Y g:i A') }} to
    {{ $booking->end_at->format('D, M j, Y g:i A') }}
</p>

<p>Total: {{ number_format((float) $booking->total_price, 2) }} MAD</p>

<p>This request is pending your confirmation.</p>

<p><a href="{{ $reviewUrl }}">Review booking request</a></p>
