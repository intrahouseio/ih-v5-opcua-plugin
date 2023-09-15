/// <reference types="node" />
/// <reference types="node" />
import __crypto from "crypto";
export declare const createPrivateKeyFromNodeJSCrypto: typeof __crypto.createPrivateKey;
type KeyFormat = "pem" | "der" | "jwk";
type KeyObjectType = "secret" | "public" | "private";
interface KeyExportOptions<T extends KeyFormat> {
    type: "pkcs1" | "spki" | "pkcs8" | "sec1";
    format: T;
    cipher?: string | undefined;
    passphrase?: string | Buffer | undefined;
}
interface JwkKeyExportOptions {
    format: "jwk";
}
export interface KeyObject {
    export(options: KeyExportOptions<"pem">): string | Buffer;
    export(options: KeyExportOptions<"der">): Buffer;
    export(options: JwkKeyExportOptions): JsonWebKey;
    type: KeyObjectType;
}
export declare function isKeyObject(mayBeKeyObject: any): boolean;
export type PrivateKey = {
    hidden: string;
} | {
    hidden: KeyObject;
};
export type PublicKey = KeyObject;
export type Nonce = Buffer;
export type PEM = string;
export type DER = Buffer;
export type Certificate = DER;
export type CertificatePEM = PEM;
export type PrivateKeyPEM = PEM;
export type PublicKeyPEM = PEM;
export type Signature = Buffer;
export type CertificateRevocationList = Buffer;
export declare enum CertificatePurpose {
    NotSpecified = 0,
    ForCertificateAuthority = 1,
    ForApplication = 2,
    ForUserAuthentication = 3
}
export {};
