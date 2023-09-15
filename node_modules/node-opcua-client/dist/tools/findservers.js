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
exports.findServersOnNetwork = exports.findServers = void 0;
/**
 * @module node-opcua-client
 */
const async = __importStar(require("async"));
const client_base_impl_1 = require("../private/client_base_impl");
function findServers(discoveryServerEndpointUri, callback) {
    const client = new client_base_impl_1.ClientBaseImpl({ connectionStrategy: { maxRetry: 3 } });
    let servers = [];
    let endpoints = [];
    async.series([
        (innerCallback) => {
            client.connect(discoveryServerEndpointUri, innerCallback);
        },
        (innerCallback) => {
            client.findServers((err, _servers) => {
                if (_servers) {
                    servers = _servers;
                }
                innerCallback(err ? err : undefined);
            });
        },
        (innerCallback) => {
            client.getEndpoints({ endpointUrl: undefined }, (err, _endpoints) => {
                if (_endpoints) {
                    endpoints = _endpoints;
                }
                innerCallback(err ? err : undefined);
            });
        }
    ], (err) => {
        client.disconnect(() => {
            callback(err ? err : null, { servers, endpoints });
        });
    });
}
exports.findServers = findServers;
function findServersOnNetwork(discoveryServerEndpointUri, callback) {
    const client = new client_base_impl_1.ClientBaseImpl({ connectionStrategy: { maxRetry: 3 } });
    client.connect(discoveryServerEndpointUri, (err) => {
        if (!err) {
            client.findServersOnNetwork((err1, servers) => {
                client.disconnect(() => {
                    callback(err1, servers);
                });
            });
        }
        else {
            client.disconnect(() => {
                callback(err);
            });
        }
    });
}
exports.findServersOnNetwork = findServersOnNetwork;
// tslint:disable:no-var-requires
const thenify = require("thenify");
module.exports.findServersOnNetwork = thenify.withCallback(module.exports.findServersOnNetwork);
module.exports.findServers = thenify.withCallback(module.exports.findServers);
//# sourceMappingURL=findservers.js.map