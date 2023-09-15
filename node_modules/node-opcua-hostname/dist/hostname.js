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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveFullyQualifiedDomainName = exports.getHostname = exports.getFullyQualifiedDomainName = exports.prepareFQDN = exports.extractFullyQualifiedDomainName = void 0;
/**
 * @module node-opcua-hostname
 */
const dns = __importStar(require("dns"));
const os = __importStar(require("os"));
const util_1 = require("util");
function trim(str, length) {
    if (!length) {
        return str;
    }
    return str.substring(0, Math.min(str.length, length));
}
function fqdn(callback) {
    const uqdn = os.hostname();
    dns.lookup(uqdn, { hints: dns.ADDRCONFIG }, (err1, ip) => {
        if (err1) {
            return callback(err1);
        }
        dns.lookupService(ip, 0, (err2, _fqdn) => {
            if (err2) {
                return callback(err2);
            }
            _fqdn = _fqdn.replace(".localdomain", "");
            callback(null, _fqdn);
        });
    });
}
let _fullyQualifiedDomainNameInCache;
/**
 * extract FullyQualifiedDomainName of this computer
 */
function extractFullyQualifiedDomainName() {
    return __awaiter(this, void 0, void 0, function* () {
        if (_fullyQualifiedDomainNameInCache) {
            return _fullyQualifiedDomainNameInCache;
        }
        if (process.platform === "win32") {
            // http://serverfault.com/a/73643/251863
            const env = process.env;
            _fullyQualifiedDomainNameInCache =
                env.COMPUTERNAME + (env.USERDNSDOMAIN && env.USERDNSDOMAIN.length > 0 ? "." + env.USERDNSDOMAIN : "");
        }
        else {
            try {
                _fullyQualifiedDomainNameInCache = yield (0, util_1.promisify)(fqdn)();
                if (_fullyQualifiedDomainNameInCache === "localhost") {
                    throw new Error("localhost not expected");
                }
                if (/sethostname/.test(_fullyQualifiedDomainNameInCache)) {
                    throw new Error("Detecting fqdn  on windows !!!");
                }
            }
            catch (err) {
                // fall back to old method
                _fullyQualifiedDomainNameInCache = os.hostname();
            }
        }
        return _fullyQualifiedDomainNameInCache;
    });
}
exports.extractFullyQualifiedDomainName = extractFullyQualifiedDomainName;
function prepareFQDN() {
    return __awaiter(this, void 0, void 0, function* () {
        _fullyQualifiedDomainNameInCache = yield extractFullyQualifiedDomainName();
    });
}
exports.prepareFQDN = prepareFQDN;
function getFullyQualifiedDomainName(optional_max_length) {
    if (!_fullyQualifiedDomainNameInCache) {
        throw new Error("FullyQualifiedDomainName computation is not completed yet");
    }
    return _fullyQualifiedDomainNameInCache ? trim(_fullyQualifiedDomainNameInCache, optional_max_length) : "%FQDN%";
}
exports.getFullyQualifiedDomainName = getFullyQualifiedDomainName;
function getHostname() {
    return os.hostname();
}
exports.getHostname = getHostname;
function resolveFullyQualifiedDomainName(str) {
    if (!_fullyQualifiedDomainNameInCache) {
        throw new Error("FullyQualifiedDomainName computation is not completed yet");
    }
    str = str.replace("%FQDN%", _fullyQualifiedDomainNameInCache);
    str = str.replace("{FQDN}", _fullyQualifiedDomainNameInCache);
    str = str.replace("{hostname}", getHostname());
    return str;
}
exports.resolveFullyQualifiedDomainName = resolveFullyQualifiedDomainName;
// note : under windows ... echo %COMPUTERNAME%.%USERDNSDOMAIN%
prepareFQDN();
//# sourceMappingURL=hostname.js.map