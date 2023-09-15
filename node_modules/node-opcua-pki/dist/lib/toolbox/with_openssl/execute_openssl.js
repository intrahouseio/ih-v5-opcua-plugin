"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
// ---------------------------------------------------------------------------------------------------------------------
// node-opcua-pki
// ---------------------------------------------------------------------------------------------------------------------
// Copyright (c) 2014-2022 - Etienne Rossignon - etienne.rossignon (at) gadz.org
// Copyright (c) 2022-2023 - Sterfive.com
// ---------------------------------------------------------------------------------------------------------------------
//
// This  project is licensed under the terms of the MIT license.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
// documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so,  subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
// Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// ---------------------------------------------------------------------------------------------------------------------
// tslint:disable:no-console
// tslint:disable:no-shadowed-variable
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute_openssl = exports.execute_openssl_no_failure = exports.executeOpensslAsync = exports.ensure_openssl_installed = exports.find_openssl = exports.execute = void 0;
const assert = require("assert");
const byline = require("byline");
const chalk = require("chalk");
const child_process = require("child_process");
const fs = require("fs");
const os = require("os");
const install_prerequisite_1 = require("./install_prerequisite");
const common_1 = require("../common");
const config_1 = require("../config");
const debug_1 = require("../debug");
const _env_1 = require("./_env");
const common2_1 = require("../common2");
// tslint:disable-next-line:variable-name
let opensslPath; // not initialized
const n = common2_1.make_path;
function execute(cmd, options, callback) {
    assert(typeof callback === "function");
    const from = new Error();
    /// assert(g_config.CARootDir && fs.existsSync(option.CARootDir));
    options.cwd = options.cwd || process.cwd();
    // istanbul ignore next
    if (!config_1.g_config.silent) {
        (0, debug_1.warningLog)(chalk.cyan("                  CWD         "), options.cwd);
    }
    const outputs = [];
    const child = child_process.exec(cmd, {
        cwd: options.cwd,
        windowsHide: true,
    }, (err) => {
        // istanbul ignore next
        if (err) {
            if (!options.hideErrorMessage) {
                const fence = "###########################################";
                console.error(chalk.bgWhiteBright.redBright(`${fence} OPENSSL ERROR ${fence}`));
                console.error(chalk.bgWhiteBright.redBright("CWD = " + options.cwd));
                console.error(chalk.bgWhiteBright.redBright(err.message));
                console.error(chalk.bgWhiteBright.redBright(`${fence} OPENSSL ERROR ${fence}`));
                console.error(from.stack);
            }
            callback(new Error(err.message));
            return;
        }
        callback(null, outputs.join(""));
    });
    if (child.stdout) {
        const stream2 = byline(child.stdout);
        stream2.on("data", (line) => {
            outputs.push(line + "\n");
        });
        if (!config_1.g_config.silent) {
            stream2.on("data", (line) => {
                line = line.toString();
                if (debug_1.doDebug) {
                    process.stdout.write(chalk.white("        stdout ") + chalk.whiteBright(line) + "\n");
                }
            });
        }
    }
    // istanbul ignore next
    if (!config_1.g_config.silent) {
        if (child.stderr) {
            const stream1 = byline(child.stderr);
            stream1.on("data", (line) => {
                line = line.toString();
                if (debug_1.displayError) {
                    process.stdout.write(chalk.white("        stderr ") + chalk.red(line) + "\n");
                }
            });
        }
    }
}
exports.execute = execute;
function find_openssl(callback) {
    (0, install_prerequisite_1.get_openssl_exec_path)((err, _opensslPath) => {
        opensslPath = _opensslPath;
        callback(err, opensslPath);
    });
}
exports.find_openssl = find_openssl;
function ensure_openssl_installed(callback) {
    assert(typeof callback === "function");
    if (!opensslPath) {
        return find_openssl((err) => {
            // istanbul ignore next
            if (err) {
                return callback(err);
            }
            execute_openssl("version", { cwd: "." }, (err, outputs) => {
                // istanbul ignore next
                if (err || !outputs) {
                    return callback(err || new Error("no outputs"));
                }
                config_1.g_config.opensslVersion = outputs.trim();
                if (debug_1.doDebug) {
                    (0, debug_1.warningLog)("OpenSSL version : ", config_1.g_config.opensslVersion);
                }
                callback(err ? err : undefined);
            });
        });
    }
    else {
        return callback();
    }
}
exports.ensure_openssl_installed = ensure_openssl_installed;
function executeOpensslAsync(cmd, options) {
    return new Promise((resolve, reject) => {
        execute_openssl(cmd, options, (err, output) => {
            // istanbul ignore next
            if (err) {
                reject(err);
            }
            else {
                resolve(output || "");
            }
        });
    });
}
exports.executeOpensslAsync = executeOpensslAsync;
function execute_openssl_no_failure(cmd, options, callback) {
    options = options || {};
    options.hideErrorMessage = true;
    execute_openssl(cmd, options, (err, output) => {
        // istanbul ignore next
        if (err) {
            (0, debug_1.debugLog)(" (ignored error =  ERROR : )", err.message);
        }
        callback(null, output);
    });
}
exports.execute_openssl_no_failure = execute_openssl_no_failure;
function getTempFolder() {
    return os.tmpdir();
}
function execute_openssl(cmd, options, callback) {
    // tslint:disable-next-line:variable-name
    const empty_config_file = n(getTempFolder(), "empty_config.cnf");
    if (!fs.existsSync(empty_config_file)) {
        fs.writeFileSync(empty_config_file, "# empty config file");
    }
    assert(typeof callback === "function");
    options = options || {};
    options.openssl_conf = options.openssl_conf || empty_config_file; // "!! OPEN SLL CONF NOT DEFINED BAD FILE !!";
    assert(options.openssl_conf);
    (0, _env_1.setEnv)("OPENSSL_CONF", options.openssl_conf);
    // istanbul ignore next
    if (!config_1.g_config.silent) {
        (0, debug_1.warningLog)(chalk.cyan("                  OPENSSL_CONF"), process.env.OPENSSL_CONF);
        (0, debug_1.warningLog)(chalk.cyan("                  RANDFILE    "), process.env.RANDFILE);
        (0, debug_1.warningLog)(chalk.cyan("                  CMD         openssl "), chalk.cyanBright(cmd));
    }
    ensure_openssl_installed((err) => {
        // istanbul ignore next
        if (err) {
            return callback(err);
        }
        execute((0, common_1.quote)(opensslPath) + " " + cmd, options, callback);
    });
}
exports.execute_openssl = execute_openssl;
//# sourceMappingURL=execute_openssl.js.map