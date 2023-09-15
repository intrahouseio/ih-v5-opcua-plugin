/// <reference types="node" />
import { KeyObject } from "./common.js";
import { PublicKey, PublicKeyPEM, PrivateKeyPEM, PrivateKey } from "./common.js";
/***
 * @method rsaLengthPrivateKey
 * A very expensive way to determine the rsa key length ( i.e 2048bits or 1024bits)
 * @param key  a PEM public key or a PEM rsa private key
 * @return the key length in bytes.
 */
export declare function rsaLengthPrivateKey(key: PrivateKey): number;
/**
 * @method toPem2
 * @param raw_key
 * @param pem
 *
 *
 * @return a PEM string containing the Private Key
 *
 * Note:  a Pem key can be converted back to a private key object using coercePrivateKey
 *
 */
export declare function toPem2(raw_key: Buffer | string | KeyObject | PrivateKey, pem: string): string;
export declare function coercePrivateKeyPem(privateKey: PrivateKey): PrivateKeyPEM;
export declare function coercePublicKeyPem(publicKey: PublicKey | PublicKeyPEM): PublicKeyPEM;
export declare function coerceRsaPublicKeyPem(publicKey: PublicKey | KeyObject | PublicKeyPEM): PublicKeyPEM;
export declare function rsaLengthPublicKey(key: PublicKeyPEM | PublicKey): number;
export declare function rsaLengthRsaPublicKey(key: PublicKeyPEM | PublicKey): number;
