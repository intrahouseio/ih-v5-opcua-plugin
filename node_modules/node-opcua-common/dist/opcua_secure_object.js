"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPCUASecureObject = void 0;
/**
 * @module node-opcua-common
 */
const events_1 = require("events");
const fs = __importStar(require("fs"));
const node_opcua_assert_1 = require("node-opcua-assert");
const node_opcua_crypto_1 = require("node-opcua-crypto");
function _load_certificate(certificateFilename) {
    const der = (0, node_opcua_crypto_1.readCertificate)(certificateFilename);
    return der;
}
function _load_private_key(privateKeyFilename) {
    return (0, node_opcua_crypto_1.readPrivateKey)(privateKeyFilename);
}
/**
 * an object that provides a certificate and a privateKey
 * @class OPCUASecureObject
 * @param options
 * @param options.certificateFile {string}
 * @param options.privateKeyFile {string}
 * @constructor
 */
class OPCUASecureObject extends events_1.EventEmitter {
    constructor(options) {
        super();
        (0, node_opcua_assert_1.assert)(typeof options.certificateFile === "string");
        (0, node_opcua_assert_1.assert)(typeof options.privateKeyFile === "string");
        this.certificateFile = options.certificateFile || "invalid certificate file";
        this.privateKeyFile = options.privateKeyFile || "invalid private key file";
    }
    getCertificate() {
        const priv = this;
        if (!priv.$$certificate) {
            const certChain = this.getCertificateChain();
            priv.$$certificate = (0, node_opcua_crypto_1.split_der)(certChain)[0];
        }
        return priv.$$certificate;
    }
    getCertificateChain() {
        const priv = this;
        if (!priv.$$certificateChain) {
            (0, node_opcua_assert_1.assert)(fs.existsSync(this.certificateFile), "Certificate file must exist :" + this.certificateFile);
            priv.$$certificateChain = _load_certificate(this.certificateFile);
            if (priv.$$certificateChain && priv.$$certificateChain.length === 0) {
                priv.$$certificateChain = _load_certificate(this.certificateFile);
                throw new Error("Invalid certificate length = 0 " + this.certificateFile);
            }
        }
        return priv.$$certificateChain;
    }
    getPrivateKey() {
        const priv = this;
        if (!priv.$$privateKey) {
            (0, node_opcua_assert_1.assert)(fs.existsSync(this.privateKeyFile), "private file must exist :" + this.privateKeyFile);
            priv.$$privateKey = _load_private_key(this.privateKeyFile);
        }
        (0, node_opcua_assert_1.assert)(!(priv.$$privateKey instanceof Buffer), "should not be a buffer");
        return priv.$$privateKey;
    }
}
exports.OPCUASecureObject = OPCUASecureObject;
//# sourceMappingURL=opcua_secure_object.js.map