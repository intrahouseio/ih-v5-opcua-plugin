/// <reference types="node" />
/// <reference types="node" />
import { KeyLike } from "crypto";
import { Certificate, CertificatePEM, DER, PEM, PublicKeyPEM, Signature, PrivateKey } from "./common.js";
export declare function identifyPemType(rawKey: Buffer | string): undefined | string;
export declare function removeTrailingLF(str: string): string;
export declare function toPem(raw_key: Buffer | string, pem: string): string;
export declare function convertPEMtoDER(raw_key: PEM): DER;
export declare function hexDump(buffer: Buffer, width?: number): string;
interface MakeMessageChunkSignatureOptions {
    signatureLength: number;
    algorithm: string;
    privateKey: PrivateKey;
}
export declare function makeMessageChunkSignature(chunk: Buffer, options: MakeMessageChunkSignatureOptions): Buffer;
export interface VerifyMessageChunkSignatureOptions {
    signatureLength?: number;
    algorithm: string;
    publicKey: PublicKeyPEM;
}
/**
 * @method verifyMessageChunkSignature
 *
 *     const signer = {
 *           signatureLength : 128,
 *           algorithm : "RSA-SHA256",
 *           publicKey: "qsdqsdqsd"
 *     };
 * @param blockToVerify
 * @param signature
 * @param options
 * @param options.signatureLength
 * @param options.algorithm    for example "RSA-SHA256"
 * @param options.publicKey
 * @return true if the signature is valid
 */
export declare function verifyMessageChunkSignature(blockToVerify: Buffer, signature: Signature, options: VerifyMessageChunkSignatureOptions): boolean;
export declare function makeSHA1Thumbprint(buffer: Buffer): Signature;
export declare const RSA_PKCS1_OAEP_PADDING: number;
export declare const RSA_PKCS1_PADDING: number;
export declare enum PaddingAlgorithm {
    RSA_PKCS1_OAEP_PADDING = 4,
    RSA_PKCS1_PADDING = 1
}
export declare function publicEncrypt_native(buffer: Buffer, publicKey: KeyLike, algorithm?: PaddingAlgorithm): Buffer;
export declare function privateDecrypt_native(buffer: Buffer, privateKey: PrivateKey, algorithm?: PaddingAlgorithm): Buffer;
export declare const publicEncrypt: typeof publicEncrypt_native;
export declare const privateDecrypt: typeof privateDecrypt_native;
export declare function publicEncrypt_long(buffer: Buffer, publicKey: KeyLike, blockSize: number, padding: number, paddingAlgorithm?: PaddingAlgorithm): Buffer;
export declare function privateDecrypt_long(buffer: Buffer, privateKey: PrivateKey, blockSize: number, paddingAlgorithm?: number): Buffer;
export declare function coerceCertificatePem(certificate: Certificate | CertificatePEM): CertificatePEM;
export declare function extractPublicKeyFromCertificateSync(certificate: Certificate | CertificatePEM): PublicKeyPEM;
/**
 * extract the publickey from a certificate
 * @async
 */
export declare function extractPublicKeyFromCertificate(certificate: CertificatePEM | Certificate, callback: (err: Error | null, publicKeyPEM?: PublicKeyPEM) => void): void;
export {};
