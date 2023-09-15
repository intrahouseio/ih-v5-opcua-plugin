import { CertificatePurpose } from "../common.js";
import { x509 } from "./_crypto.js";
export interface CreateSelfSignCertificateOptions {
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
/**
 *
 * construct a self-signed certificate
 */
export declare function createSelfSignedCertificate({ privateKey, notAfter, notBefore, validity, subject, dns, ip, applicationUri, purpose, }: CreateSelfSignCertificateOptions): Promise<{
    cert: string;
    der: x509.X509Certificate;
}>;
