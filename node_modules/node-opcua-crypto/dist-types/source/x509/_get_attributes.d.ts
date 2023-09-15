import { CertificatePurpose } from "../common.js";
import { x509 } from "./_crypto.js";
export declare function getAttributes(purpose: CertificatePurpose): {
    nsComment: string;
    basicConstraints: x509.BasicConstraintsExtension;
    keyUsageExtension: x509.ExtendedKeyUsage[];
    usages: x509.KeyUsageFlags;
};
