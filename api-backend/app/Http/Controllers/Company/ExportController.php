<?php

namespace App\Http\Controllers\Company;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function array(Request $r): StreamedResponse
    {
        $filename = (string)($r->input('filename') ?: 'export.csv');
        $headings = (array) $r->input('headings', []);
        $rows     = (array) $r->input('rows', []);

        return response()->streamDownload(function () use ($headings, $rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $delim = ',';

            if (!empty($headings)) fputcsv($out, $headings, $delim);
            foreach ($rows as $row) {
                $row = array_map(
                    fn($v) => is_bool($v) ? ($v ? '1' : '0') : (is_scalar($v) ? (string)$v : json_encode($v, JSON_UNESCAPED_UNICODE)),
                    $row
                );
                fputcsv($out, $row, $delim);
            }
            fclose($out);
        }, $filename, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    public function trips(Request $r): StreamedResponse
    {
        $u       = $r->user();
        $scope   = (string)($r->input('scope') ?: 'all');
        $page    = max(1, (int)$r->input('page', 1));
        $perPage = max(1, (int)$r->input('per_page', 100));

        $q = \App\Models\Product::query()
            ->where('company_id', $u->company_id)
            ->orderByDesc('id');

        $items = $scope === 'page'
            ? collect($q->paginate($perPage, ['*'], 'page', $page)->items())
            : $q->get();

        $headings = ['Sefer','Kalkış','Varış','Tarih','Bilet','Gelir','Aktif'];

        return response()->streamDownload(function () use ($items, $headings) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $delim = ',';

            fputcsv($out, $headings, $delim);

            foreach ($items as $p) {
                $trip    = $p->trip ?? sprintf('%s - %s', $p->terminal_from ?? '-', $p->terminal_to ?? '-');
                $from    = $p->terminal_from ?? '-';
                $to      = $p->terminal_to   ?? '-';
                $date    = $p->departure_time ?? (string)($p->start_time ?? '');
                $orders  = (int)($p->orders   ?? 0);
                $revenue = (float)($p->revenue ?? 0);
                $active  = !empty($p->is_active) ? 'Evet' : 'Hayır';

                fputcsv($out, [$trip, $from, $to, $date, $orders, $revenue, $active], $delim);
            }
            fclose($out);
        }, 'seferler.csv', [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="seferler.csv"',
        ]);
    }
}
