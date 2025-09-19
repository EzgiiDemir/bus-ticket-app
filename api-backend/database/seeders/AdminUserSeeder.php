<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        \App\Models\User::updateOrCreate(
            ['email' => 'edemir04@gmail.com'],
            [
                'name' => 'ezgi',
                'password' => bcrypt('ezgi2002'),
                'role' => 'admin',
                'role_status' => 'active'
            ]
        );
    }
}
