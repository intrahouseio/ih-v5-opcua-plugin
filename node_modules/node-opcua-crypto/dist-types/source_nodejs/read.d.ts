/// <reference types="node" />
import { Certificate, CertificatePEM, PublicKey, PublicKeyPEM, PrivateKeyPEM, PrivateKey } from "../source/common.js";
/**
 * read a DER or PEM certificate from file
 */
export declare function readCertificate(filename: string): Certificate;
/**
 * read a DER or PEM certificate from file
 */
export declare function readPublicKey(filename: string): PublicKey;
export declare function makePrivateKeyThumbPrint(privateKey: PrivateKey): Buffer;
/**
 * read a DER or PEM certificate from file
 */
export declare function readPrivateKey(filename: string): PrivateKey;
export declare function readCertificatePEM(filename: string): CertificatePEM;
export declare function readPublicKeyPEM(filename: string): PublicKeyPEM;
/**
 *
 * @deprecated
 */
export declare function readPrivateKeyPEM(filename: string): PrivateKeyPEM;
export declare function setCertificateStore(store: string): string;
export declare function getCertificateStore(): string;
/**
 *
 * @param filename
 */
export declare function readPrivateRsaKey(filename: string): PrivateKey;
export declare function readPublicRsaKey(filename: string): PublicKey;
