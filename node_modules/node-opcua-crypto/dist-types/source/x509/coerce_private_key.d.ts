/// <reference types="node" />
import { PrivateKey, KeyObject } from "../common.js";
export declare function coercePEMorDerToPrivateKey(privateKeyInDerOrPem: string | Buffer): PrivateKey;
/**
 *
 * @private
 */
export declare function _coercePrivateKey(privateKey: any): Promise<KeyObject>;
