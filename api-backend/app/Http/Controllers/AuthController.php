<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\RoleRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function register(Request $r)
    {
        $r->validate([
            'name'        => 'required|string|max:255',
            'email'       => 'required|email|unique:users,email',
            'password'    => 'required|confirmed|min:6',
            'role'        => 'required|in:passenger,personnel,admin',
            'company_id'  => 'required_if:role,personnel|nullable|exists:companies,id',
        ]);

        $isPersonnel = $r->role === 'personnel';

        $user = User::create([
            'name'        => $r->name,
            'email'       => $r->email,
            'password'    => bcrypt($r->password),
            'role'        => $r->role,
            'company_id'  => $isPersonnel ? $r->company_id : null,
            'role_status' => $isPersonnel ? 'pending' : 'active',
        ]);

// use App\Models\RoleRequest;
        if ($isPersonnel) {
            RoleRequest::updateOrCreate(
                ['user_id'=>$user->id, 'role'=>'personnel'],
                [
                    'company_id'     => $user->company_id,
                    'company_status' => 'pending',
                    'admin_status'   => 'pending',
                    // legacy alanlar tabloya varsa:
                    'type'           => 'personnel_request',
                    'status'         => 'pending',
                    'note'           => 'Initial personnel signup',
                ]
            );
            $user->update(['role_status'=>'pending']);
        }

        return response()->json([
            'message' => 'ok',
            'user'    => $user->load('Company:id,name,code'),
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email'    => 'required|string|email',
            'password' => 'required|string',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(["status"=>false,"message"=>"Invalid Credentials"], 401);
        }

        /** @var User $user */
        $user = Auth::user();

        if ($user->role === 'personnel' && $user->role_status !== 'active') {
            return response()->json([
                'status'=>false,
                'message'=>'Hesabınız onay bekliyor. Önce firma ardından admin onayı gerekir.'
            ], 403);
        }

        $token = $user->createToken('myToken')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'           => $user->id,
                'name'         => $user->name,
                'email'        => $user->email,
                'role'         => strtolower($user->role),
                'role_status'  => $user->role_status,
                'Company'      => optional($user->company)->only(['id','name','code']),
            ],
        ]);
    }

    public function profile(Request $request)
    {
        $u = $request->user()->load('Company:id,name,code');
        return response()->json($u);
    }

    public function logout(Request $request)
    {
        Auth::logout();
        return response()->json([
            "status"  => true,
            "message" => "Logout Successful"
        ]);
    }

    public function updateProfile(Request $r)
    {
        $user = $r->user();
        $data = $r->validate([
            'name'  => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:32',
        ]);
        $user->update($data);
        return response()->json(['status' => true, 'user' => $user->refresh()]);
    }

    public function changePassword(Request $r)
    {
        $r->validate([
            'current_password' => 'required|string',
            'password'         => ['required', 'confirmed', PasswordRule::min(6)],
        ]);
        $user = $r->user();
        if (!Hash::check($r->current_password, $user->password)) {
            return response()->json(['status' => false, 'message' => 'Geçerli şifre hatalı'], 422);
        }
        $user->forceFill(['password' => Hash::make($r->password)])->save();
        return response()->json(['status' => true, 'message' => 'Şifre güncellendi']);
    }

    public function forgotPassword(Request $r)
    {
        $r->validate(['email' => 'required|email']);
        $status = Password::sendResetLink($r->only('email'));
        return $status === Password::RESET_LINK_SENT
            ? response()->json(['status' => true, 'message' => __($status)])
            : response()->json(['status' => false, 'message' => __($status)], 422);
    }

    public function resetPassword(Request $r)
    {
        $r->validate([
            'email'    => 'required|email',
            'token'    => 'required',
            'password' => ['required', 'confirmed', PasswordRule::min(6)],
        ]);
        $status = Password::reset(
            $r->only('email', 'password', 'password_confirmation', 'token'),
            function ($user) use ($r) {
                $user->forceFill([
                    'password'       => Hash::make($r->password),
                    'remember_token' => Str::random(60),
                ])->save();
                event(new PasswordReset($user));
            }
        );
        return $status === Password::PASSWORD_RESET
            ? response()->json(['status' => true, 'message' => __($status)])
            : response()->json(['status' => false, 'message' => __($status)], 422);
    }
}
