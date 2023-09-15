export declare function generatePrivateKeyFile(privateKeyFilename: string, modulusLength: 1024 | 2048 | 3072 | 4096): Promise<void>;
/**
 * alternate function to generate PrivateKeyFile, using jsrsasign.
 *
 * This function is slower than generatePrivateKeyFile
 */
export declare function generatePrivateKeyFileAlternate(privateKeyFilename: string, modulusLength: 2048 | 3072 | 4096): Promise<void>;
