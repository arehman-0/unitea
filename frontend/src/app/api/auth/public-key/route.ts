import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import NodeRSA from 'node-rsa';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Check for existing active key
    const { data: existingKey } = await supabase
      .from('server_keys')
      .select('n, e')
      .eq('is_active', true)
      .single();

    if (existingKey) {
      return NextResponse.json({
        success: true,
        publicKey: {
          n: existingKey.n,
          e: existingKey.e,
        },
      });
    }

    // Generate new keypair
    const key = new NodeRSA({ b: 2048 });

    // Access key components via internal property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyPair = (key as any).keyPair;

    const keyData = {
      private_key: key.exportKey('pkcs1-private-pem'),
      public_key: key.exportKey('pkcs1-public-pem'),
      n: keyPair.n.toString(16),
      e: keyPair.e.toString(16),
      is_active: true,
    };

    const { error } = await supabase.from('server_keys').insert(keyData);

    if (error) {
      console.error('Error storing keys:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      publicKey: {
        n: keyData.n,
        e: keyData.e,
      },
    });
  } catch (error) {
    console.error('Public key error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
