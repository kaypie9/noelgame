// app/api/auth/sign-in/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import * as jose from 'jose';
// import the function safely (make sure the path matches your project)
import { fetchUser } from '@/lib/neynar';

export const POST = async (req: NextRequest) => {
  try {
    const { fid, signature, message } = await req.json();

    if (!fid || !signature || !message) {
      return NextResponse.json({ error: 'bad payload' }, { status: 400 });
    }

    // Farcaster user data
    const user: any = await fetchUser(fid);
    if (!user || !user.custody_address) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 });
    }

    const address = user.custody_address as `0x${string}`;

    // Verify signature
    const isValidSignature = await verifyMessage({
      address,
      message,
      signature,
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Prepare JWT secret
    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      return NextResponse.json({ error: 'Missing JWT_SECRET' }, { status: 500 });
    }

    // Generate JWT token
    const secret = new TextEncoder().encode(secretKey);
    const token = await new jose.SignJWT({
      fid,
      walletAddress: address,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

    // Return response with cookie
    const res = NextResponse.json({ success: true, user });
    res.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });

    return res;
  } catch (e) {
    console.error('auth/sign-in error', e);
    return NextResponse.json({ error: 'server' }, { status: 500 });
  }
};
