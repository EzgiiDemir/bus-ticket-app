<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Terminal;

class TerminalSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['name'=>'Silivri Otogarı','city'=>'İstanbul','code'=>'IST-SIL'],
            ['name'=>'Esenler Otogarı','city'=>'İstanbul','code'=>'IST-ESN'],
            ['name'=>'Alibeyköy Cep Otogarı','city'=>'İstanbul','code'=>'IST-ALB'],
            ['name'=>'Dudullu (Ataşehir) Otogarı','city'=>'İstanbul','code'=>'IST-DUD'],
            ['name'=>'Gebze Otogarı','city'=>'Kocaeli','code'=>'KOC-GEB'],
            ['name'=>'İzmit Otogarı','city'=>'Kocaeli','code'=>'KOC-IZM'],
            ['name'=>'Sakarya (Adapazarı) Otogarı','city'=>'Sakarya','code'=>'SAK-ADP'],
            ['name'=>'Ankara (AŞTİ) Otogarı','city'=>'Ankara','code'=>'ANK-ASTI'],
        ];
        Terminal::query()->upsert($rows, ['code'], ['name','city']);
    }
}
