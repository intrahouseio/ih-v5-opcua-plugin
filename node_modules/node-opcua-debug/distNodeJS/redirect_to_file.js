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
exports.redirectToFile = void 0;
/**
 * @module node-opcua-debug
 */
// tslint:disable:no-console
// tslint:disable:ban-types
const fs = __importStar(require("fs"));
const util_1 = require("util");
const node_opcua_assert_1 = require("node-opcua-assert");
const get_temp_filename_1 = require("./get_temp_filename");
/**
 * @method redirectToFile
 * @param tmpFile {String} log file name to redirect console output.
 * @param actionFct  the inner function to execute
 * @param callback
 */
function redirectToFile(tmpFile, actionFct, callback) {
    let oldConsoleLog;
    (0, node_opcua_assert_1.assert)(typeof actionFct === "function");
    (0, node_opcua_assert_1.assert)(!callback || typeof callback === "function");
    const isAsync = actionFct && actionFct.length;
    const logFile = (0, get_temp_filename_1.getTempFilename)(tmpFile);
    // xx    console.log(" log_file ",log_file);
    const f = fs.createWriteStream(logFile, { flags: "w", encoding: "utf-8" });
    function _write_to_file(...args) {
        const msg = util_1.format.call(null, ...args);
        f.write(msg + "\n");
        if (typeof process === "object" && process.env.DEBUG) {
            oldConsoleLog.call(console, msg);
        }
    }
    if (!isAsync) {
        oldConsoleLog = console.log;
        console.log = _write_to_file;
        // async version
        try {
            actionFct();
            f.end(callback);
        }
        catch (err) {
            console.log = oldConsoleLog;
            console.log(" log file = ", logFile);
            console.log("redirectToFile  has intercepted an error :", err);
            // we don't want the callback anymore since we got an error
            // display file on screen  for investigation
            console.log(fs.readFileSync(logFile).toString("utf-8"));
            f.end(() => {
                if (callback) {
                    callback(err);
                }
            });
        }
        finally {
            console.log = oldConsoleLog;
        }
    }
    else {
        oldConsoleLog = console.log;
        console.log = _write_to_file;
        // async version
        actionFct((err) => {
            (0, node_opcua_assert_1.assert)(typeof callback === "function");
            console.log = oldConsoleLog;
            if (err) {
                console.log("redirectToFile  has intercepted an error");
                throw err;
            }
            f.end(callback);
        });
    }
}
exports.redirectToFile = redirectToFile;
//# sourceMappingURL=redirect_to_file.js.map