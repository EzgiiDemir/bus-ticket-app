<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CompanySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\Company::query()->upsert([
            ['name'=>'Anka Tur','code'=>'ANK'],
            ['name'=>'Mavi Yol','code'=>'MVY'],
            ['name'=>'Toros Lines','code'=>'TRS'],
        ], ['code'], ['name']);
    }
}
