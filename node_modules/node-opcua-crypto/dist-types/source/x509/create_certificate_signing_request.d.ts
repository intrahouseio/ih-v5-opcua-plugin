import { CertificatePurpose } from "../common.js";
import { x509 } from "./_crypto.js";
interface CreateCertificateSigningRequestOptions {
    privateKey: CryptoKey;
    notBefore?: Date;
    notAfter?: Date;
    validity?: number;
    subject?: string;
    dns?: string[];
    ip?: string[];
    applicationUri?: string;
    purpose: CertificatePurpose;
}
export declare function createCertificateSigningRequest({ privateKey, subject, dns, ip, applicationUri, purpose, }: CreateCertificateSigningRequestOptions): Promise<{
    csr: string;
    der: x509.Pkcs10CertificateRequest;
}>;
export {};
