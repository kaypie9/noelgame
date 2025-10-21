import { NextResponse } from 'next/server';
import minikitConfig from '../../../minikit.config';

export async function GET() {
  return NextResponse.json({
    accountAssociation: minikitConfig.accountAssociation,
    miniapp: minikitConfig.miniapp
  });
}
