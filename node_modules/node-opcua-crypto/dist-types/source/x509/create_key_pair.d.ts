export declare function generateKeyPair(modulusLength?: 1024 | 2048 | 3072 | 4096): Promise<CryptoKeyPair>;
/**
 *  generate a pair of private/public keys of length 1024,2048, 3072, or 4096 bits
 */
export declare function generatePrivateKey(modulusLength?: 1024 | 2048 | 3072 | 4096): Promise<CryptoKey>;
/**
 *  convert  a CryptoKey to a PEM string
 */
export declare function privateKeyToPEM(privateKey: CryptoKey): Promise<{
    privPem: string;
    privDer: ArrayBuffer;
}>;
export declare function derToPrivateKey(privDer: ArrayBuffer): Promise<CryptoKey>;
export declare function pemToPrivateKey(pem: string): Promise<CryptoKey>;
