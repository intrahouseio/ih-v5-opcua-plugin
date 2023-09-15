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
exports.createCertificateSigningRequestAsync = exports.createCertificateSigningRequest = void 0;
const assert = require("assert");
const async = require("async");
const fs = require("fs");
const subject_1 = require("../../misc/subject");
const common_1 = require("../common");
const common2_1 = require("../common2");
const display_1 = require("../display");
const execute_openssl_1 = require("./execute_openssl");
const _env_1 = require("./_env");
const toolbox_1 = require("./toolbox");
const util_1 = require("util");
const q = common_1.quote;
const n = common2_1.make_path;
/**
 * create a certificate signing request
 *
 * @param certificateSigningRequestFilename
 * @param params
 * @param callback
 */
function createCertificateSigningRequest(certificateSigningRequestFilename, params, callback) {
    assert(params);
    assert(params.rootDir);
    assert(params.configFile);
    assert(params.privateKey);
    assert(typeof params.privateKey === "string");
    assert(fs.existsSync(params.configFile), "config file must exist " + params.configFile);
    assert(fs.existsSync(params.privateKey), "Private key must exist" + params.privateKey);
    assert(fs.existsSync(params.rootDir), "RootDir key must exist");
    assert(typeof certificateSigningRequestFilename === "string");
    // note : this openssl command requires a config file
    (0, _env_1.processAltNames)(params);
    const configFile = (0, toolbox_1.generateStaticConfig)(params.configFile);
    const options = { cwd: params.rootDir, openssl_conf: configFile };
    const configOption = " -config " + q(n(configFile));
    const subject = params.subject ? new subject_1.Subject(params.subject).toString() : undefined;
    // process.env.OPENSSL_CONF  ="";
    const subjectOptions = subject ? ' -subj "' + subject + '"' : "";
    async.series([
        (callback) => {
            (0, display_1.displaySubtitle)("- Creating a Certificate Signing Request with openssl", callback);
        },
        (callback) => {
            (0, execute_openssl_1.execute_openssl)("req -new" +
                "  -sha256 " +
                " -batch " +
                " -text " +
                configOption +
                " -key " +
                q(n(params.privateKey)) +
                subjectOptions +
                " -out " +
                q(n(certificateSigningRequestFilename)), options, (err) => {
                callback(err ? err : undefined);
            });
        },
    ], (err) => callback(err));
}
exports.createCertificateSigningRequest = createCertificateSigningRequest;
exports.createCertificateSigningRequestAsync = (0, util_1.promisify)(createCertificateSigningRequest);
//# sourceMappingURL=create_certificate_signing_request.js.map