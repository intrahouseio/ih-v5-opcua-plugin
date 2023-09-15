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
exports.Xml2JsonFs = void 0;
const fs = __importStar(require("fs"));
const xml2json_1 = require("../xml2json");
class Xml2JsonFs extends xml2json_1.Xml2Json {
    parse(xmlFile, callback) {
        if (!callback) {
            throw new Error("internal error");
        }
        const readWholeFile = true;
        if (readWholeFile) {
            // slightly faster but require more memory ..
            fs.readFile(xmlFile, (err, data) => {
                if (err) {
                    return callback(err);
                }
                if (data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
                    data = data.subarray(3);
                }
                const dataAsString = data.toString();
                const parser = this._prepareParser(callback);
                parser.write(dataAsString);
                parser.end();
            });
        }
        else {
            const Bomstrip = require("bomstrip");
            const parser = this._prepareParser(callback);
            fs.createReadStream(xmlFile, { autoClose: true, encoding: "utf8" }).pipe(new Bomstrip()).pipe(parser);
        }
    }
}
exports.Xml2JsonFs = Xml2JsonFs;
// tslint:disable:no-var-requires
const thenify = require("thenify");
const opts = { multiArgs: false };
Xml2JsonFs.prototype.parse = thenify.withCallback(Xml2JsonFs.prototype.parse, opts);
//# sourceMappingURL=xml2json_fs.js.map