<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Company;
use Illuminate\Support\Facades\Hash;

class CompanyAndHrSeeder extends Seeder
{
    public function run(): void
    {
        // İsimleri netleştir: Toros, Anka, Mavi Yol
        $companies = [
            ['name'=>'Toros',    'code'=>'TOROS'],
            ['name'=>'Anka',     'code'=>'ANKA'],
            ['name'=>'Mavi Yol', 'code'=>'MAVI'],
        ];

        foreach ($companies as $c) {
            // Hem code hem name ile tekil eşleşme
            $exists = Company::where('code', $c['code'])
                ->orWhere('name', $c['name'])
                ->first();

            if ($exists) {
                // Kod veya isim farklıysa güncelle
                $exists->fill($c)->save();
            } else {
                Company::create($c);
            }
        }

        $defs = [
            ['name'=>'Toros İK',    'email'=>'ik.toros@example.com',  'Company'=>'TOROS'],
            ['name'=>'Anka İK',     'email'=>'ik.anka@example.com',   'Company'=>'ANKA'],
            ['name'=>'Mavi Yol İK', 'email'=>'ik.mavi@example.com',   'Company'=>'MAVI'],
        ];

        foreach ($defs as $d) {
            $company = Company::where('code',$d['Company'])
                ->orWhere('name', $d['Company']==='MAVI' ? 'Mavi Yol' : $d['Company'])
                ->first();

            if (!$company) continue;

            User::updateOrCreate(
                ['email'=>$d['email']],
                [
                    'name'=>$d['name'],
                    'password'=>Hash::make('Password123!'),
                    'role'=>'company_approver',
                    'role_status'=>'active',
                    'company_id'=>$company->id,
                ]
            );
        }
    }
}
