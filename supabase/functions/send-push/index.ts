import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Base64 URL encode fonksiyonu
function base64UrlEncode(str: string): string {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));

    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Private key'i düzelt (\\\\n -> \n)
function fixPrivateKey(pem: string): string {
    return pem.replace(/\\\\\\\\n/g, '\n');
}

// PEM'den RSA private key oluştur (DÜZELTİLDİ - algoritma ismi)
async function getPrivateKeyFromPEM(pem: string): Promise<CryptoKey> {
    try {
        // Önce private key'i düzelt
        const fixedPem = fixPrivateKey(pem);

        // PEM formatını temizle
        const pemContents = fixedPem
            .replace(/-----BEGIN PRIVATE KEY-----/g, '')
            .replace(/-----END PRIVATE KEY-----/g, '')
            .replace(/\n/g, '')
            .replace(/\r/g, '')
            .replace(/\s/g, '')
            .trim();

        console.log('Fixed PEM length:', fixedPem.length);
        console.log('Cleaned PEM length:', pemContents.length);

        // Base64 decode
        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

        // RSA private key import et (ALGORİTMA İSMİ DÜZELTİLDİ)
        const key = await crypto.subtle.importKey(
            "pkcs8",
            binaryDer,
            {
                name: "RSASSA-PKCS1-v1_5",  // DÜZELTİLDİ: - yerine _
                hash: { name: "SHA-256" },
            },
            true,
            ["sign"]
        );

        console.log('✓ Private key imported successfully');
        return key;
    } catch (error) {
        console.error('Private key import error:', error);
        throw new Error(`Failed to import private key: ${error.message}`);
    }
}

// JWT oluştur
async function createJWT(serviceAccount: any): Promise<string> {
    const header = {
        alg: "RS256",
        typ: "JWT",
        kid: serviceAccount.private_key_id
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: serviceAccount.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        exp: now + 3600,
        iat: now
    };

    // Header ve payload'ı base64url encode et
    const headerB64 = base64UrlEncode(JSON.stringify(header));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));

    const unsignedToken = `${headerB64}.${payloadB64}`;
    console.log('Unsigned JWT created, length:', unsignedToken.length);

    // Sign (ALGORİTMA İSMİ DÜZELTİLDİ)
    const privateKey = await getPrivateKeyFromPEM(serviceAccount.private_key);
    const signature = await crypto.subtle.sign(
        { name: "RSASSA-PKCS1-v1_5" },  // DÜZELTİLDİ: - yerine _
        privateKey,
        new TextEncoder().encode(unsignedToken)
    );

    // Signature'ı base64url encode et
    const signatureArray = new Uint8Array(signature);
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const jwt = `${unsignedToken}.${signatureBase64}`;
    console.log('✓ JWT created, total length:', jwt.length);

    return jwt;
}

// Google OAuth token al
async function getGoogleAccessToken(serviceAccount: any): Promise<string> {
    try {
        console.log('[1/3] JWT oluşturuluyor...');
        const jwt = await createJWT(serviceAccount);

        console.log('[2/3] Google OAuth token isteniyor...');
        const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: new URLSearchParams({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: jwt,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Google OAuth Error:', response.status, errorText.substring(0, 200));
            throw new Error(`Google OAuth Failed: ${response.status}`);
        }

        const data = await response.json();
        console.log('[3/3] ✓ Access token alındı');

        return data.access_token;
    } catch (error) {
        console.error('❌ Google Access Token alma hatası:', error);
        throw error;
    }
}

// FCM V1 API ile gönder
async function sendViaFCMv1(token: string, title: string, body: string, data: any, accessToken: string, projectId: string) {
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    console.log('🚀 FCM V1 API isteği gönderiliyor...');
    console.log('Token (ilk 50):', token.substring(0, 50) + '...');

    const payload = {
        message: {
            token: token,
            notification: {
                title: title,
                body: body,
            },
            android: {
                priority: "HIGH",
                notification: {
                    channel_id: "default",
                    sound: "default",
                }
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                        badge: 1,
                    }
                }
            },
            data: data || {},
        }
    };

    console.log('Payload hazır, projectId:', projectId);

    const response = await fetch(fcmUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(payload),
    });

    const result = await response.json();

    console.log('FCM Response status:', response.status);
    console.log('FCM Response ok:', response.ok);

    if (!response.ok) {
        console.error('❌ FCM Error Details:', JSON.stringify(result, null, 2));
        throw new Error(`FCM Error: ${JSON.stringify(result.error || result)}`);
    }

    console.log('✅ FCM Success, messageId:', result.name);
    return result;
}

// Main handler
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log('\n=== FCM PUSH ===');

        const { targetUserId, title, body, data } = await req.json();
        console.log(`Target: ${targetUserId}, Title: "${title}"`);

        // Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Kullanıcı
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('expo_push_token, username')
            .eq('id', targetUserId)
            .single();

        if (userError || !user) {
            console.error('User error:', userError?.message);
            throw new Error('User not found');
        }

        console.log(`User: ${user.username}, Token: ${user.expo_push_token?.substring(0, 50) || 'NO_TOKEN'}...`);

        if (!user.expo_push_token) {
            throw new Error('No push token for user');
        }

        // Service Account
        const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
        if (!serviceAccountJson) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT missing');
        }

        // JSON parse
        let serviceAccount = JSON.parse(serviceAccountJson);

        // Private key'i düzelt
        if (serviceAccount.private_key.includes('\\\\n')) {
            console.log('⚠️ Private key contains \\\\n, fixing...');
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\\\\\\\n/g, '\n');
        }

        console.log(`Service Account Project: ${serviceAccount.project_id}`);

        // Access token al
        const accessToken = await getGoogleAccessToken(serviceAccount);
        console.log('✓ Access token ready, length:', accessToken.length);

        // FCM gönder
        const result = await sendViaFCMv1(
            user.expo_push_token,
            title,
            body,
            data || {},
            accessToken,
            serviceAccount.project_id
        );

        console.log('✅ PUSH SENT SUCCESSFULLY');

        return new Response(JSON.stringify({
            success: true,
            messageId: result.name,
            details: result
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('💥 ERROR:', error.message);
        console.error('Stack:', error.stack);

        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
})