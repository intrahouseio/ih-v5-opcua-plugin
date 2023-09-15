/// <reference types="node" />
import { BlockInfo } from "./asn1.js";
import { BasicConstraints, X509KeyUsage } from "./crypto_explore_certificate.js";
export interface ExtensionRequest {
    basicConstraints: BasicConstraints;
    keyUsage: X509KeyUsage;
    subjectAltName: any;
}
export interface CertificateSigningRequestInfo {
    extensionRequest: ExtensionRequest;
}
export declare function readCertificationRequestInfo(buffer: Buffer, block: BlockInfo): CertificateSigningRequestInfo;
export declare function exploreCertificateSigningRequest(crl: Buffer): CertificateSigningRequestInfo;
